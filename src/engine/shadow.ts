import Decimal from 'decimal.js'
import { indexOnOrAfter, indexOnOrBefore } from './calendar'
import type { SplitAdjustedTransaction } from './holdings'
import type { PriceHistory } from './prices/types'

/**
 * The VOO shadow (SPEC section 5). Every ticker has its own bucket: a buy in the ticker
 * buys the same dollars of VOO that day, a sell or a cash dividend sells that many
 * dollars of VOO, and splits and adjusts do nothing. Both sides therefore see identical
 * cash flows, so the difference in value is stock selection and nothing else.
 *
 * Shadow positions are never expressed as share counts, because Yahoo restates adjusted
 * closes after every dividend and a stored share count would silently go stale. What is
 * carried instead is a flow's `amount / adj(pricingDate)` - called "units" here - which is
 * recomputed from the freshly fetched series on every call. Bucket value on day `d` is
 * `adj(d) * (sum of units up to d)`, which is exactly SPEC's `f * adj(d) / adj(i)` summed.
 */

/** One shadow trade: the cash side of one real transaction, priced on a benchmark day. */
export interface ShadowFlow {
  ticker: string
  trade_date: string
  /**
   * The benchmark trading day this flow is priced on: `trade_date` itself when the market
   * traded, otherwise the next trading day (SPEC section 5). Null when `trade_date` falls
   * past the end of the benchmark series, which leaves the flow unpriceable.
   */
  pricingDate: string | null
  /** Signed dollars: positive buys the benchmark, negative sells it. */
  amount: string
}

export interface ShadowCoverageWarning {
  ticker: string
  trade_date: string
  kind: 'before-benchmark-series' | 'after-benchmark-series'
  message: string
}

/**
 * Adjusted closes as `Decimal`s, memoized on the `PriceHistory` object itself. Parsing a
 * six-year series costs ~1,500 `Decimal` constructions and `analyze` walks the benchmark
 * several times over, so this is the difference between a snappy and a sluggish dashboard.
 * Keyed on object identity: a `PriceHistory` handed to the engine must not be mutated
 * afterwards. Pure in the sense that matters - same input object, same output, no I/O.
 */
const adjCache = new WeakMap<PriceHistory, Decimal[]>()

export function adjSeries(history: PriceHistory): Decimal[] {
  let series = adjCache.get(history)
  if (!series) {
    series = history.adjClose.map((value) => new Decimal(value ?? 0))
    adjCache.set(history, series)
  }
  return series
}

/** Adjusted close on `date`, or on the last trading day before it. Null if the series starts later. */
export function benchmarkAdjOn(history: PriceHistory, date: string): Decimal | null {
  const at = indexOnOrBefore(history.dates, date)
  if (at < 0) return null
  return adjSeries(history)[at] ?? null
}

/** The benchmark day a trade dated `date` is priced on (SPEC section 5: next trading day). */
export function benchmarkPricingDate(history: PriceHistory, date: string): string | null {
  const at = indexOnOrAfter(history.dates, date)
  return at < history.dates.length ? history.dates[at] : null
}

/**
 * `$1` invested in the benchmark on `from` is worth this much on `to`. Null when either end
 * falls outside the series. Used by the per-buy decision view, which prices each lot
 * against its own start and end point rather than against the whole bucket.
 */
export function benchmarkGrowth(history: PriceHistory, from: string, to: string): Decimal | null {
  const start = benchmarkPricingDate(history, from)
  if (start === null) return null
  const startAdj = benchmarkAdjOn(history, start)
  const endAdj = benchmarkAdjOn(history, to)
  if (startAdj === null || endAdj === null || startAdj.isZero()) return null
  return endAdj.div(startAdj)
}

/**
 * The cash side of every transaction, as shadow trades in ascending `pricingDate` order.
 * `split` and `adjust` rows produce nothing: a split moves no money, and an adjust is a
 * share-count correction, so neither side of the comparison sees a flow.
 */
export function shadowFlows(
  adjusted: SplitAdjustedTransaction[],
  benchmark: PriceHistory,
  upTo?: string,
): ShadowFlow[] {
  const flows: ShadowFlow[] = []

  for (const txn of adjusted) {
    if (upTo !== undefined && txn.trade_date > upTo) continue

    const amount = new Decimal(txn.amount_usd).abs()
    let signed: Decimal
    switch (txn.type) {
      case 'buy':
        signed = amount
        break
      case 'sell':
      case 'dividend':
        signed = amount.neg()
        break
      default:
        continue
    }
    if (signed.isZero()) continue

    flows.push({
      ticker: txn.ticker,
      trade_date: txn.trade_date,
      pricingDate: benchmarkPricingDate(benchmark, txn.trade_date),
      amount: signed.toFixed(),
    })
  }

  return flows.sort(
    (a, b) =>
      (a.pricingDate ?? '9999-12-31').localeCompare(b.pricingDate ?? '9999-12-31') ||
      a.trade_date.localeCompare(b.trade_date),
  )
}

/**
 * Where the benchmark series does not cover the ledger. A flow dated before the series
 * starts is still priced, at the earliest day there is - the number stays sane, but the
 * comparison is measuring from the wrong start, so say so. A flow dated after the series
 * ends cannot be priced at all and is left out of every bucket.
 */
export function shadowCoverageWarnings(
  flows: ShadowFlow[],
  benchmark: PriceHistory,
): ShadowCoverageWarning[] {
  const first = benchmark.dates[0]
  const warnings: ShadowCoverageWarning[] = []

  for (const flow of flows) {
    if (flow.pricingDate === null) {
      warnings.push({
        ticker: flow.ticker,
        trade_date: flow.trade_date,
        kind: 'after-benchmark-series',
        message: `benchmark prices end before ${flow.trade_date}, so this flow is missing from the shadow`,
      })
    } else if (first !== undefined && flow.trade_date < first) {
      warnings.push({
        ticker: flow.ticker,
        trade_date: flow.trade_date,
        kind: 'before-benchmark-series',
        message: `benchmark prices start on ${first}, so this flow is priced later than it happened`,
      })
    }
  }

  return warnings
}

/** Bucket value per ticker on `date`. Empty when `date` precedes the benchmark series. */
export function shadowBucketsOn(
  flows: ShadowFlow[],
  benchmark: PriceHistory,
  date: string,
): Map<string, Decimal> {
  const adj = benchmarkAdjOn(benchmark, date)
  const buckets = new Map<string, Decimal>()
  if (adj === null) return buckets

  for (const [ticker, units] of shadowUnitsOn(flows, benchmark, date)) {
    buckets.set(ticker, units.times(adj))
  }
  return buckets
}

/** Total shadow value on `date`: the sum of every bucket. */
export function shadowTotalOn(flows: ShadowFlow[], benchmark: PriceHistory, date: string): Decimal {
  let total = new Decimal(0)
  for (const value of shadowBucketsOn(flows, benchmark, date).values()) {
    total = total.plus(value)
  }
  return total
}

/**
 * Cumulative units on each day in `dates`, as an array parallel to it. One pass over the
 * flows, so a daily series costs one multiplication per day rather than a re-sum. Pass
 * `ticker` for a single bucket; omit it for the whole portfolio, where only the running
 * total is needed - `sum(adj(d) * units) == adj(d) * sum(units)`.
 */
export function shadowUnitsByDay(
  flows: ShadowFlow[],
  benchmark: PriceHistory,
  dates: string[],
  ticker?: string,
): Decimal[] {
  const adj = adjSeries(benchmark)
  const priced = flows
    .filter((flow) => flow.pricingDate !== null && (ticker === undefined || flow.ticker === ticker))
    .map((flow) => {
      const at = indexOnOrBefore(benchmark.dates, flow.pricingDate!)
      const atAdj = at < 0 ? null : (adj[at] ?? null)
      return {
        pricingDate: flow.pricingDate!,
        units: atAdj === null || atAdj.isZero() ? null : new Decimal(flow.amount).div(atAdj),
      }
    })

  const series: Decimal[] = []
  let running = new Decimal(0)
  let next = 0

  for (const date of dates) {
    while (next < priced.length && priced[next].pricingDate <= date) {
      const units = priced[next++].units
      if (units !== null) running = running.plus(units)
    }
    series.push(running)
  }

  return series
}

/** Units held on `date` per ticker, computed fresh from the benchmark series. */
export function shadowUnitsOn(
  flows: ShadowFlow[],
  benchmark: PriceHistory,
  date: string,
): Map<string, Decimal> {
  const adj = adjSeries(benchmark)
  const units = new Map<string, Decimal>()

  for (const flow of flows) {
    if (flow.pricingDate === null || flow.pricingDate > date) continue
    const at = indexOnOrBefore(benchmark.dates, flow.pricingDate)
    const atAdj = at < 0 ? null : (adj[at] ?? null)
    if (atAdj === null || atAdj.isZero()) continue

    const contribution = new Decimal(flow.amount).div(atAdj)
    units.set(flow.ticker, (units.get(flow.ticker) ?? new Decimal(0)).plus(contribution))
  }

  return units
}
