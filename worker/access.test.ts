import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'
import { verifyAccess, type AccessEnv } from './access'

/**
 * These verify the real check - signature, issuer, audience, algorithm, expiry, email - by
 * signing tokens with a key pair generated here and handing `verifyAccess` a local key set
 * instead of Cloudflare's certs endpoint. Only the source of the public keys is swapped.
 */

const TEAM_DOMAIN = 'https://alpha-ledger-test.cloudflareaccess.com'
const AUD = 'd0b1f0a2c3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0'
const OWNER = 'owner@example.test'

const ENV: AccessEnv = {
  ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
  ACCESS_AUD: AUD,
  OWNER_EMAIL: OWNER,
}

let signingKey: CryptoKey
let keys: ReturnType<typeof createLocalJWKSet>
/** A second pair that the key set does not know, for the "signed by someone else" case. */
let foreignKey: CryptoKey

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true })
  signingKey = pair.privateKey
  const publicJwk = (await exportJWK(pair.publicKey)) as JWK
  keys = createLocalJWKSet({ keys: [{ ...publicJwk, alg: 'RS256', kid: 'test-key' }] })

  const other = await generateKeyPair('RS256', { extractable: true })
  foreignKey = other.privateKey
})

interface TokenOptions {
  email?: string | null
  issuer?: string
  audience?: string
  expiresIn?: string
  key?: CryptoKey
  alg?: string
}

async function token(opts: TokenOptions = {}): Promise<string> {
  const claims: Record<string, unknown> = {}
  if (opts.email !== null) claims.email = opts.email ?? OWNER

  return new SignJWT(claims)
    .setProtectedHeader({ alg: opts.alg ?? 'RS256', kid: 'test-key' })
    .setIssuer(opts.issuer ?? TEAM_DOMAIN)
    .setAudience(opts.audience ?? AUD)
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? '1h')
    .sign(opts.key ?? signingKey)
}

function withHeader(value: string): Request {
  return new Request('https://example.test/api/transactions', {
    headers: { 'Cf-Access-Jwt-Assertion': value },
  })
}

describe('verifyAccess', () => {
  it("lets the owner's valid token through", async () => {
    const result = await verifyAccess(withHeader(await token()), ENV, keys)
    expect(result).toEqual({ ok: true, email: OWNER })
  })

  it('accepts the CF_Authorization cookie when the header is absent', async () => {
    const request = new Request('https://example.test/api/transactions', {
      headers: { Cookie: `other=1; CF_Authorization=${await token()}; trailing=2` },
    })
    expect(await verifyAccess(request, ENV, keys)).toEqual({ ok: true, email: OWNER })
  })

  it('matches the owner email case-insensitively', async () => {
    const result = await verifyAccess(withHeader(await token({ email: 'Owner@Example.TEST' })), ENV, keys)
    expect(result.ok).toBe(true)
  })

  it('401s a request with no token at all', async () => {
    const request = new Request('https://example.test/api/transactions')
    expect(await verifyAccess(request, ENV, keys)).toEqual({
      ok: false,
      status: 401,
      reason: 'missing-access-token',
    })
  })

  it('403s a token signed by a key the certs endpoint does not list', async () => {
    const result = await verifyAccess(withHeader(await token({ key: foreignKey })), ENV, keys)
    expect(result).toEqual({ ok: false, status: 403, reason: 'invalid-access-token' })
  })

  it('403s a token for a different Access application (wrong aud)', async () => {
    const result = await verifyAccess(withHeader(await token({ audience: 'some-other-app' })), ENV, keys)
    expect(result).toMatchObject({ ok: false, status: 403, reason: 'invalid-access-token' })
  })

  it("403s a token from another team's Access (wrong issuer)", async () => {
    const result = await verifyAccess(
      withHeader(await token({ issuer: 'https://attacker.cloudflareaccess.com' })),
      ENV,
      keys,
    )
    expect(result).toMatchObject({ ok: false, status: 403, reason: 'invalid-access-token' })
  })

  it('403s an expired token', async () => {
    const result = await verifyAccess(withHeader(await token({ expiresIn: '-1s' })), ENV, keys)
    expect(result).toMatchObject({ ok: false, status: 403, reason: 'invalid-access-token' })
  })

  it('403s an unsigned "alg: none" token', async () => {
    // Hand-built, since a signer will not produce one: header.payload with an empty signature.
    const b64 = (o: unknown) =>
      btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
      email: OWNER,
      iss: TEAM_DOMAIN,
      aud: AUD,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })}.`
    const result = await verifyAccess(withHeader(unsigned), ENV, keys)
    expect(result).toMatchObject({ ok: false, status: 403, reason: 'invalid-access-token' })
  })

  it('403s a correctly signed token for the wrong person', async () => {
    const result = await verifyAccess(withHeader(await token({ email: 'someone@else.test' })), ENV, keys)
    expect(result).toEqual({ ok: false, status: 403, reason: 'not-the-owner' })
  })

  it('403s a token carrying no email claim', async () => {
    const result = await verifyAccess(withHeader(await token({ email: null })), ENV, keys)
    expect(result).toEqual({ ok: false, status: 403, reason: 'not-the-owner' })
  })

  // Secrets arrive by paste, and `echo` adds a newline. Without trimming, every one of
  // these would reject a perfectly good token.
  it('tolerates whitespace around each pasted secret', async () => {
    const padded: AccessEnv = {
      ACCESS_TEAM_DOMAIN: `${TEAM_DOMAIN}\n`,
      ACCESS_AUD: ` ${AUD} `,
      OWNER_EMAIL: `${OWNER}\n`,
    }
    expect(await verifyAccess(withHeader(await token()), padded, keys)).toEqual({
      ok: true,
      email: OWNER,
    })
  })

  it('still fails closed when a secret is nothing but whitespace', async () => {
    const blank = { ...ENV, ACCESS_AUD: '   ' }
    expect(await verifyAccess(withHeader(await token()), blank, keys)).toEqual({
      ok: false,
      status: 403,
      reason: 'access-not-configured',
    })
  })

  // The important one: a deploy that forgot a secret must lock the API, not open it.
  it.each(['ACCESS_TEAM_DOMAIN', 'ACCESS_AUD', 'OWNER_EMAIL'] as const)(
    'fails closed when %s is not set',
    async (missing) => {
      const env = { ...ENV, [missing]: undefined }
      const result = await verifyAccess(withHeader(await token()), env, keys)
      expect(result).toEqual({ ok: false, status: 403, reason: 'access-not-configured' })
    },
  )

  it('bypasses the check only when DEV_AUTH_BYPASS is exactly "true"', async () => {
    const bare = new Request('https://example.test/api/transactions')

    expect(await verifyAccess(bare, { DEV_AUTH_BYPASS: 'true' }, keys)).toEqual({
      ok: true,
      email: 'dev@localhost',
    })
    // Anything else - '1', 'yes', 'TRUE' - is not a bypass, so a stray value cannot open it.
    for (const value of ['1', 'yes', 'TRUE', '']) {
      expect(await verifyAccess(bare, { DEV_AUTH_BYPASS: value }, keys)).toMatchObject({ ok: false })
    }
  })
})
