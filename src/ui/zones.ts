import { toNumber, type Numeric } from './format'

/**
 * The fair-value discount zones. SPEC section 7 requires these thresholds to live as constants
 * in **one** file, and this is that file - anything that needs them (the meter, the rebuy
 * ranking, task 12's screens) imports from here rather than restating the numbers.
 *
 * Discount = (fair value − price) / fair value. Positive means the price is below your estimate.
 */

export const DEEP_DISCOUNT = 0.15
export const WELL_ABOVE = -0.15

export type ZoneId = 'deep' | 'below' | 'above' | 'well-above'

export interface Zone {
  id: ZoneId
  label: string
  /** Blue is the cheap side, red the expensive side - the same pair as beat/trailed VOO. */
  tone: 'ahead' | 'behind'
}

const ZONES: Record<ZoneId, Zone> = {
  deep: { id: 'deep', label: 'Deep discount', tone: 'ahead' },
  below: { id: 'below', label: 'Below fair value', tone: 'ahead' },
  above: { id: 'above', label: 'Above fair value', tone: 'behind' },
  'well-above': { id: 'well-above', label: 'Well above', tone: 'behind' },
}

/** `null` for a ticker with no estimate - which is listed, never ranked (SPEC section 7). */
export function zoneFor(discount: Numeric): Zone | null {
  const value = toNumber(discount)
  if (value === null) return null
  if (value >= DEEP_DISCOUNT) return ZONES.deep
  if (value >= 0) return ZONES.below
  if (value >= WELL_ABOVE) return ZONES.above
  return ZONES['well-above']
}
