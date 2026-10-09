/**
 * Trading-day helpers. The "calendar" is always a price series' `dates` array - we never
 * model holidays ourselves, because Yahoo's series already is the list of days the market
 * traded. Every function here assumes `dates` holds `YYYY-MM-DD` strings in ascending
 * order, which is what `parseYahooChart` produces; ISO dates compare correctly as strings.
 */

/** Index of the first day on or after `date`, or `dates.length` if there is none. */
export function indexOnOrAfter(dates: string[], date: string): number {
  let low = 0
  let high = dates.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (dates[mid] < date) low = mid + 1
    else high = mid
  }
  return low
}

/** Index of the last day on or before `date`, or -1 if there is none. */
export function indexOnOrBefore(dates: string[], date: string): number {
  const at = indexOnOrAfter(dates, date)
  if (at < dates.length && dates[at] === date) return at
  return at - 1
}

/**
 * The day whose close prices a trade dated `date` should use: `date` itself when the
 * market traded, otherwise the next trading day (SPEC section 5). Null when `date` falls
 * after the end of the series - the caller decides whether that is a stale price series
 * or a future-dated transaction.
 */
export function nextTradingDay(dates: string[], date: string): string | null {
  const at = indexOnOrAfter(dates, date)
  return at < dates.length ? dates[at] : null
}

/** The last day the market traded on or before `date`; null when `date` precedes the series. */
export function previousTradingDay(dates: string[], date: string): string | null {
  const at = indexOnOrBefore(dates, date)
  return at >= 0 ? dates[at] : null
}

export function isTradingDay(dates: string[], date: string): boolean {
  const at = indexOnOrAfter(dates, date)
  return at < dates.length && dates[at] === date
}

/** Every trading day in `[from, to]`, inclusive. Used for the daily history series. */
export function tradingDaysBetween(dates: string[], from: string, to: string): string[] {
  const start = indexOnOrAfter(dates, from)
  const end = indexOnOrBefore(dates, to)
  return end < start ? [] : dates.slice(start, end + 1)
}
