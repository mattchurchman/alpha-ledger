import { useMemo, useState } from 'react'
import { money, moneyCompact, signedMoney, toNumber, type Numeric } from '../format'
import { Button } from '../primitives'
import { EmptyState } from '../States'
import { ChartFrame } from './ChartFrame'

/**
 * Value creators and destroyers: every ticker ever held, ranked by how much better or worse off
 * you are than if those same dollars had gone into VOO. Closed positions belong here too - SPEC
 * section 6 says value added stays valid when current value is zero.
 *
 * Built from HTML rows rather than SVG. A diverging bar list is a table with one visual column,
 * and as HTML each row is natively focusable, screen-readable and selectable, which an SVG
 * `<rect>` is not. The 2px surface gap the mark spec asks for between adjacent bars comes from
 * row padding; nothing is stroked.
 *
 * The scale is symmetric around zero - both arms share `max |value|` - so a creator and a
 * destroyer of the same size draw the same length.
 */
export interface DivergingBarsProps {
  items: readonly { label: string; value: Numeric; note?: string }[]
  title?: string
  subtitle?: string
  /** How many rows before "Show all". Phone-sized by default. */
  initialVisible?: number
  busy?: boolean
  /** Makes every row a button, e.g. to push the stock detail screen. Omit to leave them inert. */
  onSelect?: (label: string) => void
}

export function DivergingBars({
  items,
  title = 'Value creators and destroyers',
  subtitle,
  initialVisible = 8,
  busy = false,
  onSelect,
}: DivergingBarsProps) {
  const [expanded, setExpanded] = useState(false)

  const ranked = useMemo(() => {
    return items
      .map((item) => ({ ...item, number: toNumber(item.value) }))
      .filter((item): item is typeof item & { number: number } => item.number !== null)
      .sort((a, b) => Math.abs(b.number) - Math.abs(a.number))
  }, [items])

  const largest = ranked.reduce((max, item) => Math.max(max, Math.abs(item.number)), 0)
  const visible = expanded ? ranked : ranked.slice(0, initialVisible)

  if (ranked.length === 0) {
    return (
      <ChartFrame
        title={title}
        subtitle={subtitle}
        empty={
          <EmptyState
            title="Nothing to rank yet"
            body="Once there are transactions and prices, every ticker you have ever held shows up here."
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
        <caption className="sr-only">Value added against VOO, by ticker</caption>
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-rule text-left">
            <th scope="col" className="label-micro py-1.5 pr-3 font-medium">
              Ticker
            </th>
            <th scope="col" className="label-micro py-1.5 text-right font-medium">
              Value added
            </th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((item) => (
            <tr key={item.label} className="border-b border-rule/60 last:border-0">
              <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                {item.label}
                {item.note && <span className="text-ink-muted"> ({item.note})</span>}
              </th>
              <td className="py-1.5 text-right">{signedMoney(item.number)}</td>
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
        { label: 'Beat VOO', tone: 'ahead', shape: 'rect' },
        { label: 'Trailed VOO', tone: 'behind', shape: 'rect' },
      ]}
    >
      <ul className="flex flex-col">
        {visible.map((item) => {
          const ahead = item.number >= 0
          const share = largest === 0 ? 0 : (Math.abs(item.number) / largest) * 50
          const rowClassName =
            'group grid min-h-11 w-full grid-cols-[4.5rem_1fr] items-center gap-2 rounded-[6px] py-1 text-left transition-colors duration-[120ms] hover:bg-sunken sm:grid-cols-[5.5rem_1fr_6rem]'
          const rowBody = (
            <>
              <span className="flex flex-col leading-tight">
                <span className="truncate font-mono text-small font-medium">{item.label}</span>
                {item.note && (
                  <span className="truncate text-[0.625rem] text-ink-muted">{item.note}</span>
                )}
              </span>

              <div className="relative h-2.5" aria-hidden="true">
                {/* The zero rule: a hairline, not a bar. */}
                <span className="absolute inset-y-[-3px] left-1/2 w-px -translate-x-1/2 bg-axis" />
                <span
                  className={`absolute top-0 h-2.5 ${
                    ahead
                      ? 'left-1/2 rounded-r-[4px] bg-ahead'
                      : 'right-1/2 rounded-l-[4px] bg-behind'
                  }`}
                  style={{ width: `${share}%` }}
                />
              </div>

              <span className="col-span-2 text-right text-small tabular-nums sm:col-span-1">
                <span className={ahead ? 'text-ahead' : 'text-behind'}>
                  <span className="sr-only">
                    {item.label} {ahead ? 'beat VOO by' : 'trailed VOO by'}{' '}
                  </span>
                  <span aria-hidden="true">{ahead ? '▲ +' : '▼ −'}</span>
                  <span className="group-hover:hidden">{moneyCompact(Math.abs(item.number))}</span>
                  <span className="hidden group-hover:inline">{money(Math.abs(item.number))}</span>
                </span>
              </span>
            </>
          )
          return (
            <li key={item.label}>
              {/*
                The row is the hit target, well past the 24px minimum, and the value is printed
                either way - the hover state sharpens it from compact to exact rather than being
                the only way to read it. A `button` when `onSelect` is given, so it is reachable
                and activatable from the keyboard - a plain `div`'s `onClick` would not be.
              */}
              {onSelect ? (
                <button type="button" onClick={() => onSelect(item.label)} className={rowClassName}>
                  {rowBody}
                </button>
              ) : (
                <div className={rowClassName}>{rowBody}</div>
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
