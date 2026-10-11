import { useMemo } from 'react'
import { tileSizes } from './geometry'
import { money, percent, toNumber, type Numeric } from '../format'
import { EmptyState } from '../States'
import { rampStepFor, zoneFor } from '../zones'
import { ChartFrame } from './ChartFrame'

/**
 * The toggle beside `RebuyBars`: the same ranked tickers, as tiles sized by position value
 * instead of rows ordered by discount - good for spotting "which big holding is cheap" rather
 * than "which holding is cheapest". Tile side length comes from `tileSizes` (`geometry.ts`), and
 * shading from the DESIGN 2.5 blue ramp (`rampStepFor`) - darker means a bigger discount, not a
 * second hue, since a red-tinted ramp would be a palette addition this task is not scoped for.
 *
 * A watched ticker has no position value to size by, so it gets the fixed small weight
 * `WATCHED_WEIGHT` and an outlined, unshaded tile - visually "not a real position", same idea
 * as its "Watching" badge everywhere else.
 */
export interface DiscountMapItem {
  ticker: string
  discount: Numeric
  price: Numeric
  fairValue: Numeric
  /** Position value, for sizing. `null` for a watched ticker - it has no position to size by. */
  value: Numeric | null
  watching: boolean
}

export interface DiscountMapProps {
  items: readonly DiscountMapItem[]
  range?: number
  onSelect?: (ticker: string) => void
}

export function DiscountMap({ items, range = 0.3, onSelect }: DiscountMapProps) {
  const ranked = useMemo(() => {
    return items
      .map((item) => ({ ...item, number: toNumber(item.discount) }))
      .filter((item): item is typeof item & { number: number } => item.number !== null)
      .sort((a, b) => b.number - a.number)
  }, [items])

  const heldWeights = ranked
    .filter((item) => !item.watching)
    .map((item) => Math.max(toNumber(item.value) ?? 0, 0))
  const maxHeldWeight = heldWeights.reduce((found, weight) => Math.max(found, weight), 0)
  // A watched tile reads as "fixed and small" against whatever the held tiles are doing, not
  // against some absolute size - a tenth of the biggest holding, or the floor, whichever is
  // bigger.
  const watchedWeight = Math.max(maxHeldWeight * 0.1, 1)

  const sizes = useMemo(
    () =>
      tileSizes(
        ranked.map((item) => (item.watching ? watchedWeight : (toNumber(item.value) ?? 0))),
      ),
    [ranked, watchedWeight],
  )

  if (ranked.length === 0) {
    return (
      <ChartFrame
        title="Discount map"
        subtitle="The same ranking as Rebuy opportunities, sized by position value instead of sorted by discount."
        empty={
          <EmptyState
            title="Nothing to map yet"
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
        <caption className="sr-only">Discount map, by position value</caption>
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-rule text-left">
            <th scope="col" className="label-micro py-1.5 pr-3 font-medium">
              Ticker
            </th>
            <th scope="col" className="label-micro py-1.5 pr-3 text-right font-medium">
              Value
            </th>
            <th scope="col" className="label-micro py-1.5 pr-3 text-right font-medium">
              Discount
            </th>
            <th scope="col" className="label-micro py-1.5 font-medium">
              Zone
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
              <td className="py-1.5 pr-3 text-right">
                {item.watching ? <span className="text-ink-muted">—</span> : money(item.value)}
              </td>
              <td className="py-1.5 pr-3 text-right">{percent(item.number, { sign: false })}</td>
              <td className="py-1.5">{zoneFor(item.number)?.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <ChartFrame
      title="Discount map"
      subtitle="The same ranking as Rebuy opportunities, sized by position value instead of sorted by discount."
      table={table}
    >
      <ul className="flex flex-wrap gap-1.5" role="list">
        {ranked.map((item, index) => {
          const size = sizes[index]
          const zone = zoneFor(item.number)
          const step = rampStepFor(item.number, range)
          return (
            <li key={item.ticker}>
              <button
                type="button"
                onClick={() => onSelect?.(item.ticker)}
                style={
                  item.watching
                    ? { width: size, height: size }
                    : { width: size, height: size, backgroundColor: step.color }
                }
                className={`flex flex-col items-center justify-center gap-0.5 overflow-hidden rounded-[6px] p-1 text-center transition-opacity duration-[120ms] hover:opacity-90 ${
                  item.watching ? 'border border-rule bg-surface text-ink-secondary' : ''
                }`}
                aria-label={`${item.ticker}, ${percent(item.number, { sign: false })} ${zone?.label ?? ''}${
                  item.watching ? ', watching' : `, ${money(item.value)}`
                }`}
              >
                <span
                  className={`truncate font-mono text-micro font-medium ${
                    item.watching ? '' : step.dark ? 'text-white' : 'text-ink'
                  }`}
                >
                  {item.ticker}
                </span>
                {size >= 60 && (
                  <span
                    className={`text-[0.625rem] ${item.watching ? 'text-ink-muted' : step.dark ? 'text-white/85' : 'text-ink/70'}`}
                  >
                    {percent(item.number, { sign: false })}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </ChartFrame>
  )
}
