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

/** DESIGN section 2.5's documented blue ramp, light to dark - nothing eyeballed. */
export const SEQUENTIAL_RAMP = [
  '#cde2fb',
  '#b7d3f6',
  '#9ec5f4',
  '#86b6ef',
  '#6da7ec',
  '#5598e7',
  '#3987e5',
  '#2a78d6',
  '#256abf',
  '#1c5cab',
  '#184f95',
  '#104281',
  '#0d366b',
] as const

export interface RampStep {
  color: string
  /** True once the step is dark enough that a label inside it should be white, not ink. */
  dark: boolean
}

/**
 * `DiscountMap`'s shading: a discount mapped onto the ramp by magnitude, clamped to `±range` -
 * a deep discount (cheap) lands darkest, a price well above fair value lands lightest. This
 * reuses the one ramp DESIGN 2.5 already validated rather than inventing a second, red-tinted
 * one - a real palette addition is task 22's job, not this one's.
 */
export function rampStepFor(discount: Numeric, range = 0.3): RampStep {
  const value = toNumber(discount)
  if (value === null || range <= 0) return { color: SEQUENTIAL_RAMP[0], dark: false }
  const clamped = Math.max(-range, Math.min(range, value))
  const fraction = (clamped + range) / (2 * range)
  const index = Math.round(fraction * (SEQUENTIAL_RAMP.length - 1))
  // Steps 450 and up (index 7+) are dark enough that white reads better than ink (DESIGN 5.3).
  return { color: SEQUENTIAL_RAMP[index], dark: index >= 7 }
}
