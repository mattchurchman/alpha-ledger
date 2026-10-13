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

/**
 * DESIGN section 2.5's sequential ramp, as **token references** rather than hexes: the two
 * themes hold different steps (light reads more magnitude as darker, dark as brighter), so the
 * values cannot live in TypeScript. Each step also names the ink that clears 4.5:1 on it, which
 * is why a caller never has to decide between white and ink itself.
 */
export const SEQUENTIAL_RAMP = [1, 2, 3, 4, 5, 6, 7].map((step) => ({
  color: `var(--al-ramp-${step})`,
  ink: `var(--al-ramp-${step}-ink)`,
})) as readonly RampStep[]

export interface RampStep {
  /** A `var(--al-ramp-N)` reference - usable anywhere a CSS colour is. */
  color: string
  /** The ink token that meets AA on `color`, in whichever theme is live. */
  ink: string
}

/**
 * `DiscountMap`'s shading: a discount mapped onto the ramp by magnitude, clamped to `±range` -
 * a deep discount (cheap) lands on the strongest step, a price well above fair value on the
 * faintest. One hue, magnitude by lightness; a second, red-tinted ramp would turn a magnitude
 * encoding into a diverging one, which the zone label already carries.
 */
export function rampStepFor(discount: Numeric, range = 0.3): RampStep {
  const value = toNumber(discount)
  if (value === null || range <= 0) return SEQUENTIAL_RAMP[0]
  const clamped = Math.max(-range, Math.min(range, value))
  const fraction = (clamped + range) / (2 * range)
  return SEQUENTIAL_RAMP[Math.round(fraction * (SEQUENTIAL_RAMP.length - 1))]
}
