import { verifyAuth, type AuthEnv } from './auth'
import { apiError, toErrorResponse } from './http'
import { handleAliases } from './api/aliases'
import { exportAll, restoreAll } from './api/backup'
import { handleFairValues } from './api/fairValues'
import { handleMeta } from './api/meta'
import { handlePriceHistory } from './api/priceHistory'
import { createSession, deleteSession, readSession } from './api/session'
import { handleTransactions } from './api/transactions'
import { handlePricesRequest } from './prices'

export interface Env extends AuthEnv {
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

  if (pathname === '/api/session') {
    // Reaching this behind the gate is itself the answer.
    if (request.method === 'GET') return readSession()
    return apiError('Method not allowed', 405)
  }

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
      // The app shell: HTML and JS, no personal data. Unlike Cloudflare Access, which gated
      // the whole hostname at the edge, this gate lives inside the Worker and so can only
      // protect the API. Recorded in the SPEC 10 decision log.
      return env.ASSETS.fetch(request)
    }

    try {
      // Unlock and sign-out must be reachable without a session - they are what create and
      // destroy one. Everything else, `/api/health` included, is behind the gate: a liveness
      // probe that answered first would tell an unauthenticated caller the app is here.
      if (url.pathname === '/api/session') {
        if (request.method === 'POST') return await createSession(request, env, url)
        if (request.method === 'DELETE') return deleteSession(url)
      }

      const auth = await verifyAuth(request, env)
      if (!auth.ok) return apiError(auth.reason, auth.status)

      return await route(request, env, url)
    } catch (err) {
      return toErrorResponse(err)
    }
  },
} satisfies ExportedHandler<Env>
