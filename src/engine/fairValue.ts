import Decimal from 'decimal.js'
import { splitFactorAfter } from './holdings'
import type { PriceSplitEvent } from './prices/types'
import type { FairValueEstimate, FairValueRecord } from './types'

/**
 * SPEC section 7's fair-value math: the current estimate per ticker, the discount it implies
 * against a price, the zone that discount falls in, and the split-adjusted history a chart
 * needs. User-entered only - nothing here computes or suggests a value, it only classifies and
 * restates the ones already on record. Kept outside `analyze` (see `index.ts`'s module map):
 * fair value is SPEC section 7, not section 6, and nothing in `analyze`'s result depends on it.
 */

/** SPEC section 7's thresholds, as the one file they are required to live in. */
export const DEEP_DISCOUNT = 0.15
export const WELL_ABOVE = -0.15

export type ZoneId = 'deep' | 'below' | 'above' | 'well-above'

/**
 * The newest estimate per ticker - newest `effective_date`, ties broken by the higher `id`
 * (insert order). This is the one that feeds the dashboard and the rebuy ranking; every other
 * row is history only.
 */
export function latestFairValues(
  records: readonly FairValueRecord[],
): Map<string, FairValueRecord> {
  const latest = new Map<string, FairValueRecord>()
  for (const record of records) {
    const current = latest.get(record.ticker)
    if (
      !current ||
      record.effective_date > current.effective_date ||
      (record.effective_date === current.effective_date && record.id > current.id)
    ) {
      latest.set(record.ticker, record)
    }
  }
  return latest
}

/**
 * `(fair value - price) / fair value`. Positive means the price sits below your estimate.
 * Null when the fair value is not positive - dividing by it would flip "cheap" into
 * "expensive", the same reasoning `returns.ts`'s `percentDifference` uses for the shadow bucket.
 */
export function discountFrom(price: string | number, fairValue: string | number): string | null {
  const fv = new Decimal(fairValue)
  if (fv.lte(0)) return null
  return fv.minus(price).div(fv).toFixed()
}

/** `null` for a ticker with no estimate - which is listed, never ranked (SPEC section 7). */
export function zoneFor(discount: string | number | null): ZoneId | null {
  if (discount === null) return null
  const value = typeof discount === 'string' ? Number(discount) : discount
  if (!Number.isFinite(value)) return null
  if (value >= DEEP_DISCOUNT) return 'deep'
  if (value >= 0) return 'below'
  if (value >= WELL_ABOVE) return 'above'
  return 'well-above'
}

/**
 * Restates one estimate at today's split level: divide by the same factor
 * `splitFactorAfter` would multiply a share count by, since a fair value is a per-share
 * dollar figure and a split moves price (and this) the opposite way it moves shares. The
 * stored `value_usd` is never touched - this is purely a read-time view for comparing against
 * a current, already-split-adjusted price.
 */
export function splitAdjustedValue(
  estimate: FairValueEstimate,
  splits: readonly PriceSplitEvent[],
): string {
  const factor = splitFactorAfter(estimate.effective_date, [...splits])
  return new Decimal(estimate.value_usd).div(factor).toFixed()
}

export interface SplitAdjustedEstimate {
  date: string
  value: string
  note: string | null
}

/**
 * Every estimate for one ticker, oldest first and split-adjusted, ready for `StepLineChart`'s
 * `estimates` prop (SPEC section 7: "old estimates are shown split-adjusted on charts").
 */
export function splitAdjustedHistory(
  records: readonly FairValueRecord[],
  splits: readonly PriceSplitEvent[],
): SplitAdjustedEstimate[] {
  return [...records]
    .sort((a, b) => a.effective_date.localeCompare(b.effective_date) || a.id - b.id)
    .map((record) => ({
      date: record.effective_date,
      value: splitAdjustedValue(record, splits),
      note: record.note,
    }))
}
