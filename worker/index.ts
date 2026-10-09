import { verifyAccess, type AccessEnv } from './access'
import { apiError, toErrorResponse } from './http'
import { handleAliases } from './api/aliases'
import { exportAll, restoreAll } from './api/backup'
import { handleFairValues } from './api/fairValues'
import { handleMeta } from './api/meta'
import { handlePriceHistory } from './api/priceHistory'
import { handleTransactions } from './api/transactions'
import { handlePricesRequest } from './prices'

export interface Env extends AccessEnv {
  ASSETS: Fetcher
  DB: D1Database
}

/**
 * Returns the path remaining after `prefix`, or null if the path is not under it.
 * `/api/transactions` -> `''`, `/api/transactions/7` -> `'/7'`.
 */
function under(pathname: string, prefix: string): string | null {
  if (pathname === prefix) return ''
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length)
  return null
}

async function route(request: Request, env: Env, url: URL): Promise<Response> {
  const { pathname } = url
  const params = url.searchParams
  const db = env.DB

  if (pathname === '/api/health') {
    return Response.json({ status: 'ok' })
  }

  if (pathname.startsWith('/api/prices/')) {
    return handlePricesRequest(pathname, params)
  }

  let rest: string | null

  if ((rest = under(pathname, '/api/transactions')) !== null) {
    return (await handleTransactions(db, request, rest, params)) ?? apiError('Not found', 404)
  }
  if ((rest = under(pathname, '/api/aliases')) !== null) {
    return (await handleAliases(db, request, rest)) ?? apiError('Not found', 404)
  }
  if ((rest = under(pathname, '/api/fair-values')) !== null) {
    return (await handleFairValues(db, request, rest, params)) ?? apiError('Not found', 404)
  }
  if ((rest = under(pathname, '/api/price-history')) !== null) {
    return (await handlePriceHistory(db, request, rest)) ?? apiError('Not found', 404)
  }
  if ((rest = under(pathname, '/api/meta')) !== null) {
    return (await handleMeta(db, request, rest)) ?? apiError('Not found', 404)
  }

  if (pathname === '/api/export') {
    if (request.method !== 'GET') return apiError('Method not allowed', 405)
    return exportAll(db)
  }
  if (pathname === '/api/restore') {
    if (request.method !== 'POST') return apiError('Method not allowed', 405)
    return restoreAll(db, request)
  }

  return apiError('Not found', 404)
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)

    if (!url.pathname.startsWith('/api/')) {
      // Static assets. Access gates these at the edge for the whole hostname, so an
      // unauthenticated browser never reaches the Worker at all (SPEC 10).
      return env.ASSETS.fetch(request)
    }

    // Every `/api/*` route is gated, `/api/health` included: a liveness probe that answers
    // before the lock would tell an unauthenticated caller the app exists.
    const access = await verifyAccess(request, env)
    if (!access.ok) {
      return apiError(access.reason, access.status)
    }

    try {
      return await route(request, env, url)
    } catch (err) {
      return toErrorResponse(err)
    }
  },
} satisfies ExportedHandler<Env>
