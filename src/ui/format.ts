/**
 * Every number the UI shows passes through here. Screens must not hand-roll formatting -
 * docs/DESIGN.md section 4 is the contract and this file is its only implementation.
 *
 * Two things to know before using it:
 *
 * 1. **The engine hands out exact decimal strings** (docs/ENGINE_API.md), so every function
 *    takes `string | number | null | undefined`. Parsing to a float here is safe because
 *    this is the display layer and rounding is its job; nothing downstream reads the result.
 * 2. **`null` means "not available" and renders as an em dash, never as zero.** SPEC section 6
 *    requires IRR and the percent gap to show a dash rather than a guess, so a missing value
 *    can never come out as `$0` or `NaN`.
 */

/** What "not available" looks like. Muted wherever it appears. */
export const NA = '—'

/** U+2212. A hyphen reads as a bullet at 11.5px and never aligns in a mono column. */
export const MINUS = '−'

export type Numeric = string | number | null | undefined

/** `null` for anything that is not a finite number, including `''` and `'NaN'`. */
export function toNumber(value: Numeric): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function group(value: number, fractionDigits: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

/** Sign outside the dollar sign: `−$3,140`, never `$−3,140`. */
function withSign(magnitude: string, negative: boolean): string {
  return negative ? `${MINUS}$${magnitude}` : `$${magnitude}`
}

/** Cents only below $1,000, where they still carry information. `$1,284` / `$184.20`. */
export function money(value: Numeric): string {
  const n = toNumber(value)
  if (n === null) return NA
  const abs = Math.abs(n)
  return withSign(group(abs, abs < 1000 ? 2 : 0), n < 0)
}

/** Always two decimals. Tables, tooltips, the decision list - anywhere cents must line up. */
export function moneyExact(value: Numeric): string {
  const n = toNumber(value)
  if (n === null) return NA
  return withSign(group(Math.abs(n), 2), n < 0)
}

/**
 * Compact above $10,000 - axis ticks and phone-width stat tiles. Below that it is `money`,
 * because `$9.9K` loses real information that `$9,872` carries.
 */
export function moneyCompact(value: Numeric): string {
  const n = toNumber(value)
  if (n === null) return NA
  const abs = Math.abs(n)
  if (abs < 10_000) return money(n)
  const [divisor, suffix] =
    abs >= 1e9 ? [1e9, 'B'] : abs >= 1e6 ? [1e6, 'M'] : ([1e3, 'K'] as const)
  const scaled = abs / divisor
  // Trim a trailing .0 so an axis reads $12K rather than $12.0K.
  const body = scaled.toFixed(1).replace(/\.0$/, '')
  return withSign(`${body}${suffix}`, n < 0)
}

/**
 * Axis ticks, which are round numbers by construction (`niceTicks`) and live in a narrow
 * gutter. So: zero is `$0` rather than `$0.00` - a baseline labelled in cents among `$10K` and
 * `$20K` reads as a different kind of number - and cents are dropped from $1 up, where a tick
 * can never have any. Below $1 they are kept, because a penny stock's axis is all cents.
 */
export function moneyAxis(value: Numeric): string {
  const n = toNumber(value)
  if (n === null) return NA
  if (n === 0) return '$0'
  const abs = Math.abs(n)
  if (abs >= 10_000) return moneyCompact(n)
  if (abs >= 1) return withSign(group(abs, 0), n < 0)
  return money(n)
}

export interface PercentOptions {
  /** Show a leading `+` on positive values. Default true - these are nearly all deltas. */
  sign?: boolean
}

/**
 * Takes a **decimal fraction**, the way the engine reports it: `0.124` renders `+12.4%`.
 *
 * A large gain over a few days annualizes to millions of percent, which ENGINE_API warns is
 * genuine rather than a bug. Beyond 1,000% this abbreviates (`+1.2K%`) rather than clamping,
 * so the figure stays honest and still fits a table cell.
 */
export function percent(value: Numeric, options: PercentOptions = {}): string {
  const n = toNumber(value)
  if (n === null) return NA
  const { sign = true } = options
  const points = n * 100
  const abs = Math.abs(points)
  const prefix = points > 0 ? (sign ? '+' : '') : points < 0 ? MINUS : ''
  if (abs >= 1e6) return `${prefix}${(abs / 1e6).toFixed(1).replace(/\.0$/, '')}M%`
  if (abs >= 1000) return `${prefix}${(abs / 1000).toFixed(1).replace(/\.0$/, '')}K%`
  return `${prefix}${abs.toFixed(1)}%`
}

/** `▲` up, `▼` down, nothing at exactly zero. Sign is never carried by color alone. */
export function signGlyph(value: Numeric): string {
  const n = toNumber(value)
  if (n === null || n === 0) return ''
  return n > 0 ? '▲' : '▼'
}

/** `▲ +$12,480` / `▼ −$3,140` / `$0` at zero (no glyph, nothing to point at). */
export function signedMoney(value: Numeric, compact = false): string {
  const n = toNumber(value)
  if (n === null) return NA
  const body = compact ? moneyCompact(Math.abs(n)) : money(Math.abs(n))
  if (n === 0) return body
  return `${signGlyph(n)} ${n > 0 ? '+' : MINUS}${body}`
}

/** `▲ +12.4%` / `▼ −3.0%`. */
export function signedPercent(value: Numeric): string {
  const n = toNumber(value)
  if (n === null) return NA
  if (n === 0) return percent(0, { sign: false })
  return `${signGlyph(n)} ${percent(n)}`
}

/** Up to six decimals, trailing zeros trimmed. `12` / `3.5` / `0.004219`. */
export function shares(value: Numeric): string {
  const n = toNumber(value)
  if (n === null) return NA
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Splits a `YYYY-MM-DD` date by hand rather than through `new Date`, which would read it as
 * UTC midnight and shift it a day back for anyone west of Greenwich.
 */
function parseDay(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!match) return null
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year: Number(match[1]), month, day }
}

/** `Oct 3` inside the reference year, `Dec 31, 2024` outside it. */
export function dateShort(value: string | null | undefined, now = new Date()): string {
  if (!value) return NA
  const parsed = parseDay(value)
  if (!parsed) return NA
  const { year, month, day } = parsed
  const head = `${MONTHS[month - 1]} ${day}`
  return year === now.getFullYear() ? head : `${head}, ${year}`
}

/** Always carries the year. Tooltips and the scrub readout, where the date is the anchor. */
export function dateFull(value: string | null | undefined): string {
  if (!value) return NA
  const parsed = parseDay(value)
  if (!parsed) return NA
  return `${MONTHS[parsed.month - 1]} ${parsed.day}, ${parsed.year}`
}

/** For the "updated …" half of the prices-as-of slot. Falls back to a date past a week. */
export function relativeTime(value: string | number | Date | null | undefined, now = new Date()) {
  if (value === null || value === undefined) return NA
  const then = value instanceof Date ? value : new Date(value)
  const ms = then.getTime()
  if (!Number.isFinite(ms)) return NA
  const seconds = Math.round((now.getTime() - ms) / 1000)
  if (seconds < 0) return 'just now'
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)}d ago`
  return dateShort(then.toISOString().slice(0, 10), now)
}
