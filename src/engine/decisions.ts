import Decimal from 'decimal.js'
import { indexOnOrBefore } from './calendar'
import { splitAdjustTransactions, type SplitAdjustedTransaction } from './holdings'
import type { PriceHistory } from './prices/types'
import { benchmarkGrowth } from './shadow'
import type { TickerAlias, Transaction } from './types'

/**
 * The decision-level view of SPEC section 6, for the stock detail screen only: what each
 * individual buy turned into - the shares still held at today's price, plus the proceeds of
 * the parts already sold, matched first-in-first-out - against the same dollars put into
 * the benchmark instead.
 *
 * Two things to know before reading numbers off this:
 *
 * 1. **FIFO here, average cost everywhere else.** `holdings.ts` pools basis at average
 *    cost, because that is what a position-level display wants. This view has to attribute
 *    an outcome to a *particular* buy, which average cost cannot do, so SPEC asks for FIFO.
 *    The two never mix: nothing here feeds a total.
 * 2. **Each part is compared to the same end point as its real side.** A sold slice is
 *    measured against the benchmark from the buy date to the *sell* date; the still-held
 *    part against the benchmark from the buy date to the as-of date. Comparing a slice sold
 *    years ago against a benchmark held until today would be comparing two different bets.
 *
 * Dividends are deliberately absent: SPEC defines a decision as shares versus the same
 * dollars in the benchmark, and splitting a dividend across lots would be inventing a
 * policy the spec does not have. So per-buy value added does **not** sum to the ticker's
 * value added whenever that ticker paid a dividend. The ticker-level figure is the one to
 * trust; this view answers "was this particular purchase a good idea".
 */

export interface BuyExit {
  /** `sell` when the shares were sold, `adjust` when a correction removed them. */
  kind: 'sell' | 'adjust'
  trade_date: string
  shares: string
  /** Dollars received for this slice. Always 0 for an `adjust`. */
  proceeds: string
  /** What this slice's dollars would have been worth in the benchmark on the same day. */
  shadowValue: string
}

export interface BuyDecision {
  ticker: string
  account_label: string
  trade_date: string
  /** Shares bought, restated in today's split terms. */
  shares: string
  /** Dollars paid. */
  amount: string
  sharesRemaining: string
  /** Value of the shares still held, at the as-of close. Zero when no price is available. */
  remainingValue: string
  /** Proceeds of the parts already sold, FIFO-matched. */
  proceeds: string
  /** `proceeds + remainingValue`: what this buy is worth at the end point. */
  outcomeValue: string
  /** The same dollars in the benchmark, each part to its own end point. */
  shadowValue: string
  /** `outcomeValue - shadowValue`. Positive means this buy beat the benchmark. */
  valueAdded: string
  exits: BuyExit[]
  /** The day the last of these shares left, or null while any are still held. */
  closedOn: string | null
}

export interface DecisionsInput {
  transactions: Transaction[]
  prices: Record<string, PriceHistory>
  aliases?: TickerAlias[]
  asOf?: string
  benchmark?: string
}

/** A FIFO lot waiting to be matched. Shares that arrived by `adjust` carry no cost. */
interface Lot {
  kind: 'buy' | 'adjust'
  shares: Decimal
  remaining: Decimal
  amount: Decimal
  trade_date: string
  decision: BuyDecision | null
  exits: BuyExit[]
}

/**
 * Every lot in order, plus how far the matcher has eaten into it. A head index rather than
 * shifting off the front, so a fully-sold lot is still there at the end to be totalled.
 */
interface Queue {
  lots: Lot[]
  head: number
}

export function buyDecisions(input: DecisionsInput, ticker: string): BuyDecision[] {
  const { transactions, prices, aliases = [], benchmark = 'VOO' } = input
  const benchmarkHistory = prices[benchmark]
  if (!benchmarkHistory) return []

  const adjusted = splitAdjustTransactions(transactions, prices, aliases)
  const asOf = input.asOf ?? benchmarkHistory.asOf

  return decisionsFrom(adjusted, prices, benchmarkHistory, asOf, ticker)
}

/** The same thing from work `analyze` has already done, so the detail screen pays once. */
export function decisionsFrom(
  adjusted: SplitAdjustedTransaction[],
  prices: Record<string, PriceHistory>,
  benchmarkHistory: PriceHistory,
  asOf: string,
  ticker: string,
): BuyDecision[] {
  const rows = adjusted.filter((txn) => txn.ticker === ticker && txn.trade_date <= asOf)
  const latestClose = closeOn(prices[ticker], asOf)

  const decisions: BuyDecision[] = []
  const queue: Queue = { lots: [], head: 0 }

  for (const txn of rows) {
    const amount = new Decimal(txn.amount_usd).abs()
    const signed = txn.signedShares === null ? new Decimal(0) : new Decimal(txn.signedShares)

    if (txn.type === 'buy') {
      const decision: BuyDecision = {
        ticker,
        account_label: txn.account_label,
        trade_date: txn.trade_date,
        shares: signed.toFixed(),
        amount: amount.toFixed(),
        sharesRemaining: signed.toFixed(),
        remainingValue: '0',
        proceeds: '0',
        outcomeValue: '0',
        shadowValue: '0',
        valueAdded: '0',
        exits: [],
        closedOn: null,
      }
      decisions.push(decision)
      queue.lots.push({
        kind: 'buy',
        shares: signed,
        remaining: signed,
        amount,
        trade_date: txn.trade_date,
        decision,
        exits: decision.exits,
      })
      continue
    }

    if (txn.type === 'adjust' && signed.isPositive() && !signed.isZero()) {
      // Shares from a spinoff or a transfer in kind: no buy to attribute, but they still
      // have to sit in the queue or a later sell would be matched to the wrong lot.
      queue.lots.push({
        kind: 'adjust',
        shares: signed,
        remaining: signed,
        amount: new Decimal(0),
        trade_date: txn.trade_date,
        decision: null,
        exits: [],
      })
      continue
    }

    const leaving =
      txn.type === 'sell'
        ? signed.abs()
        : txn.type === 'adjust' && signed.isNegative()
          ? signed.abs()
          : null
    if (leaving === null || leaving.isZero()) continue

    matchFifo(queue, leaving, {
      kind: txn.type === 'sell' ? 'sell' : 'adjust',
      trade_date: txn.trade_date,
      total: txn.type === 'sell' ? amount : new Decimal(0),
      benchmarkHistory,
    })
  }

  for (const lot of queue.lots) {
    if (lot.decision === null) continue
    const remainingCost = lot.shares.isZero()
      ? lot.amount
      : lot.amount.times(lot.remaining).div(lot.shares)
    const growth = benchmarkGrowth(benchmarkHistory, lot.trade_date, asOf)
    const shadowRemaining = growth === null ? new Decimal(0) : remainingCost.times(growth)

    lot.decision.sharesRemaining = lot.remaining.toFixed()
    lot.decision.remainingValue =
      latestClose === null ? '0' : lot.remaining.times(latestClose).toFixed()
    lot.decision.shadowValue = new Decimal(lot.decision.shadowValue).plus(shadowRemaining).toFixed()
  }

  for (const decision of decisions) {
    decision.outcomeValue = new Decimal(decision.proceeds).plus(decision.remainingValue).toFixed()
    decision.valueAdded = new Decimal(decision.outcomeValue).minus(decision.shadowValue).toFixed()
    const last = decision.exits[decision.exits.length - 1]
    decision.closedOn =
      new Decimal(decision.sharesRemaining).isZero() && last !== undefined ? last.trade_date : null
  }

  return decisions
}

interface ExitEvent {
  kind: 'sell' | 'adjust'
  trade_date: string
  /** Dollars received for the whole exit, apportioned across the lots it consumes. */
  total: Decimal
  benchmarkHistory: PriceHistory
}

/**
 * Takes `quantity` shares off the front of the queue, apportioning the exit's proceeds
 * across the lots it consumes. Overselling (which bad data can do) exhausts the queue and
 * the excess is dropped here - `reconcileShares` is the designated place for a share count
 * that does not add up to surface, and it will.
 */
function matchFifo(queue: Queue, quantity: Decimal, exit: ExitEvent): void {
  let left = quantity

  while (left.gt(0) && queue.head < queue.lots.length) {
    const lot = queue.lots[queue.head]
    if (lot.remaining.lte(0)) {
      queue.head++
      continue
    }

    const taken = Decimal.min(lot.remaining, left)
    const share = quantity.isZero() ? new Decimal(0) : taken.div(quantity)
    const proceeds = exit.total.times(share)
    const cost = lot.shares.isZero() ? new Decimal(0) : lot.amount.times(taken).div(lot.shares)
    const growth = benchmarkGrowth(exit.benchmarkHistory, lot.trade_date, exit.trade_date)
    const shadowValue = growth === null ? new Decimal(0) : cost.times(growth)

    lot.exits.push({
      kind: exit.kind,
      trade_date: exit.trade_date,
      shares: taken.toFixed(),
      proceeds: proceeds.toFixed(),
      shadowValue: shadowValue.toFixed(),
    })
    if (lot.decision !== null) {
      lot.decision.proceeds = new Decimal(lot.decision.proceeds).plus(proceeds).toFixed()
      lot.decision.shadowValue = new Decimal(lot.decision.shadowValue).plus(shadowValue).toFixed()
    }

    lot.remaining = lot.remaining.minus(taken)
    left = left.minus(taken)
    if (lot.remaining.lte(0)) queue.head++
  }
}

function closeOn(history: PriceHistory | undefined, asOf: string): Decimal | null {
  if (!history) return null
  const at = indexOnOrBefore(history.dates, asOf)
  if (at < 0) return null
  const close = history.close[at]
  return close === undefined ? null : new Decimal(close)
}
