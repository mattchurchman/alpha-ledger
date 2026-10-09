import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import {
  FIRST_DAY,
  PRICES,
  WEEKEND_DAY,
  adjust,
  buy,
  dividend,
  history,
  sell,
} from './__fixtures__/synthetic'
import {
  MissingBenchmarkError,
  analyze,
  tickerDecisions,
  tickerSeries,
  type AnalyzeResult,
} from './index'
import type { PriceHistory } from './prices/types'
import type { Transaction } from './types'

const cents = (value: string) => new Decimal(value).toFixed(2)

function run(transactions: Transaction[], prices = PRICES): AnalyzeResult {
  return analyze({ transactions, prices })
}

function one(transactions: Transaction[]) {
  const result = run(transactions)
  expect(result.byTicker).toHaveLength(1)
  return result.byTicker[0]
}

describe('analyze', () => {
  it('values a single buy against the benchmark', () => {
    // 10 shares for $1,000 on day one. Worth 10 x 300 = $3,000; the same $1,000 in the
    // benchmark would be 1000 x 500/100 = $5,000.
    const holding = one([buy(FIRST_DAY, 'ACME', '10', '1000')])

    expect(cents(holding.currentValue)).toBe('3000.00')
    expect(cents(holding.shadowValue)).toBe('5000.00')
    expect(cents(holding.valueAdded)).toBe('-2000.00')
    expect(holding.percentDifference).toBe('-0.4')
    // One clean year: the pick tripled, the benchmark quintupled.
    expect(holding.irr).toBe('2.000000')
    expect(holding.shadowIrr).toBe('4.000000')
  })

  it('still reports value added on a fully closed position', () => {
    // Sold everything on 01-06 for $1,200, leaving 10 - 6 = 4 units in the bucket.
    const holding = one([
      buy(FIRST_DAY, 'ACME', '10', '1000'),
      sell('2025-01-06', 'ACME', '10', '1200'),
    ])

    expect(holding.shares).toBe('0')
    expect(cents(holding.currentValue)).toBe('0.00')
    expect(cents(holding.shadowValue)).toBe('2000.00')
    expect(cents(holding.valueAdded)).toBe('-2000.00')
    expect(holding.percentDifference).toBe('-1')
  })

  it('treats a cash dividend as selling that many dollars of the benchmark', () => {
    const holding = one([
      buy(FIRST_DAY, 'ACME', '10', '1000'),
      dividend('2025-01-06', 'ACME', '200'),
    ])

    expect(cents(holding.dividendGain)).toBe('200.00')
    expect(cents(holding.currentValue)).toBe('3000.00')
    expect(cents(holding.shadowValue)).toBe('4500.00') // 10 - 200/200 = 9 units x 500
    expect(cents(holding.valueAdded)).toBe('-1500.00')
  })

  it('shows a negative bucket as it is, with no percentage and no shadow rate', () => {
    // $5,000 back out at adj 400 sells 12.5 units against the 10 bought: the bucket is short.
    const holding = one([
      buy(FIRST_DAY, 'ACME', '10', '1000'),
      sell('2025-01-08', 'ACME', '10', '5000'),
    ])

    expect(cents(holding.shadowValue)).toBe('-1250.00')
    expect(cents(holding.valueAdded)).toBe('1250.00')
    expect(holding.percentDifference).toBeNull()
    expect(holding.shadowIrr).toBeNull()
  })

  it('prices a non-trading-day trade on the next trading day', () => {
    const holding = one([buy(WEEKEND_DAY, 'ACME', '2', '400')])
    expect(cents(holding.shadowValue)).toBe('1000.00') // 400/200 = 2 units x 500
    expect(cents(holding.currentValue)).toBe('600.00')
  })

  it('nets to zero shadow flow when selling one ticker funds another', () => {
    const held = run([buy(FIRST_DAY, 'ACME', '10', '1000')])
    const swapped = run([
      buy(FIRST_DAY, 'ACME', '10', '1000'),
      sell('2025-01-06', 'ACME', '10', '1200'),
      buy('2025-01-06', 'BETA', '12', '1200'),
    ])

    // ACME keeps 4 units, BETA gains 6: the portfolio's benchmark side is untouched.
    expect(cents(swapped.portfolio.shadowValue)).toBe(cents(held.portfolio.shadowValue))
    expect(cents(swapped.portfolio.shadowValue)).toBe('5000.00')
    const buckets = Object.fromEntries(
      swapped.byTicker.map((ticker) => [ticker.ticker, cents(ticker.shadowValue)]),
    )
    expect(buckets).toEqual({ ACME: '2000.00', BETA: '3000.00' })
  })

  it('finds zero value added for a pick that tracks the benchmark exactly', () => {
    // BETA is half the benchmark's price every single day, so no entry point can beat it.
    const holding = one([buy('2025-01-06', 'BETA', '7', '700')])
    expect(cents(holding.valueAdded)).toBe('0.00')
    expect(holding.irr).toBe(holding.shadowIrr)
  })

  it('keeps portfolio value added equal to the sum of the per-ticker figures', () => {
    const result = run([
      buy(FIRST_DAY, 'ACME', '10', '1000'),
      buy(FIRST_DAY, 'BETA', '20', '1000'),
      dividend('2025-01-03', 'ACME', '13.47'),
      sell('2025-01-06', 'BETA', '5', '500'),
      buy(WEEKEND_DAY, 'ACME', '3', '355.55'),
      adjust('2025-01-07', 'BETA', '2'),
      sell('2025-01-08', 'ACME', '13', '2600'),
      buy('2025-07-01', 'BETA', '1', '200'),
    ])

    const sum = (key: 'valueAdded' | 'shadowValue' | 'currentValue') =>
      result.byTicker.reduce((total, ticker) => total.plus(ticker[key]), new Decimal(0)).toFixed(10)

    expect(sum('valueAdded')).toBe(new Decimal(result.portfolio.valueAdded).toFixed(10))
    expect(sum('shadowValue')).toBe(new Decimal(result.portfolio.shadowValue).toFixed(10))
    expect(sum('currentValue')).toBe(new Decimal(result.portfolio.currentValue).toFixed(10))
    // And the identity the headline is built on.
    expect(
      new Decimal(result.portfolio.currentValue).minus(result.portfolio.shadowValue).toFixed(10),
    ).toBe(new Decimal(result.portfolio.valueAdded).toFixed(10))
  })

  it('includes the portfolio daily series by default and skips it on request', () => {
    const transactions = [buy(FIRST_DAY, 'ACME', '10', '1000')]
    expect(run(transactions).series?.dates).toHaveLength(7)
    expect(analyze({ transactions, prices: PRICES, includeSeries: false }).series).toBeNull()
  })

  it('reports where the benchmark series does not cover the ledger', () => {
    const result = run([buy('2024-06-03', 'ACME', '1', '100')])
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toMatchObject({ ticker: 'ACME', kind: 'before-benchmark-series' })
  })

  it('reports a still-held ticker with no price instead of inventing one', () => {
    const result = analyze({
      transactions: [buy(FIRST_DAY, 'GHOST', '5', '500')],
      prices: PRICES,
    })
    expect(result.missingPrices).toEqual(['GHOST'])
    expect(cents(result.byTicker[0].currentValue)).toBe('0.00')
    // The benchmark side is still knowable, so value added is a real (very negative) number.
    expect(cents(result.byTicker[0].shadowValue)).toBe('2500.00')
  })

  it('refuses to guess without the benchmark', () => {
    expect(() => analyze({ transactions: [], prices: { ACME: PRICES.ACME } })).toThrow(
      MissingBenchmarkError,
    )
  })

  it('accepts a different benchmark ticker', () => {
    const result = analyze({
      transactions: [buy(FIRST_DAY, 'ACME', '10', '1000')],
      prices: PRICES,
      benchmark: 'BETA',
    })
    expect(result.benchmark).toBe('BETA')
    // BETA is half the benchmark's price but has the same shape, so the ratio is unchanged.
    expect(cents(result.byTicker[0].shadowValue)).toBe('5000.00')
  })

  it('honours an explicit as-of date', () => {
    const result = analyze({
      transactions: [buy(FIRST_DAY, 'ACME', '10', '1000')],
      prices: PRICES,
      asOf: '2025-01-08',
    })
    expect(result.asOf).toBe('2025-01-08')
    expect(cents(result.byTicker[0].currentValue)).toBe('2000.00') // 10 x close 200
    expect(cents(result.byTicker[0].shadowValue)).toBe('4000.00') // 10 units x adj 400
  })

  it('serves one ticker’s series and decisions from the context it already built', () => {
    const result = run([
      buy(FIRST_DAY, 'ACME', '10', '1000'),
      buy('2025-01-06', 'BETA', '7', '700'),
    ])

    expect(tickerSeries(result, 'BETA').dates[0]).toBe('2025-01-06')
    expect(tickerSeries(result, 'ACME').value.at(-1)).toBe('3000.00')

    const decisions = tickerDecisions(result, 'ACME')
    expect(decisions).toHaveLength(1)
    expect(cents(decisions[0].valueAdded)).toBe('-2000.00')
  })

  it('is empty, not broken, with no transactions', () => {
    const result = run([])
    expect(result.byTicker).toEqual([])
    expect(cents(result.portfolio.valueAdded)).toBe('0.00')
    expect(result.portfolio.irr).toBeNull()
    expect(result.series?.dates).toEqual([])
  })
})

// --- performance ----------------------------------------------------------------------
// The acceptance check: six years of daily prices for sixty tickers, analyzed in under a
// second in Node. Everything here is generated, so the figures are meaningless - what is
// being measured is that `analyze` stays linear enough to run on a phone.

const BUDGET_MS = 1000

/** Deterministic generator, so a slow run is a real regression and not a different dataset. */
function lcg(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648
    return state / 2_147_483_648
  }
}

function weekdays(fromYear: number, years: number): string[] {
  const dates: string[] = []
  const day = new Date(Date.UTC(fromYear, 0, 1))
  const end = Date.UTC(fromYear + years, 0, 1)
  while (day.getTime() < end) {
    const weekday = day.getUTCDay()
    if (weekday !== 0 && weekday !== 6) dates.push(day.toISOString().slice(0, 10))
    day.setUTCDate(day.getUTCDate() + 1)
  }
  return dates
}

function syntheticPortfolio(tickerCount: number, years: number) {
  const dates = weekdays(2019, years)
  const random = lcg(20_251_002)
  const prices: Record<string, PriceHistory> = {}
  const transactions: Transaction[] = []

  const makeSeries = (): PriceHistory => {
    let price = 40 + random() * 160
    const closes = dates.map(() => {
      price = Math.max(1, price * (0.98 + random() * 0.04))
      return price.toFixed(2)
    })
    return history(closes, { dates })
  }

  prices.VOO = makeSeries()

  for (let t = 0; t < tickerCount; t++) {
    const ticker = `SYN${String(t).padStart(2, '0')}`
    prices[ticker] = makeSeries()

    // A buy every six weeks, a sell after every fourth, and a quarterly dividend: about
    // thirty flows per ticker, which is heavier than a real M1 account.
    for (let i = 0; i < dates.length; i += 30) {
      const date = dates[i]
      const close = Number(prices[ticker].close[i])
      const shares = (200 / close).toFixed(6)
      transactions.push({
        account_label: t % 2 === 0 ? 'taxable' : 'retirement',
        trade_date: date,
        ticker,
        type: 'buy',
        shares,
        amount_usd: '200',
        source: 'm1',
        source_row_hash: `${ticker}-b-${i}`,
        note: null,
        excluded: false,
      })

      if (i % 120 === 0 && i > 0) {
        transactions.push({
          account_label: 'taxable',
          trade_date: date,
          ticker,
          type: 'sell',
          shares,
          amount_usd: (Number(shares) * close).toFixed(2),
          source: 'm1',
          source_row_hash: `${ticker}-s-${i}`,
          note: null,
          excluded: false,
        })
      }

      if (i % 60 === 0) {
        transactions.push({
          account_label: 'taxable',
          trade_date: date,
          ticker,
          type: 'dividend',
          shares: null,
          amount_usd: '1.75',
          source: 'm1',
          source_row_hash: `${ticker}-d-${i}`,
          note: null,
          excluded: false,
        })
      }
    }
  }

  return { prices, transactions, dates }
}

describe('analyze performance', () => {
  it(`handles six years of sixty tickers in under ${BUDGET_MS}ms`, () => {
    const { prices, transactions, dates } = syntheticPortfolio(60, 6)
    expect(dates.length).toBeGreaterThan(1500)
    expect(transactions.length).toBeGreaterThan(3000)

    const started = performance.now()
    const result = analyze({ transactions, prices })
    const elapsed = performance.now() - started

    expect(result.byTicker).toHaveLength(60)
    expect(result.series?.dates.length).toBe(dates.length)
    expect(elapsed).toBeLessThan(BUDGET_MS)
  })

  it('serves one ticker’s detail screen without redoing the portfolio', () => {
    const { prices, transactions } = syntheticPortfolio(60, 6)
    const result = analyze({ transactions, prices, includeSeries: false })

    const started = performance.now()
    const series = tickerSeries(result, 'SYN07')
    const decisions = tickerDecisions(result, 'SYN07')
    const elapsed = performance.now() - started

    expect(series.dates.length).toBeGreaterThan(1500)
    expect(decisions.length).toBeGreaterThan(20)
    expect(elapsed).toBeLessThan(BUDGET_MS)
  })
})
