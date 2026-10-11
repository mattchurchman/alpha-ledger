import Decimal from 'decimal.js'
import {
  sharesOn,
  splitAdjustTransactions,
  splitFactorAfter,
  type TickerHoldings,
} from './holdings'
import type { PriceHistory } from './prices/types'
import type { TickerAlias, Transaction } from './types'

/**
 * Closing out a company that is gone, and spotting the ones that look it (task 18).
 *
 * The lists already filter to tickers with shares above zero, so a bought-out company keeps
 * showing as a holding for one reason only: the ledger never recorded the exit. M1 pays a
 * buyout out as cash, and the parser drops cash rows, so nothing ever removed the shares.
 * The fix is therefore to **record the exit**, not to filter harder - everything here builds
 * the transaction that does that, and nothing here removes a row or hides one by itself.
 *
 * Pure, like the rest of the engine: prices and transactions come in through the argument.
 */

/** A ticker with no shares left: fully exited, so nothing about it is a live decision. */
export function isClosedPosition(holding: Pick<TickerHoldings, 'shares'>): boolean {
  return new Decimal(holding.shares).isZero()
}

/** Every fully exited ticker, in the order they were given. */
export function closedTickers(byTicker: readonly Pick<TickerHoldings, 'ticker' | 'shares'>[]) {
  return byTicker.filter(isClosedPosition).map((holding) => holding.ticker)
}

/** Whether a decimal string is a usable, finite, non-negative amount. */
function positiveAmount(value: string): Decimal | null {
  if (!/^\d+(\.\d+)?$/.test(value.trim())) return null
  const amount = new Decimal(value.trim())
  return amount.isPositive() && !amount.isZero() ? amount : null
}

/** How the cash figure the user typed should be read. */
export type CashBasis = 'total' | 'perShare'

export interface CloseOutInput {
  transactions: readonly Transaction[]
  /** Keyed by the ticker after alias resolution, exactly as `analyze` takes it. */
  prices: Record<string, PriceHistory>
  aliases?: TickerAlias[]
  /** The ticker as the analysis reports it - already resolved through any alias. */
  ticker: string
  /** The day the buyout settled. */
  date: string
  /** Cash received, as typed. */
  cash: string
  cashBasis: CashBasis
}

export interface CloseOutSell {
  ticker: string
  trade_date: string
  /**
   * Share count for the transaction row, in the share terms of `trade_date` itself - the
   * number of shares that really existed that day, which is what a `sell` row carries.
   */
  shares: string
  /** Total cash received, always positive (SPEC section 3). */
  amount_usd: string
  /** Shares held on `trade_date`, restated in today's split terms - what the screens show. */
  sharesHeldToday: string
  /** The implied price per share, for the sheet to read back before anything is written. */
  perShare: string
}

export type CloseOutPlan = { ok: true; sell: CloseOutSell } | { ok: false; reason: string }

/**
 * The one `sell` that closes a bought-out position: every share held on `date`, for the cash
 * that arrived. Two details make it land on exactly zero shares rather than a rounding crumb:
 *
 * - `sharesOn` counts in **today's** split terms, while a transaction row carries the shares
 *   that existed on its own trade date - so the count is divided back by every split after
 *   `date` (`splitFactorAfter`), which the engine will then re-apply when it reads the row.
 * - A per-share figure is multiplied by that same trade-date share count, because a price
 *   quoted per share in a buyout is per share as it existed then.
 *
 * The derived total is rounded to the cent, since it stands for money that actually moved; a
 * total typed directly is stored exactly as typed.
 */
export function closeOutPlan(input: CloseOutInput): CloseOutPlan {
  const { transactions, prices, aliases = [], ticker, date, cash, cashBasis } = input

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, reason: 'Enter the date it settled.' }

  const adjusted = splitAdjustTransactions([...transactions], prices, aliases)
  const held = sharesOn(adjusted, date).get(ticker) ?? new Decimal(0)
  if (!held.isPositive() || held.isZero()) {
    return {
      ok: false,
      reason: `No ${ticker} shares were held on ${date}, so there is nothing to close out on that date.`,
    }
  }

  const amount = positiveAmount(cash)
  if (amount === null) return { ok: false, reason: 'Enter the cash received as a positive number.' }

  const factor = splitFactorAfter(date, prices[ticker]?.splits ?? [])
  const sharesThen = held.div(factor)
  const total = cashBasis === 'total' ? amount : sharesThen.times(amount).toDecimalPlaces(2)

  return {
    ok: true,
    sell: {
      ticker,
      trade_date: date,
      shares: sharesThen.toFixed(),
      amount_usd: total.toFixed(),
      sharesHeldToday: held.toFixed(),
      perShare: total.div(sharesThen).toFixed(),
    },
  }
}

export interface ExchangeInput {
  transactions: readonly Transaction[]
  prices: Record<string, PriceHistory>
  aliases?: TickerAlias[]
  /** The ticker as the analysis reports it today. */
  from: string
  /** What it became. */
  to: string
  effectiveDate: string
  /** New shares per old share. `1` for a straight rename. */
  ratio: string
  /** Valuation date, so "shares held" means the same thing it does on screen. */
  asOf: string
}

export interface ExchangePlan {
  alias: TickerAlias
  /** The correction to write on the new ticker, or null when the alias alone is right. */
  adjust: { ticker: string; trade_date: string; shares: string } | null
  /** Shares of the old ticker going in. */
  sharesHeld: string
  /** What those shares should become under the new ticker. */
  targetShares: string
  /** What the alias alone would make them - the reason an adjust is or is not needed. */
  sharesFromAliasAlone: string
}

export type ExchangeOutcome = { ok: true; plan: ExchangePlan } | { ok: false; reason: string }

/**
 * A rename or merger: the alias, plus the share correction it needs (SPEC Decision log,
 * 2026-10-11). The correction is **not** `sharesHeld * (ratio - 1)`, however obvious that
 * looks. Share counts are restated by the split events of whatever ticker a row resolves
 * under, so the moment the alias moves those rows to the new symbol they are restated by the
 * *new* ticker's splits instead of the old one's - and right after a rename the new symbol
 * usually has no stored price history at all, so none apply. Computing the delta from the
 * pre-alias figure then bakes the difference into the ledger as a permanent error.
 *
 * So this applies the alias first, measures what the moved rows actually contribute, and
 * writes only the gap between that and the target. A 1:1 rename of a ticker that never split
 * reduces to writing nothing, which is what it should be.
 */
export function exchangePlan(input: ExchangeInput): ExchangeOutcome {
  const { transactions, prices, aliases = [], effectiveDate, asOf } = input
  const from = input.from.trim().toUpperCase()
  const to = input.to.trim().toUpperCase()

  if (to === '') return { ok: false, reason: 'Enter the ticker it became.' }
  if (to === from) {
    return { ok: false, reason: 'That is the same ticker. An alias has to point somewhere else.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
    return { ok: false, reason: 'Enter the date the change took effect.' }
  }
  const ratio = positiveAmount(input.ratio)
  if (ratio === null) {
    return { ok: false, reason: 'Enter the exchange ratio as a positive number.' }
  }

  const alias: TickerAlias = { from_ticker: from, to_ticker: to, effective_date: effectiveDate }
  const before = sharesOn(splitAdjustTransactions([...transactions], prices, aliases), asOf)
  const held = before.get(from) ?? new Decimal(0)
  if (!held.isPositive() || held.isZero()) {
    return { ok: false, reason: `No ${from} shares are held, so there is nothing to exchange.` }
  }

  const after = sharesOn(
    splitAdjustTransactions([...transactions], prices, [...aliases, alias]),
    asOf,
  )
  // What the moved rows contribute, isolated from any of the new ticker's own history.
  const contributed = (after.get(to) ?? new Decimal(0)).minus(before.get(to) ?? new Decimal(0))
  const target = held.times(ratio)
  const delta = target.minus(contributed)

  // The adjust row is itself restated by the new ticker's splits after its trade date, so it
  // is written in that date's terms - the same correction `closeOutPlan` makes.
  const factor = splitFactorAfter(effectiveDate, prices[to]?.splits ?? [])

  return {
    ok: true,
    plan: {
      alias,
      adjust: delta.isZero()
        ? null
        : { ticker: to, trade_date: effectiveDate, shares: delta.div(factor).toFixed() },
      sharesHeld: held.toFixed(),
      targetShares: target.toFixed(),
      sharesFromAliasAlone: contributed.toFixed(),
    },
  }
}

/** Calendar days from `from` to `to`, both `YYYY-MM-DD`. Negative when `to` precedes `from`. */
export function calendarDaysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)
  return Math.round(ms / 86_400_000)
}

/** A price this far behind the valuation date is treated as a symbol that stopped trading. */
export const DEFAULT_STALE_DAYS = 30

export interface DelistedCandidate {
  ticker: string
  /** `no-price`: nothing stored at all. `stale-price`: stored, but it stopped moving. */
  reason: 'no-price' | 'stale-price'
  lastCloseDate: string | null
  /** Calendar days between `lastCloseDate` and the valuation date; null when there is none. */
  daysBehind: number | null
}

export interface DelistedInput {
  byTicker: readonly Pick<TickerHoldings, 'ticker' | 'shares' | 'latestCloseDate'>[]
  /** `analyze`'s own list: still-held tickers with no usable price. */
  missingPrices: readonly string[]
  asOf: string
  /**
   * The benchmark's own last close, if it is known - the reference for whether the price set
   * as a whole is current. Omit it and every lagging ticker is reported.
   */
  benchmarkCloseDate?: string | null
}

/**
 * Held positions that look like the company is gone: no stored price at all, or a last close
 * more than `staleDays` behind the valuation date. This only ever produces a **prompt** - the
 * app never closes or hides a position on its own, because a quiet data-source outage and a
 * real delisting look identical from here, and only one of them should change the ledger.
 *
 * A lagging close only means anything if the reference series kept going without it. The
 * valuation date is the newest close across *every* stored ticker, so one manual spot price on
 * a symbol nobody holds can drag it months ahead of the real series and leave every holding
 * looking dead. So when the benchmark's own close is itself that far behind, the whole price
 * set is behind - which is "update your prices", not "these companies are gone" - and no
 * stale-price candidate is reported. A **missing** price is reported either way: no amount of
 * refetching has yet invented one.
 */
export function delistedCandidates(
  input: DelistedInput,
  options: { staleDays?: number } = {},
): DelistedCandidate[] {
  const staleDays = options.staleDays ?? DEFAULT_STALE_DAYS
  const missing = new Set(input.missingPrices)
  const candidates: DelistedCandidate[] = []
  const referenceStale =
    input.benchmarkCloseDate != null &&
    calendarDaysBetween(input.benchmarkCloseDate, input.asOf) > staleDays

  for (const holding of input.byTicker) {
    if (isClosedPosition(holding)) continue

    if (missing.has(holding.ticker)) {
      candidates.push({
        ticker: holding.ticker,
        reason: 'no-price',
        lastCloseDate: holding.latestCloseDate,
        daysBehind:
          holding.latestCloseDate === null
            ? null
            : calendarDaysBetween(holding.latestCloseDate, input.asOf),
      })
      continue
    }

    if (holding.latestCloseDate === null || referenceStale) continue
    const daysBehind = calendarDaysBetween(holding.latestCloseDate, input.asOf)
    if (daysBehind > staleDays) {
      candidates.push({
        ticker: holding.ticker,
        reason: 'stale-price',
        lastCloseDate: holding.latestCloseDate,
        daysBehind,
      })
    }
  }

  return candidates.sort((a, b) => a.ticker.localeCompare(b.ticker))
}
