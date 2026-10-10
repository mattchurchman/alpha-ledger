import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError, NotAuthenticatedError } from '../api/client'
import type { FairValueRow } from '../api/types'
import { usePortfolioData } from '../data/usePortfolioData'
import { discountFrom, latestFairValues, splitAdjustedValue } from '../engine/fairValue'
import type { TickerAnalysis } from '../engine'
import {
  Button,
  Card,
  DataTable,
  BottomSheet,
  EmptyState,
  money,
  percent,
  SectionHeading,
  TextField,
  toNumber,
  useToast,
  zoneFor,
  type Column,
} from '../ui'

/**
 * SPEC section 9's third screen: every open holding in one list, fast entry on a phone. Reads
 * `usePortfolioData().result` for the tickers and prices and keeps its own fair-value rows
 * (same pattern Settings uses for aliases) - saving always adds a new row (append-only, SPEC
 * section 7), never edits one in place. The split-adjusted current estimate and the discount it
 * implies both come from `src/engine/fairValue.ts`; nothing here recomputes them.
 *
 * "Holdings" here means open positions, matching the Dashboard's own holdings table and rebuy
 * ranking - a closed ticker has no rebuy decision left to inform. Its full estimate history
 * (including delete) lives on the stock detail screen, reachable either way.
 */

function isClosed(ticker: TickerAnalysis): boolean {
  return (toNumber(ticker.shares) ?? 0) === 0
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

interface Draft {
  value_usd: string
  effective_date: string
  note: string
}

function blankDraft(): Draft {
  return { value_usd: '', effective_date: todayDate(), note: '' }
}

export default function FairValues() {
  const navigate = useNavigate()
  const toast = useToast()
  const { loading, error, result, prices } = usePortfolioData()
  const [fairValueRows, setFairValueRows] = useState<FairValueRow[] | null>(null)
  const [target, setTarget] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(blankDraft())
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const report = useCallback(
    (err: unknown) => {
      if (err instanceof NotAuthenticatedError) toast.show(err.message, { status: 'critical' })
      else if (err instanceof ApiError)
        toast.show(`${err.status}: ${err.message}`, { status: 'critical' })
      else toast.show(err instanceof Error ? err.message : String(err), { status: 'critical' })
    },
    [toast],
  )

  const reload = useCallback(async () => {
    try {
      setFairValueRows(await api.fairValues.list())
    } catch (err) {
      report(err)
    }
  }, [report])

  useEffect(() => {
    let cancelled = false
    api.fairValues.list().then(
      (rows) => {
        if (!cancelled) setFairValueRows(rows)
      },
      (err: unknown) => {
        if (!cancelled) report(err)
      },
    )
    return () => {
      cancelled = true
    }
  }, [report])

  const latestFairValue = useMemo(() => latestFairValues(fairValueRows ?? []), [fairValueRows])

  const currentFairValue = useMemo(() => {
    const current = new Map<string, string>()
    for (const [ticker, fv] of latestFairValue) {
      current.set(ticker, splitAdjustedValue(fv, prices[ticker]?.splits ?? []))
    }
    return current
  }, [latestFairValue, prices])

  const heldTickers = useMemo(
    () => (result ? result.byTicker.filter((t) => !isClosed(t)) : []),
    [result],
  )

  function openFor(ticker: string) {
    setTarget(ticker)
    setDraft(blankDraft())
    setFormError(null)
  }

  async function save() {
    if (!target) return
    if (draft.value_usd.trim() === '') return setFormError('A value is required.')
    if (draft.effective_date.trim() === '') return setFormError('A date is required.')
    if (Number.isNaN(Number(draft.value_usd))) return setFormError('Value must be a number.')

    setBusy(true)
    try {
      await api.fairValues.create({
        ticker: target,
        value_usd: draft.value_usd.trim(),
        effective_date: draft.effective_date,
        note: draft.note.trim() === '' ? null : draft.note.trim(),
      })
      setFormError(null)
      setTarget(null)
      toast.show(`Fair value set for ${target}.`, { status: 'good' })
      await reload()
    } catch (err) {
      if (err instanceof ApiError) setFormError(err.message)
      else report(err)
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<TickerAnalysis>[] = useMemo(
    () => [
      {
        key: 'ticker',
        header: 'Ticker',
        primary: true,
        sort: (row) => row.ticker,
        render: (row) => <span className="font-mono font-medium">{row.ticker}</span>,
      },
      {
        key: 'price',
        header: 'Price',
        align: 'right',
        sort: (row) => (row.latestClose === null ? null : Number(row.latestClose)),
        render: (row) => money(row.latestClose),
      },
      {
        key: 'fairValue',
        header: 'Fair value',
        align: 'right',
        sort: (row) => {
          const fv = currentFairValue.get(row.ticker)
          return fv === undefined ? null : Number(fv)
        },
        render: (row) => {
          const fv = currentFairValue.get(row.ticker)
          return fv === undefined ? <span className="text-ink-muted">No estimate</span> : money(fv)
        },
      },
      {
        key: 'discount',
        header: 'Discount',
        align: 'right',
        sort: (row) => {
          const fv = currentFairValue.get(row.ticker)
          if (fv === undefined || row.latestClose === null) return null
          const d = discountFrom(row.latestClose, fv)
          return d === null ? null : Number(d)
        },
        render: (row) => {
          const fv = currentFairValue.get(row.ticker)
          if (fv === undefined || row.latestClose === null)
            return <span className="text-ink-muted">—</span>
          const d = discountFrom(row.latestClose, fv)
          if (d === null) return <span className="text-ink-muted">—</span>
          return (
            <span className={zoneFor(d)?.tone === 'ahead' ? 'text-ahead' : 'text-behind'}>
              {percent(d, { sign: false })} · {zoneFor(d)?.label}
            </span>
          )
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row) => (
          <Button variant="secondary" onClick={() => openFor(row.ticker)}>
            Set value
          </Button>
        ),
      },
    ],
    [currentFairValue],
  )

  if (loading) {
    return <p className="text-small text-ink-muted">Loading…</p>
  }

  if (error) {
    return <EmptyState title="Could not load your data" body={error} />
  }

  if (!result) {
    return (
      <EmptyState
        title="No comparison yet"
        body="Import your M1 activity and update market data first - fair value needs a current price to compare against."
        action={
          <Button variant="primary" onClick={() => navigate('/import')}>
            Go to Import
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading>Fair values</SectionHeading>

      <Card>
        <DataTable
          rows={heldTickers}
          columns={columns}
          rowKey={(row) => row.ticker}
          caption="Your holdings and your fair-value estimates"
          initialSort={{ key: 'ticker', direction: 'asc' }}
          empty={
            <EmptyState
              title="No holdings yet"
              body="Once you have an open position, it shows up here."
            />
          }
        />
      </Card>

      <BottomSheet
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target ? `Set ${target}'s fair value` : 'Set fair value'}
      >
        <div className="flex flex-col gap-3">
          <TextField
            label="Fair value (USD)"
            inputMode="decimal"
            value={draft.value_usd}
            onChange={(e) => setDraft((d) => ({ ...d, value_usd: e.target.value }))}
            placeholder="0.00"
          />
          <TextField
            label="Date"
            type="date"
            value={draft.effective_date}
            onChange={(e) => setDraft((d) => ({ ...d, effective_date: e.target.value }))}
          />
          <TextField
            label="Note"
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            placeholder="Optional - why this number"
          />

          {formError && <p className="text-small text-critical">{formError}</p>}

          <p className="text-small text-ink-muted">
            This always adds a new entry. Past estimates are kept, never overwritten - see this
            ticker's detail screen for the full history.
          </p>

          <div className="mt-1 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
