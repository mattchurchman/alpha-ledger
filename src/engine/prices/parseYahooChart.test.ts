import { describe, expect, it } from 'vitest'
import nvdaWithSplit from '../../../tests/fixtures/prices/nvda_with_split.json'
import unknownTicker from '../../../tests/fixtures/prices/unknown_ticker.json'
import vooWithDividend from '../../../tests/fixtures/prices/voo_with_dividend.json'
import { parseYahooChart, YahooUpstreamError } from './parseYahooChart'

describe('parseYahooChart', () => {
  it('parses a normal response with a dividend and no splits', () => {
    const history = parseYahooChart(vooWithDividend, 'VOO')

    expect(history.dates.length).toBeGreaterThan(0)
    expect(history.dates.length).toBe(history.close.length)
    expect(history.dates.length).toBe(history.adjClose.length)
    expect(history.asOf).toBe(history.dates[history.dates.length - 1])
    expect(history.splits).toEqual([])
    expect(history.dividends).toEqual([{ date: '2026-09-28', amount: '1.823' }])

    // dates ascending, YYYY-MM-DD, no float noise left in prices
    for (let i = 1; i < history.dates.length; i++) {
      expect(history.dates[i] > history.dates[i - 1]).toBe(true)
    }
    expect(history.close[0]).toMatch(/^\d+(\.\d{1,4})?$/)
  })

  it('parses a split event onto the correct calendar date', () => {
    const history = parseYahooChart(nvdaWithSplit, 'NVDA')

    expect(history.splits).toEqual([{ date: '2021-07-20', numerator: 4, denominator: 1 }])
    expect(history.dates).toContain('2021-07-20')
  })

  it('throws a not-found error for an unknown ticker', () => {
    expect(() => parseYahooChart(unknownTicker, 'BOGUSXYZ123')).toThrow(YahooUpstreamError)
    try {
      parseYahooChart(unknownTicker, 'BOGUSXYZ123')
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(YahooUpstreamError)
      expect((err as YahooUpstreamError).kind).toBe('not-found')
    }
  })

  it('throws a bad-shape error when "chart" is missing', () => {
    try {
      parseYahooChart({ unexpected: true }, 'VOO')
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(YahooUpstreamError)
      expect((err as YahooUpstreamError).kind).toBe('bad-shape')
    }
  })

  it('throws a bad-shape error when quote/timestamp lengths disagree', () => {
    const malformed = {
      chart: {
        result: [
          {
            meta: { symbol: 'VOO' },
            timestamp: [1, 2, 3],
            indicators: { quote: [{ close: [100] }] },
          },
        ],
        error: null,
      },
    }
    try {
      parseYahooChart(malformed, 'VOO')
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(YahooUpstreamError)
      expect((err as YahooUpstreamError).kind).toBe('bad-shape')
    }
  })

  it('skips null price entries instead of crashing', () => {
    const withNulls = {
      chart: {
        result: [
          {
            meta: { symbol: 'VOO' },
            timestamp: [1700000000, 1700086400, 1700172800],
            indicators: {
              quote: [{ close: [100, null, 102] }],
              adjclose: [{ adjclose: [100, null, 102] }],
            },
          },
        ],
        error: null,
      },
    }
    const history = parseYahooChart(withNulls, 'VOO')
    expect(history.dates.length).toBe(2)
    expect(history.close).toEqual(['100', '102'])
  })

  it('cleans float32 rounding noise to 4 decimal places', () => {
    const noisy = {
      chart: {
        result: [
          {
            meta: { symbol: 'VOO' },
            timestamp: [1700000000],
            indicators: {
              quote: [{ close: [198.3699951171875] }],
              adjclose: [{ adjclose: [168.47303771972656] }],
            },
          },
        ],
        error: null,
      },
    }
    const history = parseYahooChart(noisy, 'VOO')
    expect(history.close).toEqual(['198.37'])
    expect(history.adjClose).toEqual(['168.473'])
  })
})
