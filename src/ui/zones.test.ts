import { describe, expect, it } from 'vitest'
import { SEQUENTIAL_RAMP, rampStepFor, zoneFor } from './zones'

describe('zoneFor', () => {
  it('labels the four zones and declines a missing estimate', () => {
    expect(zoneFor(0.3)?.id).toBe('deep')
    expect(zoneFor(0.05)?.id).toBe('below')
    expect(zoneFor(-0.05)?.id).toBe('above')
    expect(zoneFor(-0.3)?.id).toBe('well-above')
    expect(zoneFor(null)).toBeNull()
  })
})

describe('rampStepFor', () => {
  it('maps the ends of the range onto the ends of the ramp', () => {
    // A deep discount is the most magnitude, so it lands on the last step.
    expect(rampStepFor(0.3)).toBe(SEQUENTIAL_RAMP[SEQUENTIAL_RAMP.length - 1])
    expect(rampStepFor(-0.3)).toBe(SEQUENTIAL_RAMP[0])
    expect(rampStepFor(0)).toBe(SEQUENTIAL_RAMP[(SEQUENTIAL_RAMP.length - 1) / 2])
  })

  it('clamps past the range rather than running off the ramp', () => {
    expect(rampStepFor(5)).toBe(rampStepFor(0.3))
    expect(rampStepFor(-5)).toBe(rampStepFor(-0.3))
  })

  it('falls back to the faintest step for a missing or degenerate input', () => {
    expect(rampStepFor(null)).toBe(SEQUENTIAL_RAMP[0])
    expect(rampStepFor(0.1, 0)).toBe(SEQUENTIAL_RAMP[0])
  })

  it('pairs every step with the ink token that reads on it', () => {
    // The pairing is what lets a tile label skip deciding between white and ink itself.
    SEQUENTIAL_RAMP.forEach((step, index) => {
      expect(step.color).toBe(`var(--al-ramp-${index + 1})`)
      expect(step.ink).toBe(`var(--al-ramp-${index + 1}-ink)`)
    })
  })
})
