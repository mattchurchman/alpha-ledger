import type { ReactNode } from 'react'
import { CriticalIcon, GoodIcon, WarningIcon } from './icons'
import { dateShort, relativeTime } from './format'

/**
 * Loading, empty and status. Two rules from docs/DESIGN.md:
 *
 * - A skeleton appears on a **first** load only. A refetch holds the previous render at reduced
 *   opacity instead, so nothing jumps (see `ChartFrame`'s `busy`).
 * - A status colour never carries meaning alone: every badge here ships an icon and a word.
 */

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      // `rule` rather than `sunken`: the sunken step is nearly invisible against the dark
      // surface, so a dark-mode skeleton read as an empty card.
      className={`block animate-pulse rounded-[4px] bg-rule ${className}`.trimEnd()}
    />
  )
}

/** A first-load placeholder shaped like the thing it is standing in for. */
export function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3" style={{ height }}>
      <Skeleton className="h-3 w-28" />
      <Skeleton className="flex-1" />
      <Skeleton className="h-2.5 w-full" />
    </div>
  )
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-2 py-6">
      <p className="text-h3 font-semibold">{title}</p>
      {body && <p className="max-w-prose text-small text-ink-secondary">{body}</p>}
      {action}
    </div>
  )
}

type Status = 'good' | 'warning' | 'serious' | 'critical'

const STATUS_TEXT: Record<Status, string> = {
  good: 'text-good',
  warning: 'text-warning',
  serious: 'text-serious',
  critical: 'text-critical',
}

const STATUS_ICON: Record<Status, typeof GoodIcon> = {
  good: GoodIcon,
  warning: WarningIcon,
  serious: WarningIcon,
  critical: CriticalIcon,
}

/**
 * On the light surface `warning` and `serious` sit below 3:1 on purpose (docs/DESIGN.md
 * section 2.4); the icon and the word are the mitigation, so neither is optional here.
 */
export function StatusBadge({ status, children }: { status: Status; children: ReactNode }) {
  const Glyph = STATUS_ICON[status]
  return (
    <span className="inline-flex items-center gap-1.5 text-small font-medium">
      <Glyph className={`${STATUS_TEXT[status]} size-[1.1em]`} />
      <span className="text-ink-secondary">{children}</span>
    </span>
  )
}

export interface PricesAsOf {
  /** Date of the last close the app holds, `YYYY-MM-DD`. */
  date: string | null
  /** When the fetch happened, ISO. */
  updatedAt: string | null
  /** More than five trading days behind. Task 09 owns the real calculation. */
  stale?: boolean
}

/**
 * The "prices as of" indicator. The shell owns the slot; task 09 fills it from real metadata.
 * SPEC 8 wants both halves - which close the numbers are based on, and when we last asked.
 */
export function PricesAsOfBadge({ value }: { value?: PricesAsOf }) {
  if (!value || !value.date) {
    return <span className="text-micro text-ink-muted">No prices yet</span>
  }
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-micro text-ink-muted">
      <span>
        Prices as of {dateShort(value.date)}
        {value.updatedAt ? ` · updated ${relativeTime(value.updatedAt)}` : ''}
      </span>
      {value.stale && (
        <span className="inline-flex items-center gap-1 font-medium text-ink-secondary">
          <WarningIcon className="size-[1.2em] text-warning" />
          Stale
        </span>
      )}
    </span>
  )
}
