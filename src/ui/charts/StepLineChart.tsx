import { useMemo, useState, type CSSProperties } from 'react'
import { NA, dateFull, dateShort, money, moneyAxis, toNumber, type Numeric } from '../format'
import { EmptyState } from '../States'
import { useElementWidth } from '../useElementWidth'
import { ChartFrame, Readout } from './ChartFrame'
import {
  decimate,
  linePath,
  linearScale,
  niceTicks,
  paddedDomain,
  pathLength,
  stepPath,
  type Point,
} from './geometry'
import { useScrub } from './useScrub'

/**
 * A price line with your fair-value history drawn over it as a **step-after** line, plus a
 * marker at every change carrying its note (SPEC section 7).
 *
 * Step-after is the whole point: an estimate is a level that holds until you revise it, so a
 * sloped line between two estimates would claim a gradual revision that never happened.
 *
 * The estimate line is green - see docs/DESIGN.md section 2.3 for why that hue and why it is
 * never allowed to mean "good" anywhere else in the app. It is always direct-labelled.
 *
 * Split adjustment of older estimates is the engine's job (SPEC section 7); this component
 * draws the numbers it is handed.
 */
export interface EstimateChange {
  /** `YYYY-MM-DD`. */
  date: string
  value: Numeric
  note?: string | null
}

export interface StepLineChartProps {
  dates: readonly string[]
  price: readonly Numeric[]
  estimates: readonly EstimateChange[]
  title?: string
  subtitle?: string
  height?: number
  busy?: boolean
}

const MARGIN = { top: 18, right: 14, bottom: 20, left: 46 }

export function StepLineChart({
  dates,
  price,
  estimates,
  title = 'Price and your fair value',
  subtitle,
  height = 220,
  busy = false,
}: StepLineChartProps) {
  const [wrapperRef, width] = useElementWidth<HTMLDivElement>(340)
  const [openNote, setOpenNote] = useState<number | null>(null)

  const series = useMemo(() => {
    const length = Math.min(dates.length, price.length)
    const closes: number[] = []
    const days: string[] = []
    for (let i = 0; i < length; i += 1) {
      const value = toNumber(price[i])
      if (value === null) continue
      closes.push(value)
      days.push(dates[i])
    }

    // Each estimate lands on the first trading day at or after the date it was entered.
    const changes = estimates
      .map((change) => ({ ...change, number: toNumber(change.value) }))
      .filter((change): change is typeof change & { number: number } => change.number !== null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((change) => {
        const found = days.findIndex((day) => day >= change.date)
        return { ...change, index: found === -1 ? Math.max(0, days.length - 1) : found }
      })

    // The level in force on each day, null before the first estimate exists.
    const level: (number | null)[] = new Array(days.length).fill(null)
    let cursor = -1
    for (let i = 0; i < days.length; i += 1) {
      while (cursor + 1 < changes.length && changes[cursor + 1].index <= i) cursor += 1
      level[i] = cursor >= 0 ? changes[cursor].number : null
    }

    return { closes, days, changes, level }
  }, [dates, price, estimates])

  const plot = useMemo(() => {
    const { closes, days, changes, level } = series
    const left = MARGIN.left
    const right = Math.max(left + 1, width - MARGIN.right)
    const top = MARGIN.top
    const bottom = Math.max(top + 1, height - MARGIN.bottom)

    const x = linearScale([0, Math.max(1, days.length - 1)], [left, right])
    const values = [...closes, ...changes.map((change) => change.number)]
    const y = linearScale(paddedDomain(values, { pad: 0.1 }), [bottom, top])

    const xs = days.map((_, i) => x(i))
    const pricePoints: Point[] = closes.map((value, i) => ({ x: xs[i], y: y(value) }))
    const priceThin = decimate(pricePoints, Math.max(32, Math.round(right - left)))

    // The step edge only exists from the first estimate onward.
    const stepPoints: Point[] = []
    level.forEach((value, i) => {
      if (value !== null) stepPoints.push({ x: xs[i], y: y(value) })
    })

    return {
      left,
      right,
      top,
      bottom,
      x,
      y,
      xs,
      pricePath: linePath(priceThin),
      stepPath: stepPath(stepPoints),
      drawLength: pathLength(priceThin),
      markers: changes.map((change) => ({
        ...change,
        cx: x(change.index),
        cy: y(change.number),
      })),
      lastPrice: pricePoints[pricePoints.length - 1],
      lastStep: stepPoints[stepPoints.length - 1],
    }
  }, [series, width, height])

  const yTicks = useMemo(() => {
    const [low, high] = plot.y.domain
    return niceTicks(low, high, 3)
      .map((value) => ({ value, y: plot.y(value) }))
      .filter((tick) => tick.y > plot.top + 4 && tick.y < plot.bottom)
  }, [plot])

  const { index, handlers } = useScrub(plot.xs)
  const { closes, days, changes, level } = series
  const active = index ?? closes.length - 1

  if (closes.length < 2) {
    return (
      <ChartFrame
        title={title}
        subtitle={subtitle}
        empty={<EmptyState title="No price history for this ticker yet" />}
      >
        {null}
      </ChartFrame>
    )
  }

  const table = (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-small">
        <caption className="sr-only">Your fair-value estimates for this ticker</caption>
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-rule text-left">
            <th scope="col" className="label-micro py-1.5 pr-3 font-medium">
              Date
            </th>
            <th scope="col" className="label-micro py-1.5 pr-3 text-right font-medium">
              Fair value
            </th>
            <th scope="col" className="label-micro py-1.5 font-medium">
              Note
            </th>
          </tr>
        </thead>
        <tbody>
          {changes.length === 0 && (
            <tr>
              <td colSpan={3} className="py-2 text-ink-secondary">
                No estimates yet.
              </td>
            </tr>
          )}
          {changes.map((change) => (
            <tr
              key={`${change.date}-${change.number}`}
              className="border-b border-rule/60 last:border-0"
            >
              <th
                scope="row"
                className="py-1.5 pr-3 text-left font-normal tabular-nums text-ink-secondary"
              >
                {dateShort(change.date)}
              </th>
              <td className="py-1.5 pr-3 text-right tabular-nums">{money(change.number)}</td>
              <td className="py-1.5 text-ink-secondary">{change.note || NA}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const note = openNote === null ? null : plot.markers[openNote]

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      busy={busy}
      table={table}
      legend={[
        { label: 'Price', tone: 'you' },
        { label: 'Fair value', tone: 'estimate' },
      ]}
      readout={
        <Readout
          caption={index === null ? `Latest · ${dateShort(days[active])}` : dateFull(days[active])}
          items={[
            { label: 'price', value: money(closes[active]), tone: 'you' },
            {
              label: 'fair value',
              value: level[active] === null ? NA : money(level[active]),
              tone: 'estimate',
            },
          ]}
        />
      }
    >
      <div ref={wrapperRef} className="w-full">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="application"
          tabIndex={0}
          aria-label={`Price and fair value from ${dateFull(days[0])} to ${dateFull(
            days[days.length - 1],
          )}. Use the left and right arrow keys to read individual days.`}
          className="block select-none"
          onKeyDown={handlers.onKeyDown}
          onBlur={handlers.onBlur}
        >
          {yTicks.map((tick) => (
            <line
              key={tick.value}
              x1={plot.left}
              x2={plot.right}
              y1={tick.y}
              y2={tick.y}
              className="stroke-grid"
              strokeWidth={1}
            />
          ))}

          <path
            d={plot.pricePath}
            className="draw-in stroke-you"
            style={{ '--draw-length': plot.drawLength } as CSSProperties}
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={plot.stepPath}
            className="stroke-estimate"
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {plot.lastPrice && (
            <circle
              cx={plot.lastPrice.x}
              cy={plot.lastPrice.y}
              r={4}
              className="fill-you stroke-surface"
              strokeWidth={2}
            />
          )}
          {plot.lastStep && (
            <text
              x={plot.lastStep.x - 8}
              y={plot.lastStep.y - 8}
              textAnchor="end"
              className="chart-label fill-ink-secondary text-micro font-medium"
            >
              Fair value
            </text>
          )}

          {/*
            A marker per estimate change. The visible dot is 8px, so each one carries a 24px
            transparent hit circle - the mark spec's minimum, which an 8px target would miss.
          */}
          {plot.markers.map((marker, i) => (
            <g key={`${marker.date}-${i}`}>
              <circle
                cx={marker.cx}
                cy={marker.cy}
                r={4}
                className="fill-estimate stroke-surface"
                strokeWidth={2}
              />
              <circle
                cx={marker.cx}
                cy={marker.cy}
                r={12}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`Fair value set to ${money(marker.number)} on ${dateFull(marker.date)}${
                  marker.note ? `: ${marker.note}` : ''
                }`}
                className="cursor-pointer"
                onPointerEnter={() => setOpenNote(i)}
                onPointerLeave={() => setOpenNote(null)}
                onFocus={() => setOpenNote(i)}
                onBlur={() => setOpenNote(null)}
                onClick={() => setOpenNote(i)}
              />
            </g>
          ))}

          {yTicks.map((tick) => (
            <text
              key={`label-${tick.value}`}
              x={0}
              y={tick.y - 4}
              className="chart-label fill-ink-muted font-mono text-micro tabular-nums"
            >
              {moneyAxis(tick.value)}
            </text>
          ))}

          <text x={plot.left} y={height - 6} className="fill-ink-muted font-mono text-micro">
            {dateFull(days[0])}
          </text>
          <text
            x={plot.right}
            y={height - 6}
            textAnchor="end"
            className="fill-ink-muted font-mono text-micro"
          >
            {dateFull(days[days.length - 1])}
          </text>

          {index !== null && (
            <g>
              <line
                x1={plot.xs[active]}
                x2={plot.xs[active]}
                y1={plot.top}
                y2={plot.bottom}
                className="stroke-axis"
                strokeWidth={1}
              />
              <circle
                cx={plot.xs[active]}
                cy={plot.y(closes[active])}
                r={4}
                className="fill-you stroke-surface"
                strokeWidth={2}
              />
            </g>
          )}

          <rect
            x={plot.left}
            y={plot.top}
            width={Math.max(0, plot.right - plot.left)}
            height={Math.max(0, plot.bottom - plot.top)}
            fill="transparent"
            style={{ touchAction: 'pan-y' }}
            onPointerDown={handlers.onPointerDown}
            onPointerMove={handlers.onPointerMove}
            onPointerUp={handlers.onPointerUp}
            onPointerCancel={handlers.onPointerCancel}
            onPointerLeave={handlers.onPointerLeave}
          />
        </svg>
      </div>

      {/*
        The note lives in a fixed strip under the plot rather than a floating bubble: on a phone
        a bubble lands under your thumb, and this cannot overflow the card. `min-h` keeps the
        card from reflowing as notes appear.
      */}
      <p className="mt-1 min-h-9 text-small text-ink-secondary">
        {note ? (
          <>
            <span className="tabular-nums">{dateShort(note.date)}</span> · set to{' '}
            <span className="tabular-nums">{money(note.number)}</span>
            {note.note ? ` · ${note.note}` : ''}
          </>
        ) : (
          <span className="text-ink-muted">
            {changes.length > 0 ? 'Tap a marker to read its note.' : 'No estimates yet.'}
          </span>
        )}
      </p>
    </ChartFrame>
  )
}
