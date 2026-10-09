/**
 * Cloudflare Access gate for `/api/*` (SPEC 10).
 *
 * Access itself already stops unauthenticated browsers at the edge. This is the second
 * lock: it proves the request actually came through Access and that the signed-in identity
 * is the owner's, so a request that somehow reaches the Worker directly cannot read the
 * ledger. Everything here fails closed - a missing secret is a 403, never an allow.
 */

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

export interface AccessEnv {
  /** `https://<team-name>.cloudflareaccess.com`. A secret: it names the user's account. */
  ACCESS_TEAM_DOMAIN?: string
  /** The Access application's AUD tag. A secret. */
  ACCESS_AUD?: string
  /** The one email allowed through. A secret; never in the repo (SPEC 10). */
  OWNER_EMAIL?: string
  /**
   * Local-only escape hatch. Set to `true` in `.dev.vars`, which is gitignored and is read
   * only by `wrangler dev` and the test pool - a deployed Worker has no way to see it
   * unless someone deliberately publishes it as a var or secret, which `docs/SETUP.md`
   * says not to do.
   */
  DEV_AUTH_BYPASS?: string
}

export type AccessIdentity = { ok: true; email: string }
export type AccessDenial = { ok: false; status: 401 | 403; reason: string }
export type AccessResult = AccessIdentity | AccessDenial

const JWT_HEADER = 'Cf-Access-Jwt-Assertion'
const JWT_COOKIE = 'CF_Authorization'

/**
 * One remote key set per team domain, kept at module scope so the certs endpoint is not
 * refetched on every request. `createRemoteJWKSet` handles Cloudflare's six-weekly key
 * rotation on its own: an unknown `kid` triggers a refetch (rate-limited), so the keys
 * are never pinned to a stale copy.
 */
const keySets = new Map<string, JWTVerifyGetKey>()

function keySetFor(teamDomain: string): JWTVerifyGetKey {
  let keys = keySets.get(teamDomain)
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`))
    keySets.set(teamDomain, keys)
  }
  return keys
}

/** Exposed only so tests can start from a clean cache. */
export function resetAccessKeyCache(): void {
  keySets.clear()
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return null
}

function accessToken(request: Request): string | null {
  // The header is what Access sends to the origin; the cookie is a fallback for a plain
  // browser navigation that somehow arrives without it.
  return (
    request.headers.get(JWT_HEADER) ??
    readCookie(request.headers.get('Cookie'), JWT_COOKIE)
  )
}

/** Emails are compared case-insensitively; Access normalizes to lowercase, users do not. */
function sameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * `keys` exists so tests can verify a locally signed token against a local key set. Nothing
 * else about the check changes: signature, issuer, audience, algorithm, expiry and the email
 * match all run exactly as they do in production, only the source of the public keys moves.
 */
export async function verifyAccess(
  request: Request,
  env: AccessEnv,
  keys?: JWTVerifyGetKey,
): Promise<AccessResult> {
  if (env.DEV_AUTH_BYPASS === 'true') {
    return { ok: true, email: 'dev@localhost' }
  }

  const { ACCESS_TEAM_DOMAIN, ACCESS_AUD, OWNER_EMAIL } = env
  if (!ACCESS_TEAM_DOMAIN || !ACCESS_AUD || !OWNER_EMAIL) {
    // Deploying without the secrets must lock the API, not open it.
    return { ok: false, status: 403, reason: 'access-not-configured' }
  }

  const token = accessToken(request)
  if (!token) return { ok: false, status: 401, reason: 'missing-access-token' }

  let email: unknown
  try {
    const { payload } = await jwtVerify(token, keys ?? keySetFor(ACCESS_TEAM_DOMAIN), {
      issuer: ACCESS_TEAM_DOMAIN,
      audience: ACCESS_AUD,
      // Pinned so a token signed with a different algorithm - or none - cannot be swapped in.
      algorithms: ['RS256'],
    })
    email = payload.email
  } catch {
    // Signature, audience, issuer and expiry failures are one answer: no.
    return { ok: false, status: 403, reason: 'invalid-access-token' }
  }

  if (typeof email !== 'string' || !sameEmail(email, OWNER_EMAIL)) {
    return { ok: false, status: 403, reason: 'not-the-owner' }
  }

  return { ok: true, email }
}
