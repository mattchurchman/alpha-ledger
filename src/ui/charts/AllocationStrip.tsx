import { useMemo } from 'react'
import { money, percent, toNumber, type Numeric } from '../format'
import { EmptyState } from '../States'
import { ChartFrame } from './ChartFrame'

/**
 * "How much of this is in what" at a glance, above Holdings: one bar, a segment per holding
 * sized by its share of current value. No donuts (DESIGN section 1) - a stacked bar reads at a
 * glance and survives greyscale, where a ring chart needs either a legend or colour to carry
 * every slice's identity.
 *
 * There is no categorical per-ticker palette (DESIGN 2.3 defines series by role - you, VOO,
 * estimate - not by ticker), so every segment is the one "your portfolio" hue; identity comes
 * from the direct label where a segment is wide enough to carry it, the hairline gap between
 * segments, and the table twin otherwise. Held only, same scope as Holdings itself - a watched
 * ticker has no value to show a share of.
 */
export interface AllocationStripItem {
  ticker: string
  value: Numeric
}

export interface AllocationStripProps {
  items: readonly AllocationStripItem[]
  onSelect?: (ticker: string) => void
}

export function AllocationStrip({ items, onSelect }: AllocationStripProps) {
  const ranked = useMemo(() => {
    return items
      .map((item) => ({ ticker: item.ticker, number: toNumber(item.value) }))
      .filter(
        (item): item is { ticker: string; number: number } =>
          item.number !== null && item.number > 0,
      )
      .sort((a, b) => b.number - a.number)
  }, [items])

  const total = ranked.reduce((sum, item) => sum + item.number, 0)

  if (ranked.length === 0 || total <= 0) {
    return (
      <ChartFrame
        title="Allocation"
        subtitle="Current value, by holding."
        empty={
          <EmptyState
            title="Nothing to allocate yet"
            body="Once a holding has a stored price, its share of the total shows up here."
          />
        }
      >
        {null}
      </ChartFrame>
    )
  }

  const table = (
    <table className="w-full text-small tabular-nums">
      <caption className="sr-only">Allocation by holding</caption>
      <thead>
        <tr className="border-b border-rule text-left">
          <th scope="col" className="label-micro py-1.5 pr-3 font-medium">
            Ticker
          </th>
          <th scope="col" className="label-micro py-1.5 pr-3 text-right font-medium">
            Value
          </th>
          <th scope="col" className="label-micro py-1.5 text-right font-medium">
            Share
          </th>
        </tr>
      </thead>
      <tbody>
        {ranked.map((item) => (
          <tr key={item.ticker} className="border-b border-rule/60 last:border-0">
            <th scope="row" className="py-1.5 pr-3 text-left font-normal">
              {item.ticker}
            </th>
            <td className="py-1.5 pr-3 text-right">{money(item.number)}</td>
            <td className="py-1.5 text-right">{percent(item.number / total, { sign: false })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <ChartFrame title="Allocation" subtitle="Current value, by holding." table={table}>
      <div
        className="flex h-11 gap-[2px] overflow-hidden rounded-[6px]"
        role="list"
        aria-label="Allocation by holding"
      >
        {ranked.map((item) => {
          const share = item.number / total
          return (
            <button
              key={item.ticker}
              type="button"
              role="listitem"
              onClick={() => onSelect?.(item.ticker)}
              style={{ flexGrow: share, flexBasis: 0 }}
              className="min-w-[3px] overflow-hidden bg-you opacity-85 transition-opacity duration-[120ms] hover:opacity-100"
              aria-label={`${item.ticker}, ${percent(share, { sign: false })} of your holdings, ${money(item.number)}`}
            >
              {share >= 0.08 && (
                <span
                  aria-hidden="true"
                  className="block truncate px-1 text-micro font-mono font-medium text-accent-ink"
                >
                  {item.ticker}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </ChartFrame>
  )
}
