import { describe, expect, it } from 'vitest'
import {
  DATES,
  FIRST_DAY,
  PRICES,
  WEEKEND_DAY,
  buy,
  dividend,
  sell,
} from './__fixtures__/synthetic'
import { dailySeries } from './series'

describe('dailySeries', () => {
  it('runs from the first transaction to the last price date', () => {
    const series = dailySeries({
      transactions: [buy('2025-01-07', 'ACME', '1', '150')],
      prices: PRICES,
    })
    expect(series.dates).toEqual(['2025-01-07', '2025-01-08', '2025-07-01', '2026-01-02'])
  })

  it('tracks value, shadow and gap day by day', () => {
    // 10 shares of ACME for $1,000 on day one. Real value is 10 x close; the shadow is
    // 10 units (1000/100) x the benchmark's adjusted close.
    const series = dailySeries({
      transactions: [buy(FIRST_DAY, 'ACME', '10', '1000')],
      prices: PRICES,
    })

    expect(series.dates).toEqual(DATES)
    expect(series.value).toEqual([
      '1000.00',
      '1100.00',
      '1200.00',
      '1500.00',
      '2000.00',
      '2500.00',
      '3000.00',
    ])
    expect(series.shadow).toEqual([
      '1000.00',
      '1000.00',
      '2000.00',
      '2000.00',
      '4000.00',
      '4000.00',
      '5000.00',
    ])
    expect(series.gap).toEqual([
      '0.00',
      '100.00',
      '-800.00',
      '-500.00',
      '-2000.00',
      '-1500.00',
      '-2000.00',
    ])
  })

  it('keeps gap exactly equal to value minus shadow on every day', () => {
    const series = dailySeries({
      transactions: [
        buy(FIRST_DAY, 'ACME', '3', '300'),
        buy('2025-01-06', 'BETA', '7', '700'),
        dividend('2025-01-07', 'ACME', '11.37'),
        sell('2025-01-08', 'BETA', '2', '400'),
      ],
      prices: PRICES,
    })

    for (let i = 0; i < series.dates.length; i++) {
      expect(Number(series.gap[i]).toFixed(2)).toBe(
        (Number(series.value[i]) - Number(series.shadow[i])).toFixed(2),
      )
    }
  })

  it('drops a position out of the real line but keeps the shadow bucket after a full sale', () => {
    const series = dailySeries({
      transactions: [
        buy(FIRST_DAY, 'ACME', '10', '1000'),
        sell('2025-01-06', 'ACME', '10', '1200'),
      ],
      prices: PRICES,
    })

    // From 01-06 the shares are gone, but the bucket still holds 10 - 6 = 4 units.
    expect(series.value.slice(2)).toEqual(['0.00', '0.00', '0.00', '0.00', '0.00'])
    expect(series.shadow.slice(2)).toEqual(['800.00', '800.00', '1600.00', '1600.00', '2000.00'])
  })

  it('starts the shadow on the next trading day for a weekend trade', () => {
    const series = dailySeries({
      transactions: [buy(WEEKEND_DAY, 'ACME', '2', '400')],
      prices: PRICES,
    })

    // The series starts on the Saturday's next trading day, since that is the first day the
    // benchmark calendar has on or after the trade.
    expect(series.dates[0]).toBe('2025-01-06')
    expect(series.shadow[0]).toBe('400.00')
    expect(series.value[0]).toBe('240.00')
  })

  it('gives one ticker its own series, starting at that ticker’s first trade', () => {
    const transactions = [
      buy(FIRST_DAY, 'ACME', '10', '1000'),
      buy('2025-01-06', 'BETA', '7', '700'),
    ]

    const beta = dailySeries({ transactions, prices: PRICES }, 'BETA')
    expect(beta.dates[0]).toBe('2025-01-06')
    // 7 shares at BETA's closes 100, 100, 200, 200, 250.
    expect(beta.value).toEqual(['700.00', '700.00', '1400.00', '1400.00', '1750.00'])
    // 700/200 = 3.5 units at adj 200, 200, 400, 400, 500.
    expect(beta.shadow).toEqual(['700.00', '700.00', '1400.00', '1400.00', '1750.00'])
  })

  it('honours an explicit from and asOf', () => {
    const series = dailySeries({
      transactions: [buy(FIRST_DAY, 'ACME', '10', '1000')],
      prices: PRICES,
      from: '2025-01-06',
      asOf: '2025-01-08',
    })
    expect(series.dates).toEqual(['2025-01-06', '2025-01-07', '2025-01-08'])
  })

  it('is empty when there is no benchmark history or no transaction', () => {
    expect(dailySeries({ transactions: [], prices: PRICES }).dates).toEqual([])
    expect(
      dailySeries({
        transactions: [buy(FIRST_DAY, 'ACME', '1', '100')],
        prices: { ACME: PRICES.ACME },
      }).dates,
    ).toEqual([])
  })
})
