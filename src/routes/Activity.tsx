import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError, NotAuthenticatedError } from '../api/client'
import type { TransactionRow, TransactionType } from '../api/types'
import {
  BottomSheet,
  Button,
  Card,
  DataTable,
  dateShort,
  EmptyState,
  moneyExact,
  SectionHeading,
  Select,
  shares as formatShares,
  TextField,
  toNumber,
  useToast,
  type Column,
} from '../ui'
import { TransactionForm, type TransactionFormValues } from './TransactionForm'

const BLANK_TRANSACTION: TransactionFormValues = {
  account_label: '',
  trade_date: new Date().toISOString().slice(0, 10),
  ticker: '',
  type: 'buy',
  shares: '',
  amount_usd: '',
  note: '',
  excluded: false,
}

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'dividend', label: 'Dividend' },
  { value: 'split', label: 'Split' },
  { value: 'adjust', label: 'Adjust' },
]

function toValues(row: TransactionRow): TransactionFormValues {
  return {
    account_label: row.account_label,
    trade_date: row.trade_date,
    ticker: row.ticker,
    type: row.type,
    shares: row.shares ?? '',
    amount_usd: row.amount_usd,
    note: row.note ?? '',
    excluded: row.excluded,
  }
}

export default function Activity() {
  const toast = useToast()
  const [all, setAll] = useState<TransactionRow[] | null>(null)
  const [tickerFilter, setTickerFilter] = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<TransactionType | ''>('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<TransactionRow | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const report = useCallback(
    (err: unknown) => {
      if (err instanceof NotAuthenticatedError) toast.show(err.message, { status: 'critical' })
      else if (err instanceof ApiError)
        toast.show(`${err.status}: ${err.message}`, { status: 'critical' })
      else toast.show(String(err), { status: 'critical' })
    },
    [toast],
  )

  const reload = useCallback(async () => {
    try {
      setAll(await api.transactions.list())
    } catch (err) {
      report(err)
    }
  }, [report])

  useEffect(() => {
    let cancelled = false
    api.transactions.list().then(
      (rows) => {
        if (!cancelled) setAll(rows)
      },
      (err: unknown) => {
        if (!cancelled) report(err)
      },
    )
    return () => {
      cancelled = true
    }
  }, [report])

  const accounts = useMemo(
    () => [...new Set((all ?? []).map((r) => r.account_label))].sort(),
    [all],
  )

  const rows = useMemo(() => {
    if (!all) return []
    return all.filter(
      (r) =>
        (tickerFilter === '' || r.ticker === tickerFilter.toUpperCase()) &&
        (accountFilter === '' || r.account_label === accountFilter) &&
        (typeFilter === '' || r.type === typeFilter),
    )
  }, [all, tickerFilter, accountFilter, typeFilter])

  async function createTransaction(values: TransactionFormValues) {
    setBusy(true)
    try {
      await api.transactions.create({
        account_label: values.account_label.trim(),
        trade_date: values.trade_date,
        ticker: values.ticker.trim().toUpperCase(),
        type: values.type,
        shares: values.shares.trim() === '' ? null : values.shares.trim(),
        amount_usd: values.amount_usd.trim(),
        source: 'manual',
        source_row_hash: `manual-${crypto.randomUUID()}`,
        note: values.note.trim() === '' ? null : values.note.trim(),
        excluded: values.excluded,
      })
      setAdding(false)
      setSaveError(null)
      toast.show('Transaction added.', { status: 'good' })
      await reload()
    } catch (err) {
      if (err instanceof ApiError) setSaveError(err.message)
      else report(err)
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit(id: number, values: TransactionFormValues) {
    setBusy(true)
    try {
      await api.transactions.update(id, {
        account_label: values.account_label.trim(),
        trade_date: values.trade_date,
        ticker: values.ticker.trim().toUpperCase(),
        type: values.type,
        shares: values.shares.trim() === '' ? null : values.shares.trim(),
        amount_usd: values.amount_usd.trim(),
        note: values.note.trim() === '' ? null : values.note.trim(),
        excluded: values.excluded,
      })
      setEditing(null)
      setSaveError(null)
      toast.show('Transaction updated.', { status: 'good' })
      await reload()
    } catch (err) {
      if (err instanceof ApiError) setSaveError(err.message)
      else report(err)
    } finally {
      setBusy(false)
    }
  }

  async function toggleExcluded(row: TransactionRow) {
    try {
      await api.transactions.setExcluded(row.id, !row.excluded)
      await reload()
    } catch (err) {
      report(err)
    }
  }

  async function confirmDelete(id: number) {
    try {
      await api.transactions.remove(id)
      setConfirmDeleteId(null)
      toast.show('Transaction deleted.', { status: 'good' })
      await reload()
    } catch (err) {
      report(err)
    }
  }

  const columns: Column<TransactionRow>[] = [
    {
      key: 'ticker',
      header: 'Ticker',
      primary: true,
      sort: (r) => r.ticker,
      render: (r) => (
        <span className={r.excluded ? 'text-ink-muted line-through' : ''}>
          {r.ticker} <span className="text-ink-muted">· {r.type}</span>
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      sort: (r) => r.trade_date,
      render: (r) => dateShort(r.trade_date),
    },
    {
      key: 'type',
      header: 'Type',
      hideOnCard: true,
      sort: (r) => r.type,
      render: (r) => r.type,
    },
    {
      key: 'account',
      header: 'Account',
      sort: (r) => r.account_label,
      render: (r) => r.account_label,
    },
    {
      key: 'shares',
      header: 'Shares',
      align: 'right',
      sort: (r) => toNumber(r.shares),
      render: (r) => formatShares(r.shares),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sort: (r) => toNumber(r.amount_usd),
      render: (r) => moneyExact(r.amount_usd),
    },
    {
      key: 'note',
      header: 'Note',
      hideOnCard: true,
      render: (r) => r.note ?? '—',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex flex-wrap gap-1.5">
          <Button variant="ghost" onClick={() => setEditing(r)}>
            Edit
          </Button>
          <Button variant="ghost" onClick={() => void toggleExcluded(r)}>
            {r.excluded ? 'Include' : 'Exclude'}
          </Button>
          {confirmDeleteId === r.id ? (
            <>
              <Button variant="primary" onClick={() => void confirmDelete(r.id)}>
                Confirm delete
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDeleteId(r.id)}>
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        action={
          <Button variant="primary" onClick={() => setAdding(true)}>
            Add transaction
          </Button>
        }
      >
        Activity
      </SectionHeading>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextField
            label="Ticker"
            value={tickerFilter}
            onChange={(e) => setTickerFilter(e.target.value.toUpperCase())}
            placeholder="All"
          />
          <Select
            label="Account"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            options={[
              { value: '', label: 'All accounts' },
              ...accounts.map((a) => ({ value: a, label: a })),
            ]}
          />
          <Select
            label="Type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TransactionType | '')}
            options={TYPE_FILTER_OPTIONS}
          />
        </div>
      </Card>

      {all === null ? (
        <p className="text-small text-ink-muted">Loading…</p>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => String(r.id)}
          caption="Transactions"
          initialSort={{ key: 'date', direction: 'desc' }}
          empty={
            <EmptyState
              title="No transactions"
              body={
                all.length === 0
                  ? 'Import an M1 export or add one by hand to get started.'
                  : 'Nothing matches these filters.'
              }
            />
          }
        />
      )}

      <BottomSheet open={adding} onClose={() => setAdding(false)} title="Add transaction">
        <TransactionForm
          initial={BLANK_TRANSACTION}
          accounts={accounts}
          submitLabel="Add"
          busy={busy}
          error={saveError}
          onSubmit={createTransaction}
          onCancel={() => setAdding(false)}
        />
      </BottomSheet>

      <BottomSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit transaction"
      >
        {editing && (
          <TransactionForm
            initial={toValues(editing)}
            accounts={accounts}
            submitLabel="Save"
            busy={busy}
            error={saveError}
            showExcluded
            onSubmit={(values) => saveEdit(editing.id, values)}
            onCancel={() => setEditing(null)}
          />
        )}
      </BottomSheet>
    </div>
  )
}
