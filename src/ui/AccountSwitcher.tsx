/**
 * The Dashboard's account control (task 19): "All accounts" plus one stop per label, in the
 * same segmented form as `RangeSelector` and for the same reason - at 390px a handful of
 * account names do not fit at docs/DESIGN.md section 3.3's 44px touch-target floor, so the row
 * scrolls horizontally rather than shrinking the targets below it.
 *
 * It renders nothing at all when there is one account or none: there is no view to switch to,
 * and the rule belongs here rather than in each caller's JSX.
 */

export const ALL_ACCOUNTS_LABEL = 'All accounts'

export interface AccountSwitcherProps {
  accounts: string[]
  /** The selected account, or null for the summed view. */
  value: string | null
  onChange: (account: string | null) => void
  label?: string
}

export function AccountSwitcher({
  accounts,
  value,
  onChange,
  label = 'Account',
}: AccountSwitcherProps) {
  if (accounts.length < 2) return null

  const stops: { key: string; name: string; account: string | null }[] = [
    { key: '__all__', name: ALL_ACCOUNTS_LABEL, account: null },
    ...accounts.map((account) => ({ key: account, name: account, account })),
  ]

  return (
    <div role="group" aria-label={label} className="flex gap-1.5 overflow-x-auto pb-1">
      {stops.map((stop) => (
        <button
          key={stop.key}
          type="button"
          aria-pressed={value === stop.account}
          onClick={() => onChange(stop.account)}
          className={`inline-flex min-h-11 max-w-56 shrink-0 items-center justify-center rounded-full border px-4 text-small font-medium transition-colors duration-[120ms] ease-out ${
            value === stop.account
              ? 'border-transparent bg-accent-wash text-accent'
              : 'border-transparent text-ink-secondary hover:bg-sunken hover:text-ink'
          }`}
        >
          <span className="truncate">{stop.name}</span>
        </button>
      ))}
    </div>
  )
}
