import { CHART_RANGES, type ChartRange } from './chartRange'

/**
 * The window control for `HistoryChart`: eight stops from `1W` to `All`. At 390px they do not
 * all fit at the 44px touch-target floor docs/DESIGN.md section 3.3 requires, so the row scrolls
 * horizontally instead of shrinking the targets - task 17's acceptance explicitly allows this.
 */
export interface RangeSelectorProps {
  value: ChartRange
  onChange: (range: ChartRange) => void
  label?: string
}

export function RangeSelector({ value, onChange, label = 'Chart range' }: RangeSelectorProps) {
  return (
    <div role="group" aria-label={label} className="flex gap-1.5 overflow-x-auto pb-1">
      {CHART_RANGES.map((range) => (
        <button
          key={range}
          type="button"
          aria-pressed={value === range}
          onClick={() => onChange(range)}
          className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border px-3 text-small font-medium transition-colors duration-[120ms] ease-out ${
            value === range
              ? 'border-transparent bg-accent-wash text-accent'
              : 'border-transparent text-ink-secondary hover:bg-sunken hover:text-ink'
          }`}
        >
          {range}
        </button>
      ))}
    </div>
  )
}
