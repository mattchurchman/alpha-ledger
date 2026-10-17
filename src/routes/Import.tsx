import { useCallback, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, NotAuthenticatedError } from '../api/client'
import type { TransactionRow } from '../api/types'
import { parseM1Activity, type ParseResult } from '../engine/m1/parse'
import { planImport, type ImportPlan, type ImportRowReference } from '../engine/m1/resolve'
import { resolveImportPlan, type ImportDecision } from '../data/importWorkflow'
import { parseImportIgnoredHashes } from '../data/importIgnoredHashes'
import { usePortfolioData } from '../data/usePortfolioData'
import {
  computeHoldings,
  crossCheckSplits,
  splitAdjustTransactions,
  sharesOn,
} from '../engine/holdings'
import { DEFAULT_BENCHMARK, delistedCandidates, type Transaction } from '../engine'
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
  StatusBadge,
  TextField,
  useToast,
  type Column,
} from '../ui'
import { TransactionForm, type TransactionFormValues } from './TransactionForm'

type Tab = 'import' | 'reconcile'

export default function Import() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('import')
  /**
   * Reads the shared cache rather than fetching its own copy, so a transaction created on any
   * other screen (Close Position, Activity) is reflected here without a page reload - task 25c
   * found the opposite, independently-fetched version going stale and showing a mismatch that
   * had already been fixed elsewhere.
   */
  const { transactions: allTransactions, loading, reload } = usePortfolioData()
  const transactions: TransactionRow[] | null = loading ? null : allTransactions

  const report = useCallback(
    (err: unknown) => {
      if (err instanceof NotAuthenticatedError) toast.show(err.message, { status: 'critical' })
      else if (err instanceof ApiError)
        toast.show(`${err.status}: ${err.message}`, { status: 'critical' })
      else toast.show(String(err), { status: 'critical' })
    },
    [toast],
  )

  const accounts = useMemo(
    () => [...new Set((transactions ?? []).map((t) => t.account_label))].sort(),
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
        <ImportTab onReconcile={() => setTab('reconcile')} report={report} toast={toast} />
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
  suggestedLabel: string
  /** Undefined means "let the resolver infer it". */
  accountLabel?: string
  text: string
}

interface ParsedEntry {
  entry: FileEntry
  error: string | null
  result: ParseResult | null
  plan: ImportPlan | null
  resolved: ReturnType<typeof resolveImportPlan> | null
  dateRange: { min: string; max: string } | null
}

function tryParse(text: string): { result: ParseResult | null; error: string | null } {
  try {
    // The resolver re-hashes every row after it infers or receives the real account label.
    return { result: parseM1Activity(text, ''), error: null }
  } catch (err) {
    return { result: null, error: err instanceof Error ? err.message : String(err) }
  }
}

function ImportTab({
  onReconcile,
  report,
  toast,
}: {
  onReconcile: () => void
  report: (err: unknown) => void
  toast: Toast
}) {
  const { transactions, prices, aliases, meta, loading, reload, runUpdate, update } =
    usePortfolioData()
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [decisions, setDecisions] = useState<Record<string, ImportDecision>>({})
  const [phase, setPhase] = useState<'idle' | 'importing' | 'updating' | 'complete'>('idle')
  const [showHealth, setShowHealth] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const ignoredHashes = useMemo(
    () => parseImportIgnoredHashes(meta.import_ignored_hashes),
    [meta.import_ignored_hashes],
  )

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    const added = await Promise.all(
      files.map(async (file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        suggestedLabel: file.name.replace(/\.csv$/i, ''),
        text: await file.text(),
      })),
    )
    setShowHealth(false)
    setPhase('idle')
    setEntries((prev) => [...prev, ...added])
  }

  function updateLabel(id: string, accountLabel: string) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, accountLabel } : e)))
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  const preview: ParsedEntry[] = useMemo(() => {
    const planningLedger: Transaction[] = [...transactions]
    const planningIgnored = new Set(ignoredHashes)
    return entries.map((entry) => {
      const { result, error } = tryParse(entry.text)
      if (!result)
        return { entry, error, result: null, plan: null, resolved: null, dateRange: null }

      const accountLabel = entry.accountLabel?.trim() || undefined
      const plan = planImport({
        parsed: result,
        ...(accountLabel ? { accountLabel } : {}),
        ledger: planningLedger,
        prices,
        aliases,
        ignoredHashes: [...planningIgnored],
      })
      const resolved = resolveImportPlan(plan, decisions)
      planningLedger.push(...resolved.transactions)
      for (const hash of resolved.ignoredHashes) planningIgnored.add(hash)

      let min = ''
      let max = ''
      for (const txn of result.transactions) {
        if (min === '' || txn.trade_date < min) min = txn.trade_date
        if (max === '' || txn.trade_date > max) max = txn.trade_date
      }
      return {
        entry,
        error: null,
        result,
        plan,
        resolved,
        dateRange: min ? { min, max } : null,
      }
    })
  }, [entries, transactions, prices, aliases, ignoredHashes, decisions])

  const totals = preview.reduce(
    (acc, p) => ({
      new: acc.new + (p.plan?.fresh.length ?? 0),
      dup: acc.dup + (p.plan?.duplicates ?? 0),
      fixed: acc.fixed + (p.plan?.autoFixed.length ?? 0),
      unresolved: acc.unresolved + (p.resolved?.unresolved.length ?? 0),
    }),
    { new: 0, dup: 0, fixed: 0, unresolved: 0 },
  )
  const hasValidFiles = preview.length > 0 && preview.every((p) => p.plan !== null)
  const canImport = hasValidFiles && totals.unresolved === 0 && !loading && phase === 'idle'

  function decide(sourceRowHash: string, decision: ImportDecision) {
    setDecisions((current) => ({ ...current, [sourceRowHash]: decision }))
  }

  async function confirmImport() {
    setPhase('importing')
    try {
      const all = [
        ...new Map(
          preview
            .flatMap((p) => p.resolved?.transactions ?? [])
            .map((transaction) => [transaction.source_row_hash, transaction]),
        ).values(),
      ]
      const nextIgnored = [
        ...new Set([...ignoredHashes, ...preview.flatMap((p) => p.resolved?.ignoredHashes ?? [])]),
      ]
      const result = await api.transactions.bulkUpsert(all)
      setEntries([])
      setDecisions({})
      setPhase('updating')

      try {
        await api.importIgnoredHashes.set(nextIgnored)
      } catch (err) {
        report(err)
      }
      await reload()
      let failedUpdates = 0
      try {
        const outcome = await runUpdate([...transactions, ...all])
        failedUpdates = outcome.failed.length
      } catch (err) {
        report(err)
        failedUpdates = 1
      }
      setShowHealth(true)
      setPhase('complete')
      toast.show(
        failedUpdates === 0
          ? `Imported ${result.inserted} new transaction${result.inserted === 1 ? '' : 's'} and updated market data.`
          : `Imported ${result.inserted} new transaction${result.inserted === 1 ? '' : 's'}; the price update needs attention.`,
        { status: failedUpdates === 0 ? 'good' : 'warning' },
      )
    } catch (err) {
      report(err)
      setPhase('idle')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-small text-ink-secondary">
          Pick one or more full M1 activity exports. The app matches an existing account from the
          rows themselves; a genuinely new account asks you for its label once.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e)}
        />
        <Button
          className="mt-3"
          disabled={phase === 'importing' || phase === 'updating'}
          onClick={() => fileInputRef.current?.click()}
        >
          Choose CSV files…
        </Button>
      </Card>

      {entries.length === 0 ? (
        phase === 'updating' ? (
          <Card>
            <StatusBadge status="warning">
              Updating market data… {update.done}/{update.total}
            </StatusBadge>
          </Card>
        ) : showHealth ? (
          <HealthSummary onReconcile={onReconcile} />
        ) : (
          <EmptyState
            title="No files chosen"
            body="Pick one or more M1 activity exports to preview them here."
          />
        )
      ) : (
        <>
          {preview.map(({ entry, error, result, plan, resolved, dateRange }) => (
            <Card key={entry.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <TextField
                  label="Account label"
                  value={entry.accountLabel ?? plan?.accountLabel.value ?? ''}
                  placeholder={entry.suggestedLabel}
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
                result &&
                plan &&
                resolved && (
                  <>
                    <p className="text-micro text-ink-muted">{plan.accountLabel.evidence}</p>
                    {dateRange && (
                      <p className="text-micro text-ink-muted">
                        {dateShort(dateRange.min)} – {dateShort(dateRange.max)}
                      </p>
                    )}
                    <p className="text-small font-medium">
                      {plan.fresh.length} new · {plan.duplicates} already in ·{' '}
                      {plan.autoFixed.length} fixed automatically · {resolved.unresolved.length}{' '}
                      needs you
                    </p>

                    {plan.autoFixed.length > 0 && <AutomaticFixes plan={plan} />}
                    {(plan.proposals.length > 0 || plan.needsYou.length > 0) && (
                      <DecisionList plan={plan} decisions={decisions} onDecide={decide} />
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
              {totals.new} new · {totals.dup} already in · {totals.fixed} fixed automatically ·{' '}
              {totals.unresolved} needs you
            </p>
            <Button variant="primary" disabled={!canImport} onClick={() => void confirmImport()}>
              {phase === 'importing'
                ? 'Importing…'
                : phase === 'updating'
                  ? `Updating prices… ${update.done}/${update.total}`
                  : 'Import'}
            </Button>
          </Card>
        </>
      )}
    </div>
  )
}

function AutomaticFixes({ plan }: { plan: ImportPlan }) {
  return (
    <details className="rounded-control bg-sunken px-3 py-2">
      <summary className="cursor-pointer text-small font-medium">
        Fixed automatically ({plan.autoFixed.length})
      </summary>
      <ul className="mt-2 flex flex-col gap-2">
        {plan.autoFixed.map((item) => (
          <li key={item.sourceRowHash} className="text-micro text-ink-muted">
            <span className="text-ink">
              Line {item.line}: {item.description || item.transactionType}
            </span>
            <br />
            {item.evidence}
          </li>
        ))}
      </ul>
    </details>
  )
}

function DecisionList({
  plan,
  decisions,
  onDecide,
}: {
  plan: ImportPlan
  decisions: Record<string, ImportDecision>
  onDecide: (sourceRowHash: string, decision: ImportDecision) => void
}) {
  const rows: Array<
    ImportRowReference & { evidence: string; proposal: boolean; candidates?: string[] }
  > = [
    ...plan.proposals.map((row) => ({ ...row, proposal: true })),
    ...plan.needsYou.map((row) => ({ ...row, proposal: false })),
  ]
  const unresolved = resolveImportPlan(plan, decisions).unresolved.length

  return (
    <section className="flex flex-col gap-2" aria-label="Import decisions">
      <h3 className="text-small font-semibold">
        {unresolved > 0 ? `Needs you (${unresolved})` : 'Decisions complete'}
      </h3>
      {rows.map((row) => {
        if (row.sourceRowHash === '') {
          return (
            <div key="account" className="rounded-control border border-warning/40 p-3 text-small">
              <p className="font-medium">Enter the account label above.</p>
              <p className="mt-1 text-micro text-ink-muted">{row.evidence}</p>
            </div>
          )
        }
        const decision = decisions[row.sourceRowHash]
        return (
          <article key={row.sourceRowHash} className="rounded-control border border-rule p-3">
            <p className="text-small font-medium">
              Line {row.line}: {row.description || row.transactionType || 'M1 row'}
            </p>
            <p className="mt-1 text-micro text-ink-muted">{row.evidence}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {row.proposal && (
                <Button
                  variant={decision?.kind === 'accept' ? 'primary' : 'secondary'}
                  onClick={() => onDecide(row.sourceRowHash, { kind: 'accept' })}
                >
                  Accept
                </Button>
              )}
              {row.candidates?.map((ticker) => (
                <Button
                  key={ticker}
                  variant={
                    decision?.kind === 'choose' && decision.ticker === ticker
                      ? 'primary'
                      : 'secondary'
                  }
                  disabled={
                    !plan.needsYou
                      .find((need) => need.sourceRowHash === row.sourceRowHash)
                      ?.candidateTransactions?.some((transaction) => transaction.ticker === ticker)
                  }
                  onClick={() => onDecide(row.sourceRowHash, { kind: 'choose', ticker })}
                >
                  Choose {ticker}
                </Button>
              ))}
              <Button
                variant={decision?.kind === 'ignore' ? 'primary' : 'ghost'}
                onClick={() => onDecide(row.sourceRowHash, { kind: 'ignore' })}
              >
                Ignore
              </Button>
            </div>
            {decision && (
              <p className="mt-2 text-micro text-ink-muted">
                Decision: {decision.kind === 'choose' ? `use ${decision.ticker}` : decision.kind}
              </p>
            )}
          </article>
        )
      })}
    </section>
  )
}

function HealthSummary({ onReconcile }: { onReconcile: () => void }) {
  const { transactions, prices, aliases, update } = usePortfolioData()
  const health = useMemo(() => {
    const holdings = computeHoldings({ transactions, prices, aliases })
    return {
      unpriced: holdings.missingPrices,
      delisted: delistedCandidates({
        ...holdings,
        benchmarkCloseDate: prices[DEFAULT_BENCHMARK]?.asOf ?? null,
      }),
      splits: crossCheckSplits(transactions, prices, aliases),
    }
  }, [transactions, prices, aliases])
  const clean =
    health.unpriced.length === 0 &&
    health.delisted.length === 0 &&
    health.splits.length === 0 &&
    update.failures.length === 0

  return (
    <Card as="section" className="flex flex-col gap-3">
      <div>
        <h3 className="text-h3 font-semibold">Import health</h3>
        <p className="mt-1 text-small text-ink-secondary">
          Market data was updated before these checks ran.
        </p>
      </div>
      {clean ? (
        <StatusBadge status="good">
          Everything checks out: open holdings are priced, no delisting candidates were found, and
          split rows agree.
        </StatusBadge>
      ) : (
        <ul className="flex flex-col gap-3 text-small text-ink-secondary">
          {health.unpriced.length > 0 && (
            <li>
              <StatusBadge status="warning">
                Unpriced holdings: {health.unpriced.join(', ')}.
              </StatusBadge>{' '}
              <Link className="text-accent underline underline-offset-4" to="/settings">
                Add a manual price or ticker alias
              </Link>
              .
            </li>
          )}
          {health.delisted.length > 0 && (
            <li>
              <StatusBadge status="warning">
                Delisted candidates: {health.delisted.map((row) => row.ticker).join(', ')}.
              </StatusBadge>{' '}
              {health.delisted.map((row, index) => (
                <span key={row.ticker}>
                  {index > 0 && ' · '}
                  <Link
                    className="text-accent underline underline-offset-4"
                    to={`/stocks/${encodeURIComponent(row.ticker)}`}
                  >
                    Review {row.ticker}&rsquo;s close-out
                  </Link>
                </span>
              ))}
            </li>
          )}
          {health.splits.length > 0 && (
            <li>
              <StatusBadge status="warning">
                {health.splits.length} split{' '}
                {health.splits.length === 1 ? 'row disagrees' : 'rows disagree'} with stored market
                data.
              </StatusBadge>{' '}
              <button
                type="button"
                className="text-accent underline underline-offset-4"
                onClick={onReconcile}
              >
                Reconcile with M1
              </button>
              .
            </li>
          )}
          {update.failures.length > 0 && (
            <li>
              <StatusBadge status="serious">
                Price update failed for{' '}
                {update.failures.map((failure) => failure.ticker).join(', ')}.
              </StatusBadge>{' '}
              <Link className="text-accent underline underline-offset-4" to="/settings">
                Fix market data
              </Link>
              .
            </li>
          )}
        </ul>
      )}
      <Button variant="primary" onClick={onReconcile}>
        Reconcile with M1
      </Button>
    </Card>
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

        {Object.keys(prices).length === 0 && (
          <StatusBadge status="warning">
            No prices stored yet - fetch prices first, or every split is compared in pre-split
            terms.
          </StatusBadge>
        )}

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
