import type { PriceHistory } from '../engine/prices/types'

/**
 * The watchlist: tickers the user does not own yet but wants priced and ranked alongside the
 * ones they do (task 20). Like `hidden_tickers`, it lives in one `meta` row as a JSON array, so
 * it needs no migration and rides along in `/api/export` with everything else.
 *
 * A watched ticker never reaches `analyze` - it has no transactions, so there is nothing for the
 * engine to compute. `mergeHeldAndWatched` is the one place Fair values and Rebuy opportunities
 * both read to combine the two lists, so they can never drift apart.
 */

export const WATCHLIST_KEY = 'watchlist'

/** Uppercase, unique, sorted - so two devices writing the same set write the same string. */
function normalize(tickers: Iterable<string>): string[] {
  const set = new Set<string>()
  for (const ticker of tickers) {
    const trimmed = ticker.trim().toUpperCase()
    if (trimmed !== '') set.add(trimmed)
  }
  return [...set].sort()
}

/**
 * Tolerant on purpose, matching `parseHiddenTickers`: a key that is missing, empty, not JSON, or
 * not an array of strings reads as "watching nothing" rather than a screen that will not render.
 */
export function parseWatchlist(raw: string | null | undefined): string[] {
  if (typeof raw !== 'string' || raw.trim() === '') return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return normalize(parsed.filter((entry): entry is string => typeof entry === 'string'))
}

export function serializeWatchlist(tickers: Iterable<string>): string {
  return JSON.stringify(normalize(tickers))
}

/** The list with `ticker` added or removed. Returns a new array; the input is untouched. */
export function withWatched(
  watchlist: readonly string[],
  ticker: string,
  shouldWatch: boolean,
): string[] {
  const target = ticker.trim().toUpperCase()
  if (target === '') return normalize(watchlist)
  return shouldWatch
    ? normalize([...watchlist, target])
    : normalize(watchlist).filter((entry) => entry !== target)
}

/** The most recent stored close, or `null` when there is no history yet. */
export function latestStoredClose(history: PriceHistory | undefined): string | null {
  if (!history || history.close.length === 0) return null
  return history.close[history.close.length - 1]
}

export interface MergedTicker {
  ticker: string
  latestClose: string | null
  /** True for a watched ticker with no holding; false for an open, held position. */
  watching: boolean
}

/**
 * Fair values and Rebuy opportunities both rank "everything you might buy": the open positions
 * passed in as `held`, plus the watchlist, minus whichever of those a ticker already appears
 * as. A ticker already held is never duplicated as watching - "when a watched ticker is bought
 * it shows once, as a holding" - and a hidden one is left out entirely, same as a hidden holding.
 */
export function mergeHeldAndWatched(
  held: readonly { ticker: string; latestClose: string | null }[],
  watchlist: readonly string[],
  hiddenTickers: readonly string[],
  prices: Record<string, PriceHistory | undefined>,
): MergedTicker[] {
  const heldTickers = new Set(held.map((h) => h.ticker))
  const rows: MergedTicker[] = held.map((h) => ({
    ticker: h.ticker,
    latestClose: h.latestClose,
    watching: false,
  }))
  for (const ticker of watchlist) {
    if (heldTickers.has(ticker) || hiddenTickers.includes(ticker)) continue
    rows.push({ ticker, latestClose: latestStoredClose(prices[ticker]), watching: true })
  }
  return rows.sort((a, b) => a.ticker.localeCompare(b.ticker))
}
