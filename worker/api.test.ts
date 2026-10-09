import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import type {
  BulkUpsertResult,
  ExportBundle,
  FairValueRow,
  MetaMap,
  RestoreResult,
  StoredPriceHistory,
  TickerAlias,
  TransactionInput,
  TransactionRow,
} from '../src/api/types'
import worker, { type Env } from './index'

/**
 * Route tests. These run inside workerd against a real local D1 (see
 * `vitest.worker.config.ts`), so the CHECK constraints and the UNIQUE dedupe on
 * `source_row_hash` are exercised for real rather than mocked.
 *
 * All fixtures are synthetic: invented tickers, round numbers, example.test emails.
 *
 * The Worker's default export is called directly rather than through `SELF` so each case can
 * hand it a different env - which is what makes the signed-out cases testable at all.
 */

const ORIGIN = 'https://alpha-ledger.test'

async function call(
  path: string,
  init: RequestInit = {},
  overrides: Partial<Env> = {},
): Promise<Response> {
  // `new Request` builds an outbound request; the handler's parameter is an inbound one,
  // which differs only in the `cf` property the runtime adds and nothing here reads.
  const request = new Request(`${ORIGIN}${path}`, init) as unknown as Parameters<
    typeof worker.fetch
  >[0]
  return worker.fetch(request, { ...env, ...overrides })
}

const send = (method: string, path: string, body?: unknown, overrides?: Partial<Env>) =>
  call(
    path,
    {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    },
    overrides,
  )

async function expectJson<T>(response: Response, status: number): Promise<T> {
  expect(response.status).toBe(status)
  return (await response.json()) as T
}

function tx(overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    account_label: 'brokerage',
    trade_date: '2024-03-04',
    ticker: 'ACME',
    type: 'buy',
    shares: '10.5',
    amount_usd: '1050.00',
    source: 'manual',
    source_row_hash: 'hash-1',
    ...overrides,
  }
}

const SERIES = {
  dates: ['2024-03-01', '2024-03-04', '2024-03-05'],
  close: ['100.00', '101.00', '102.00'],
  adjClose: ['99.00', '100.00', '101.00'],
  splits: [{ date: '2024-03-04', numerator: 2, denominator: 1 }],
  dividends: [{ date: '2024-03-05', amount: '0.25' }],
  asOf: '2024-03-05',
}

beforeEach(async () => {
  // Storage is isolated per test file, not per test, so each case starts from empty tables.
  await env.DB.batch([
    env.DB.prepare('DELETE FROM transactions'),
    env.DB.prepare('DELETE FROM ticker_alias'),
    env.DB.prepare('DELETE FROM fair_value'),
    env.DB.prepare('DELETE FROM price_history'),
    env.DB.prepare('DELETE FROM meta'),
  ])
})

describe('the auth gate', () => {
  // No dev bypass: what a real signed-out request meets.
  const signedOut: Partial<Env> = { DEV_AUTH_BYPASS: undefined }
  const TOKEN = env.AUTH_TOKEN as string

  const bearer = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })

  it('401s an /api request carrying no credentials', async () => {
    const response = await call('/api/transactions', {}, signedOut)
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'missing-credentials' })
  })

  it('403s a wrong token', async () => {
    const response = await call('/api/transactions', bearer('not-the-token'), signedOut)
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'invalid-token' })
  })

  it('lets the right token through', async () => {
    const response = await call('/api/transactions', bearer(TOKEN), signedOut)
    expect(response.status).toBe(200)
  })

  it('403s when no token is configured, rather than allowing the request', async () => {
    const response = await call('/api/transactions', bearer(TOKEN), {
      DEV_AUTH_BYPASS: undefined,
      AUTH_TOKEN: undefined,
    })
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'auth-not-configured' })
  })

  it('gates /api/health too, so an unauthenticated probe learns nothing', async () => {
    expect((await call('/api/health', {}, signedOut)).status).toBe(401)
    expect((await call('/api/health')).status).toBe(200)
  })

  it('gates every data route', async () => {
    for (const [method, path] of [
      ['POST', '/api/transactions'],
      ['POST', '/api/transactions/bulk'],
      ['GET', '/api/aliases'],
      ['POST', '/api/fair-values'],
      ['GET', '/api/price-history'],
      ['GET', '/api/meta'],
      ['GET', '/api/export'],
      ['POST', '/api/restore'],
      ['GET', '/api/session'],
      ['GET', '/api/prices/VOO'],
    ] as const) {
      const response = await send(method, path, undefined, signedOut)
      expect([401, 403], `${method} ${path}`).toContain(response.status)
    }
  })

  it('serves the app shell ungated - it is HTML and JS, with no data in it', async () => {
    // Reaching ASSETS at all is the assertion; what it returns is the asset handler's business.
    const response = await call('/', {}, signedOut)
    expect(response.status).not.toBe(401)
    expect(response.status).not.toBe(403)
  })
})

describe('the unlock flow', () => {
  const signedOut: Partial<Env> = { DEV_AUTH_BYPASS: undefined }
  const TOKEN = env.AUTH_TOKEN as string

  /** The `Set-Cookie` value reduced to what a browser would send back. */
  function cookieFrom(response: Response): string {
    const header = response.headers.get('Set-Cookie')
    expect(header).toBeTruthy()
    return (header as string).split(';')[0]
  }

  it('exchanges the token for a session cookie', async () => {
    const response = await send('POST', '/api/session', { token: TOKEN }, signedOut)
    expect(response.status).toBe(200)

    const header = response.headers.get('Set-Cookie') ?? ''
    expect(header).toContain('al_session=')
    expect(header).toContain('HttpOnly')
    expect(header).toContain('SameSite=Strict')

    const body = (await response.json()) as { expires_at: number }
    // A year, give or take the second this test takes to run.
    expect(body.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000) + 364 * 24 * 3600)
  })

  it('the issued cookie then opens the data routes', async () => {
    const login = await send('POST', '/api/session', { token: TOKEN }, signedOut)
    const cookie = cookieFrom(login)

    const response = await call('/api/transactions', { headers: { Cookie: cookie } }, signedOut)
    expect(response.status).toBe(200)

    const whoami = await call('/api/session', { headers: { Cookie: cookie } }, signedOut)
    expect(await expectJson<{ authenticated: boolean }>(whoami, 200)).toEqual({
      authenticated: true,
    })
  })

  it('refuses the wrong token and issues no cookie', async () => {
    const response = await send('POST', '/api/session', { token: 'wrong' }, signedOut)
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'invalid-token' })
    expect(response.headers.get('Set-Cookie')).toBeNull()
  })

  it('400s a malformed unlock body without revealing whether a token would have worked', async () => {
    expect((await send('POST', '/api/session', {}, signedOut)).status).toBe(400)
    expect((await send('POST', '/api/session', { token: 42 }, signedOut)).status).toBe(400)
  })

  it('403s the unlock when no token is configured', async () => {
    const response = await send('POST', '/api/session', { token: TOKEN }, {
      DEV_AUTH_BYPASS: undefined,
      AUTH_TOKEN: undefined,
    })
    expect(response.status).toBe(403)
  })

  it('signs out by expiring the cookie', async () => {
    const response = await send('DELETE', '/api/session', undefined, signedOut)
    expect(response.status).toBe(204)
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0')
  })

  it('only POST and DELETE are reachable unauthenticated; other methods meet the gate', async () => {
    // Only unlock and sign-out sit outside the gate, so an unauthenticated PATCH gets 401
    // rather than 405 - it does not get to learn which methods the route has.
    expect((await send('PATCH', '/api/session', {}, signedOut)).status).toBe(401)
    expect((await send('PATCH', '/api/session', {})).status).toBe(405)
  })
})

describe('transactions', () => {
  it('creates a row and lists it back', async () => {
    const created = await expectJson<TransactionRow>(await send('POST', '/api/transactions', tx()), 201)
    expect(created).toMatchObject({ ticker: 'ACME', shares: '10.5', amount_usd: '1050.00', excluded: false })
    expect(created.id).toBeGreaterThan(0)

    const list = await expectJson<TransactionRow[]>(await call('/api/transactions'), 200)
    expect(list).toEqual([created])
  })

  it('keeps share counts and amounts as exact decimal strings', async () => {
    // A float64 round trip would turn this into 0.30000000000000004-shaped noise.
    await send('POST', '/api/transactions', tx({ shares: '0.123456789', amount_usd: '12.30' }))
    const [row] = await expectJson<TransactionRow[]>(await call('/api/transactions'), 200)
    expect(row.shares).toBe('0.123456789')
    expect(row.amount_usd).toBe('12.30')
  })

  it('uppercases the ticker on the way in', async () => {
    const row = await expectJson<TransactionRow>(
      await send('POST', '/api/transactions', tx({ ticker: 'acme' })),
      201,
    )
    expect(row.ticker).toBe('ACME')
  })

  it('rejects a second row with the same source_row_hash', async () => {
    await send('POST', '/api/transactions', tx())
    const response = await send('POST', '/api/transactions', tx({ amount_usd: '9.99' }))
    expect(response.status).toBe(400)
    expect(((await response.json()) as { error: string }).error).toMatch(/already exists/)
  })

  it('allows a negative share count only on an adjust', async () => {
    const ok = await send('POST', '/api/transactions', tx({ type: 'adjust', shares: '-4', amount_usd: '0' }))
    expect(ok.status).toBe(201)

    const bad = await send(
      'POST',
      '/api/transactions',
      tx({ type: 'sell', shares: '-4', source_row_hash: 'hash-2' }),
    )
    expect(bad.status).toBe(400)
  })

  it.each([
    ['an unknown type', tx({ type: 'deposit' as TransactionInput['type'] })],
    ['a date that is not a real day', tx({ trade_date: '2024-02-30' })],
    ['a date in the wrong format', tx({ trade_date: '04/03/2024' })],
    ['a numeric amount instead of a decimal string', tx({ amount_usd: 1050 as unknown as string })],
    ['a negative amount', tx({ amount_usd: '-1050.00' })],
    ['an unparseable amount', tx({ amount_usd: '1,050.00' })],
    ['an invalid ticker', tx({ ticker: 'not a ticker' })],
    ['an unknown source', tx({ source: 'fidelity' as TransactionInput['source'] })],
    ['a missing account label', tx({ account_label: '' })],
  ])('400s %s', async (_label, body) => {
    const response = await send('POST', '/api/transactions', body)
    expect(response.status).toBe(400)
  })

  it('400s a body that is not JSON at all', async () => {
    const response = await call('/api/transactions', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    })
    expect(response.status).toBe(400)
  })

  it('filters by ticker, account and type', async () => {
    await send('POST', '/api/transactions/bulk', {
      transactions: [
        tx({ source_row_hash: 'a' }),
        tx({ source_row_hash: 'b', ticker: 'BETA' }),
        tx({ source_row_hash: 'c', account_label: 'roth' }),
        tx({ source_row_hash: 'd', type: 'dividend', shares: null, amount_usd: '3.00' }),
      ],
    })

    const byTicker = await expectJson<TransactionRow[]>(await call('/api/transactions?ticker=BETA'), 200)
    expect(byTicker.map((r) => r.source_row_hash)).toEqual(['b'])

    const byAccount = await expectJson<TransactionRow[]>(await call('/api/transactions?account=roth'), 200)
    expect(byAccount.map((r) => r.source_row_hash)).toEqual(['c'])

    const byType = await expectJson<TransactionRow[]>(await call('/api/transactions?type=dividend'), 200)
    expect(byType.map((r) => r.source_row_hash)).toEqual(['d'])

    expect((await call('/api/transactions?type=nonsense')).status).toBe(400)
  })

  it('returns rows ordered by trade date', async () => {
    await send('POST', '/api/transactions/bulk', {
      transactions: [
        tx({ source_row_hash: 'late', trade_date: '2024-06-01' }),
        tx({ source_row_hash: 'early', trade_date: '2023-01-09' }),
        tx({ source_row_hash: 'mid', trade_date: '2024-03-04' }),
      ],
    })
    const list = await expectJson<TransactionRow[]>(await call('/api/transactions'), 200)
    expect(list.map((r) => r.source_row_hash)).toEqual(['early', 'mid', 'late'])
  })

  describe('bulk upsert', () => {
    it('inserts new hashes and reports them', async () => {
      const result = await expectJson<BulkUpsertResult>(
        await send('POST', '/api/transactions/bulk', {
          transactions: [tx({ source_row_hash: 'a' }), tx({ source_row_hash: 'b' })],
        }),
        200,
      )
      expect(result).toEqual({ inserted: 2, skipped: 0 })
    })

    it('skips hashes it already has, which is the overlapping-export case', async () => {
      await send('POST', '/api/transactions/bulk', {
        transactions: [tx({ source_row_hash: 'a' }), tx({ source_row_hash: 'b' })],
      })
      const second = await expectJson<BulkUpsertResult>(
        await send('POST', '/api/transactions/bulk', {
          transactions: [tx({ source_row_hash: 'b' }), tx({ source_row_hash: 'c' })],
        }),
        200,
      )
      expect(second).toEqual({ inserted: 1, skipped: 1 })
      const list = await expectJson<TransactionRow[]>(await call('/api/transactions'), 200)
      expect(list).toHaveLength(3)
    })

    it('leaves an edited row alone when the same hash is re-imported', async () => {
      const [created] = [
        await expectJson<TransactionRow>(await send('POST', '/api/transactions', tx()), 201),
      ]
      await send('POST', `/api/transactions/${created.id}/exclude`, { excluded: true })

      await send('POST', '/api/transactions/bulk', { transactions: [tx({ amount_usd: '1.00' })] })

      const [row] = await expectJson<TransactionRow[]>(await call('/api/transactions'), 200)
      expect(row.excluded).toBe(true)
      expect(row.amount_usd).toBe('1050.00')
    })

    it('handles an empty list and a batch bigger than one chunk', async () => {
      expect(
        await expectJson<BulkUpsertResult>(
          await send('POST', '/api/transactions/bulk', { transactions: [] }),
          200,
        ),
      ).toEqual({ inserted: 0, skipped: 0 })

      const many = Array.from({ length: 250 }, (_, i) => tx({ source_row_hash: `bulk-${i}` }))
      expect(
        await expectJson<BulkUpsertResult>(
          await send('POST', '/api/transactions/bulk', { transactions: many }),
          200,
        ),
      ).toEqual({ inserted: 250, skipped: 0 })
    })

    it('400s the whole batch if any row is invalid, inserting none of it', async () => {
      const response = await send('POST', '/api/transactions/bulk', {
        transactions: [tx({ source_row_hash: 'good' }), tx({ source_row_hash: 'bad', type: 'nope' as never })],
      })
      expect(response.status).toBe(400)
      expect(await expectJson<TransactionRow[]>(await call('/api/transactions'), 200)).toEqual([])
    })
  })

  it('patches one field at a time and leaves the rest', async () => {
    const created = await expectJson<TransactionRow>(await send('POST', '/api/transactions', tx()), 201)

    const patched = await expectJson<TransactionRow>(
      await send('PATCH', `/api/transactions/${created.id}`, { note: 'corrected from statement' }),
      200,
    )
    expect(patched).toEqual({ ...created, note: 'corrected from statement' })

    expect((await send('PATCH', `/api/transactions/${created.id}`, {})).status).toBe(400)
    expect((await send('PATCH', `/api/transactions/${created.id}`, { trade_date: 'nope' })).status).toBe(400)
    expect((await send('PATCH', '/api/transactions/9999', { note: 'x' })).status).toBe(404)
  })

  it('excludes and re-includes a row', async () => {
    const created = await expectJson<TransactionRow>(await send('POST', '/api/transactions', tx()), 201)

    const excluded = await expectJson<TransactionRow>(
      await send('POST', `/api/transactions/${created.id}/exclude`, { excluded: true }),
      200,
    )
    expect(excluded.excluded).toBe(true)

    const included = await expectJson<TransactionRow>(
      await send('POST', `/api/transactions/${created.id}/exclude`, { excluded: false }),
      200,
    )
    expect(included.excluded).toBe(false)

    // Excluded rows stay in the list with their flag; the engine is what skips them.
    await send('POST', `/api/transactions/${created.id}/exclude`, { excluded: true })
    expect(await expectJson<TransactionRow[]>(await call('/api/transactions'), 200)).toHaveLength(1)

    expect((await send('POST', '/api/transactions/9999/exclude', { excluded: true })).status).toBe(404)
  })

  it('deletes a row', async () => {
    const created = await expectJson<TransactionRow>(await send('POST', '/api/transactions', tx()), 201)
    expect((await send('DELETE', `/api/transactions/${created.id}`)).status).toBe(204)
    expect(await expectJson<TransactionRow[]>(await call('/api/transactions'), 200)).toEqual([])
    expect((await send('DELETE', `/api/transactions/${created.id}`)).status).toBe(404)
  })

  it('405s a method a route does not have', async () => {
    expect((await send('DELETE', '/api/transactions')).status).toBe(405)
    expect((await send('GET', '/api/transactions/bulk')).status).toBe(405)
  })
})

describe('aliases', () => {
  const alias: TickerAlias = { from_ticker: 'OLD', to_ticker: 'NEW', effective_date: '2024-05-06' }

  it('creates, lists and deletes', async () => {
    expect(await expectJson<TickerAlias>(await send('POST', '/api/aliases', alias), 201)).toEqual(alias)
    expect(await expectJson<TickerAlias[]>(await call('/api/aliases'), 200)).toEqual([alias])

    expect(
      (await send('DELETE', `/api/aliases/${alias.from_ticker}/${alias.effective_date}`)).status,
    ).toBe(204)
    expect(await expectJson<TickerAlias[]>(await call('/api/aliases'), 200)).toEqual([])
    expect((await send('DELETE', '/api/aliases/OLD/2024-05-06')).status).toBe(404)
  })

  it('rewrites the destination when the same rename is saved again', async () => {
    await send('POST', '/api/aliases', alias)
    await send('POST', '/api/aliases', { ...alias, to_ticker: 'OTHER' })
    const list = await expectJson<TickerAlias[]>(await call('/api/aliases'), 200)
    expect(list).toEqual([{ ...alias, to_ticker: 'OTHER' }])
  })

  it('keeps two renames of the same symbol on different dates', async () => {
    await send('POST', '/api/aliases', alias)
    await send('POST', '/api/aliases', { ...alias, to_ticker: 'THIRD', effective_date: '2025-01-02' })
    expect(await expectJson<TickerAlias[]>(await call('/api/aliases'), 200)).toHaveLength(2)
  })

  it('rejects a self-alias and a bad date', async () => {
    expect((await send('POST', '/api/aliases', { ...alias, to_ticker: 'OLD' })).status).toBe(400)
    expect((await send('POST', '/api/aliases', { ...alias, effective_date: '2024-13-01' })).status).toBe(400)
  })
})

describe('fair values', () => {
  const fv = { ticker: 'ACME', value_usd: '120.00', effective_date: '2024-04-01' }

  it('appends rather than replaces, so the history survives', async () => {
    const first = await expectJson<FairValueRow>(await send('POST', '/api/fair-values', fv), 201)
    const second = await expectJson<FairValueRow>(
      await send('POST', '/api/fair-values', { ...fv, value_usd: '135.50', effective_date: '2024-07-01' }),
      201,
    )
    expect(second.id).not.toBe(first.id)

    const list = await expectJson<FairValueRow[]>(await call('/api/fair-values'), 200)
    expect(list.map((r) => r.value_usd)).toEqual(['120.00', '135.50'])
  })

  it('stamps created_at on the server', async () => {
    const row = await expectJson<FairValueRow>(
      await send('POST', '/api/fair-values', { ...fv, created_at: '1999-01-01T00:00:00.000Z' }),
      201,
    )
    expect(row.created_at).not.toBe('1999-01-01T00:00:00.000Z')
    expect(Date.parse(row.created_at)).toBeGreaterThan(Date.parse('2026-01-01T00:00:00Z'))
  })

  it('filters by ticker', async () => {
    await send('POST', '/api/fair-values', fv)
    await send('POST', '/api/fair-values', { ...fv, ticker: 'BETA' })
    const list = await expectJson<FairValueRow[]>(await call('/api/fair-values?ticker=BETA'), 200)
    expect(list.map((r) => r.ticker)).toEqual(['BETA'])
  })

  it('deletes one entry explicitly', async () => {
    const row = await expectJson<FairValueRow>(await send('POST', '/api/fair-values', fv), 201)
    expect((await send('DELETE', `/api/fair-values/${row.id}`)).status).toBe(204)
    expect((await send('DELETE', `/api/fair-values/${row.id}`)).status).toBe(404)
  })

  it('400s a negative or non-decimal value', async () => {
    expect((await send('POST', '/api/fair-values', { ...fv, value_usd: '-1' })).status).toBe(400)
    expect((await send('POST', '/api/fair-values', { ...fv, value_usd: '$120' })).status).toBe(400)
  })
})

describe('price history', () => {
  it('stores one row per ticker and reads it back as a PriceHistory', async () => {
    const stored = await expectJson<StoredPriceHistory>(
      await send('PUT', '/api/price-history/ACME', { source: 'yahoo', history: SERIES }),
      200,
    )
    expect(stored.ticker).toBe('ACME')
    expect(stored.source).toBe('yahoo')
    expect(stored.history).toEqual(SERIES)

    const list = await expectJson<StoredPriceHistory[]>(await call('/api/price-history'), 200)
    expect(list).toEqual([stored])
  })

  it('replaces the stored history rather than merging it', async () => {
    await send('PUT', '/api/price-history/ACME', { source: 'yahoo', history: SERIES })
    const shorter = { ...SERIES, dates: ['2024-03-05'], close: ['102.00'], adjClose: ['101.00'] }
    await send('PUT', '/api/price-history/ACME', { source: 'manual', history: shorter })

    const list = await expectJson<StoredPriceHistory[]>(await call('/api/price-history'), 200)
    expect(list).toHaveLength(1)
    expect(list[0].history.dates).toEqual(['2024-03-05'])
    expect(list[0].source).toBe('manual')
  })

  it('derives asOf from the last date instead of trusting the client', async () => {
    const stored = await expectJson<StoredPriceHistory>(
      await send('PUT', '/api/price-history/ACME', {
        source: 'yahoo',
        history: { ...SERIES, asOf: '1970-01-01' },
      }),
      200,
    )
    expect(stored.history.asOf).toBe('2024-03-05')
  })

  it('rejects series whose arrays disagree in length', async () => {
    const response = await send('PUT', '/api/price-history/ACME', {
      source: 'yahoo',
      history: { ...SERIES, close: ['100.00'] },
    })
    expect(response.status).toBe(400)
  })

  it('rejects an invalid ticker, an unknown source and a malformed split', async () => {
    expect((await send('PUT', '/api/price-history/not%20a%20ticker', { source: 'yahoo', history: SERIES })).status).toBe(400)
    expect((await send('PUT', '/api/price-history/ACME', { source: 'bloomberg', history: SERIES })).status).toBe(400)
    expect(
      (
        await send('PUT', '/api/price-history/ACME', {
          source: 'yahoo',
          history: { ...SERIES, splits: [{ date: '2024-03-04', numerator: '2', denominator: 1 }] },
        })
      ).status,
    ).toBe(400)
  })

  it('accepts an empty series', async () => {
    const stored = await expectJson<StoredPriceHistory>(
      await send('PUT', '/api/price-history/ACME', {
        source: 'manual',
        history: { dates: [], close: [], adjClose: [], splits: [], dividends: [], asOf: '' },
      }),
      200,
    )
    expect(stored.history.asOf).toBe('')
  })
})

describe('meta', () => {
  it('reads an empty table as an empty object', async () => {
    expect(await expectJson<MetaMap>(await call('/api/meta'), 200)).toEqual({})
  })

  it('sets and overwrites a key', async () => {
    await send('PUT', '/api/meta/prices_last_updated', { value: '2026-10-08T12:00:00.000Z' })
    expect(await expectJson<MetaMap>(await call('/api/meta'), 200)).toEqual({
      prices_last_updated: '2026-10-08T12:00:00.000Z',
    })

    await send('PUT', '/api/meta/prices_last_updated', { value: '2026-10-09T12:00:00.000Z' })
    const map = await expectJson<MetaMap>(await call('/api/meta'), 200)
    expect(map.prices_last_updated).toBe('2026-10-09T12:00:00.000Z')
  })

  it('400s a missing or non-string value', async () => {
    expect((await send('PUT', '/api/meta/key', {})).status).toBe(400)
    expect((await send('PUT', '/api/meta/key', { value: 7 })).status).toBe(400)
  })
})

describe('export and restore', () => {
  async function seed(): Promise<void> {
    await send('POST', '/api/transactions/bulk', {
      transactions: [
        tx({ source_row_hash: 'a' }),
        tx({ source_row_hash: 'b', ticker: 'BETA', trade_date: '2024-09-10', excluded: true }),
        tx({ source_row_hash: 'c', type: 'adjust', shares: '-2', amount_usd: '0', note: 'spinoff' }),
      ],
    })
    await send('POST', '/api/aliases', { from_ticker: 'OLD', to_ticker: 'ACME', effective_date: '2023-02-03' })
    await send('POST', '/api/fair-values', { ticker: 'ACME', value_usd: '120.00', effective_date: '2024-04-01' })
    await send('PUT', '/api/price-history/ACME', { source: 'yahoo', history: SERIES })
    await send('PUT', '/api/meta/prices_last_updated', { value: '2026-10-08T12:00:00.000Z' })
  }

  it('exports everything in one document', async () => {
    await seed()
    const bundle = await expectJson<ExportBundle>(await call('/api/export'), 200)

    expect(bundle.format).toBe(1)
    expect(Date.parse(bundle.exported_at)).not.toBeNaN()
    expect(bundle.transactions).toHaveLength(3)
    expect(bundle.aliases).toHaveLength(1)
    expect(bundle.fair_values).toHaveLength(1)
    expect(bundle.price_history).toHaveLength(1)
    expect(bundle.meta).toEqual({ prices_last_updated: '2026-10-08T12:00:00.000Z' })
    // The excluded flag has to survive a backup or a restore would silently re-include a row.
    expect(bundle.transactions.find((t) => t.source_row_hash === 'b')?.excluded).toBe(true)
  })

  it('restores a bundle byte-for-byte, row ids included', async () => {
    await seed()
    const before = await expectJson<ExportBundle>(await call('/api/export'), 200)

    // Wipe, then restore.
    for (const t of before.transactions) await send('DELETE', `/api/transactions/${t.id}`)
    expect(await expectJson<TransactionRow[]>(await call('/api/transactions'), 200)).toEqual([])

    const result = await expectJson<RestoreResult>(await send('POST', '/api/restore', before), 200)
    expect(result).toEqual({ transactions: 3, aliases: 1, fair_values: 1, price_history: 1, meta: 1 })

    const after = await expectJson<ExportBundle>(await call('/api/export'), 200)
    expect({ ...after, exported_at: '' }).toEqual({ ...before, exported_at: '' })
  })

  it('replaces what is already there rather than merging', async () => {
    await seed()
    const bundle = await expectJson<ExportBundle>(await call('/api/export'), 200)

    const emptied: ExportBundle = {
      ...bundle,
      transactions: [],
      aliases: [],
      fair_values: [],
      price_history: [],
      meta: {},
    }
    await send('POST', '/api/restore', emptied)

    const after = await expectJson<ExportBundle>(await call('/api/export'), 200)
    expect(after.transactions).toEqual([])
    expect(after.price_history).toEqual([])
    expect(after.meta).toEqual({})
  })

  it('refuses a bundle from a future format', async () => {
    const response = await send('POST', '/api/restore', {
      format: 2,
      transactions: [],
      aliases: [],
      fair_values: [],
      price_history: [],
      meta: {},
    })
    expect(response.status).toBe(400)
  })

  it('validates before deleting, so a bad bundle cannot empty the database', async () => {
    await seed()
    const bundle = await expectJson<ExportBundle>(await call('/api/export'), 200)

    const corrupt = {
      ...bundle,
      transactions: [...bundle.transactions, { ...bundle.transactions[0], id: 99, trade_date: 'nonsense' }],
    }
    expect((await send('POST', '/api/restore', corrupt)).status).toBe(400)

    const after = await expectJson<ExportBundle>(await call('/api/export'), 200)
    expect(after.transactions).toHaveLength(3)
  })
})

describe('routing', () => {
  it('404s an unknown /api path', async () => {
    expect((await call('/api/nope')).status).toBe(404)
    expect((await call('/api/transactions/7/nope')).status).toBe(404)
  })

  it('turns away an id that is not a positive integer', async () => {
    // `0` looks like an id, so it is a malformed request; `abc` is not an id route at all.
    expect((await send('DELETE', '/api/transactions/0')).status).toBe(400)
    expect((await send('DELETE', '/api/transactions/abc')).status).toBe(404)
  })
})
