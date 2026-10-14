import { afterEach, describe, expect, it, vi } from 'vitest'
import { handlePricesRequest } from './prices'

/**
 * Regression: task 25b, 2026-10-13. A held share-class position came back `Unknown ticker`
 * from the real price fetch and was left unpriced, which SPEC 6 values at $0 - so a live
 * holding read as a near-total loss. It had not been delisted: M1 spells a share class with a
 * dot and Yahoo spells it with a dash, and nothing converted between the two.
 *
 * `yahooSymbol.test.ts` pins the translation itself. This pins the thing that was actually
 * broken - the URL the Worker requests - which the unit test alone cannot catch, since the
 * bug was a missing call rather than a wrong function.
 *
 * Synthetic symbols; `ZZ.B` is the shape, not the company.
 */
describe('handlePricesRequest symbol translation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** Captures the URL and answers with a minimal well-formed chart payload. */
  function stubFetch(): { urls: string[] } {
    const urls: string[] = []
    vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
      urls.push(String(input))
      return Promise.resolve(
        Response.json({
          chart: {
            result: [
              {
                meta: { regularMarketTime: 1760356800 },
                timestamp: [1760356800],
                indicators: { quote: [{ close: [12.34] }], adjclose: [{ adjclose: [12.34] }] },
                events: {},
              },
            ],
            error: null,
          },
        }),
      )
    })
    return { urls }
  }

  it('asks Yahoo for the dashed spelling of a dotted share class', async () => {
    const { urls } = stubFetch()

    const response = await handlePricesRequest('/api/prices/ZZ.B', new URLSearchParams({ from: '2026-01-02' }))

    expect(response.status).toBe(200)
    expect(urls).toHaveLength(1)
    expect(urls[0]).toContain('/v8/finance/chart/ZZ-B?')
    expect(urls[0]).not.toContain('ZZ.B')
    expect(urls[0]).not.toContain('ZZ%2EB')
  })

  it('leaves an ordinary symbol untouched', async () => {
    const { urls } = stubFetch()

    const response = await handlePricesRequest('/api/prices/ZZTOP', new URLSearchParams({ from: '2026-01-02' }))

    expect(response.status).toBe(200)
    expect(urls[0]).toContain('/v8/finance/chart/ZZTOP?')
  })
})
