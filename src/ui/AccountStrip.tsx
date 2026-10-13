import type { ReactNode } from 'react'

/**
 * One tappable line per account, carrying two figures (task 19). The Dashboard uses it under
 * the headline for value and value added; the stock detail screen uses it for how a position's
 * shares split across accounts. Both get the same 44px target, the same truncation of a long
 * account name, and the same right-aligned columns.
 *
 * The figures arrive already formatted by the kit's own formatters - the screens do that for
 * every other number they show - and `delta` is a node so a caller can put a `SignedDelta`
 * there with its own wording. Nothing is computed here.
 */

export interface AccountStripRow {
  account: string
  /** The first figure, formatted: a money or share count. */
  figure: string
  /** The right-hand cell. A `SignedDelta`, or any node. */
  delta?: ReactNode
  /** Marks the row the screen is currently showing, so the strip says where you are. */
  selected?: boolean
}

export interface AccountStripProps {
  rows: AccountStripRow[]
  /** Called with the account to switch to. */
  onSelect: (account: string) => void
  /** How the row reads to a screen reader, as a sentence: `(account) => string`. */
  describe?: (account: string) => string
}

export function AccountStrip({
  rows,
  onSelect,
  describe = (account) => `Show ${account} only`,
}: AccountStripProps) {
  if (rows.length === 0) return null

  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li key={row.account}>
          <button
            type="button"
            onClick={() => onSelect(row.account)}
            aria-label={describe(row.account)}
            aria-current={row.selected ? 'true' : undefined}
            className={`-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center gap-3 rounded-control border px-2.5 text-left transition-colors duration-[120ms] ease-out hover:bg-sunken ${
              row.selected ? 'border-transparent bg-accent-wash' : 'border-transparent'
            }`}
          >
            <span className="min-w-0 flex-1 truncate text-small text-ink">{row.account}</span>
            <span className="shrink-0 text-small tabular-nums text-ink-secondary">
              {row.figure}
            </span>
            {/* Fixed-width so the second column lines up whatever the names are. */}
            {row.delta !== undefined && (
              <span className="flex w-24 shrink-0 justify-end">{row.delta}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
