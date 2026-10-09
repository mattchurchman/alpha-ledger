import type { TickerAlias } from '../../src/api/types'
import { apiError, json, readJson } from '../http'
import { asObject, fail, reqDate, reqTicker } from '../validate'

export async function listAliases(db: D1Database): Promise<Response> {
  const { results } = await db
    .prepare('SELECT from_ticker, to_ticker, effective_date FROM ticker_alias ORDER BY effective_date, from_ticker')
    .all<TickerAlias>()
  return json(results)
}

/**
 * Saving the same `from_ticker` + `effective_date` again rewrites `to_ticker` instead of
 * erroring. The pair is the identity of "this symbol changed on this day", so a second save
 * is the user correcting the destination, not creating a second rename.
 */
export async function createAlias(db: D1Database, request: Request): Promise<Response> {
  const body = asObject(await readJson(request), 'alias')
  const alias: TickerAlias = {
    from_ticker: reqTicker(body, 'from_ticker'),
    to_ticker: reqTicker(body, 'to_ticker'),
    effective_date: reqDate(body, 'effective_date'),
  }
  // A self-alias would make `resolveTicker` chase its own tail for no gain.
  if (alias.from_ticker === alias.to_ticker) {
    fail('from_ticker and to_ticker must differ')
  }

  await db
    .prepare(
      `INSERT INTO ticker_alias (from_ticker, to_ticker, effective_date)
       VALUES (?, ?, ?)
       ON CONFLICT (from_ticker, effective_date) DO UPDATE SET to_ticker = excluded.to_ticker`,
    )
    .bind(alias.from_ticker, alias.to_ticker, alias.effective_date)
    .run()

  return json(alias, 201)
}

export async function deleteAlias(
  db: D1Database,
  fromTicker: string,
  effectiveDate: string,
): Promise<Response> {
  const { meta } = await db
    .prepare('DELETE FROM ticker_alias WHERE from_ticker = ? AND effective_date = ?')
    .bind(fromTicker.toUpperCase(), effectiveDate)
    .run()
  if (meta.changes === 0) return apiError(`No alias for ${fromTicker} on ${effectiveDate}`, 404)
  return new Response(null, { status: 204 })
}

/** Routes under `/api/aliases`. The composite primary key is the path, so there is no id. */
export async function handleAliases(
  db: D1Database,
  request: Request,
  rest: string,
): Promise<Response | null> {
  if (rest === '') {
    if (request.method === 'GET') return listAliases(db)
    if (request.method === 'POST') return createAlias(db, request)
    return apiError('Method not allowed', 405)
  }

  const match = /^\/([^/]+)\/(\d{4}-\d{2}-\d{2})$/.exec(rest)
  if (match) {
    if (request.method !== 'DELETE') return apiError('Method not allowed', 405)
    return deleteAlias(db, decodeURIComponent(match[1]), match[2])
  }

  return null
}
