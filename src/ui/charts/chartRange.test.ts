import { describe, expect, it } from 'vitest'
import { CHART_RANGES, rangeStart, SHORT_RANGES, type ChartRange } from './chartRange'

/** `count` sequential calendar dates ending on `end` - good enough for index maths tests, which
 * never care whether a day was actually a trading day. */
function datesEndingOn(end: string, count: number): string[] {
  const out: string[] = []
  const cursor = new Date(`${end}T00:00:00Z`)
  for (let i = 0; i < count; i += 1) {
    out.unshift(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return out
}

/** `count` sequential calendar dates starting on `start`, forward. */
function datesFrom(start: string, count: number): string[] {
  const out: string[] = []
  const cursor = new Date(`${start}T00:00:00Z`)
  for (let i = 0; i < count; i += 1) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

describe('rangeStart', () => {
  it('returns 0 for every range on an empty series', () => {
    for (const range of CHART_RANGES) expect(rangeStart([], range)).toBe(0)
  })

  it('always returns 0 for All, regardless of length', () => {
    expect(rangeStart(datesEndingOn('2026-01-01', 3000), 'All')).toBe(0)
    expect(rangeStart(datesEndingOn('2026-01-01', 3), 'All')).toBe(0)
  })

  it('counts back by trading days for a fixed range with plenty of data', () => {
    const dates = datesEndingOn('2026-10-10', 2000)
    expect(rangeStart(dates, '1W')).toBe(2000 - 5)
    expect(rangeStart(dates, '1M')).toBe(2000 - 21)
    expect(rangeStart(dates, '3M')).toBe(2000 - 63)
    expect(rangeStart(dates, '6M')).toBe(2000 - 126)
    expect(rangeStart(dates, '1Y')).toBe(2000 - 252)
    expect(rangeStart(dates, '3Y')).toBe(2000 - 756)
  })

  it('clamps a range longer than the data to the start of the series', () => {
    const dates = datesEndingOn('2026-10-10', 10)
    expect(rangeStart(dates, '3Y')).toBe(0)
    expect(rangeStart(dates, '1Y')).toBe(0)
  })

  it('clamps when the range exactly matches the data length', () => {
    const dates = datesEndingOn('2026-10-10', 21)
    expect(rangeStart(dates, '1M')).toBe(0)
  })

  it('finds YTD by calendar date, not a day count, when the series crosses a year boundary', () => {
    const dates = datesFrom('2025-06-01', 400) // runs well past the next New Year's Day
    const start = rangeStart(dates, 'YTD')
    expect(dates[start]).toBe('2026-01-01')
  })

  it('returns 0 for YTD when the whole series already sits in the final year', () => {
    const dates = datesFrom('2026-01-05', 40)
    expect(rangeStart(dates, 'YTD')).toBe(0)
  })

  it('keeps SHORT_RANGES and CHART_RANGES in agreement on membership', () => {
    for (const range of SHORT_RANGES) expect(CHART_RANGES).toContain(range)
    const long: ChartRange[] = CHART_RANGES.filter((r) => !SHORT_RANGES.has(r))
    expect(long).toEqual(['YTD', '1Y', '3Y', 'All'])
  })
})
