import { MINUS, NA, money, moneyCompact, percent, toNumber, type Numeric } from './format'

/**
 * A signed number, rendered so that **three** channels carry the sign: a ▲/▼ glyph, an explicit
 * `+`/`−`, and the hue. Losing any one of them - colour-blindness, grayscale print, a screen
 * reader - still leaves the direction legible (docs/DESIGN.md section 2.2).
 *
 * Blue is ahead and red is behind. Not green/red: that is the pair that collapses under
 * protanopia, measuring ΔE 7.2 where blue↔red measures 21.6.
 */

const FORMATTERS = {
  money,
  moneyCompact,
  percent: (value: Numeric) => percent(value, { sign: false }),
} as const

export interface SignedDeltaProps {
  value: Numeric
  format?: keyof typeof FORMATTERS
  /**
   * Words for the screen reader, which should hear the meaning rather than the glyph. The
   * default is deliberately generic; screens pass the domain wording.
   */
  describe?: { up: string; down: string; flat?: string }
  /** Set false where a smaller number is the good one (a premium to fair value, say). */
  goodWhenUp?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = {
  sm: 'text-small',
  md: 'text-body',
  lg: 'text-figure font-semibold',
} as const

export function SignedDelta({
  value,
  format = 'money',
  describe = { up: 'up by', down: 'down by' },
  goodWhenUp = true,
  size = 'md',
  className = '',
}: SignedDeltaProps) {
  const n = toNumber(value)
  const formatter = FORMATTERS[format]

  if (n === null) {
    return (
      <span
        className={`${SIZES[size]} text-ink-muted ${className}`.trimEnd()}
        aria-label="not available"
      >
        {NA}
      </span>
    )
  }

  const magnitude = formatter(Math.abs(n))

  if (n === 0) {
    return (
      <span className={`${SIZES[size]} tabular-nums text-ink-secondary ${className}`.trimEnd()}>
        {describe.flat ? <span className="sr-only">{describe.flat} </span> : null}
        {magnitude}
      </span>
    )
  }

  const up = n > 0
  // The hue follows whether the move is *good*, not whether the number went up.
  const tone = up === goodWhenUp ? 'text-ahead' : 'text-behind'

  return (
    <span className={`${SIZES[size]} tabular-nums ${tone} ${className}`.trimEnd()}>
      <span className="sr-only">{up ? describe.up : describe.down} </span>
      <span aria-hidden="true">{up ? '▲' : '▼'} </span>
      <span aria-hidden="true">{up ? '+' : MINUS}</span>
      {magnitude}
    </span>
  )
}
