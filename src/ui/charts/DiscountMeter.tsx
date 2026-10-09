import { NA, money, percent, toNumber, type Numeric } from '../format'
import { Label } from '../primitives'
import { DEEP_DISCOUNT, WELL_ABOVE, zoneFor } from '../zones'

/**
 * How far a price sits below (or above) your own fair-value estimate.
 *
 * It is a **meter**, not a four-colour gauge: the track is the neutral diverging midpoint, the
 * fill runs from the centre out in the pole hue, and the four SPEC section 7 zones are marked
 * by boundary ticks and named in words. Four coloured bands would have needed a red ramp that
 * the documented palette does not define, and the zone's name is the thing you actually read.
 *
 * `null` renders as a dash under "No estimate yet" - a ticker without an estimate is listed,
 * never ranked.
 */
export interface DiscountMeterProps {
  discount: Numeric
  /** Shown beside the zone when both are known, as the arithmetic behind the number. */
  price?: Numeric
  fairValue?: Numeric
  label?: string
  /** The widest discount the track shows. Beyond it the fill is clamped and marked. */
  range?: number
}

export function DiscountMeter({
  discount,
  price,
  fairValue,
  label = 'Discount to fair value',
  range = 0.3,
}: DiscountMeterProps) {
  const value = toNumber(discount)
  const zone = zoneFor(discount)

  // Percent of the track, measured from the left edge. Zero sits at the middle.
  const position = (fraction: number) =>
    50 + (Math.max(-range, Math.min(range, fraction)) / range) * 50
  const clamped = value !== null && Math.abs(value) > range

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Label>{label}</Label>
        {value === null ? (
          <span className="text-small text-ink-muted">No estimate yet</span>
        ) : (
          <span className="flex items-baseline gap-2">
            <span
              className={`text-figure font-semibold ${
                zone?.tone === 'ahead' ? 'text-ahead' : 'text-behind'
              }`}
            >
              {percent(value, { sign: false })}
            </span>
            <span className="text-small text-ink-secondary">{zone?.label}</span>
          </span>
        )}
      </div>

      <div
        role="meter"
        aria-valuenow={value ?? undefined}
        aria-valuemin={-range}
        aria-valuemax={range}
        aria-valuetext={
          value === null ? 'No estimate yet' : `${percent(value, { sign: false })}, ${zone?.label}`
        }
        aria-label={label}
        className="relative h-2.5 w-full rounded-full bg-mid"
      >
        {value !== null && (
          <span
            className={`absolute top-0 h-2.5 ${
              value >= 0
                ? 'left-1/2 rounded-r-[4px] bg-ahead'
                : 'right-1/2 rounded-l-[4px] bg-behind'
            }`}
            style={{ width: `${Math.abs(position(value) - 50)}%` }}
          />
        )}

        {/* Zone boundaries: the −15 / 0 / +15 thresholds, as hairlines over the track. */}
        {[WELL_ABOVE, 0, DEEP_DISCOUNT].map((boundary) => (
          <span
            key={boundary}
            aria-hidden="true"
            className={`absolute inset-y-[-3px] w-px ${boundary === 0 ? 'bg-axis' : 'bg-rule'}`}
            style={{ left: `${position(boundary)}%` }}
          />
        ))}
      </div>

      <div aria-hidden="true" className="flex justify-between text-micro text-ink-muted">
        <span>Well above</span>
        <span>Fair</span>
        <span>Deep discount</span>
      </div>

      {(price !== undefined || fairValue !== undefined) && (
        <p className="text-small text-ink-secondary tabular-nums">
          Price {price === undefined ? NA : money(price)} · your fair value{' '}
          {fairValue === undefined ? NA : money(fairValue)}
          {clamped && ' · beyond the scale'}
        </p>
      )}
    </div>
  )
}
