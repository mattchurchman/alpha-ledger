import Decimal from 'decimal.js'
import type { FairValueRow } from '../api/types'

/**
 * Fair value is user-entered and append-only (SPEC section 7): full history is kept, but only
 * the current estimate per ticker - the newest `effective_date`, ties broken by the highest
 * row id (insert order) - feeds the dashboard and the rebuy ranking.
 */
export function latestFairValues(rows: readonly FairValueRow[]): Map<string, FairValueRow> {
  const latest = new Map<string, FairValueRow>()
  for (const row of rows) {
    const current = latest.get(row.ticker)
    if (
      !current ||
      row.effective_date > current.effective_date ||
      (row.effective_date === current.effective_date && row.id > current.id)
    ) {
      latest.set(row.ticker, row)
    }
  }
  return latest
}

/**
 * SPEC section 7: `(fair value - price) / fair value`. Positive means the price sits below
 * your estimate. Null when the fair value is not positive - dividing by it would flip "cheap"
 * into "expensive", the same reasoning `returns.ts`'s `percentDifference` uses for the shadow
 * bucket.
 */
export function discountFrom(
  price: string | number,
  fairValue: string | number,
): string | null {
  const fv = new Decimal(fairValue)
  if (fv.lte(0)) return null
  return fv.minus(price).div(fv).toFixed()
}
