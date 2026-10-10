import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, NotAuthenticatedError } from '../api/client'
import type { TickerAlias } from '../api/types'
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  SectionHeading,
  TextField,
  useToast,
  type Column,
} from '../ui'

const BLANK: TickerAlias = { from_ticker: '', to_ticker: '', effective_date: '' }

export default function Settings() {
  const toast = useToast()
  const [aliases, setAliases] = useState<TickerAlias[] | null>(null)
  const [draft, setDraft] = useState<TickerAlias>(BLANK)
  const [formError, setFormError] = useState<string | null>(null)
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
      setAliases(await api.aliases.list())
    } catch (err) {
      report(err)
    }
  }, [report])

  useEffect(() => {
    let cancelled = false
    api.aliases.list().then(
      (fetched) => {
        if (!cancelled) setAliases(fetched)
      },
      (err: unknown) => {
        if (!cancelled) report(err)
      },
    )
    return () => {
      cancelled = true
    }
  }, [report])

  async function addAlias() {
    if (
      draft.from_ticker.trim() === '' ||
      draft.to_ticker.trim() === '' ||
      draft.effective_date === ''
    ) {
      setFormError('All three fields are required.')
      return
    }
    setBusy(true)
    try {
      await api.aliases.create({
        from_ticker: draft.from_ticker.trim().toUpperCase(),
        to_ticker: draft.to_ticker.trim().toUpperCase(),
        effective_date: draft.effective_date,
      })
      setDraft(BLANK)
      setFormError(null)
      toast.show('Alias saved.', { status: 'good' })
      await reload()
    } catch (err) {
      if (err instanceof ApiError) setFormError(err.message)
      else report(err)
    } finally {
      setBusy(false)
    }
  }

  async function removeAlias(alias: TickerAlias) {
    try {
      await api.aliases.remove(alias.from_ticker, alias.effective_date)
      toast.show('Alias removed.', { status: 'good' })
      await reload()
    } catch (err) {
      report(err)
    }
  }

  const columns: Column<TickerAlias>[] = [
    {
      key: 'from',
      header: 'From ticker',
      primary: true,
      sort: (a) => a.from_ticker,
      render: (a) => a.from_ticker,
    },
    { key: 'to', header: 'To ticker', sort: (a) => a.to_ticker, render: (a) => a.to_ticker },
    {
      key: 'date',
      header: 'Effective',
      sort: (a) => a.effective_date,
      render: (a) => a.effective_date,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (a) => (
        <Button variant="ghost" onClick={() => void removeAlias(a)}>
          Remove
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading>Settings</SectionHeading>

      <Card>
        <h2 className="mb-1 text-h3 font-semibold">Ticker aliases</h2>
        <p className="mb-3 text-small text-ink-secondary">
          Record a rename or merger: transactions dated on or before the effective date keep the old
          ticker; the holdings and shadow calculations resolve them under the new one.
        </p>

        {aliases === null ? (
          <p className="text-small text-ink-muted">Loading…</p>
        ) : (
          <DataTable
            rows={aliases}
            columns={columns}
            rowKey={(a) => `${a.from_ticker}-${a.effective_date}`}
            caption="Ticker aliases"
            initialSort={{ key: 'date', direction: 'desc' }}
            empty={
              <EmptyState title="No aliases yet" body="Add one below when a ticker changes." />
            }
          />
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-rule pt-4 sm:grid-cols-3">
          <TextField
            label="From ticker"
            value={draft.from_ticker}
            onChange={(e) => setDraft((d) => ({ ...d, from_ticker: e.target.value.toUpperCase() }))}
            placeholder="OLD"
          />
          <TextField
            label="To ticker"
            value={draft.to_ticker}
            onChange={(e) => setDraft((d) => ({ ...d, to_ticker: e.target.value.toUpperCase() }))}
            placeholder="NEW"
          />
          <TextField
            label="Effective date"
            type="date"
            value={draft.effective_date}
            onChange={(e) => setDraft((d) => ({ ...d, effective_date: e.target.value }))}
          />
        </div>
        {formError && <p className="mt-2 text-small text-critical">{formError}</p>}
        <Button variant="primary" className="mt-3" disabled={busy} onClick={() => void addAlias()}>
          {busy ? 'Saving…' : 'Add alias'}
        </Button>
      </Card>

      <Card>
        <p className="text-small text-ink-muted">
          Market data, manual prices, export/restore, and "how this is calculated" land in later
          tasks.
        </p>
      </Card>
    </div>
  )
}
