import { useMemo, useState, type ReactNode } from 'react'
import { SortIcon } from './icons'
import { Label } from './primitives'

/**
 * A sortable table that **collapses to one card per row below 640px**.
 *
 * Both layouts are always in the DOM and chosen by CSS, not by a resize listener: a width
 * measured in JavaScript is wrong for one frame on every load, and a holdings table that
 * reflows after paint looks broken. Sorting state is shared, so switching width keeps your
 * order; on a phone the column headers are gone, so the sort control becomes a `<select>`.
 */
export interface Column<T> {
  key: string
  header: string
  align?: 'left' | 'right'
  render: (row: T) => ReactNode
  /** Omit to make the column unsortable. Return `null` to sort that row last. */
  sort?: (row: T) => number | string | null
  /** The card's title on a phone. Exactly one column should set it. */
  primary?: boolean
  /** Keep this column out of the phone card, where space is the scarce thing. */
  hideOnCard?: boolean
}

export interface DataTableProps<T> {
  rows: readonly T[]
  columns: readonly Column<T>[]
  rowKey: (row: T) => string
  /** Describes the table for screen readers. Visually hidden. */
  caption: string
  initialSort?: { key: string; direction: 'asc' | 'desc' }
  onRowSelect?: (row: T) => void
  /**
   * A control for one row, rendered **outside** the row's own select target: its own cell in
   * the table, and a footer under the card on a phone. A `render` column cannot do this when
   * `onRowSelect` is set, because the whole phone card is then a `<button>` and a control
   * inside it would be a button nested in a button - invalid, and unreachable by keyboard.
   */
  rowAction?: (row: T) => ReactNode
  /** Column heading for the `rowAction` cell. Visually a label; always announced. */
  rowActionHeader?: string
  empty?: ReactNode
}

type Direction = 'asc' | 'desc'

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  caption,
  initialSort,
  onRowSelect,
  rowAction,
  rowActionHeader = 'Actions',
  empty,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(initialSort?.key ?? null)
  const [direction, setDirection] = useState<Direction>(initialSort?.direction ?? 'desc')

  const sorted = useMemo(() => {
    const column = columns.find((candidate) => candidate.key === sortKey)
    if (!column?.sort) return [...rows]
    const read = column.sort
    const sign = direction === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const left = read(a)
      const right = read(b)
      // Missing values sort last whichever way the column is pointing.
      if (left === null && right === null) return 0
      if (left === null) return 1
      if (right === null) return -1
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * sign
      return String(left).localeCompare(String(right)) * sign
    })
  }, [rows, columns, sortKey, direction])

  const toggle = (column: Column<T>) => {
    if (!column.sort) return
    if (column.key === sortKey) setDirection(direction === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(column.key)
      setDirection('desc')
    }
  }

  if (rows.length === 0 && empty) return <>{empty}</>

  const primary = columns.find((column) => column.primary) ?? columns[0]
  const sortable = columns.filter((column) => column.sort)

  return (
    <>
      {/* Phone: the sort control the column headers would otherwise provide. */}
      {sortable.length > 0 && (
        <div className="mb-3 flex items-center gap-2 sm:hidden">
          <label htmlFor={`${caption}-sort`} className="label-micro">
            Sort
          </label>
          <select
            id={`${caption}-sort`}
            value={sortKey ?? ''}
            onChange={(event) => setSortKey(event.target.value || null)}
            className="min-h-11 flex-1 rounded-control border border-rule bg-sunken px-3 text-small"
          >
            <option value="">Unsorted</option>
            {sortable.map((column) => (
              <option key={column.key} value={column.key}>
                {column.header}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setDirection(direction === 'asc' ? 'desc' : 'asc')}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-rule bg-surface text-ink-secondary shadow-card transition-colors duration-[120ms] hover:bg-sunken hover:text-ink"
            aria-label={direction === 'asc' ? 'Sort descending' : 'Sort ascending'}
          >
            <SortIcon direction={direction} />
          </button>
        </div>
      )}

      {/* Phone: one card per row. */}
      <ul className="flex flex-col gap-2.5 sm:hidden">
        {sorted.map((row) => {
          const body = (
            <>
              <p className="text-h3 font-semibold">{primary.render(row)}</p>
              <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
                {columns
                  .filter((column) => column !== primary && !column.hideOnCard)
                  .map((column) => (
                    <div key={column.key} className="flex flex-col">
                      <dt>
                        <Label>{column.header}</Label>
                      </dt>
                      <dd className="text-small tabular-nums">{column.render(row)}</dd>
                    </div>
                  ))}
              </dl>
            </>
          )
          // With a row action the frame moves out to the `<li>`, so the action can sit in a
          // footer under the select target rather than inside it.
          const framed = rowAction ? '' : 'rounded-card border border-rule bg-surface shadow-card'
          return (
            <li
              key={rowKey(row)}
              className={rowAction ? 'rounded-card border border-rule bg-surface shadow-card' : ''}
            >
              {onRowSelect ? (
                <button
                  type="button"
                  onClick={() => onRowSelect(row)}
                  className={`w-full p-4 text-left transition-colors duration-[120ms] hover:bg-sunken ${framed}`.trimEnd()}
                >
                  {body}
                </button>
              ) : (
                <div className={`p-4 ${framed}`.trimEnd()}>{body}</div>
              )}
              {rowAction && <div className="border-t border-rule px-4 py-2.5">{rowAction(row)}</div>}
            </li>
          )
        })}
      </ul>

      {/* Tablet and up: a real table. */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-small">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-rule">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    column.sort
                      ? column.key === sortKey
                        ? direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                      : undefined
                  }
                  className={`px-2 py-2.5 first:pl-0 last:pr-0 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {column.sort ? (
                    <button
                      type="button"
                      onClick={() => toggle(column)}
                      className={`label-micro inline-flex min-h-8 items-center gap-1 hover:text-ink ${
                        column.align === 'right' ? 'flex-row-reverse' : ''
                      } ${column.key === sortKey ? 'text-ink' : ''}`}
                    >
                      {column.header}
                      <SortIcon direction={column.key === sortKey ? direction : undefined} />
                    </button>
                  ) : (
                    <Label>{column.header}</Label>
                  )}
                </th>
              ))}
              {rowAction && (
                <th scope="col" className="px-2 py-2.5 text-right last:pr-0">
                  <Label>{rowActionHeader}</Label>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowSelect ? () => onRowSelect(row) : undefined}
                onKeyDown={
                  onRowSelect
                    ? (event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        onRowSelect(row)
                      }
                    : undefined
                }
                tabIndex={onRowSelect ? 0 : undefined}
                role={onRowSelect ? 'button' : undefined}
                className={`border-b border-rule/70 last:border-0 ${
                  onRowSelect ? 'cursor-pointer hover:bg-accent-wash' : ''
                }`}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-2 py-2.5 tabular-nums first:pl-0 last:pr-0 ${
                      column.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {column.render(row)}
                  </td>
                ))}
                {rowAction && (
                  // The row itself is clickable (and, now, keyboard-activatable), so the
                  // action's cell swallows both the click and the key that would otherwise
                  // bubble up to the row and fire onRowSelect as well.
                  <td
                    className="px-2 py-2.5 text-right last:pr-0"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    {rowAction(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
