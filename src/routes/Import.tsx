import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { api, ApiError, NotAuthenticatedError } from '../api/client'
import type { TransactionInput, TransactionRow } from '../api/types'
import { parseM1Activity, type ParseResult } from '../engine/m1/parse'
import { usePortfolioData } from '../data/usePortfolioData'
import { splitAdjustTransactions, sharesOn } from '../engine/holdings'
import { reconcileShares, type ShareCount, type ShareMismatch } from '../engine/reconcile'
import {
  BottomSheet,
  Button,
  Card,
  Checkbox,
  DataTable,
  dateShort,
  EmptyState,
  moneyExact,
  SectionHeading,
  shares as formatShares,
  TextField,
  useToast,
  type Column,
} from '../ui'
import { TransactionForm, type TransactionFormValues } from './TransactionForm'

type Tab = 'import' | 'reconcile'

export default function Import() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('import')
  const [transactions, setTransactions] = useState<TransactionRow[] | null>(null)

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
      setTransactions(await api.transactions.list())
    } catch (err) {
      report(err)
    }
  }, [report])

  useEffect(() => {
    let cancelled = false
    api.transactions.list().then(
      (rows) => {
        if (!cancelled) setTransactions(rows)
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
    () => [...new Set((transactions ?? []).map((t) => t.account_label))].sort(),
    [transactions],
  )
  const existingHashes = useMemo(
    () => new Set((transactions ?? []).map((t) => t.source_row_hash)),
    [transactions],
  )

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading>Import</SectionHeading>

      <div className="flex gap-1.5">
        <Button
          variant={tab === 'import' ? 'primary' : 'secondary'}
          onClick={() => setTab('import')}
        >
          Import
        </Button>
        <Button
          variant={tab === 'reconcile' ? 'primary' : 'secondary'}
          onClick={() => setTab('reconcile')}
        >
          Reconcile
        </Button>
      </div>

      {tab === 'import' ? (
        <ImportTab
          existingHashes={existingHashes}
          onImported={reload}
          report={report}
          toast={toast}
        />
      ) : (
        <ReconcileTab
          transactions={transactions}
          accounts={accounts}
          onAdjusted={reload}
          report={report}
          toast={toast}
        />
      )}
    </div>
  )
}

type Toast = ReturnType<typeof useToast>

interface FileEntry {
  id: string
  name: string
  accountLabel: string
  text: string
}

interface ParsedEntry {
  entry: FileEntry
  error: string | null
  result: ParseResult | null
  newCount: number
  dupCount: number
  byType: Record<string, number>
  dateRange: { min: string; max: string } | null
}

function tryParse(
  text: string,
  accountLabel: string,
): { result: ParseResult | null; error: string | null } {
  if (accountLabel.trim() === '') return { result: null, error: 'Enter an account label.' }
  try {
    return { result: parseM1Activity(text, accountLabel.trim()), error: null }
  } catch (err) {
    return { result: null, error: err instanceof Error ? err.message : String(err) }
  }
}

function ImportTab({
  existingHashes,
  onImported,
  report,
  toast,
}: {
  existingHashes: Set<string>
  onImported: () => Promise<void>
  report: (err: unknown) => void
  toast: Toast
}) {
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    const added = await Promise.all(
      files.map(async (file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        accountLabel: file.name.replace(/\.csv$/i, ''),
        text: await file.text(),
      })),
    )
    setEntries((prev) => [...prev, ...added])
  }

  function updateLabel(id: string, accountLabel: string) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, accountLabel } : e)))
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  const preview: ParsedEntry[] = useMemo(() => {
    const seenInBatch = new Set<string>()
    return entries.map((entry) => {
      const { result, error } = tryParse(entry.text, entry.accountLabel)
      if (!result)
        return { entry, error, result: null, newCount: 0, dupCount: 0, byType: {}, dateRange: null }

      let newCount = 0
      let dupCount = 0
      const byType: Record<string, number> = {}
      let min = ''
      let max = ''
      for (const txn of result.transactions) {
        byType[txn.type] = (byType[txn.type] ?? 0) + 1
        if (min === '' || txn.trade_date < min) min = txn.trade_date
        if (max === '' || txn.trade_date > max) max = txn.trade_date
        const seen = existingHashes.has(txn.source_row_hash) || seenInBatch.has(txn.source_row_hash)
        seenInBatch.add(txn.source_row_hash)
        if (seen) dupCount++
        else newCount++
      }
      return {
        entry,
        error: null,
        result,
        newCount,
        dupCount,
        byType,
        dateRange: min ? { min, max } : null,
      }
    })
  }, [entries, existingHashes])

  const totals = preview.reduce(
    (acc, p) => ({
      new: acc.new + p.newCount,
      dup: acc.dup + p.dupCount,
      unrecognized: acc.unrecognized + (p.result?.unrecognized.length ?? 0),
    }),
    { new: 0, dup: 0, unrecognized: 0 },
  )
  const hasValidFiles = preview.some((p) => p.result !== null)

  async function confirmImport() {
    setBusy(true)
    try {
      const all: TransactionInput[] = preview.flatMap((p) => p.result?.transactions ?? [])
      const result = await api.transactions.bulkUpsert(all)
      toast.show(
        `Imported ${result.inserted} new transaction${result.inserted === 1 ? '' : 's'}; ${result.skipped} already in your ledger.`,
        { status: 'good' },
      )
      setEntries([])
      await onImported()
    } catch (err) {
      report(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-small text-ink-secondary">
          Pick one or more M1 activity CSV exports. Label each with the account it came from - that
          is what keeps the same trade in two accounts from being merged into one.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e)}
        />
        <Button className="mt-3" onClick={() => fileInputRef.current?.click()}>
          Choose CSV files…
        </Button>
      </Card>

      {entries.length === 0 ? (
        <EmptyState
          title="No files chosen"
          body="Pick one or more M1 activity exports to preview them here."
        />
      ) : (
        <>
          {preview.map(({ entry, error, result, newCount, dupCount, byType, dateRange }) => (
            <Card key={entry.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <TextField
                  label="Account label"
                  value={entry.accountLabel}
                  onChange={(e) => updateLabel(entry.id, e.target.value)}
                  className="flex-1"
                />
                <Button variant="ghost" className="mt-5" onClick={() => removeEntry(entry.id)}>
                  Remove
                </Button>
              </div>
              <p className="text-micro text-ink-muted">{entry.name}</p>

              {error ? (
                <p className="text-small text-critical">{error}</p>
              ) : (
                result && (
                  <>
                    <div className="flex flex-wrap gap-3 text-small text-ink-secondary">
                      {Object.entries(byType).map(([type, count]) => (
                        <span key={type}>
                          {count} {type}
                        </span>
                      ))}
                      {result.transactions.length === 0 && <span>No recognized transactions.</span>}
                    </div>
                    {dateRange && (
                      <p className="text-micro text-ink-muted">
                        {dateShort(dateRange.min)} – {dateShort(dateRange.max)}
                      </p>
                    )}
                    <p className="text-small">
                      {newCount} new · {dupCount} already in your ledger
                    </p>
                    {result.unrecognized.length > 0 && (
                      <details>
                        <summary className="cursor-pointer text-small font-medium text-warning">
                          {result.unrecognized.length} unrecognized row
                          {result.unrecognized.length === 1 ? '' : 's'} - review
                        </summary>
                        <ul className="mt-2 flex flex-col gap-1 text-micro text-ink-muted">
                          {result.unrecognized.map((u, i) => (
                            <li key={i}>
                              Line {u.line}: {u.reason || `unknown type "${u.transaction_type}"`}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {result.dropped.length > 0 && (
                      <p className="text-micro text-ink-muted">
                        {result.dropped.length} cash row{result.dropped.length === 1 ? '' : 's'}{' '}
                        dropped (deposits, fees, interest, transfers).
                      </p>
                    )}
                  </>
                )
              )}
            </Card>
          ))}

          <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-small">
              {totals.new} new · {totals.dup} already imported
              {totals.unrecognized > 0 &&
                ` · ${totals.unrecognized} unrecognized (will be skipped)`}
            </p>
            <Button
              variant="primary"
              disabled={busy || !hasValidFiles}
              onClick={() => void confirmImport()}
            >
              {busy ? 'Importing…' : 'Confirm import'}
            </Button>
          </Card>
        </>
      )}
    </div>
  )
}

interface ActualRow {
  id: string
  ticker: string
  shares: string
}

function blankActualRow(): ActualRow {
  return { id: crypto.randomUUID(), ticker: '', shares: '' }
}

function parseActualCsv(text: string): ActualRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '')
  const rows: ActualRow[] = []
  for (const line of lines) {
    const [rawTicker, rawShares] = line.split(',').map((s) => s.trim())
    if (!rawTicker) continue
    if (rows.length === 0 && !/^-?\d/.test(rawShares ?? '')) continue // likely a header row
    rows.push({ id: crypto.randomUUID(), ticker: rawTicker.toUpperCase(), shares: rawShares ?? '' })
  }
  return rows
}

function blankAdjustment(ticker: string, difference: string): TransactionFormValues {
  return {
    account_label: '',
    trade_date: new Date().toISOString().slice(0, 10),
    ticker,
    type: 'adjust',
    shares: difference,
    amount_usd: '0',
    note: 'Reconciliation adjustment',
    excluded: false,
  }
}

function ReconcileTab({
  transactions,
  accounts,
  onAdjusted,
  report,
  toast,
}: {
  transactions: TransactionRow[] | null
  accounts: string[]
  onAdjusted: () => Promise<void>
  report: (err: unknown) => void
  toast: Toast
}) {
  /**
   * Prices and aliases come from the shared cache rather than a fetch of their own: a
   * reconstructed share count is only comparable with M1's if it is in the same (post-split)
   * terms and under the same ticker (SPEC section 4). Task 08 passed `{}` for both because no
   * stored price history existed yet; task 09 added it.
   */
  const { prices, aliases } = usePortfolioData()
  const [rows, setRows] = useState<ActualRow[]>([blankActualRow()])
  const [actualIsComplete, setActualIsComplete] = useState(true)
  const [mismatches, setMismatches] = useState<ShareMismatch[] | null>(null)
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const [tickerTxns, setTickerTxns] = useState<TransactionRow[] | null>(null)
  const [adjustFor, setAdjustFor] = useState<ShareMismatch | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const csvInputRef = useRef<HTMLInputElement>(null)

  function setRow(id: string, patch: Partial<ActualRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  async function handleCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const text = await file.text()
    const parsed = parseActualCsv(text)
    if (parsed.length > 0) setRows(parsed)
  }

  function runReconciliation() {
    if (!transactions) return
    const adjusted = splitAdjustTransactions(transactions, prices, aliases)
    const today = new Date().toISOString().slice(0, 10)
    const held = sharesOn(adjusted, today)
    const reconstructed: ShareCount[] = [...held].map(([ticker, qty]) => ({
      ticker,
      shares: qty.toFixed(),
    }))
    const actual: ShareCount[] = rows
      .filter((r) => r.ticker.trim() !== '' && r.shares.trim() !== '')
      .map((r) => ({ ticker: r.ticker.trim().toUpperCase(), shares: r.shares.trim() }))

    setMismatches(reconcileShares(reconstructed, actual, { actualIsComplete }))
    setSelectedTicker(null)
    setTickerTxns(null)
  }

  async function viewTransactions(ticker: string) {
    setSelectedTicker(ticker)
    try {
      setTickerTxns(await api.transactions.list({ ticker }))
    } catch (err) {
      report(err)
    }
  }

  async function createAdjustment(values: TransactionFormValues) {
    setBusy(true)
    try {
      await api.transactions.create({
        account_label: values.account_label.trim(),
        trade_date: values.trade_date,
        ticker: values.ticker.trim().toUpperCase(),
        type: 'adjust',
        shares: values.shares.trim(),
        amount_usd: values.amount_usd.trim() === '' ? '0' : values.amount_usd.trim(),
        source: 'manual',
        source_row_hash: `manual-${crypto.randomUUID()}`,
        note: values.note.trim() === '' ? null : values.note.trim(),
      })
      setAdjustFor(null)
      setSaveError(null)
      toast.show('Adjustment added.', { status: 'good' })
      await onAdjusted()
      if (selectedTicker) await viewTransactions(selectedTicker)
      setMismatches(null)
    } catch (err) {
      if (err instanceof ApiError) setSaveError(err.message)
      else report(err)
    } finally {
      setBusy(false)
    }
  }

  const mismatchColumns: Column<ShareMismatch>[] = [
    {
      key: 'ticker',
      header: 'Ticker',
      primary: true,
      sort: (r) => r.ticker,
      render: (r) => r.ticker,
    },
    {
      key: 'reconstructed',
      header: 'In ledger',
      align: 'right',
      render: (r) => formatShares(r.reconstructed),
    },
    { key: 'actual', header: 'M1 says', align: 'right', render: (r) => formatShares(r.actual) },
    {
      key: 'difference',
      header: 'Off by',
      align: 'right',
      sort: (r) => Math.abs(Number(r.difference)),
      render: (r) => formatShares(r.difference),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex flex-wrap gap-1.5">
          <Button variant="ghost" onClick={() => void viewTransactions(r.ticker)}>
            Transactions
          </Button>
          <Button variant="ghost" onClick={() => setAdjustFor(r)}>
            Add adjustment
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <p className="text-small text-ink-secondary">
          Enter or upload the share counts M1 currently reports, one ticker per row. Anything off by
          more than 0.001 shares is flagged below, with a one-tap fix.
        </p>

        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-end gap-2">
              <TextField
                label="Ticker"
                value={row.ticker}
                onChange={(e) => setRow(row.id, { ticker: e.target.value.toUpperCase() })}
                className="flex-1"
              />
              <TextField
                label="Shares"
                inputMode="decimal"
                value={row.shares}
                onChange={(e) => setRow(row.id, { shares: e.target.value })}
                className="flex-1"
              />
              <Button
                variant="ghost"
                onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setRows((prev) => [...prev, blankActualRow()])}>Add row</Button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => void handleCsv(e)}
          />
          <Button onClick={() => csvInputRef.current?.click()}>Load from CSV…</Button>
        </div>

        <Checkbox
          label="This is my complete current holdings (not just a few tickers I'm checking)"
          checked={actualIsComplete}
          onChange={(e) => setActualIsComplete(e.target.checked)}
        />

        <Button variant="primary" disabled={!transactions} onClick={runReconciliation}>
          Check reconciliation
        </Button>
      </Card>

      {mismatches && (
        <Card>
          {mismatches.length === 0 ? (
            <EmptyState
              title="Everything matches"
              body="No ticker is off by more than 0.001 shares."
            />
          ) : (
            <DataTable
              rows={mismatches}
              columns={mismatchColumns}
              rowKey={(r) => r.ticker}
              caption="Share mismatches"
              initialSort={{ key: 'difference', direction: 'desc' }}
            />
          )}
        </Card>
      )}

      {selectedTicker && (
        <Card>
          <SectionHeading>{selectedTicker} transactions</SectionHeading>
          {tickerTxns === null ? (
            <p className="text-small text-ink-muted">Loading…</p>
          ) : (
            <DataTable
              rows={tickerTxns}
              columns={[
                {
                  key: 'date',
                  header: 'Date',
                  primary: true,
                  render: (r) => dateShort(r.trade_date),
                },
                { key: 'type', header: 'Type', render: (r) => r.type },
                {
                  key: 'shares',
                  header: 'Shares',
                  align: 'right',
                  render: (r) => formatShares(r.shares),
                },
                {
                  key: 'amount',
                  header: 'Amount',
                  align: 'right',
                  render: (r) => moneyExact(r.amount_usd),
                },
                { key: 'account', header: 'Account', render: (r) => r.account_label },
              ]}
              rowKey={(r) => String(r.id)}
              caption={`${selectedTicker} transactions`}
              empty={<EmptyState title="No transactions for this ticker" />}
            />
          )}
        </Card>
      )}

      <BottomSheet
        open={adjustFor !== null}
        onClose={() => setAdjustFor(null)}
        title={`Add adjustment: ${adjustFor?.ticker ?? ''}`}
      >
        {adjustFor && (
          <TransactionForm
            initial={blankAdjustment(adjustFor.ticker, adjustFor.difference)}
            accounts={accounts}
            submitLabel="Add adjustment"
            busy={busy}
            error={saveError}
            onSubmit={createAdjustment}
            onCancel={() => setAdjustFor(null)}
          />
        )}
      </BottomSheet>
    </div>
  )
}
