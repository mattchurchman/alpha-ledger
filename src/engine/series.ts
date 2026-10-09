import Decimal from 'decimal.js'
import { tradingDaysBetween } from './calendar'
import { sharesByDay, splitAdjustTransactions, type SplitAdjustedTransaction } from './holdings'
import type { PriceHistory } from './prices/types'
import { adjSeries, shadowFlows, shadowUnitsByDay, type ShadowFlow } from './shadow'
import type { TickerAlias, Transaction } from './types'

/**
 * The daily history of SPEC section 6: for every trading day from the first transaction,
 * portfolio value, total shadow value, and the gap between them - plus the same series for
 * one ticker on demand.
 *
 * The benchmark's own `dates` array is the trading calendar, exactly as in `calendar.ts`:
 * it is the one series that is always present and always complete.
 */

export interface DailySeries {
  dates: string[]
  /** Real value: shares held that day times that day's close. */
  value: string[]
  /** Benchmark bucket value that day. */
  shadow: string[]
  /** `value - shadow`, the chart's third line. */
  gap: string[]
}

export interface SeriesInput {
  transactions: Transaction[]
  /** Price history per ticker, keyed by the ticker after alias resolution. Must hold the benchmark. */
  prices: Record<string, PriceHistory>
  aliases?: TickerAlias[]
  /** Last day of the series. Defaults to the benchmark's `asOf`. */
  asOf?: string
  /** First day of the series. Defaults to the first transaction. */
  from?: string
  /** Benchmark ticker. Defaults to `VOO`. */
  benchmark?: string
}

/**
 * Chart points are rounded to cents here, which is the one deliberate exception to
 * CLAUDE.md's "round only at display". A daily series is a display artifact and nothing
 * else: six years is ~1,500 points per line, and carrying twenty significant digits
 * through three of them would be a payload the UI only throws away. Headline figures never
 * come through here. `gap` is computed from the rounded lines so the three agree exactly on
 * screen rather than drifting a cent apart.
 */
const MONEY_DP = 2

export function dailySeries(input: SeriesInput, ticker?: string): DailySeries {
  const { transactions, prices, aliases = [], benchmark = 'VOO' } = input
  const benchmarkHistory = prices[benchmark]
  if (!benchmarkHistory) return { dates: [], value: [], shadow: [], gap: [] }

  const adjusted = splitAdjustTransactions(transactions, prices, aliases)
  const asOf = input.asOf ?? benchmarkHistory.asOf
  const flows = shadowFlows(adjusted, benchmarkHistory, asOf)

  return seriesFrom({ adjusted, flows, prices, benchmarkHistory, asOf, from: input.from }, ticker)
}

export interface SeriesContext {
  adjusted: SplitAdjustedTransaction[]
  flows: ShadowFlow[]
  prices: Record<string, PriceHistory>
  benchmarkHistory: PriceHistory
  asOf: string
  from?: string
}

/**
 * The series from work `analyze` has already done. Exported so the dashboard's series does
 * not pay for a second alias pass and a second flow build.
 */
export function seriesFrom(context: SeriesContext, ticker?: string): DailySeries {
  const { adjusted, flows, prices, benchmarkHistory, asOf } = context

  const relevant = ticker === undefined ? adjusted : adjusted.filter((txn) => txn.ticker === ticker)
  const inRange = relevant.filter((txn) => txn.trade_date <= asOf)

  const from = context.from ?? earliestDate(inRange)
  if (from === null) return { dates: [], value: [], shadow: [], gap: [] }

  const dates = tradingDaysBetween(benchmarkHistory.dates, from, asOf)
  if (dates.length === 0) return { dates: [], value: [], shadow: [], gap: [] }

  const shares = sharesByDay(inRange, dates)
  const units = shadowUnitsByDay(flows, benchmarkHistory, dates, ticker)
  const benchmarkAdj = adjSeries(benchmarkHistory)
  const adjByDay = alignedAdj(benchmarkHistory, benchmarkAdj, dates)

  // Parallel arrays rather than a map lookup per ticker per day: a six-year, sixty-ticker
  // portfolio is ~94,000 trips through the inner loop.
  const held = [...shares.keys()].map((name) => ({
    quantities: shares.get(name)!,
    closes: alignedCloses(prices[name], dates),
  }))

  const value: string[] = []
  const shadow: string[] = []
  const gap: string[] = []

  for (let i = 0; i < dates.length; i++) {
    let total = new Decimal(0)
    for (const position of held) {
      const quantity = position.quantities[i]
      if (quantity.isZero()) continue
      const close = position.closes[i]
      if (close === null) continue
      total = total.plus(quantity.times(close))
    }

    const adj = adjByDay[i]
    const bucket = adj === null ? new Decimal(0) : units[i].times(adj)

    const roundedValue = total.toFixed(MONEY_DP)
    const roundedShadow = bucket.toFixed(MONEY_DP)
    value.push(roundedValue)
    shadow.push(roundedShadow)
    gap.push(new Decimal(roundedValue).minus(roundedShadow).toFixed(MONEY_DP))
  }

  return { dates, value, shadow, gap }
}

function earliestDate(adjusted: SplitAdjustedTransaction[]): string | null {
  let earliest: string | null = null
  for (const txn of adjusted) {
    if (earliest === null || txn.trade_date < earliest) earliest = txn.trade_date
  }
  return earliest
}

/**
 * A ticker's closes lined up with the master calendar in one pass over both. Null before
 * the ticker's own series starts; the last known close is carried forward across any day
 * the ticker did not trade but the benchmark did (a halt, or a late listing on one feed).
 */
function alignedCloses(history: PriceHistory | undefined, dates: string[]): (Decimal | null)[] {
  const out: (Decimal | null)[] = new Array(dates.length).fill(null)
  if (!history) return out

  let at = 0
  let last: Decimal | null = null
  for (let i = 0; i < dates.length; i++) {
    while (at < history.dates.length && history.dates[at] <= dates[i]) {
      const close = history.close[at]
      if (close !== undefined) last = new Decimal(close)
      at++
    }
    out[i] = last
  }
  return out
}

/** The benchmark's own adjusted closes lined up with `dates`, which are drawn from it. */
function alignedAdj(history: PriceHistory, adj: Decimal[], dates: string[]): (Decimal | null)[] {
  const out: (Decimal | null)[] = new Array(dates.length).fill(null)
  let at = 0
  let last: Decimal | null = null
  for (let i = 0; i < dates.length; i++) {
    while (at < history.dates.length && history.dates[at] <= dates[i]) {
      last = adj[at] ?? last
      at++
    }
    out[i] = last
  }
  return out
}
