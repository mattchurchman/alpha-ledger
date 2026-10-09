import Decimal from 'decimal.js'
import {
  computeHoldings,
  splitAdjustTransactions,
  type PortfolioTotals,
  type TickerHoldings,
} from './holdings'
import type { PriceHistory } from './prices/types'
import { cashFlows, irrWithFinalValue, percentDifference, shadowIrr, valueAdded } from './returns'
import { seriesFrom, type DailySeries, type SeriesContext } from './series'
import {
  shadowBucketsOn,
  shadowCoverageWarnings,
  shadowFlows,
  type ShadowCoverageWarning,
} from './shadow'
import { decisionsFrom, type BuyDecision } from './decisions'
import type { TickerAlias, Transaction } from './types'

/**
 * The engine's front door. One call does the whole comparison the app exists for: what the
 * picks are worth, what the same dollars in VOO would be worth, and the gap.
 *
 * The return shape is documented in `docs/ENGINE_API.md`. Everything is pure - prices come
 * in through `input`, nothing is fetched, nothing is stored, and no UI type is imported.
 */

export const DEFAULT_BENCHMARK = 'VOO'

/**
 * Declared field then assignment rather than a constructor parameter property, matching
 * `YahooUpstreamError`. Parameter properties need a real TypeScript transform, and node's
 * strip-only mode - which is what runs `scripts/*.ts` - rejects them outright.
 */
export class MissingBenchmarkError extends Error {
  readonly ticker: string

  constructor(ticker: string) {
    super(
      `no price history supplied for the benchmark ${ticker}; the shadow comparison cannot be computed without it`,
    )
    this.name = 'MissingBenchmarkError'
    this.ticker = ticker
  }
}

export interface AnalyzeInput {
  transactions: Transaction[]
  /** Price history per ticker, keyed by the ticker after alias resolution. Must hold the benchmark. */
  prices: Record<string, PriceHistory>
  aliases?: TickerAlias[]
  /** Valuation date. Defaults to the newest `asOf` across `prices`. */
  asOf?: string
  /** Benchmark ticker. Defaults to `VOO`. */
  benchmark?: string
  /**
   * Include the portfolio's daily history. On by default, because the dashboard's chart
   * needs it; the stock detail screen can turn it off and ask for one ticker's series.
   */
  includeSeries?: boolean
}

/** One ticker: the real side from `holdings.ts`, plus everything it is being compared to. */
export interface TickerAnalysis extends TickerHoldings {
  /** Bucket value today: the same dollars put into the benchmark on the same days. */
  shadowValue: string
  /** The headline number: `currentValue - shadowValue`. Valid for closed positions too. */
  valueAdded: string
  /** `valueAdded / shadowValue`, or null when the bucket is not positive. */
  percentDifference: string | null
  /** Annualized money-weighted return, or null where SPEC says show a dash. */
  irr: string | null
  /** The same, on the benchmark side: identical flows, bucket value as the final one. */
  shadowIrr: string | null
}

export interface PortfolioAnalysis extends PortfolioTotals {
  shadowValue: string
  valueAdded: string
  percentDifference: string | null
  irr: string | null
  shadowIrr: string | null
}

export interface AnalyzeResult {
  asOf: string
  benchmark: string
  portfolio: PortfolioAnalysis
  /** Alphabetical by ticker, including fully closed positions. */
  byTicker: TickerAnalysis[]
  /** Daily history for the whole portfolio, unless `includeSeries` was false. */
  series: DailySeries | null
  /** Tickers still held for which no usable price was supplied; their value reads as 0. */
  missingPrices: string[]
  /** Where the benchmark series does not cover the ledger. Empty is the normal case. */
  warnings: ShadowCoverageWarning[]
  /** Everything the on-demand helpers below need, so a second screen does not recompute it. */
  context: SeriesContext
}

export function analyze(input: AnalyzeInput): AnalyzeResult {
  const { transactions, prices, aliases = [], benchmark = DEFAULT_BENCHMARK } = input
  const benchmarkHistory = prices[benchmark]
  if (!benchmarkHistory) throw new MissingBenchmarkError(benchmark)

  const holdings = computeHoldings({ transactions, prices, aliases, asOf: input.asOf })
  const asOf = holdings.asOf
  const adjusted = splitAdjustTransactions(transactions, prices, aliases)
  const flows = shadowFlows(adjusted, benchmarkHistory, asOf)
  const buckets = shadowBucketsOn(flows, benchmarkHistory, asOf)

  const byTicker: TickerAnalysis[] = holdings.byTicker.map((holding) => {
    const shadowValue = (buckets.get(holding.ticker) ?? new Decimal(0)).toFixed()
    const tickerFlows = cashFlows(adjusted, asOf, holding.ticker)

    return {
      ...holding,
      shadowValue,
      valueAdded: valueAdded(holding.currentValue, shadowValue),
      percentDifference: percentDifference(holding.currentValue, shadowValue),
      irr: irrWithFinalValue(tickerFlows, holding.currentValue, asOf),
      shadowIrr: shadowIrr(tickerFlows, shadowValue, asOf),
    }
  })

  // Portfolio shadow is the sum of the per-ticker buckets, taken from `byTicker` rather
  // than re-summed from the flows. Both give the same figure - every bucket's ticker has a
  // holding, since buckets and holdings are built from the same filtered rows - but summing
  // the published per-ticker values is what makes "portfolio value added == sum of
  // per-ticker value added" true by construction rather than by coincidence.
  const portfolioShadow = byTicker
    .reduce((sum, ticker) => sum.plus(ticker.shadowValue), new Decimal(0))
    .toFixed()
  const portfolioFlows = cashFlows(adjusted, asOf)

  const portfolio: PortfolioAnalysis = {
    ...holdings.totals,
    shadowValue: portfolioShadow,
    valueAdded: valueAdded(holdings.totals.currentValue, portfolioShadow),
    percentDifference: percentDifference(holdings.totals.currentValue, portfolioShadow),
    irr: irrWithFinalValue(portfolioFlows, holdings.totals.currentValue, asOf),
    shadowIrr: shadowIrr(portfolioFlows, portfolioShadow, asOf),
  }

  const context: SeriesContext = { adjusted, flows, prices, benchmarkHistory, asOf }

  return {
    asOf,
    benchmark,
    portfolio,
    byTicker,
    series: input.includeSeries === false ? null : seriesFrom(context),
    missingPrices: holdings.missingPrices,
    warnings: shadowCoverageWarnings(flows, benchmarkHistory),
    context,
  }
}

/** One ticker's daily history, from the context `analyze` already built (SPEC: on demand). */
export function tickerSeries(result: AnalyzeResult, ticker: string): DailySeries {
  return seriesFrom(result.context, ticker)
}

/** One ticker's per-buy decisions, from the context `analyze` already built. */
export function tickerDecisions(result: AnalyzeResult, ticker: string): BuyDecision[] {
  const { adjusted, prices, benchmarkHistory, asOf } = result.context
  return decisionsFrom(adjusted, prices, benchmarkHistory, asOf, ticker)
}

export type { DailySeries, SeriesContext } from './series'
export type { BuyDecision, BuyExit } from './decisions'
export type { ShadowCoverageWarning, ShadowFlow } from './shadow'
export type { IrrFlow } from './returns'
export type { PortfolioTotals, TickerHoldings } from './holdings'
export type { TickerAlias, Transaction, TransactionType } from './types'
export type { PriceHistory } from './prices/types'
