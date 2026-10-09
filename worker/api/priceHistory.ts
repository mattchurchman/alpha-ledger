import type { PriceDividendEvent, PriceHistory, PriceSplitEvent } from '../../src/engine/prices/types'
import type { StoredPriceHistory } from '../../src/api/types'
import { apiError, json, readJson } from '../http'
import { asArray, asObject, fail, reqEnum, TICKER_PATTERN } from '../validate'

const COLUMNS = 'ticker, fetched_at, series_json, splits_json, dividends_json, source'

export interface PriceHistoryDbRow {
  ticker: string
  fetched_at: string
  series_json: string
  splits_json: string
  dividends_json: string
  source: StoredPriceHistory['source']
}

/** The three JSON columns reassembled into the engine's `PriceHistory`. */
export function toStoredPriceHistory(row: PriceHistoryDbRow): StoredPriceHistory {
  const series = JSON.parse(row.series_json) as Pick<PriceHistory, 'dates' | 'close' | 'adjClose'>
  return {
    ticker: row.ticker,
    fetched_at: row.fetched_at,
    source: row.source,
    history: {
      ...series,
      splits: JSON.parse(row.splits_json) as PriceSplitEvent[],
      dividends: JSON.parse(row.dividends_json) as PriceDividendEvent[],
      // Derived, not stored: it is always the last date in the series
      // (src/engine/prices/parseYahooChart.ts), so storing it could only disagree.
      asOf: series.dates[series.dates.length - 1] ?? '',
    },
  }
}

function stringArray(obj: Record<string, unknown>, field: string): string[] {
  return asArray(obj[field], `"${field}"`).map((v) => {
    if (typeof v !== 'string') fail(`"${field}" must contain only strings`)
    return v
  })
}

/**
 * The engine reads `dates`, `close` and `adjClose` by shared index, so three arrays of
 * different lengths would silently price a day against another day's close. That makes the
 * equal-length check the one validation here that is load-bearing rather than hygiene.
 */
export function parsePriceHistory(value: unknown): PriceHistory {
  const body = asObject(value, 'history')
  const dates = stringArray(body, 'dates')
  const close = stringArray(body, 'close')
  const adjClose = stringArray(body, 'adjClose')
  if (close.length !== dates.length || adjClose.length !== dates.length) {
    fail('"dates", "close" and "adjClose" must all be the same length')
  }

  const splits = asArray(body.splits ?? [], '"splits"').map((raw) => {
    const s = asObject(raw, 'split')
    if (
      typeof s.date !== 'string' ||
      typeof s.numerator !== 'number' ||
      typeof s.denominator !== 'number'
    ) {
      fail('each split needs a string "date" and numeric "numerator" and "denominator"')
    }
    return { date: s.date, numerator: s.numerator, denominator: s.denominator } satisfies PriceSplitEvent
  })

  const dividends = asArray(body.dividends ?? [], '"dividends"').map((raw) => {
    const d = asObject(raw, 'dividend')
    if (typeof d.date !== 'string' || typeof d.amount !== 'string') {
      fail('each dividend needs a string "date" and a decimal-string "amount"')
    }
    return { date: d.date, amount: d.amount } satisfies PriceDividendEvent
  })

  return { dates, close, adjClose, splits, dividends, asOf: dates[dates.length - 1] ?? '' }
}

/** Shared with export/restore so one row is written the same way everywhere. */
export function priceHistoryBindings(
  ticker: string,
  fetchedAt: string,
  source: StoredPriceHistory['source'],
  history: PriceHistory,
): [string, string, string, string, string, string] {
  return [
    ticker,
    fetchedAt,
    JSON.stringify({ dates: history.dates, close: history.close, adjClose: history.adjClose }),
    JSON.stringify(history.splits),
    JSON.stringify(history.dividends),
    source,
  ]
}

export const UPSERT_PRICE_HISTORY = `INSERT INTO price_history (${COLUMNS})
   VALUES (?, ?, ?, ?, ?, ?)
   ON CONFLICT (ticker) DO UPDATE SET
     fetched_at = excluded.fetched_at,
     series_json = excluded.series_json,
     splits_json = excluded.splits_json,
     dividends_json = excluded.dividends_json,
     source = excluded.source`

export async function listPriceHistory(db: D1Database): Promise<Response> {
  const { results } = await db
    .prepare(`SELECT ${COLUMNS} FROM price_history ORDER BY ticker`)
    .all<PriceHistoryDbRow>()
  return json(results.map(toStoredPriceHistory))
}

/**
 * A fetched history always **replaces** the stored one rather than merging. Yahoo restates
 * adjusted closes after every dividend (SPEC 5), so an older row's `adjClose` values are
 * stale the moment a new one arrives; keeping any of them would mix two scales.
 */
export async function putPriceHistory(
  db: D1Database,
  ticker: string,
  request: Request,
): Promise<Response> {
  const body = asObject(await readJson(request), 'body')
  const source = reqEnum(body, 'source', ['yahoo', 'manual'] as const)
  const history = parsePriceHistory(body.history)

  await db
    .prepare(UPSERT_PRICE_HISTORY)
    .bind(...priceHistoryBindings(ticker, new Date().toISOString(), source, history))
    .run()

  const row = await db
    .prepare(`SELECT ${COLUMNS} FROM price_history WHERE ticker = ?`)
    .bind(ticker)
    .first<PriceHistoryDbRow>()
  if (!row) return apiError('Upsert returned no row', 500)
  return json(toStoredPriceHistory(row))
}

export async function handlePriceHistory(
  db: D1Database,
  request: Request,
  rest: string,
): Promise<Response | null> {
  if (rest === '') {
    if (request.method !== 'GET') return apiError('Method not allowed', 405)
    return listPriceHistory(db)
  }

  const match = /^\/([^/]+)$/.exec(rest)
  if (match) {
    if (request.method !== 'PUT') return apiError('Method not allowed', 405)
    const ticker = decodeURIComponent(match[1]).toUpperCase()
    if (!TICKER_PATTERN.test(ticker)) return apiError(`Invalid ticker "${ticker}"`, 400)
    return putPriceHistory(db, ticker, request)
  }

  return null
}
