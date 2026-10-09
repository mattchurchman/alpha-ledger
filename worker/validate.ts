/**
 * Request-body validation for `/api/*`.
 *
 * This is the only place untrusted JSON becomes a typed row, so it is strict on purpose:
 * money and share counts must arrive as exact decimal strings (the engine's contract) and
 * dates must be real calendar days. A bad row stored silently would corrupt every number
 * the app shows, and the engine has no way to tell a typo from a real trade.
 */

export class BadRequest extends Error {}

/** Shared with `prices.ts`. Allows the dash in `BRK-B`-style symbols. */
export const TICKER_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/

export function fail(message: string): never {
  throw new BadRequest(message)
}

export function asObject(value: unknown, what = 'body'): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${what} must be a JSON object`)
  }
  return value as Record<string, unknown>
}

export function asArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) fail(`${what} must be a JSON array`)
  return value
}

export function reqString(obj: Record<string, unknown>, field: string): string {
  const v = obj[field]
  if (typeof v !== 'string' || v.trim() === '') fail(`"${field}" must be a non-empty string`)
  return v
}

export function optString(obj: Record<string, unknown>, field: string): string | null {
  const v = obj[field]
  if (v === undefined || v === null) return null
  if (typeof v !== 'string') fail(`"${field}" must be a string or null`)
  return v
}

export function optBool(obj: Record<string, unknown>, field: string, fallback: boolean): boolean {
  const v = obj[field]
  if (v === undefined || v === null) return fallback
  if (typeof v !== 'boolean') fail(`"${field}" must be a boolean`)
  return v
}

export function reqEnum<const T extends readonly string[]>(
  obj: Record<string, unknown>,
  field: string,
  allowed: T,
): T[number] {
  const v = obj[field]
  if (typeof v !== 'string' || !allowed.includes(v)) {
    fail(`"${field}" must be one of ${allowed.join(', ')}`)
  }
  return v as T[number]
}

/** A real calendar day in `YYYY-MM-DD`. Rejects `2026-02-30`, which the regex alone allows. */
export function reqDate(obj: Record<string, unknown>, field: string): string {
  const v = obj[field]
  if (typeof v !== 'string' || !DATE_PATTERN.test(v)) {
    fail(`"${field}" must be a date in YYYY-MM-DD form`)
  }
  const parsed = new Date(`${v}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== v) {
    fail(`"${field}" is not a real calendar date: ${v}`)
  }
  return v
}

export function reqTicker(obj: Record<string, unknown>, field: string): string {
  const v = reqString(obj, field).toUpperCase()
  if (!TICKER_PATTERN.test(v)) fail(`"${field}" is not a valid ticker: ${v}`)
  return v
}

/**
 * An exact decimal string. Deliberately not `Number` - a float64 round trip is exactly the
 * precision loss the TEXT columns exist to prevent.
 */
export function reqDecimal(
  obj: Record<string, unknown>,
  field: string,
  opts: { allowNegative?: boolean } = {},
): string {
  const v = obj[field]
  if (typeof v !== 'string' || !DECIMAL_PATTERN.test(v)) {
    fail(`"${field}" must be a decimal string, e.g. "12.3456"`)
  }
  if (!opts.allowNegative && v.startsWith('-')) {
    fail(`"${field}" must not be negative`)
  }
  return v
}

export function optDecimal(
  obj: Record<string, unknown>,
  field: string,
  opts: { allowNegative?: boolean } = {},
): string | null {
  const v = obj[field]
  if (v === undefined || v === null) return null
  return reqDecimal(obj, field, opts)
}

/** A positive integer path segment, for `/:id` routes. */
export function parseId(segment: string): number {
  if (!/^[1-9]\d*$/.test(segment)) fail(`"${segment}" is not a valid id`)
  return Number(segment)
}
