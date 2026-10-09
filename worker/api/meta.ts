import type { MetaMap } from '../../src/api/types'
import { apiError, json, readJson } from '../http'
import { asObject, reqString } from '../validate'

export const UPSERT_META =
  'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'

/** The whole table as one object. It holds a handful of keys, so there is no list endpoint. */
export async function getMeta(db: D1Database): Promise<Response> {
  const { results } = await db
    .prepare('SELECT key, value FROM meta')
    .all<{ key: string; value: string }>()
  const map: MetaMap = {}
  for (const row of results) map[row.key] = row.value
  return json(map)
}

export async function putMeta(db: D1Database, key: string, request: Request): Promise<Response> {
  const body = asObject(await readJson(request), 'body')
  const value = reqString(body, 'value')
  await db.prepare(UPSERT_META).bind(key, value).run()
  return json({ key, value })
}

export async function handleMeta(
  db: D1Database,
  request: Request,
  rest: string,
): Promise<Response | null> {
  if (rest === '') {
    if (request.method !== 'GET') return apiError('Method not allowed', 405)
    return getMeta(db)
  }

  const match = /^\/([^/]+)$/.exec(rest)
  if (match) {
    if (request.method !== 'PUT') return apiError('Method not allowed', 405)
    return putMeta(db, decodeURIComponent(match[1]), request)
  }

  return null
}
