import { DEEP_DISCOUNT, WELL_ABOVE, zoneFor as classify, type ZoneId } from '../engine/fairValue'
import { toNumber, type Numeric } from './format'

/**
 * Presentation for the fair-value discount zones. The thresholds and the number-to-`ZoneId`
 * classification are `src/engine/fairValue.ts`'s job (SPEC section 7: "constants in one file",
 * and CLAUDE.md's "all financial math lives in the engine") - this file only adds the label and
 * colour tone a screen renders, re-exporting the constants so a meter's boundary ticks and the
 * engine's own thresholds can never drift apart.
 */

export { DEEP_DISCOUNT, WELL_ABOVE, type ZoneId }

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
  const id = classify(value)
  return id === null ? null : ZONES[id]
}
