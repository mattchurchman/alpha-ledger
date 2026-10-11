/**
 * Pure logic behind the "Update market data" action (SPEC section 8, task 09). No I/O here -
 * fetching and storing are injected, so this stays testable in node without a Worker or a
 * network. `usePortfolioData.ts` is the only caller.
 */
import { resolveTicker } from '../engine/holdings'
import type { PriceHistory } from '../engine/prices/types'
import type { TickerAlias } from '../engine/types'

/** Calendar-day add/subtract on a `YYYY-MM-DD` string. UTC throughout - no local-timezone shift. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

/**
 * Every ticker a transaction was ever booked under, resolved through aliases to the symbol
 * it trades as today - the set SPEC 8 wants priced, before VOO is added to it.
 */
export function tickersEverHeld(
  transactions: readonly { ticker: string; trade_date: string }[],
  aliases: TickerAlias[],
): string[] {
  const set = new Set<string>()
  for (const t of transactions) set.add(resolveTicker(t.ticker, t.trade_date, aliases))
  return [...set].sort()
}

/**
 * SPEC 8's range: "from 10 days before the earliest transaction to today". One `from` shared
 * by every ticker's fetch, matching `src/engine/series.ts`'s own earliest-transaction convention
 * rather than a per-ticker range - a value added a year after the first buy should still be
 * able to compare against VOO starting from day one.
 */
export function priceFetchFrom(
  transactions: readonly { trade_date: string }[],
  today: string,
): string {
  let earliest: string | null = null
  for (const t of transactions) {
    if (earliest === null || t.trade_date < earliest) earliest = t.trade_date
  }
  return addDays(earliest ?? today, -10)
}

/** Weekdays strictly between `from` (exclusive) and `to` (inclusive). Small ranges only. */
export function tradingDaysBetween(from: string, to: string): number {
  if (to <= from) return 0
  let count = 0
  let cursor = addDays(from, 1)
  while (cursor <= to) {
    const day = new Date(`${cursor}T00:00:00Z`).getUTCDay()
    if (day !== 0 && day !== 6) count++
    cursor = addDays(cursor, 1)
  }
  return count
}

/** More than five trading days behind "today" (the shell badge's "Stale" flag, SPEC 8). */
export function isStale(lastClose: string | null, today: string): boolean {
  if (!lastClose) return false
  return tradingDaysBetween(lastClose, today) > 5
}

export interface UpdateFailure {
  ticker: string
  error: string
}

export interface UpdateOutcome {
  succeeded: string[]
  failed: UpdateFailure[]
  /**
   * Fetches that failed where failing is the expected answer - a company that no longer
   * trades, whose history is already stored. Reported separately so SPEC 8's per-ticker
   * failure list stays a list of things actually worth fixing (task 18).
   */
  tolerated: UpdateFailure[]
}

export interface RunMarketUpdateOptions {
  tickers: readonly string[]
  /** Default 3: enough overlap to be fast without looking like a scrape to Yahoo's edge. */
  concurrency?: number
  fetchPrice: (ticker: string) => Promise<PriceHistory>
  storePrice: (ticker: string, history: PriceHistory) => Promise<void>
  onProgress?: (done: number, total: number) => void
  /**
   * Tickers whose failure belongs in `tolerated` rather than `failed`. The caller decides
   * what qualifies; `PortfolioData` passes closed positions that already have stored
   * history, since a delisted symbol can never be fetched again and nothing is lost by it.
   */
  tolerateFailure?: (ticker: string) => boolean
}

/**
 * Fetches and stores every ticker with limited concurrency. One retry per ticker, and a
 * failing ticker never blocks the others - both are SPEC 8 / task 09 acceptance criteria, not
 * just performance choices. A ticker is still always fetched; `tolerateFailure` only changes
 * how its failure is reported, never whether it is tried.
 */
export async function runMarketUpdate(options: RunMarketUpdateOptions): Promise<UpdateOutcome> {
  const { tickers, fetchPrice, storePrice, onProgress, tolerateFailure } = options
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, tickers.length || 1))
  const succeeded: string[] = []
  const failed: UpdateFailure[] = []
  const tolerated: UpdateFailure[] = []
  let done = 0
  let next = 0

  async function fetchWithRetry(ticker: string): Promise<PriceHistory> {
    try {
      return await fetchPrice(ticker)
    } catch {
      return await fetchPrice(ticker)
    }
  }

  async function worker(): Promise<void> {
    for (;;) {
      const i = next++
      if (i >= tickers.length) return
      const ticker = tickers[i]
      try {
        const history = await fetchWithRetry(ticker)
        await storePrice(ticker, history)
        succeeded.push(ticker)
      } catch (err) {
        const failure = { ticker, error: err instanceof Error ? err.message : String(err) }
        if (tolerateFailure?.(ticker)) tolerated.push(failure)
        else failed.push(failure)
      } finally {
        done++
        onProgress?.(done, tickers.length)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tickers.length) }, () => worker()))

  const byTicker = (a: UpdateFailure, b: UpdateFailure) => a.ticker.localeCompare(b.ticker)
  return {
    succeeded: succeeded.sort(),
    failed: failed.sort(byTicker),
    tolerated: tolerated.sort(byTicker),
  }
}

function isPlainDecimal(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value)
}

/**
 * Manual fallback CSV (docs/PRICES.md): `date,close,adjclose`, lowercase header, one row per
 * trading day, order not required. No quoting support - the format has no column that could
 * contain a comma, so the full RFC 4180 reader `src/engine/m1/parse.ts` needs is overkill here.
 */
export function parseManualPriceCsv(text: string): PriceHistory {
  const lines = text.split(/\r\n|\r|\n/).filter((line) => line.trim() !== '')
  if (lines.length === 0) throw new Error('Price CSV is empty')

  const header = lines[0].split(',').map((cell) => cell.trim().toLowerCase())
  const dateIdx = header.indexOf('date')
  const closeIdx = header.indexOf('close')
  const adjIdx = header.indexOf('adjclose')
  if (dateIdx === -1 || closeIdx === -1 || adjIdx === -1) {
    throw new Error('Price CSV must have "date", "close" and "adjclose" columns')
  }

  const byDate = new Map<string, { close: string; adjClose: string }>()
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',')
    const date = (cells[dateIdx] ?? '').trim()
    const close = (cells[closeIdx] ?? '').trim()
    const adjClose = (cells[adjIdx] ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`row ${i + 1}: invalid date "${date}"`)
    if (!isPlainDecimal(close)) throw new Error(`row ${i + 1}: invalid close "${close}"`)
    if (!isPlainDecimal(adjClose)) throw new Error(`row ${i + 1}: invalid adjclose "${adjClose}"`)
    byDate.set(date, { close, adjClose })
  }
  if (byDate.size === 0) throw new Error('Price CSV has no data rows')

  const dates = [...byDate.keys()].sort()
  return {
    dates,
    close: dates.map((d) => byDate.get(d)!.close),
    adjClose: dates.map((d) => byDate.get(d)!.adjClose),
    splits: [],
    dividends: [],
    asOf: dates[dates.length - 1],
  }
}

/**
 * Sets one ticker's price on one day - the "or set a single current price" fallback. Merges
 * into whatever history is already stored (so a manual spot-price does not erase a real
 * fetched series) rather than replacing it; `close` and `adjClose` both take the entered price
 * since there is no dividend data behind a manual entry to tell them apart.
 */
export function withManualPrice(
  existing: PriceHistory | null,
  date: string,
  price: string,
): PriceHistory {
  const close = new Map<string, string>()
  const adjClose = new Map<string, string>()
  if (existing) {
    existing.dates.forEach((d, i) => {
      close.set(d, existing.close[i])
      adjClose.set(d, existing.adjClose[i])
    })
  }
  close.set(date, price)
  adjClose.set(date, price)

  const dates = [...close.keys()].sort()
  return {
    dates,
    close: dates.map((d) => close.get(d)!),
    adjClose: dates.map((d) => adjClose.get(d)!),
    splits: existing?.splits ?? [],
    dividends: existing?.dividends ?? [],
    asOf: dates[dates.length - 1],
  }
}
