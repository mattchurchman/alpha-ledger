import { useId, useState, type ReactNode } from 'react'
import { ChartIcon, TableIcon } from '../icons'
import { Card, Legend, MiniButton } from '../primitives'

/**
 * The chrome every chart in the kit wears, so the chrome is identical everywhere and a screen
 * never reinvents it. It owns four things worth stating out loud:
 *
 * - **The table view.** Every chart has a `<table>` twin. That is the accessible equivalent,
 *   and it is also the relief channel the palette's sub-3:1 fills are allowed on condition of
 *   (docs/DESIGN.md sections 2.4 and 5.4).
 * - **The readout slot.** On a phone a floating tooltip ends up under your thumb, so the
 *   scrub readout lives here, at the top of the card, in a fixed-height row that shows the
 *   latest values when nothing is being scrubbed. Nothing reflows as you drag.
 * - **`busy` holds the frame.** A refetch dims the previous render instead of flashing a
 *   skeleton, so there is no layout jump.
 * - **The legend**, which is present whenever there are two or more series. Always.
 */
export interface ChartFrameProps {
  title: string
  subtitle?: ReactNode
  legend?: Parameters<typeof Legend>[0]['items']
  /** The live values row: the scrubbed point, or the latest one when idle. */
  readout?: ReactNode
  /** The chart's accessible twin. Omitting it is only legal for a chart with no values. */
  table?: ReactNode
  busy?: boolean
  /** Rendered in place of the chart when there is nothing to draw. */
  empty?: ReactNode
  children: ReactNode
}

export function ChartFrame({
  title,
  subtitle,
  legend,
  readout,
  table,
  busy = false,
  empty,
  children,
}: ChartFrameProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const bodyId = useId()

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-h3 font-semibold">{title}</h3>
          {subtitle && <p className="mt-0.5 text-small text-ink-secondary">{subtitle}</p>}
        </div>
        {table && (
          <MiniButton
            onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
            aria-controls={bodyId}
            aria-label={view === 'chart' ? `Show ${title} as a table` : `Show ${title} as a chart`}
          >
            {view === 'chart' ? <TableIcon className="size-4" /> : <ChartIcon className="size-4" />}
            {view === 'chart' ? 'Table' : 'Chart'}
          </MiniButton>
        )}
      </div>

      {readout && view === 'chart' && <div className="mb-2">{readout}</div>}

      <div id={bodyId} aria-busy={busy || undefined}>
        {empty ? (
          empty
        ) : (
          <div
            className={
              busy
                ? 'opacity-55 transition-opacity duration-[120ms]'
                : 'transition-opacity duration-[120ms]'
            }
          >
            {view === 'chart' ? children : table}
          </div>
        )}
      </div>

      {legend && legend.length > 1 && view === 'chart' && !empty && (
        <div className="mt-3 border-t border-rule pt-3">
          <Legend items={legend} />
        </div>
      )}
    </Card>
  )
}

/**
 * The shared shape of a readout row: a date on the left, one value per series on the right,
 * each keyed by a stroke of its colour. Values lead and names follow, which is the legend's
 * hierarchy inverted - here the reader already knows the series and wants the number.
 */
export function Readout({
  caption,
  items,
}: {
  caption: ReactNode
  items: readonly {
    label: string
    value: ReactNode
    tone: 'you' | 'voo' | 'estimate' | 'ahead' | 'behind'
  }[]
}) {
  const stroke = {
    you: 'bg-you',
    voo: 'bg-voo',
    estimate: 'bg-estimate',
    ahead: 'bg-ahead',
    behind: 'bg-behind',
  }
  return (
    <div className="flex min-h-[2.25rem] flex-wrap items-baseline gap-x-4 gap-y-1">
      <span className="label-micro tabular-nums">{caption}</span>
      {items.map((item) => (
        <span key={item.label} className="flex items-baseline gap-1.5">
          <span
            aria-hidden="true"
            className={`mb-[0.3em] inline-block h-[2px] w-3 rounded-full ${stroke[item.tone]}`}
          />
          <span className="text-body font-semibold tabular-nums">{item.value}</span>
          <span className="text-micro text-ink-muted">{item.label}</span>
        </span>
      ))}
    </div>
  )
}
