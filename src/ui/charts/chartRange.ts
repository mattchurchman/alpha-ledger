/**
 * Pure range maths for the history chart's range selector - no React, no I/O, unit-tested in
 * `chartRange.test.ts`. Fixed ranges step by trading-day counts (data is daily closes, so a
 * calendar-day count would drift against it); `YTD` is the one exception, since "year to date"
 * means the calendar year, not a day count.
 */

export type ChartRange = '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '3Y' | 'All'

export const CHART_RANGES: readonly ChartRange[] = ['1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y', 'All']

/** Short enough that an axis label needs the day, not just the month - see `HistoryChart`. */
export const SHORT_RANGES: ReadonlySet<ChartRange> = new Set(['1W', '1M', '3M', '6M'])

const TRADING_DAYS: Partial<Record<ChartRange, number>> = {
  '1W': 5,
  '1M': 21,
  '3M': 63,
  '6M': 126,
  '1Y': 252,
  '3Y': 756,
}

/**
 * The first index of `dates` (ascending `YYYY-MM-DD`) that falls inside `range`, counting back
 * from the most recent day. A range longer than the data - or `All` - returns 0, so the caller
 * always gets the whole series rather than an out-of-bounds slice.
 */
export function rangeStart(dates: readonly string[], range: ChartRange): number {
  const length = dates.length
  if (length === 0) return 0
  if (range === 'All') return 0
  if (range === 'YTD') {
    const year = dates[length - 1].slice(0, 4)
    const start = dates.findIndex((date) => date.slice(0, 4) === year)
    return start === -1 ? 0 : start
  }
  return Math.max(0, length - TRADING_DAYS[range]!)
}
