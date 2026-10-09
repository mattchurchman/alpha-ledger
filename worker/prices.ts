import { parseYahooChart, YahooUpstreamError } from '../src/engine/prices/parseYahooChart'
import { TICKER_PATTERN } from './validate'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// Yahoo's edge rejects requests with no browser-like User-Agent (observed: 429 "Edge: Too
// Many Requests" as plain text, not JSON, even on the very first request).
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** Handles `GET /api/prices/:ticker?from=YYYY-MM-DD`. `path` is the request pathname. */
export async function handlePricesRequest(path: string, searchParams: URLSearchParams): Promise<Response> {
  const match = /^\/api\/prices\/([^/]+)$/.exec(path)
  if (!match) return jsonError('Not found', 404)

  const ticker = decodeURIComponent(match[1]).toUpperCase()
  if (!TICKER_PATTERN.test(ticker)) {
    return jsonError(`Invalid ticker "${ticker}"`, 400)
  }

  const from = searchParams.get('from')
  if (from === null || !DATE_PATTERN.test(from)) {
    return jsonError('Query param "from" is required, format YYYY-MM-DD', 400)
  }

  const period1 = Math.floor(Date.parse(`${from}T00:00:00Z`) / 1000)
  if (Number.isNaN(period1)) {
    return jsonError(`Invalid "from" date "${from}"`, 400)
  }
  const period2 = Math.floor(Date.now() / 1000)

  const yahooUrl =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?period1=${period1}&period2=${period2}&interval=1d&events=div,splits`

  let upstream: Response
  try {
    upstream = await fetch(yahooUrl, {
      headers: { 'User-Agent': BROWSER_USER_AGENT, Accept: 'application/json' },
    })
  } catch {
    return jsonError('Could not reach Yahoo Finance', 502)
  }

  const bodyText = await upstream.text()
  let payload: unknown
  try {
    payload = JSON.parse(bodyText)
  } catch {
    const blocked = upstream.status === 429 || upstream.status === 403
    return jsonError(
      blocked
        ? 'Yahoo Finance is rate-limiting or blocking this Worker'
        : `Yahoo Finance returned a non-JSON response (HTTP ${upstream.status})`,
      blocked ? 429 : 502,
    )
  }

  try {
    const history = parseYahooChart(payload, ticker)
    return Response.json(history)
  } catch (err) {
    if (err instanceof YahooUpstreamError) {
      const status = err.kind === 'not-found' ? 404 : err.kind === 'rate-limited' ? 429 : 502
      return jsonError(err.message, status)
    }
    return jsonError('Unexpected error parsing Yahoo response', 502)
  }
}

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status })
}
