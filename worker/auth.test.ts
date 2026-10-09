import { describe, expect, it } from 'vitest'
import {
  SESSION_COOKIE,
  sessionCookieHeader,
  signSession,
  tokenMatches,
  verifyAuth,
  type AuthEnv,
} from './auth'

/** A stand-in for a real 256-bit token; the shape is what matters, not the bytes. */
const TOKEN = 'kQ8vH2nR7xJ4mZ1pL6wB3tY9cF5sD0aG8hN2jK4qV7e'
const ENV: AuthEnv = { AUTH_TOKEN: TOKEN }

function withCookie(value: string): Request {
  return new Request('https://example.test/api/transactions', {
    headers: { Cookie: `${SESSION_COOKIE}=${value}` },
  })
}

function withBearer(value: string): Request {
  return new Request('https://example.test/api/transactions', {
    headers: { Authorization: `Bearer ${value}` },
  })
}

async function validCookie(token = TOKEN, secondsFromNow = 3600): Promise<string> {
  return signSession(token, Math.floor(Date.now() / 1000) + secondsFromNow)
}

describe('tokenMatches', () => {
  it('accepts the configured token and nothing else', async () => {
    expect(await tokenMatches(TOKEN, ENV)).toBe(true)
    expect(await tokenMatches(`${TOKEN}x`, ENV)).toBe(false)
    expect(await tokenMatches(TOKEN.slice(0, -1), ENV)).toBe(false)
    expect(await tokenMatches('', ENV)).toBe(false)
  })

  it('ignores whitespace around a pasted token', async () => {
    expect(await tokenMatches(`  ${TOKEN}\n`, ENV)).toBe(true)
    expect(await tokenMatches(TOKEN, { AUTH_TOKEN: `${TOKEN}\n` })).toBe(true)
  })

  it('never matches when no token is configured', async () => {
    expect(await tokenMatches('anything', {})).toBe(false)
    expect(await tokenMatches('', {})).toBe(false)
    // The empty-secret trap: a blank secret must not be satisfiable by a blank token.
    expect(await tokenMatches('   ', { AUTH_TOKEN: '   ' })).toBe(false)
  })
})

describe('verifyAuth', () => {
  it('accepts a validly signed session cookie', async () => {
    expect(await verifyAuth(withCookie(await validCookie()), ENV)).toEqual({ ok: true })
  })

  it('accepts the token as a bearer header, for curl and the setup checks', async () => {
    expect(await verifyAuth(withBearer(TOKEN), ENV)).toEqual({ ok: true })
  })

  it('401s a request carrying nothing', async () => {
    const bare = new Request('https://example.test/api/transactions')
    expect(await verifyAuth(bare, ENV)).toEqual({
      ok: false,
      status: 401,
      reason: 'missing-credentials',
    })
  })

  it('403s a wrong bearer token', async () => {
    expect(await verifyAuth(withBearer('not-the-token'), ENV)).toEqual({
      ok: false,
      status: 403,
      reason: 'invalid-token',
    })
  })

  it('403s a cookie whose signature does not verify', async () => {
    const cookie = await validCookie()
    const tampered = `${cookie.slice(0, -2)}AA`
    expect(await verifyAuth(withCookie(tampered), ENV)).toMatchObject({
      ok: false,
      status: 403,
      reason: 'invalid-session',
    })
  })

  // The attack this defends against: forge a payload with a far-future expiry and hope the
  // expiry is read before the signature is checked.
  it('403s a cookie whose payload was swapped for an unexpired one', async () => {
    const real = await validCookie()
    const mac = real.slice(real.indexOf('.'))
    const forged = btoa(JSON.stringify({ exp: 9999999999 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(await verifyAuth(withCookie(`${forged}${mac}`), ENV)).toEqual({
      ok: false,
      status: 403,
      reason: 'invalid-session',
    })
  })

  it('403s a cookie signed with a different token, which is how rotation signs devices out', async () => {
    const old = await validCookie('the-previous-token')
    expect(await verifyAuth(withCookie(old), ENV)).toMatchObject({
      ok: false,
      status: 403,
      reason: 'invalid-session',
    })
  })

  it('401s an expired session', async () => {
    const stale = await validCookie(TOKEN, -1)
    expect(await verifyAuth(withCookie(stale), ENV)).toEqual({
      ok: false,
      status: 401,
      reason: 'session-expired',
    })
  })

  it.each(['', 'nodot', 'not-base64!.not-base64!', '.', 'a.'])(
    'rejects the malformed cookie %o',
    async (value) => {
      expect(await verifyAuth(withCookie(value), ENV)).toMatchObject({ ok: false })
    },
  )

  it('fails closed when no token is configured', async () => {
    expect(await verifyAuth(withBearer(TOKEN), {})).toEqual({
      ok: false,
      status: 403,
      reason: 'auth-not-configured',
    })
    expect(await verifyAuth(withBearer(TOKEN), { AUTH_TOKEN: '  ' })).toEqual({
      ok: false,
      status: 403,
      reason: 'auth-not-configured',
    })
  })

  it('bypasses only when DEV_AUTH_BYPASS is exactly "true"', async () => {
    const bare = new Request('https://example.test/api/transactions')
    expect(await verifyAuth(bare, { DEV_AUTH_BYPASS: 'true' })).toEqual({ ok: true })
    for (const value of ['1', 'yes', 'TRUE', '']) {
      expect(await verifyAuth(bare, { DEV_AUTH_BYPASS: value })).toMatchObject({ ok: false })
    }
  })
})

describe('sessionCookieHeader', () => {
  it('is HttpOnly, Secure and SameSite=Strict in production', () => {
    const header = sessionCookieHeader('abc', new URL('https://alpha-ledger.test/'), 100)
    expect(header).toContain('HttpOnly')
    expect(header).toContain('Secure')
    // Strict is what stands in for a CSRF token - the cookie never rides a cross-site request.
    expect(header).toContain('SameSite=Strict')
    expect(header).toContain('Max-Age=100')
    expect(header).toContain('Path=/')
  })

  it('drops Secure on localhost, where wrangler dev serves plain HTTP', () => {
    const header = sessionCookieHeader('abc', new URL('http://localhost:8787/'), 100)
    expect(header).not.toContain('Secure')
    expect(header).toContain('HttpOnly')
  })
})
