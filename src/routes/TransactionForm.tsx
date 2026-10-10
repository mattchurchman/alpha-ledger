import { useState } from 'react'
import type { TransactionType } from '../api/types'
import { Button, Checkbox, Select, TextField } from '../ui'

/**
 * Shared by the Activity screen (add/edit) and the Import screen's reconciliation tab
 * (one-tap "add adjustment"). Collects plain strings and hands them to the caller on submit -
 * the caller decides whether that becomes a `TransactionInput` (create) or a `TransactionPatch`
 * (edit), since only it knows which.
 */
export interface TransactionFormValues {
  account_label: string
  trade_date: string
  ticker: string
  type: TransactionType
  /** `''` means null (no share count - a dividend, usually). */
  shares: string
  amount_usd: string
  /** `''` means null. */
  note: string
  excluded: boolean
}

const TYPE_OPTIONS = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'dividend', label: 'Dividend' },
  { value: 'split', label: 'Split' },
  { value: 'adjust', label: 'Adjust (correction)' },
]

const SHARES_HINT: Record<TransactionType, string> = {
  buy: 'Required. Number of shares bought.',
  sell: 'Required. Number of shares sold.',
  dividend: 'Leave blank - a dividend has no share count.',
  split: 'Optional. The split ratio, if you know it.',
  adjust:
    'Required. Positive to add shares, negative to remove them - the one type that may be negative.',
}

export interface TransactionFormProps {
  initial: TransactionFormValues
  /** Known account labels, offered as datalist suggestions. */
  accounts: string[]
  submitLabel: string
  busy?: boolean
  /** A server-side error from the last submit attempt. */
  error?: string | null
  showExcluded?: boolean
  onSubmit: (values: TransactionFormValues) => void
  onCancel: () => void
}

export function TransactionForm({
  initial,
  accounts,
  submitLabel,
  busy = false,
  error,
  showExcluded = false,
  onSubmit,
  onCancel,
}: TransactionFormProps) {
  const [values, setValues] = useState(initial)
  const [formError, setFormError] = useState<string | null>(null)

  const set = <K extends keyof TransactionFormValues>(key: K, value: TransactionFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }))

  function handleSubmit() {
    if (values.account_label.trim() === '') return setFormError('Account is required.')
    if (values.trade_date.trim() === '') return setFormError('Date is required.')
    if (values.ticker.trim() === '') return setFormError('Ticker is required.')
    if (values.amount_usd.trim() === '') return setFormError('Amount is required (use 0 if none).')
    if ((values.type === 'buy' || values.type === 'sell') && values.shares.trim() === '') {
      return setFormError(`Shares is required for a ${values.type}.`)
    }
    if (values.type === 'adjust' && values.shares.trim() === '') {
      return setFormError('Shares is required for an adjustment.')
    }
    setFormError(null)
    onSubmit(values)
  }

  return (
    <div className="flex flex-col gap-3">
      <datalist id="al-account-labels">
        {accounts.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>

      <TextField
        label="Account"
        list="al-account-labels"
        value={values.account_label}
        onChange={(e) => set('account_label', e.target.value)}
        placeholder="e.g. Roth IRA"
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Date"
          type="date"
          value={values.trade_date}
          onChange={(e) => set('trade_date', e.target.value)}
        />
        <TextField
          label="Ticker"
          value={values.ticker}
          onChange={(e) => set('ticker', e.target.value.toUpperCase())}
          placeholder="VOO"
        />
      </div>
      <Select
        label="Type"
        options={TYPE_OPTIONS}
        value={values.type}
        onChange={(e) => set('type', e.target.value as TransactionType)}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Shares"
          inputMode="decimal"
          value={values.shares}
          onChange={(e) => set('shares', e.target.value)}
          hint={SHARES_HINT[values.type]}
        />
        <TextField
          label="Amount (USD)"
          inputMode="decimal"
          value={values.amount_usd}
          onChange={(e) => set('amount_usd', e.target.value)}
          hint="Always positive; the type carries the direction."
        />
      </div>
      <TextField
        label="Note"
        value={values.note}
        onChange={(e) => set('note', e.target.value)}
        placeholder="Optional"
      />
      {showExcluded && (
        <Checkbox
          label="Excluded from engine calculations"
          checked={values.excluded}
          onChange={(e) => set('excluded', e.target.checked)}
        />
      )}

      {(formError ?? error) && <p className="text-small text-critical">{formError ?? error}</p>}

      <div className="mt-1 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </div>
  )
}
