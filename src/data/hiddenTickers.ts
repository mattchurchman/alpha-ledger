/**
 * The hidden-ticker list: tickers the user wants out of sight on the screens that ask "what
 * should I do now" - Holdings, Rebuy opportunities and Fair values (task 18).
 *
 * It lives in one `meta` row as a JSON array, so it needs no migration and rides along in
 * `/api/export` with everything else. Hiding is **presentation only**: no total, no chart and
 * no stored number changes, which is why nothing here touches the engine.
 */

export const HIDDEN_TICKERS_KEY = 'hidden_tickers'

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
 * Tolerant on purpose: a key that is missing, empty, not JSON, or not an array of strings
 * reads as "nothing hidden". A malformed row should cost the user a forgotten preference, not
 * a screen that will not render.
 */
export function parseHiddenTickers(raw: string | null | undefined): string[] {
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

export function serializeHiddenTickers(tickers: Iterable<string>): string {
  return JSON.stringify(normalize(tickers))
}

export function isHidden(hidden: readonly string[], ticker: string): boolean {
  return hidden.includes(ticker.trim().toUpperCase())
}

/** The list with `ticker` added or removed. Returns a new array; the input is untouched. */
export function withHidden(
  hidden: readonly string[],
  ticker: string,
  shouldHide: boolean,
): string[] {
  const target = ticker.trim().toUpperCase()
  if (target === '') return normalize(hidden)
  return shouldHide
    ? normalize([...hidden, target])
    : normalize(hidden).filter((entry) => entry !== target)
}
