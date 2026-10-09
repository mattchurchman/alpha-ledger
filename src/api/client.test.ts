import { describe, expect, it } from 'vitest'
import { AccessExpiredError, ApiError, createApiClient } from './client'
import type { TransactionRow } from './types'

/**
 * The client's own logic, against a stub fetch: how it builds requests, and how it tells an
 * API error apart from an expired Access session. The routes themselves are covered by
 * `worker/api.test.ts` against a real D1.
 */

interface Call {
  url: string
  method: string
  body: string | null
  headers: Record<string, string>
}

function stub(responder: (call: Call) => Response) {
  const calls: Call[] = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : null,
      headers: Object.fromEntries(
        Object.entries((init?.headers ?? {}) as Record<string, string>),
      ),
    }
    calls.push(call)
    return responder(call)
  }) as typeof fetch

  return { calls, client: createApiClient({ fetchImpl }) }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('createApiClient', () => {
  it('GETs the collection and returns the parsed rows', async () => {
    const row = { id: 1, ticker: 'ACME' } as unknown as TransactionRow
    const { client, calls } = stub(() => json([row]))

    expect(await client.transactions.list()).toEqual([row])
    expect(calls[0]).toMatchObject({ url: '/api/transactions', method: 'GET', body: null })
    // No Content-Type on a bodyless request - some servers treat that as a malformed body.
    expect(calls[0].headers['Content-Type']).toBeUndefined()
  })

  it('turns filters into query params and drops the empty ones', async () => {
    const { client, calls } = stub(() => json([]))
    await client.transactions.list({ ticker: 'ACME', account: '', type: 'buy' })
    expect(calls[0].url).toBe('/api/transactions?ticker=ACME&type=buy')
  })

  it('sends JSON with a Content-Type on a write', async () => {
    const { client, calls } = stub(() => json({ inserted: 1, skipped: 0 }))
    await client.transactions.bulkUpsert([])
    expect(calls[0]).toMatchObject({ url: '/api/transactions/bulk', method: 'POST' })
    expect(calls[0].headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(calls[0].body ?? 'null')).toEqual({ transactions: [] })
  })

  it('percent-encodes path segments', async () => {
    const { client, calls } = stub(() => json({}))
    await client.priceHistory.put('BRK-B', {
      source: 'manual',
      history: { dates: [], close: [], adjClose: [], splits: [], dividends: [], asOf: '' },
    })
    expect(calls[0].url).toBe('/api/price-history/BRK-B')

    await client.meta.put('prices last updated', 'x')
    expect(calls[1].url).toBe('/api/meta/prices%20last%20updated')
  })

  it('resolves a 204 as undefined rather than trying to parse an empty body', async () => {
    const { client } = stub(() => new Response(null, { status: 204 }))
    await expect(client.transactions.remove(3)).resolves.toBeUndefined()
  })

  it("raises the API's own error message", async () => {
    const { client } = stub(() => json({ error: 'No transaction with id 9' }, 404))
    await expect(client.transactions.remove(9)).rejects.toThrow(
      new ApiError(404, 'No transaction with id 9'),
    )
    await expect(client.transactions.remove(9)).rejects.toMatchObject({ status: 404 })
  })

  it('falls back to the status when the error body has no message', async () => {
    const { client } = stub(() => json({ unexpected: true }, 500))
    await expect(client.transactions.list()).rejects.toThrow(/HTTP 500/)
  })

  // The case that matters for a PWA left open on a phone overnight: Access has expired, so
  // the request comes back as the login page's HTML, not as JSON.
  it('reports an expired Access session when the response is not JSON', async () => {
    const loginPage = () =>
      new Response('<html>Sign in</html>', { status: 200, headers: { 'Content-Type': 'text/html' } })
    const { client } = stub(loginPage)
    await expect(client.transactions.list()).rejects.toBeInstanceOf(AccessExpiredError)
  })

  it('reports an expired session for a bare 401/403 with no JSON body', async () => {
    const { client } = stub(() => new Response('Unauthorized', { status: 401 }))
    await expect(client.transactions.list()).rejects.toBeInstanceOf(AccessExpiredError)
  })

  it('still raises an ApiError for a non-JSON server failure', async () => {
    const { client } = stub(() => new Response('Bad gateway', { status: 502 }))
    await expect(client.transactions.list()).rejects.toBeInstanceOf(ApiError)
  })

  it('honours a baseUrl for a local front end pointed at a remote API', async () => {
    const { calls } = stub(() => json({ status: 'ok' }))
    const remote = createApiClient({
      baseUrl: 'https://example.test',
      fetchImpl: (async (input: RequestInfo | URL) => {
        calls.push({ url: String(input), method: 'GET', body: null, headers: {} })
        return json({ status: 'ok' })
      }) as typeof fetch,
    })
    await remote.health()
    expect(calls[0].url).toBe('https://example.test/api/health')
  })
})
