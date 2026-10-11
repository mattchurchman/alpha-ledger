import { useMemo, useState } from 'react'
import { divergingSpan } from './geometry'
import { money, percent, toNumber, type Numeric } from '../format'
import { Button } from '../primitives'
import { EmptyState } from '../States'
import { zoneFor } from '../zones'
import { ChartFrame } from './ChartFrame'

/**
 * Task 21's compact read of Rebuy opportunities: thirty tickers at a glance instead of thirty
 * full `DiscountMeter`s. Each row is a two-sided bar growing from a centre zero - below fair
 * value to the right in the ahead hue, above it to the left in the behind hue - clamped at
 * `range` with a tick mark where a row runs off the scale, built from `divergingSpan`
 * (`geometry.ts`).
 *
 * The row's own tap target opens stock detail (SPEC 9's rebuy ranking is a way to reach a
 * ticker, same as the old meter list); a small Edit control beside it, never nested inside that
 * button, opens the fair-value sheet instead - the DataTable `rowAction` pattern, applied to a
 * plain list.
 */
export interface RebuyBarsItem {
  ticker: string
  discount: Numeric
  price: Numeric
  fairValue: Numeric
  watching: boolean
}

export interface RebuyBarsProps {
  items: readonly RebuyBarsItem[]
  title?: string
  subtitle?: string
  /** How many rows before "Show all". Phone-sized by default. */
  initialVisible?: number
  /** The widest discount the track shows before a row's marker reads "beyond the scale". */
  range?: number
  busy?: boolean
  onSelect?: (ticker: string) => void
  onEdit?: (ticker: string) => void
}

export function RebuyBars({
  items,
  title = 'Rebuy opportunities',
  subtitle,
  initialVisible = 8,
  range = 0.3,
  busy = false,
  onSelect,
  onEdit,
}: RebuyBarsProps) {
  const [expanded, setExpanded] = useState(false)

  const ranked = useMemo(() => {
    return items
      .map((item) => ({ ...item, number: toNumber(item.discount) }))
      .filter((item): item is typeof item & { number: number } => item.number !== null)
      .sort((a, b) => b.number - a.number)
  }, [items])

  const visible = expanded ? ranked : ranked.slice(0, initialVisible)

  if (ranked.length === 0) {
    return (
      <ChartFrame
        title={title}
        subtitle={subtitle}
        empty={
          <EmptyState
            title="Nothing to rank yet"
            body="Add a fair value for a holding or a watched ticker and it shows up here."
          />
        }
      >
        {null}
      </ChartFrame>
    )
  }

  const table = (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-small tabular-nums">
        <caption className="sr-only">Rebuy opportunities, ranked by discount</caption>
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-rule text-left">
            <th scope="col" className="label-micro py-1.5 pr-3 font-medium">
              Ticker
            </th>
            <th scope="col" className="label-micro py-1.5 pr-3 text-right font-medium">
              Discount
            </th>
            <th scope="col" className="label-micro py-1.5 pr-3 font-medium">
              Zone
            </th>
            <th scope="col" className="label-micro py-1.5 pr-3 text-right font-medium">
              Price
            </th>
            <th scope="col" className="label-micro py-1.5 text-right font-medium">
              Fair value
            </th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((item) => (
            <tr key={item.ticker} className="border-b border-rule/60 last:border-0">
              <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                {item.ticker}
                {item.watching && <span className="text-ink-muted"> (watching)</span>}
              </th>
              <td className="py-1.5 pr-3 text-right">{percent(item.number, { sign: false })}</td>
              <td className="py-1.5 pr-3">{zoneFor(item.number)?.label}</td>
              <td className="py-1.5 pr-3 text-right">{money(item.price)}</td>
              <td className="py-1.5 text-right">{money(item.fairValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      busy={busy}
      table={table}
      legend={[
        { label: 'Below fair value', tone: 'ahead', shape: 'rect' },
        { label: 'Above fair value', tone: 'behind', shape: 'rect' },
      ]}
    >
      <ul className="flex flex-col">
        {visible.map((item) => {
          const zone = zoneFor(item.number)
          const ahead = item.number >= 0
          const span = divergingSpan(item.number, range)
          const rowClassName =
            'grid min-h-11 flex-1 grid-cols-[4.5rem_1fr_4.5rem] items-center gap-2 rounded-[6px] py-1 text-left transition-colors duration-[120ms] hover:bg-sunken sm:grid-cols-[5.5rem_1fr_4.5rem_8rem]'
          return (
            <li key={item.ticker} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect?.(item.ticker)}
                className={rowClassName}
              >
                <span className="flex flex-col leading-tight">
                  <span className="truncate font-mono text-small font-medium">{item.ticker}</span>
                  {item.watching && (
                    <span className="truncate text-[0.625rem] text-ink-muted">Watching</span>
                  )}
                </span>

                <div className="relative h-2.5" aria-hidden="true">
                  <span className="absolute inset-y-[-3px] left-1/2 w-px -translate-x-1/2 bg-axis" />
                  <span
                    className={`absolute top-0 h-2.5 ${
                      ahead
                        ? 'left-1/2 rounded-r-[4px] bg-ahead'
                        : 'right-1/2 rounded-l-[4px] bg-behind'
                    }`}
                    style={{ width: `${span.fraction * 50}%` }}
                  />
                  {span.clamped && (
                    <span
                      className={`absolute top-[-3px] h-4 w-px ${ahead ? 'bg-ahead' : 'bg-behind'}`}
                      style={{ [ahead ? 'right' : 'left']: 0 }}
                      title="Beyond the scale"
                    />
                  )}
                </div>

                <span className="flex flex-col items-end leading-tight">
                  <span className="sr-only">
                    {item.ticker} {ahead ? 'below fair value by' : 'above fair value by'}{' '}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`text-small font-semibold tabular-nums ${ahead ? 'text-ahead' : 'text-behind'}`}
                  >
                    {percent(item.number, { sign: false })}
                  </span>
                  <span aria-hidden="true" className="text-[0.625rem] text-ink-muted">
                    {zone?.label}
                  </span>
                </span>

                <span
                  aria-hidden="true"
                  className="hidden truncate text-right text-[0.625rem] text-ink-muted sm:block"
                >
                  {money(item.price)} · {money(item.fairValue)}
                </span>
              </button>

              {onEdit && (
                <Button
                  variant="ghost"
                  aria-label={`Set ${item.ticker}'s fair value`}
                  onClick={() => onEdit(item.ticker)}
                  className="shrink-0 px-2"
                >
                  Edit
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      {ranked.length > initialVisible && (
        <Button className="mt-2 w-full" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show fewer' : `Show all ${ranked.length}`}
        </Button>
      )}
    </ChartFrame>
  )
}
