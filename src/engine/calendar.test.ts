import { describe, expect, it } from 'vitest'
import {
  indexOnOrAfter,
  indexOnOrBefore,
  isTradingDay,
  nextTradingDay,
  previousTradingDay,
  tradingDaysBetween,
} from './calendar'

// Jan 6-7 2024 is a weekend and Jan 1 was a holiday, so this is the shape of a real series.
const DATES = ['2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', '2024-01-08']

describe('nextTradingDay', () => {
  it('returns the day itself when the market traded', () => {
    expect(nextTradingDay(DATES, '2024-01-03')).toBe('2024-01-03')
  })

  it('skips a weekend forward, which is how a Saturday-dated trade gets priced', () => {
    expect(nextTradingDay(DATES, '2024-01-06')).toBe('2024-01-08')
  })

  it('skips a holiday before the series starts', () => {
    expect(nextTradingDay(DATES, '2024-01-01')).toBe('2024-01-02')
  })

  it('returns null past the end of the series', () => {
    expect(nextTradingDay(DATES, '2024-01-09')).toBeNull()
  })

  it('returns null for an empty series', () => {
    expect(nextTradingDay([], '2024-01-03')).toBeNull()
  })
})

describe('previousTradingDay', () => {
  it('returns the day itself when the market traded', () => {
    expect(previousTradingDay(DATES, '2024-01-05')).toBe('2024-01-05')
  })

  it('steps back over a weekend, which is how a Sunday valuation gets priced', () => {
    expect(previousTradingDay(DATES, '2024-01-07')).toBe('2024-01-05')
  })

  it('returns the last day in the series for a date past its end', () => {
    expect(previousTradingDay(DATES, '2024-06-01')).toBe('2024-01-08')
  })

  it('returns null before the series starts', () => {
    expect(previousTradingDay(DATES, '2023-12-29')).toBeNull()
  })
})

describe('isTradingDay', () => {
  it('distinguishes a trading day from a weekend', () => {
    expect(isTradingDay(DATES, '2024-01-04')).toBe(true)
    expect(isTradingDay(DATES, '2024-01-06')).toBe(false)
  })
})

describe('indexOnOrAfter and indexOnOrBefore', () => {
  it('finds an exact date', () => {
    expect(indexOnOrAfter(DATES, '2024-01-04')).toBe(2)
    expect(indexOnOrBefore(DATES, '2024-01-04')).toBe(2)
  })

  it('brackets a non-trading day from both sides', () => {
    expect(indexOnOrAfter(DATES, '2024-01-06')).toBe(4)
    expect(indexOnOrBefore(DATES, '2024-01-06')).toBe(3)
  })

  it('reports off-the-end with out-of-range indexes rather than throwing', () => {
    expect(indexOnOrAfter(DATES, '2024-02-01')).toBe(DATES.length)
    expect(indexOnOrBefore(DATES, '2023-01-01')).toBe(-1)
  })
})

describe('tradingDaysBetween', () => {
  it('includes both ends', () => {
    expect(tradingDaysBetween(DATES, '2024-01-03', '2024-01-05')).toEqual([
      '2024-01-03',
      '2024-01-04',
      '2024-01-05',
    ])
  })

  it('clamps a range that runs past either end of the series', () => {
    expect(tradingDaysBetween(DATES, '2023-01-01', '2025-01-01')).toEqual(DATES)
  })

  it('is empty when the range holds no trading day', () => {
    expect(tradingDaysBetween(DATES, '2024-01-06', '2024-01-07')).toEqual([])
  })

  it('is empty when the range is inverted', () => {
    expect(tradingDaysBetween(DATES, '2024-01-05', '2024-01-03')).toEqual([])
  })
})
