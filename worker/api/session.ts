import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  sessionCookieHeader,
  signSession,
  tokenMatches,
  type AuthEnv,
} from '../auth'
import { apiError, json, readJson } from '../http'
import { asObject, reqString } from '../validate'

/**
 * `POST /api/session` - the unlock. This is the one route that must sit **outside** the gate,
 * so it is deliberately the only thing an unauthenticated caller can reach.
 *
 * There is no rate limiting and it needs none: the token is 256 random bits, so guessing is
 * not a strategy at any request rate, and a counter would need storage and CPU this tier does
 * not have to spare (SPEC 2).
 */
export async function createSession(request: Request, env: AuthEnv, url: URL): Promise<Response> {
  if (!env.AUTH_TOKEN?.trim()) return apiError('auth-not-configured', 403)

  const body = asObject(await readJson(request), 'body')
  const supplied = reqString(body, 'token')

  if (!(await tokenMatches(supplied, env))) {
    return apiError('invalid-token', 403)
  }

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const cookie = await signSession(env.AUTH_TOKEN.trim(), expiresAt)

  return new Response(JSON.stringify({ expires_at: expiresAt }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookieHeader(cookie, url, SESSION_TTL_SECONDS),
    },
  })
}

/** Sign out: expire the cookie. Ungated, because clearing your own cookie harms nobody. */
export function deleteSession(url: URL): Response {
  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': sessionCookieHeader('', url, 0) },
  })
}

/** `GET /api/session` runs behind the gate, so reaching it at all is the "yes" answer. */
export function readSession(): Response {
  return json({ authenticated: true })
}

export { SESSION_COOKIE }
