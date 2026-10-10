import { describe, expect, it, vi } from 'vitest'
import type { PriceHistory } from '../engine/prices/types'
import {
  addDays,
  isStale,
  parseManualPriceCsv,
  priceFetchFrom,
  runMarketUpdate,
  tickersEverHeld,
  tradingDaysBetween,
  withManualPrice,
} from './marketData'

const history = (asOf: string, dates: string[] = [asOf]): PriceHistory => ({
  dates,
  close: dates.map(() => '1'),
  adjClose: dates.map(() => '1'),
  splits: [],
  dividends: [],
  asOf,
})

describe('addDays', () => {
  it('adds and subtracts across month and year boundaries', () => {
    expect(addDays('2026-01-05', -10)).toBe('2025-12-26')
    expect(addDays('2026-02-25', 5)).toBe('2026-03-02')
  })
})

describe('tickersEverHeld', () => {
  it('resolves through aliases and dedupes, sorted', () => {
    const tickers = tickersEverHeld(
      [
        { ticker: 'OLD', trade_date: '2024-01-01' },
        { ticker: 'BETA', trade_date: '2024-06-01' },
        { ticker: 'OLD', trade_date: '2024-02-01' },
      ],
      [{ from_ticker: 'OLD', to_ticker: 'NEW', effective_date: '2024-03-01' }],
    )
    expect(tickers).toEqual(['BETA', 'NEW'])
  })

  it('returns an empty list for no transactions', () => {
    expect(tickersEverHeld([], [])).toEqual([])
  })
})

describe('priceFetchFrom', () => {
  it('is 10 days before the earliest transaction, not per-ticker', () => {
    const from = priceFetchFrom(
      [{ trade_date: '2024-03-15' }, { trade_date: '2024-01-10' }],
      '2026-10-09',
    )
    expect(from).toBe('2023-12-31')
  })

  it('falls back to 10 days before today with no transactions', () => {
    expect(priceFetchFrom([], '2026-10-09')).toBe('2026-09-29')
  })
})

describe('tradingDaysBetween / isStale', () => {
  it('counts weekdays only, excluding the start date', () => {
    // Fri 2026-10-09 -> Mon 2026-10-12 is one trading day (the Monday); the weekend doesn't count.
    expect(tradingDaysBetween('2026-10-09', '2026-10-12')).toBe(1)
  })

  it('is not stale within five trading days', () => {
    expect(isStale('2026-10-05', '2026-10-09')).toBe(false)
  })

  it('is stale beyond five trading days', () => {
    expect(isStale('2026-09-25', '2026-10-09')).toBe(true)
  })

  it('is never stale with no stored price', () => {
    expect(isStale(null, '2026-10-09')).toBe(false)
  })
})

describe('runMarketUpdate', () => {
  it('fetches and stores every ticker, reporting progress', async () => {
    const progress: Array<[number, number]> = []
    const outcome = await runMarketUpdate({
      tickers: ['VOO', 'ACME', 'BETA'],
      fetchPrice: (ticker) => Promise.resolve(history('2026-10-08', [ticker])),
      storePrice: () => Promise.resolve(),
      onProgress: (done, total) => progress.push([done, total]),
    })
    expect(outcome.succeeded).toEqual(['ACME', 'BETA', 'VOO'])
    expect(outcome.failed).toEqual([])
    expect(progress).toHaveLength(3)
    expect(progress[2]).toEqual([3, 3])
  })

  it('retries a failing ticker once before giving up', async () => {
    let calls = 0
    const outcome = await runMarketUpdate({
      tickers: ['ACME'],
      fetchPrice: () => {
        calls++
        if (calls === 1) return Promise.reject(new Error('network blip'))
        return Promise.resolve(history('2026-10-08'))
      },
      storePrice: () => Promise.resolve(),
    })
    expect(calls).toBe(2)
    expect(outcome.succeeded).toEqual(['ACME'])
    expect(outcome.failed).toEqual([])
  })

  it('does not let one ticker that fails twice block the rest', async () => {
    const outcome = await runMarketUpdate({
      tickers: ['ACME', 'ZZZZQQ', 'BETA'],
      fetchPrice: (ticker) =>
        ticker === 'ZZZZQQ'
          ? Promise.reject(new Error(`Unknown ticker "${ticker}"`))
          : Promise.resolve(history('2026-10-08')),
      storePrice: () => Promise.resolve(),
    })
    expect(outcome.succeeded).toEqual(['ACME', 'BETA'])
    expect(outcome.failed).toEqual([{ ticker: 'ZZZZQQ', error: 'Unknown ticker "ZZZZQQ"' }])
  })

  it('respects the concurrency limit', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const outcome = await runMarketUpdate({
      tickers: ['A', 'B', 'C', 'D', 'E'],
      concurrency: 2,
      fetchPrice: async (ticker) => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 1))
        inFlight--
        return history('2026-10-08', [ticker])
      },
      storePrice: () => Promise.resolve(),
    })
    expect(maxInFlight).toBeLessThanOrEqual(2)
    expect(outcome.succeeded).toHaveLength(5)
  })

  it('handles an empty ticker list', async () => {
    const outcome = await runMarketUpdate({
      tickers: [],
      fetchPrice: vi.fn(),
      storePrice: vi.fn(),
    })
    expect(outcome).toEqual({ succeeded: [], failed: [] })
  })
})

describe('parseManualPriceCsv', () => {
  it('parses, sorts and dedupes by date', () => {
    const result = parseManualPriceCsv(
      'date,close,adjclose\n2026-10-08,711.28,711.28\n2026-10-07,713.71,713.71\n',
    )
    expect(result.dates).toEqual(['2026-10-07', '2026-10-08'])
    expect(result.close).toEqual(['713.71', '711.28'])
    expect(result.adjClose).toEqual(['713.71', '711.28'])
    expect(result.splits).toEqual([])
    expect(result.dividends).toEqual([])
    expect(result.asOf).toBe('2026-10-08')
  })

  it('is case-insensitive on the header and tolerates row order', () => {
    const result = parseManualPriceCsv('DATE,CLOSE,ADJCLOSE\n2026-10-08,1,1')
    expect(result.dates).toEqual(['2026-10-08'])
  })

  it('rejects a missing required column', () => {
    expect(() => parseManualPriceCsv('date,close\n2026-10-08,1')).toThrow(/adjclose/)
  })

  it('rejects an unparseable date', () => {
    expect(() => parseManualPriceCsv('date,close,adjclose\nOct 8 2026,1,1')).toThrow(/invalid date/)
  })

  it('rejects a non-numeric price', () => {
    expect(() => parseManualPriceCsv('date,close,adjclose\n2026-10-08,$1.00,1')).toThrow(
      /invalid close/,
    )
  })

  it('rejects an empty file and a header-only file', () => {
    expect(() => parseManualPriceCsv('')).toThrow(/empty/)
    expect(() => parseManualPriceCsv('date,close,adjclose\n')).toThrow(/no data rows/)
  })
})

describe('withManualPrice', () => {
  it('starts a new one-point series when nothing is stored yet', () => {
    const result = withManualPrice(null, '2026-10-09', '150.00')
    expect(result).toEqual({
      dates: ['2026-10-09'],
      close: ['150.00'],
      adjClose: ['150.00'],
      splits: [],
      dividends: [],
      asOf: '2026-10-09',
    })
  })

  it('appends a new day onto an existing series without touching earlier days', () => {
    const existing = history('2026-10-08', ['2026-10-07', '2026-10-08'])
    const result = withManualPrice(existing, '2026-10-09', '150.00')
    expect(result.dates).toEqual(['2026-10-07', '2026-10-08', '2026-10-09'])
    expect(result.close[2]).toBe('150.00')
    expect(result.close[0]).toBe('1')
    expect(result.asOf).toBe('2026-10-09')
  })

  it('overwrites the same day in place', () => {
    const existing = history('2026-10-08')
    const result = withManualPrice(existing, '2026-10-08', '999.00')
    expect(result.dates).toEqual(['2026-10-08'])
    expect(result.close).toEqual(['999.00'])
  })

  it('preserves splits and dividends from the existing series', () => {
    const existing: PriceHistory = {
      ...history('2026-10-08'),
      splits: [{ date: '2024-06-10', numerator: 10, denominator: 1 }],
      dividends: [{ date: '2026-09-28', amount: '1.82' }],
    }
    const result = withManualPrice(existing, '2026-10-09', '150.00')
    expect(result.splits).toEqual(existing.splits)
    expect(result.dividends).toEqual(existing.dividends)
  })
})
