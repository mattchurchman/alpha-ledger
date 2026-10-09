import type { ReactNode } from 'react'
import { Sparkline } from './charts/Sparkline'
import { Label } from './primitives'
import { SignedDelta, type SignedDeltaProps } from './SignedDelta'
import type { Numeric } from './format'

/**
 * label · value · optional delta · optional sparkline · optional footnote - the contract in
 * docs/DESIGN.md section 5.5.
 *
 * Figures are **proportional**, not tabular: `tabular-nums` gives every digit the width of a
 * zero, which makes a large standalone number like 121 look loose. Tabular figures are for
 * columns (see `DataTable`).
 */
export interface StatTileProps {
  label: string
  /** Already formatted. The tile does not know what kind of number this is. */
  value: ReactNode
  delta?: SignedDeltaProps
  trend?: { values: readonly Numeric[]; label: string }
  footnote?: ReactNode
  /** The one headline number on a screen. More than one and neither is the headline. */
  hero?: boolean
}

export function StatTile({ label, value, delta, trend, footnote, hero = false }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={hero ? 'text-hero font-semibold' : 'text-figure font-semibold'}>
          {value}
        </span>
        {delta && <SignedDelta {...delta} size={delta.size ?? (hero ? 'md' : 'sm')} />}
      </div>
      {trend && (
        <div className="pt-1">
          <Sparkline values={trend.values} label={trend.label} />
        </div>
      )}
      {footnote && <p className="text-small text-ink-secondary">{footnote}</p>}
    </div>
  )
}
