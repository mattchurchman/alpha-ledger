import Decimal from 'decimal.js'
import type { PriceDividendEvent, PriceHistory, PriceSplitEvent } from './types'

export type YahooErrorKind = 'not-found' | 'rate-limited' | 'bad-shape'

export class YahooUpstreamError extends Error {
  readonly kind: YahooErrorKind

  constructor(message: string, kind: YahooErrorKind) {
    super(message)
    this.name = 'YahooUpstreamError'
    this.kind = kind
  }
}

const PRICE_DECIMALS = 4

/**
 * Parses Yahoo's v8 chart endpoint response (undocumented, shape may change) into
 * `PriceHistory`. Pure: takes already-parsed JSON, does no I/O.
 */
export function parseYahooChart(raw: unknown, ticker: string): PriceHistory {
  const chart = isObject(raw) ? raw.chart : undefined
  if (!isObject(chart)) {
    throw new YahooUpstreamError(
      'Yahoo response has no "chart" object; payload shape may have changed',
      'bad-shape',
    )
  }

  if (chart.error) {
    throw classifyError(chart.error, ticker)
  }

  const result = Array.isArray(chart.result) ? chart.result[0] : undefined
  if (!isObject(result)) {
    throw new YahooUpstreamError(`Yahoo returned no result for ${ticker}`, 'bad-shape')
  }

  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : []
  const quote = isObject(result.indicators) && Array.isArray(result.indicators.quote) ? result.indicators.quote[0] : undefined
  const closes = isObject(quote) && Array.isArray(quote.close) ? quote.close : []
  const adjquote =
    isObject(result.indicators) && Array.isArray(result.indicators.adjclose) ? result.indicators.adjclose[0] : undefined
  const adjCloses = isObject(adjquote) && Array.isArray(adjquote.adjclose) ? adjquote.adjclose : closes

  if (timestamps.length === 0 || closes.length !== timestamps.length) {
    throw new YahooUpstreamError(
      `Yahoo returned no usable price history for ${ticker}; payload shape may have changed`,
      'bad-shape',
    )
  }

  const dates: string[] = []
  const close: string[] = []
  const adjClose: string[] = []

  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i]
    const a = adjCloses[i]
    if (typeof c !== 'number' || typeof a !== 'number') continue
    dates.push(epochToUtcDate(timestamps[i]))
    close.push(toPriceString(c))
    adjClose.push(toPriceString(a))
  }

  if (dates.length === 0) {
    throw new YahooUpstreamError(`Yahoo returned only null prices for ${ticker}`, 'bad-shape')
  }

  const splits = eventValues(result.events, 'splits')
    .map((e): PriceSplitEvent | null => {
      if (typeof e.date !== 'number' || typeof e.numerator !== 'number' || typeof e.denominator !== 'number') {
        return null
      }
      return { date: epochToUtcDate(e.date), numerator: e.numerator, denominator: e.denominator }
    })
    .filter((e): e is PriceSplitEvent => e !== null)
    .sort((a, b) => a.date.localeCompare(b.date))

  const dividends = eventValues(result.events, 'dividends')
    .map((e): PriceDividendEvent | null => {
      if (typeof e.date !== 'number' || typeof e.amount !== 'number') return null
      return { date: epochToUtcDate(e.date), amount: toPriceString(e.amount) }
    })
    .filter((e): e is PriceDividendEvent => e !== null)
    .sort((a, b) => a.date.localeCompare(b.date))

  return { dates, close, adjClose, splits, dividends, asOf: dates[dates.length - 1] }
}

function classifyError(error: unknown, ticker: string): YahooUpstreamError {
  const code = isObject(error) && typeof error.code === 'string' ? error.code : ''
  const description = isObject(error) && typeof error.description === 'string' ? error.description : 'Yahoo returned an error'

  if (/not found/i.test(code)) {
    return new YahooUpstreamError(`Unknown ticker "${ticker}"`, 'not-found')
  }
  if (/limit|throttle|too many/i.test(code) || /limit|throttle|too many/i.test(description)) {
    return new YahooUpstreamError(description, 'rate-limited')
  }
  return new YahooUpstreamError(description, 'bad-shape')
}

function eventValues(events: unknown, key: 'splits' | 'dividends'): Record<string, unknown>[] {
  if (!isObject(events)) return []
  const group = events[key]
  if (!isObject(group)) return []
  return Object.values(group).filter(isObject)
}

/**
 * Daily bars are timestamped at US market open (9:30am ET = 13:30 or 14:30 UTC depending on
 * DST), never near a UTC midnight boundary, so the UTC calendar date is always the correct
 * trading day regardless of exchange timezone or DST - no offset needed.
 */
function epochToUtcDate(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000)
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Yahoo's floats carry float32 rounding noise past ~4 decimal places; clean it up here. */
function toPriceString(value: number): string {
  return new Decimal(value).toDecimalPlaces(PRICE_DECIMALS).toFixed()
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
