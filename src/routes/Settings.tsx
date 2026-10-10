import { useCallback, useEffect, useRef, useState } from 'react'
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

const BLANK: TickerAlias = { from_ticker: '', to_ticker: '', effective_date: '' }

export default function Settings() {
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

      <BottomSheet
        open={howSheetOpen}
        onClose={() => setHowSheetOpen(false)}
        title="How this is calculated"
      >
        <div className="flex flex-col gap-4 text-small text-ink-secondary">
          <section>
            <h3 className="mb-1 text-small font-semibold text-ink">The VOO comparison</h3>
            <p>
              Every ticker gets its own shadow bucket of VOO. Whenever you buy, sell, or get paid a
              dividend in a stock, the same dollars are imagined going into or out of VOO on the
              same day. Because both sides see the same cash flows, the gap between them - what your
              shares are worth today versus what that VOO bucket is worth today - is the result of
              your stock picking, nothing else. VOO's bucket uses its adjusted close, which already
              includes VOO's own reinvested dividends.
            </p>
          </section>
          <section>
            <h3 className="mb-1 text-small font-semibold text-ink">A bucket can go negative</h3>
            <p>
              If a stock has paid you back more cash than the same money would be worth in VOO, its
              shadow bucket shows as negative. That is shown as-is, not floored at zero - it means
              the position has already returned more than a VOO equivalent would be worth.
            </p>
          </section>
          <section>
            <h3 className="mb-1 text-small font-semibold text-ink">The numbers on each screen</h3>
            <p>
              Invested and returned are the sum of your buys and of your sells plus dividends. Total
              return splits into realized gain (from shares you have sold), unrealized gain (from
              shares you still hold), and dividends. Value added is current value minus the VOO
              bucket, and it stays meaningful for a closed position, where current value is zero.
              IRR is a money-weighted, annualized return solved from your actual cash flows - when
              there is no sign change among them, or the VOO bucket is not positive, it shows a dash
              rather than a guess.
            </p>
          </section>
          <section>
            <h3 className="mb-1 text-small font-semibold text-ink">What is ignored</h3>
            <p>
              Taxes, brokerage fees, and cash sitting idle between trades are ignored on both sides
              of every comparison. This app answers one question - did the picks beat VOO - not what
              you would have kept after taxes or fees.
            </p>
          </section>
          {/*
           * Task 15's deliverable. Every item here is a limitation of the shipped code, not a
           * caveat in general - each one was checked against the module that causes it. Add to
           * this list when a task knowingly leaves a gap the numbers depend on; take an item
           * out when the gap closes.
           */}
          <section>
            <h3 className="mb-1 text-small font-semibold text-ink">Known limitations</h3>
            <ul className="flex list-disc flex-col gap-2 pl-4">
              <li>
                <strong className="font-medium text-ink">
                  The math has not been checked against a real export yet.
                </strong>{' '}
                It is covered by tests on made-up portfolios, which proves it is self-consistent,
                not that it matches what your broker says you hold. Reconcile on the Import screen
                is the check that settles that, and it has not been run on real history.
              </li>
              <li>
                <strong className="font-medium text-ink">
                  Shares moved in or out of the account are not imported.
                </strong>{' '}
                A cash deposit or withdrawal is correctly ignored, but a transfer of shares in kind
                is reported as an unrecognized row on import and needs an adjustment entered by
                hand. Until it is, that ticker&rsquo;s share count - and so its value - is wrong.
              </li>
              <li>
                <strong className="font-medium text-ink">
                  A holding with no stored price counts as zero.
                </strong>{' '}
                It is listed on the dashboard under the headline rather than hidden, so you can see
                which totals are short, but the totals themselves are still short until that price
                is fetched or entered.
              </li>
              <li>
                <strong className="font-medium text-ink">
                  Prices move only when you tap Update market data.
                </strong>{' '}
                Everything is valued at the last close that was stored, which is also what the date
                at the top of every screen means. Nothing refreshes on its own.
              </li>
              <li>
                <strong className="font-medium text-ink">
                  A price history you upload by hand carries no split events.
                </strong>{' '}
                Splits come from the market-data fetch, so a hand-uploaded CSV leaves that
                ticker&rsquo;s share counts unadjusted for any split until the next real update
                replaces the series.
              </li>
              <li>
                <strong className="font-medium text-ink">
                  Cost basis is average cost, not tax lots.
                </strong>{' '}
                Realized and unrealized gain use one average cost per ticker across all accounts.
                That is for reading on a screen, not for a tax return.
              </li>
              <li>
                <strong className="font-medium text-ink">
                  On a stock that paid dividends, the per-purchase figures do not add up to the
                  ticker&rsquo;s total.
                </strong>{' '}
                Dividends are not attributed to individual purchases. The ticker-level value added
                is the honest number; the purchase list answers the narrower question of whether
                that particular buy was a good idea.
              </li>
            </ul>
          </section>
        </div>
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
