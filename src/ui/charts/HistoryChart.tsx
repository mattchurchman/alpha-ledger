import { useMemo, type CSSProperties } from 'react'
import {
  dateFull,
  dateShort,
  money,
  moneyAxis,
  signedMoney,
  toNumber,
  type Numeric,
} from '../format'
import { EmptyState } from '../States'
import { useElementWidth } from '../useElementWidth'
import { ChartFrame, Readout } from './ChartFrame'
import {
  areaBetweenPath,
  decimate,
  gapRuns,
  linePath,
  linearScale,
  niceTicks,
  paddedDomain,
  pathLength,
  thin,
  valueAt,
  type Point,
} from './geometry'
import { useScrub } from './useScrub'

/**
 * Your portfolio against its VOO shadow, with **the gap between them filled** - blue where you
 * are ahead, red where you are behind. That band is the headline number drawn to scale, and it
 * is the one large filled area anywhere in the app (docs/DESIGN.md section 1).
 *
 * The band is split at every crossing by `gapRuns`, which interpolates the exact index where
 * the lines meet, so the two colours share a vertex and there is never a sliver of the wrong
 * one at a join.
 *
 * VOO is graphite rather than a second hue: it is the benchmark, drawn as a reference mark.
 * Section 2.3 of DESIGN.md records the measurements behind that, including why orange - the
 * obvious alternative - fails against the red fill it would sit inside.
 */
export interface HistoryChartProps {
  /** `YYYY-MM-DD`, one per trading day. */
  dates: readonly string[]
  you: readonly Numeric[]
  benchmark: readonly Numeric[]
  youLabel?: string
  benchmarkLabel?: string
  title?: string
  subtitle?: string
  height?: number
  busy?: boolean
}

const MARGIN = { top: 18, right: 14, bottom: 20, left: 46 }

/** The last trading day of each month: enough rows to be a real table, few enough to read. */
function monthEnds(dates: readonly string[], limit = 80): number[] {
  const picked: number[] = []
  for (let i = 0; i < dates.length - 1; i += 1) {
    if (dates[i].slice(0, 7) !== dates[i + 1].slice(0, 7)) picked.push(i)
  }
  if (dates.length > 0) picked.push(dates.length - 1)
  if (picked[0] !== 0) picked.unshift(0)
  if (picked.length <= limit) return picked
  const step = (picked.length - 1) / (limit - 1)
  const out: number[] = []
  for (let i = 0; i < limit - 1; i += 1) out.push(picked[Math.round(i * step)])
  out.push(picked[picked.length - 1])
  return out
}

export function HistoryChart({
  dates,
  you,
  benchmark,
  youLabel = 'You',
  benchmarkLabel = 'VOO',
  title = 'Your money versus VOO',
  subtitle,
  height = 220,
  busy = false,
}: HistoryChartProps) {
  const [wrapperRef, width] = useElementWidth<HTMLDivElement>(340)

  const series = useMemo(() => {
    const length = Math.min(dates.length, you.length, benchmark.length)
    const real: number[] = []
    const shadow: number[] = []
    const days: string[] = []
    for (let i = 0; i < length; i += 1) {
      const a = toNumber(you[i])
      const b = toNumber(benchmark[i])
      if (a === null || b === null) continue
      real.push(a)
      shadow.push(b)
      days.push(dates[i])
    }
    return { real, shadow, days }
  }, [dates, you, benchmark])

  const plot = useMemo(() => {
    const { real, shadow } = series
    const count = real.length
    const left = MARGIN.left
    const right = Math.max(left + 1, width - MARGIN.right)
    const top = MARGIN.top
    const bottom = Math.max(top + 1, height - MARGIN.bottom)

    const x = linearScale([0, Math.max(1, count - 1)], [left, right])
    const y = linearScale(paddedDomain([...real, ...shadow], { pad: 0.1, includeZero: true }), [
      bottom,
      top,
    ])

    const xs = Array.from({ length: count }, (_, i) => x(i))
    const youPoints: Point[] = real.map((value, i) => ({ x: xs[i], y: y(value) }))
    const vooPoints: Point[] = shadow.map((value, i) => ({ x: xs[i], y: y(value) }))

    // One pixel column per column of actual pixels: that is the whole 1,500-point story.
    const columns = Math.max(32, Math.round(right - left))
    const youThin = decimate(youPoints, columns)
    const vooThin = decimate(vooPoints, columns)

    const bands = gapRuns(real, shadow).map((run, index) => {
      const indices = thin(run.indices, 300)
      const edgeYou = indices.map((i) => ({ x: x(i), y: y(valueAt(real, i)) }))
      const edgeVoo = indices.map((i) => ({ x: x(i), y: y(valueAt(shadow, i)) }))
      return { key: `${run.sign}-${index}`, sign: run.sign, d: areaBetweenPath(edgeYou, edgeVoo) }
    })

    return {
      left,
      right,
      top,
      bottom,
      x,
      y,
      xs,
      youPoints,
      vooPoints,
      youPath: linePath(youThin),
      vooPath: linePath(vooThin),
      drawLength: Math.max(pathLength(youThin), pathLength(vooThin)),
      bands,
    }
  }, [series, width, height])

  const yTicks = useMemo(() => {
    const [low, high] = plot.y.domain
    return (
      niceTicks(low, high, 3)
        .map((value) => ({ value, y: plot.y(value) }))
        // Drop a tick that would print its label into the chart's top edge.
        .filter((tick) => tick.y > plot.top + 4 && tick.y < plot.bottom)
    )
  }, [plot])

  const { index, handlers } = useScrub(plot.xs)
  const { real, shadow, days } = series
  const active = index ?? real.length - 1

  if (real.length < 2) {
    return (
      <ChartFrame
        title={title}
        subtitle={subtitle}
        empty={
          <EmptyState
            title="No history yet"
            body="Import your M1 activity and update market data, and this fills in from your first transaction onward."
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
        <caption className="sr-only">
          {youLabel} and {benchmarkLabel} value at the end of each month
        </caption>
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-rule text-left">
            <th scope="col" className="label-micro py-1.5 pr-3 font-medium">
              Date
            </th>
            <th scope="col" className="label-micro py-1.5 pr-3 text-right font-medium">
              {youLabel}
            </th>
            <th scope="col" className="label-micro py-1.5 pr-3 text-right font-medium">
              {benchmarkLabel}
            </th>
            <th scope="col" className="label-micro py-1.5 text-right font-medium">
              Gap
            </th>
          </tr>
        </thead>
        <tbody>
          {monthEnds(days).map((i) => (
            <tr key={days[i]} className="border-b border-rule/60 last:border-0">
              <th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink-secondary">
                {dateShort(days[i])}
              </th>
              <td className="py-1.5 pr-3 text-right">{money(real[i])}</td>
              <td className="py-1.5 pr-3 text-right">{money(shadow[i])}</td>
              <td className="py-1.5 text-right">{signedMoney(real[i] - shadow[i])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const youEnd = plot.youPoints[plot.youPoints.length - 1]
  const vooEnd = plot.vooPoints[plot.vooPoints.length - 1]
  const youAbove = youEnd.y <= vooEnd.y

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      busy={busy}
      table={table}
      legend={[
        { label: youLabel, tone: 'you' },
        { label: benchmarkLabel, tone: 'voo' },
        { label: 'Ahead', tone: 'ahead', shape: 'rect' },
        { label: 'Behind', tone: 'behind', shape: 'rect' },
      ]}
      readout={
        <Readout
          caption={index === null ? `Latest · ${dateShort(days[active])}` : dateFull(days[active])}
          items={[
            { label: youLabel, value: money(real[active]), tone: 'you' },
            { label: benchmarkLabel, value: money(shadow[active]), tone: 'voo' },
            {
              label: 'gap',
              value: signedMoney(real[active] - shadow[active]),
              tone: real[active] >= shadow[active] ? 'ahead' : 'behind',
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
          // One user unit per CSS pixel, which keeps the scrub maths a subtraction.
          role="application"
          tabIndex={0}
          aria-label={`${youLabel} against ${benchmarkLabel} from ${dateFull(days[0])} to ${dateFull(
            days[days.length - 1],
          )}. Use the left and right arrow keys to read individual days.`}
          className="block select-none"
          onKeyDown={handlers.onKeyDown}
          onBlur={handlers.onBlur}
        >
          {/* Gridlines first: recessive, solid hairlines, never dashed. */}
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

          {/* The gap band, split by sign at the interpolated crossings. */}
          {plot.bands.map((band) => (
            <path
              key={band.key}
              d={band.d}
              className={band.sign === 1 ? 'fill-ahead' : 'fill-behind'}
              // The mark spec's area wash is ~10%; this one sits at 15% because the band *is*
              // the headline number, and at 10% it disappeared against the warm surface.
              fillOpacity={0.15}
            />
          ))}

          <path
            d={plot.vooPath}
            className="draw-in stroke-voo"
            style={{ '--draw-length': plot.drawLength } as CSSProperties}
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={plot.youPath}
            className="draw-in stroke-you"
            style={{ '--draw-length': plot.drawLength } as CSSProperties}
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* End dots with a 2px surface ring, so they stay legible where the lines converge. */}
          <circle
            cx={vooEnd.x}
            cy={vooEnd.y}
            r={4}
            className="fill-voo stroke-surface"
            strokeWidth={2}
          />
          <circle
            cx={youEnd.x}
            cy={youEnd.y}
            r={4}
            className="fill-you stroke-surface"
            strokeWidth={2}
          />

          {/*
            Direct end labels, placed on opposite sides of their own dots, so the pair cannot
            collide however close the lines get.
          */}
          <text
            x={youEnd.x - 8}
            y={youEnd.y + (youAbove ? -8 : 14)}
            textAnchor="end"
            className="chart-label fill-ink text-micro font-medium"
          >
            {youLabel}
          </text>
          <text
            x={vooEnd.x - 8}
            y={vooEnd.y + (youAbove ? 14 : -8)}
            textAnchor="end"
            className="chart-label fill-ink-secondary text-micro font-medium"
          >
            {benchmarkLabel}
          </text>

          {/* Y labels sit in the left gutter, in mono so they align with each other. */}
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
          {/*
            The middle date only when there is room for three dates: at 390px the first and
            middle labels collide, and the readout carries the exact date anyway.
          */}
          {plot.right - plot.left >= 320 && (
            <text
              x={(plot.left + plot.right) / 2}
              y={height - 6}
              textAnchor="middle"
              className="fill-ink-muted font-mono text-micro"
            >
              {dateShort(days[Math.floor((days.length - 1) / 2)])}
            </text>
          )}
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
                cy={plot.y(shadow[active])}
                r={4}
                className="fill-voo stroke-surface"
                strokeWidth={2}
              />
              <circle
                cx={plot.xs[active]}
                cy={plot.y(real[active])}
                r={4}
                className="fill-you stroke-surface"
                strokeWidth={2}
              />
            </g>
          )}

          {/*
            The hit layer. `pan-y` rather than `none`: a mostly-vertical drag belongs to the
            page, which on a phone is most of the screen, while a sideways drag - the only
            gesture that could mean anything else here - scrubs.
          */}
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
    </ChartFrame>
  )
}
