import Decimal from 'decimal.js'
import { indexOnOrBefore } from './calendar'
import type { PriceHistory, PriceSplitEvent } from './prices/types'
import type { Transaction, TickerAlias } from './types'

/** A transaction restated in today's share terms, under its current ticker. */
export interface SplitAdjustedTransaction extends Transaction {
  /** Product of every Yahoo split ratio dated after `trade_date`. */
  splitFactor: string
  /**
   * `shares * splitFactor`, signed: positive for `buy`, negative for `sell`, as given for
   * `adjust`, null for `dividend`.
   */
  signedShares: string | null
}

export interface TickerHoldings {
  ticker: string
  /** Every account that traded this ticker. Basis is pooled across them (SPEC section 4). */
  accounts: string[]
  shares: string
  /** Remaining average cost of the shares still held. */
  costBasis: string
  averageCost: string | null
  invested: string
  returned: string
  realizedGain: string
  dividendGain: string
  unrealizedGain: string
  currentValue: string
  totalGain: string
  latestClose: string | null
  latestCloseDate: string | null
  firstTradeDate: string
  lastTradeDate: string
}

export interface PortfolioTotals {
  invested: string
  returned: string
  costBasis: string
  currentValue: string
  realizedGain: string
  dividendGain: string
  unrealizedGain: string
  totalGain: string
}

export interface HoldingsResult {
  byTicker: TickerHoldings[]
  totals: PortfolioTotals
  /** Tickers still held for which no usable price was supplied; their value reads as 0. */
  missingPrices: string[]
  asOf: string
}

export interface HoldingsInput {
  transactions: Transaction[]
  /** Price history per ticker, keyed by the ticker *after* alias resolution. */
  prices: Record<string, PriceHistory>
  aliases?: TickerAlias[]
  /** Valuation date. Defaults to the newest `asOf` across `prices`, else the last trade. */
  asOf?: string
}

/**
 * Same-day ordering. Shares have to arrive before they can leave, or a sell would be
 * priced against a basis that has not been added yet. M1 gives no intraday times, so this
 * is a convention, not a reconstruction of the real sequence.
 */
const TYPE_ORDER: Record<Transaction['type'], number> = {
  adjust: 0,
  buy: 1,
  dividend: 2,
  sell: 3,
  split: 4,
}

/**
 * The ticker a transaction's history belongs under today. An alias applies to
 * transactions dated on or before its `effective_date`; from the day after the rename M1
 * already reports the new symbol, so leaving later rows alone is what keeps a recycled
 * symbol from absorbing an unrelated company's history. Chains (A to B to C) resolve;
 * a cycle stops where it started rather than spinning.
 */
export function resolveTicker(ticker: string, tradeDate: string, aliases: TickerAlias[]): string {
  let current = ticker.toUpperCase()
  const seen = new Set([current])

  for (;;) {
    const hit = aliases.find(
      (alias) => alias.from_ticker.toUpperCase() === current && tradeDate <= alias.effective_date,
    )
    if (!hit) return current

    const next = hit.to_ticker.toUpperCase()
    if (seen.has(next)) return current
    seen.add(next)
    current = next
  }
}

/**
 * How many of today's shares one share bought on `tradeDate` has become: the product of
 * every split ratio dated strictly after it. Yahoo's split date is the ex-date, and its
 * prices from that day on are already in post-split terms, so a trade executed on the
 * ex-date itself is in post-split shares too and must not be multiplied again.
 */
export function splitFactorAfter(tradeDate: string, splits: PriceSplitEvent[]): Decimal {
  let factor = new Decimal(1)
  for (const split of splits) {
    if (split.date <= tradeDate) continue
    if (!Number.isFinite(split.numerator) || !Number.isFinite(split.denominator)) continue
    if (split.numerator <= 0 || split.denominator <= 0) continue
    factor = factor.times(new Decimal(split.numerator).div(split.denominator))
  }
  return factor
}

/**
 * Resolve aliases, restate every share count in today's split terms, and sort into
 * processing order. `excluded` rows and `split` rows are left out: Yahoo's split events
 * are the single source of split truth (SPEC section 4), so M1 split rows never move
 * share counts - they are only ever a cross-check (`crossCheckSplits`).
 */
export function splitAdjustTransactions(
  transactions: Transaction[],
  prices: Record<string, PriceHistory>,
  aliases: TickerAlias[] = [],
): SplitAdjustedTransaction[] {
  const splitsByTicker = new Map<string, PriceSplitEvent[]>()
  const splitsFor = (ticker: string): PriceSplitEvent[] => {
    let splits = splitsByTicker.get(ticker)
    if (!splits) {
      splits = [...(prices[ticker]?.splits ?? [])].sort((a, b) => a.date.localeCompare(b.date))
      splitsByTicker.set(ticker, splits)
    }
    return splits
  }

  const adjusted = transactions
    .filter((txn) => !txn.excluded && txn.type !== 'split')
    .map((txn) => {
      const ticker = resolveTicker(txn.ticker, txn.trade_date, aliases)
      const factor = splitFactorAfter(txn.trade_date, splitsFor(ticker))
      const shares = txn.shares === null ? null : new Decimal(txn.shares).times(factor)

      return {
        ...txn,
        ticker,
        splitFactor: factor.toFixed(),
        signedShares:
          shares === null ? null : (txn.type === 'sell' ? shares.abs().neg() : shares).toFixed(),
      }
    })

  return adjusted
    .map((txn, index) => ({ txn, index }))
    .sort(
      (a, b) =>
        a.txn.trade_date.localeCompare(b.txn.trade_date) ||
        TYPE_ORDER[a.txn.type] - TYPE_ORDER[b.txn.type] ||
        a.index - b.index,
    )
    .map(({ txn }) => txn)
}

/** Shares held per ticker at the close of `date`. Tickers fully exited are omitted. */
export function sharesOn(adjusted: SplitAdjustedTransaction[], date: string): Map<string, Decimal> {
  const shares = new Map<string, Decimal>()

  for (const txn of adjusted) {
    if (txn.trade_date > date) continue
    if (txn.signedShares === null) continue
    const running = (shares.get(txn.ticker) ?? new Decimal(0)).plus(txn.signedShares)
    shares.set(txn.ticker, running)
  }

  for (const [ticker, held] of shares) {
    if (held.isZero()) shares.delete(ticker)
  }
  return shares
}

/**
 * Shares held per ticker at the close of each day in `dates`, as arrays parallel to
 * `dates`. One pass over the transactions; `dates` must be ascending.
 */
export function sharesByDay(
  adjusted: SplitAdjustedTransaction[],
  dates: string[],
): Map<string, Decimal[]> {
  const series = new Map<string, Decimal[]>()
  const tickers = new Set(adjusted.map((txn) => txn.ticker))
  for (const ticker of tickers) {
    series.set(
      ticker,
      dates.map(() => new Decimal(0)),
    )
  }

  const running = new Map<string, Decimal>()
  let next = 0

  for (let i = 0; i < dates.length; i++) {
    while (next < adjusted.length && adjusted[next].trade_date <= dates[i]) {
      const txn = adjusted[next++]
      if (txn.signedShares === null) continue
      running.set(txn.ticker, (running.get(txn.ticker) ?? new Decimal(0)).plus(txn.signedShares))
    }
    for (const [ticker, held] of running) {
      series.get(ticker)![i] = held
    }
  }

  return series
}

interface Accumulator {
  accounts: Set<string>
  shares: Decimal
  costBasis: Decimal
  invested: Decimal
  returned: Decimal
  realizedGain: Decimal
  dividendGain: Decimal
  firstTradeDate: string
  lastTradeDate: string
}

/**
 * Everything SPEC section 6 asks for on the real side of the comparison, per ticker and
 * for the portfolio. Pure: all prices come in through `input`.
 *
 * Basis is average cost pooled across accounts, for display, not tax (SPEC section 4). A
 * sell releases basis in proportion to the shares sold, and a sell that closes the
 * position releases all of it, so a full exit leaves exactly zero rather than a rounding
 * crumb. Shares arriving by `adjust` (a spinoff or a transfer in kind) carry no basis,
 * and shares leaving by `adjust` write their basis off as a realized loss - which is what
 * keeps `totalGain` equal to `realizedGain + dividendGain + unrealizedGain` in every case.
 */
export function computeHoldings(input: HoldingsInput): HoldingsResult {
  const { transactions, prices, aliases = [] } = input
  const adjusted = splitAdjustTransactions(transactions, prices, aliases)
  const asOf = input.asOf ?? defaultAsOf(prices, adjusted)

  const accumulators = new Map<string, Accumulator>()

  for (const txn of adjusted) {
    if (txn.trade_date > asOf) continue

    let acc = accumulators.get(txn.ticker)
    if (!acc) {
      acc = {
        accounts: new Set(),
        shares: new Decimal(0),
        costBasis: new Decimal(0),
        invested: new Decimal(0),
        returned: new Decimal(0),
        realizedGain: new Decimal(0),
        dividendGain: new Decimal(0),
        firstTradeDate: txn.trade_date,
        lastTradeDate: txn.trade_date,
      }
      accumulators.set(txn.ticker, acc)
    }
    acc.accounts.add(txn.account_label)
    acc.lastTradeDate = txn.trade_date

    const amount = new Decimal(txn.amount_usd).abs()
    const shares = txn.signedShares === null ? new Decimal(0) : new Decimal(txn.signedShares)

    switch (txn.type) {
      case 'buy':
        acc.shares = acc.shares.plus(shares)
        acc.costBasis = acc.costBasis.plus(amount)
        acc.invested = acc.invested.plus(amount)
        break

      case 'sell': {
        const basisSold = releaseBasis(acc, shares.abs())
        acc.realizedGain = acc.realizedGain.plus(amount).minus(basisSold)
        acc.returned = acc.returned.plus(amount)
        break
      }

      case 'dividend':
        acc.dividendGain = acc.dividendGain.plus(amount)
        acc.returned = acc.returned.plus(amount)
        break

      case 'adjust':
        if (shares.isNegative()) {
          acc.realizedGain = acc.realizedGain.minus(releaseBasis(acc, shares.abs()))
        } else {
          acc.shares = acc.shares.plus(shares)
        }
        break
    }
  }

  const missingPrices: string[] = []
  const byTicker: TickerHoldings[] = []

  for (const [ticker, acc] of [...accumulators].sort((a, b) => a[0].localeCompare(b[0]))) {
    const quote = latestCloseOn(prices[ticker], asOf)
    if (quote === null && !acc.shares.isZero()) missingPrices.push(ticker)

    const currentValue = quote === null ? new Decimal(0) : acc.shares.times(quote.close)
    const unrealizedGain = currentValue.minus(acc.costBasis)

    byTicker.push({
      ticker,
      accounts: [...acc.accounts].sort(),
      shares: acc.shares.toFixed(),
      costBasis: acc.costBasis.toFixed(),
      averageCost: acc.shares.isZero() ? null : acc.costBasis.div(acc.shares).toFixed(),
      invested: acc.invested.toFixed(),
      returned: acc.returned.toFixed(),
      realizedGain: acc.realizedGain.toFixed(),
      dividendGain: acc.dividendGain.toFixed(),
      unrealizedGain: unrealizedGain.toFixed(),
      currentValue: currentValue.toFixed(),
      totalGain: currentValue.plus(acc.returned).minus(acc.invested).toFixed(),
      latestClose: quote?.close ?? null,
      latestCloseDate: quote?.date ?? null,
      firstTradeDate: acc.firstTradeDate,
      lastTradeDate: acc.lastTradeDate,
    })
  }

  return { byTicker, totals: sumTotals(byTicker), missingPrices, asOf }
}

/**
 * Takes `quantity` shares out of `acc` and returns the basis they carried. Closing the
 * position (or overselling, which bad data can do) releases the whole remaining basis.
 */
function releaseBasis(acc: Accumulator, quantity: Decimal): Decimal {
  if (acc.shares.lte(quantity)) {
    const basis = acc.costBasis
    acc.costBasis = new Decimal(0)
    acc.shares = acc.shares.minus(quantity)
    return basis
  }

  const basis = acc.costBasis.times(quantity).div(acc.shares)
  acc.costBasis = acc.costBasis.minus(basis)
  acc.shares = acc.shares.minus(quantity)
  return basis
}

function latestCloseOn(
  history: PriceHistory | undefined,
  asOf: string,
): { date: string; close: string } | null {
  if (!history) return null
  const at = indexOnOrBefore(history.dates, asOf)
  if (at < 0) return null

  const close = history.close[at]
  return close === undefined ? null : { date: history.dates[at], close }
}

function defaultAsOf(
  prices: Record<string, PriceHistory>,
  adjusted: SplitAdjustedTransaction[],
): string {
  let latest = ''
  for (const history of Object.values(prices)) {
    if (history.asOf > latest) latest = history.asOf
  }
  if (latest !== '') return latest

  for (const txn of adjusted) {
    if (txn.trade_date > latest) latest = txn.trade_date
  }
  return latest
}

function sumTotals(byTicker: TickerHoldings[]): PortfolioTotals {
  const keys = [
    'invested',
    'returned',
    'costBasis',
    'currentValue',
    'realizedGain',
    'dividendGain',
    'unrealizedGain',
    'totalGain',
  ] as const

  const totals = {} as PortfolioTotals
  for (const key of keys) {
    totals[key] = byTicker
      .reduce((sum, holding) => sum.plus(holding[key]), new Decimal(0))
      .toFixed()
  }
  return totals
}

export interface SplitDisagreement {
  ticker: string
  trade_date: string
  /** The ratio the M1 row implies, or null when its share count cannot give one. */
  m1Ratio: string | null
  /** The Yahoo split event on the same day, if there is one. */
  yahooRatio: string | null
  reason: string
}

/**
 * Cross-checks M1 `split` rows against Yahoo's split events (SPEC section 4: Yahoo is the
 * single source; M1 rows exist only to catch a split Yahoo is missing). An M1 split row
 * carries the ratio in `shares`, so a row with no share count can only be checked for the
 * existence of a matching event, not its size. Returns one entry per disagreement; an
 * empty array means the two sources agree on every split row M1 reported.
 */
export function crossCheckSplits(
  transactions: Transaction[],
  prices: Record<string, PriceHistory>,
  aliases: TickerAlias[] = [],
): SplitDisagreement[] {
  const disagreements: SplitDisagreement[] = []

  for (const txn of transactions) {
    if (txn.type !== 'split' || txn.excluded) continue

    const ticker = resolveTicker(txn.ticker, txn.trade_date, aliases)
    const event = prices[ticker]?.splits.find((split) => split.date === txn.trade_date)
    const m1Ratio = txn.shares === null ? null : new Decimal(txn.shares).toFixed()

    if (!event) {
      disagreements.push({
        ticker,
        trade_date: txn.trade_date,
        m1Ratio,
        yahooRatio: null,
        reason: prices[ticker]
          ? 'M1 reports a split on this date; Yahoo has no split event for it'
          : 'no Yahoo price history supplied for this ticker, so the split is unchecked',
      })
      continue
    }

    const yahooRatio = new Decimal(event.numerator).div(event.denominator)
    if (m1Ratio === null) {
      disagreements.push({
        ticker,
        trade_date: txn.trade_date,
        m1Ratio: null,
        yahooRatio: yahooRatio.toFixed(),
        reason: 'M1 split row has no share count, so only the date could be matched',
      })
      continue
    }

    if (!yahooRatio.eq(m1Ratio)) {
      disagreements.push({
        ticker,
        trade_date: txn.trade_date,
        m1Ratio,
        yahooRatio: yahooRatio.toFixed(),
        reason: 'the two sources disagree on the split ratio',
      })
    }
  }

  return disagreements
}
