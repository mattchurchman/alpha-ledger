import type { FairValueRow } from '../../src/api/types'
import { apiError, json, readJson } from '../http'
import { asObject, optString, parseId, reqDate, reqDecimal, reqTicker } from '../validate'

const COLUMNS = 'id, ticker, value_usd, effective_date, note, created_at'

export async function listFairValues(db: D1Database, params: URLSearchParams): Promise<Response> {
  const ticker = params.get('ticker')
  const sql =
    `SELECT ${COLUMNS} FROM fair_value` +
    (ticker ? ' WHERE ticker = ?' : '') +
    // Newest estimate per ticker last, so a reader can take the final row for each ticker.
    ' ORDER BY ticker, effective_date, id'

  const query = db.prepare(sql)
  const { results } = await (ticker ? query.bind(ticker.toUpperCase()) : query).all<FairValueRow>()
  return json(results)
}

/**
 * Append-only (SPEC 3): an updated estimate is a new row, which is what gives the stock
 * detail screen a fair-value history to chart. `created_at` is the server's clock, not the
 * client's, so a phone with a wrong date cannot reorder the history.
 */
export async function createFairValue(db: D1Database, request: Request): Promise<Response> {
  const body = asObject(await readJson(request), 'fair value')
  const row = await db
    .prepare(
      `INSERT INTO fair_value (ticker, value_usd, effective_date, note, created_at)
       VALUES (?, ?, ?, ?, ?)
       RETURNING ${COLUMNS}`,
    )
    .bind(
      reqTicker(body, 'ticker'),
      reqDecimal(body, 'value_usd'),
      reqDate(body, 'effective_date'),
      optString(body, 'note'),
      new Date().toISOString(),
    )
    .first<FairValueRow>()

  if (!row) return apiError('Insert returned no row', 500)
  return json(row, 201)
}

/** Deleting a mistaken entry is allowed, but only as its own explicit action (SPEC 3). */
export async function deleteFairValue(db: D1Database, id: number): Promise<Response> {
  const { meta } = await db.prepare('DELETE FROM fair_value WHERE id = ?').bind(id).run()
  if (meta.changes === 0) return apiError(`No fair value with id ${id}`, 404)
  return new Response(null, { status: 204 })
}

export async function handleFairValues(
  db: D1Database,
  request: Request,
  rest: string,
  params: URLSearchParams,
): Promise<Response | null> {
  if (rest === '') {
    if (request.method === 'GET') return listFairValues(db, params)
    if (request.method === 'POST') return createFairValue(db, request)
    return apiError('Method not allowed', 405)
  }

  const idMatch = /^\/(\d+)$/.exec(rest)
  if (idMatch) {
    if (request.method !== 'DELETE') return apiError('Method not allowed', 405)
    return deleteFairValue(db, parseId(idMatch[1]))
  }

  return null
}
