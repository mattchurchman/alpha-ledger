import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError, NotAuthenticatedError } from '../api/client'
import type { TickerAlias } from '../api/types'
import { parseManualPriceCsv, withManualPrice } from '../data/marketData'
import { usePortfolioData } from '../data/usePortfolioData'
import {
  BottomSheet,
  Button,
  Card,
  DataTable,
  EmptyState,
  PricesAsOfBadge,
  SectionHeading,
  TextField,
  useToast,
  type Column,
} from '../ui'
import { HowCalculatedContent } from './HowCalculated'

const BLANK: TickerAlias = { from_ticker: '', to_ticker: '', effective_date: '' }

export default function Settings() {
  const navigate = useNavigate()
  const toast = useToast()
  const [aliases, setAliases] = useState<TickerAlias[] | null>(null)
  const [draft, setDraft] = useState<TickerAlias>(BLANK)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [howSheetOpen, setHowSheetOpen] = useState(false)

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

      <MarketDataCard />

      <Card>
        <h2 className="mb-1 text-h3 font-semibold">How this is calculated</h2>
        <p className="mb-3 text-small text-ink-secondary">
          What the VOO comparison means, and what it leaves out.
        </p>
        <Button onClick={() => setHowSheetOpen(true)}>Read how this is calculated</Button>
        <p className="mt-3 text-small text-ink-muted">Export/restore lands in a later task.</p>
      </Card>

      <Card>
        <h2 className="mb-1 text-h3 font-semibold">How to use this app</h2>
        <p className="mb-3 text-small text-ink-secondary">
          The full guide: what every screen is for, the order to use them in, and what each number
          means.
        </p>
        <Button onClick={() => navigate('/help')}>Open the guide</Button>
      </Card>

      <BottomSheet
        open={howSheetOpen}
        onClose={() => setHowSheetOpen(false)}
        title="How this is calculated"
      >
        <HowCalculatedContent />
      </BottomSheet>
    </div>
  )
}

function MarketDataCard() {
  const toast = useToast()
  const { priceHistory, pricesAsOf, update, runUpdate, putPriceHistory } = usePortfolioData()
  const [csvTicker, setCsvTicker] = useState('')
  const [csvBusy, setCsvBusy] = useState(false)
  const [spotTicker, setSpotTicker] = useState('')
  const [spotPrice, setSpotPrice] = useState('')
  const [spotBusy, setSpotBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const report = useCallback(
    (err: unknown) => {
      if (err instanceof NotAuthenticatedError) toast.show(err.message, { status: 'critical' })
      else if (err instanceof ApiError)
        toast.show(`${err.status}: ${err.message}`, { status: 'critical' })
      else toast.show(err instanceof Error ? err.message : String(err), { status: 'critical' })
    },
    [toast],
  )

  async function handleUpdate() {
    try {
      const outcome = await runUpdate()
      toast.show(
        outcome.failed.length === 0
          ? 'Prices updated.'
          : `Updated with ${outcome.failed.length} failure(s).`,
        { status: outcome.failed.length === 0 ? 'good' : 'warning' },
      )
    } catch (err) {
      report(err)
    }
  }

  async function handleCsvFile(file: File) {
    const ticker = csvTicker.trim().toUpperCase()
    if (ticker === '') {
      toast.show('Enter a ticker before choosing a file.', { status: 'critical' })
      return
    }
    setCsvBusy(true)
    try {
      const history = parseManualPriceCsv(await file.text())
      await putPriceHistory(ticker, history)
      toast.show(`${ticker}: stored ${history.dates.length} day(s) from the CSV.`, {
        status: 'good',
      })
      setCsvTicker('')
    } catch (err) {
      report(err)
    } finally {
      setCsvBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSetSpotPrice() {
    const ticker = spotTicker.trim().toUpperCase()
    const price = spotPrice.trim()
    if (ticker === '' || price === '' || Number.isNaN(Number(price))) {
      toast.show('Enter a ticker and a numeric price.', { status: 'critical' })
      return
    }
    setSpotBusy(true)
    try {
      const existing = priceHistory.find((p) => p.ticker === ticker)?.history ?? null
      const today = new Date().toISOString().slice(0, 10)
      const history = withManualPrice(existing, today, price)
      await putPriceHistory(ticker, history)
      toast.show(`${ticker}: set today's price to ${price}.`, { status: 'good' })
      setSpotTicker('')
      setSpotPrice('')
    } catch (err) {
      report(err)
    } finally {
      setSpotBusy(false)
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="mb-1 text-h3 font-semibold">Market data</h2>
        <PricesAsOfBadge value={pricesAsOf} />
      </div>

      <div>
        <Button variant="primary" disabled={update.running} onClick={() => void handleUpdate()}>
          {update.running ? `Updating… ${update.done} of ${update.total}` : 'Update market data'}
        </Button>
        {!update.running && update.failures.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1">
            {update.failures.map((f) => (
              <li key={f.ticker} className="text-small text-critical">
                {f.ticker}: {f.error}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-rule pt-4">
        <h3 className="mb-1 text-small font-semibold">Manual fallback</h3>
        <p className="mb-3 text-small text-ink-secondary">
          If Yahoo is unreachable, upload a price CSV for one ticker or set its current price by
          hand. Either is marked manual and merges into whatever history is already stored.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextField
            label="Ticker"
            value={csvTicker}
            onChange={(e) => setCsvTicker(e.target.value.toUpperCase())}
            placeholder="ACME"
            className="sm:w-32"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleCsvFile(file)
            }}
          />
          <Button disabled={csvBusy} onClick={() => fileInputRef.current?.click()}>
            {csvBusy ? 'Uploading…' : 'Upload price CSV…'}
          </Button>
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextField
            label="Ticker"
            value={spotTicker}
            onChange={(e) => setSpotTicker(e.target.value.toUpperCase())}
            placeholder="ACME"
            className="sm:w-32"
          />
          <TextField
            label="Current price"
            inputMode="decimal"
            value={spotPrice}
            onChange={(e) => setSpotPrice(e.target.value)}
            placeholder="150.00"
            className="sm:w-32"
          />
          <Button disabled={spotBusy} onClick={() => void handleSetSpotPrice()}>
            {spotBusy ? 'Saving…' : 'Set current price'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
