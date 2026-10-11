import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError, NotAuthenticatedError } from '../api/client'
import type { FairValueRow } from '../api/types'
import { priceFetchFrom } from '../data/marketData'
import { usePortfolioData } from '../data/usePortfolioData'
import { mergeHeldAndWatched, type MergedTicker } from '../data/watchlist'
import { discountFrom, latestFairValues, splitAdjustedValue } from '../engine/fairValue'
import { isClosedPosition } from '../engine'
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  FairValueSheet,
  money,
  percent,
  SectionHeading,
  TextField,
  useToast,
  zoneFor,
  type Column,
  type FairValueSheetInput,
} from '../ui'

/**
 * SPEC section 9's third screen: every open holding plus every watched ticker in one list, fast
 * entry on a phone. Reads `usePortfolioData().result` for the held tickers and prices and keeps
 * its own fair-value rows (same pattern Settings uses for aliases) - saving always adds a new
 * row (append-only, SPEC section 7), never edits one in place. The split-adjusted current
 * estimate and the discount it implies both come from `src/engine/fairValue.ts`; nothing here
 * recomputes them.
 *
 * "Holdings" here means open positions the user has not hidden, matching the Dashboard's own
 * holdings table and rebuy ranking - a closed ticker has no rebuy decision left to inform, and a
 * hidden one has been asked to go away (task 18). Watched tickers (task 20) join that list
 * through `mergeHeldAndWatched`, the one helper Rebuy opportunities also reads, so the two lists
 * can never drift apart. Either one's full estimate history (including delete) lives on the
 * stock detail screen, reachable either way.
 */

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function FairValues() {
  const navigate = useNavigate()
  const toast = useToast()
  const {
    loading,
    error,
    result,
    prices,
    hiddenTickers,
    transactions,
    watchlist,
    setTickerWatched,
  } = usePortfolioData()
  const [fairValueRows, setFairValueRows] = useState<FairValueRow[] | null>(null)
  const [target, setTarget] = useState<string | null>(null)
  const [watchDraft, setWatchDraft] = useState('')
  const [watchBusy, setWatchBusy] = useState(false)
  const [unwatching, setUnwatching] = useState<string | null>(null)

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
    () =>
      result
        ? result.byTicker.filter((t) => !isClosedPosition(t) && !hiddenTickers.includes(t.ticker))
        : [],
    [result, hiddenTickers],
  )

  const rows = useMemo(
    () => mergeHeldAndWatched(heldTickers, watchlist, hiddenTickers, prices),
    [heldTickers, watchlist, hiddenTickers, prices],
  )

  const hiddenOpenCount = useMemo(
    () =>
      (result?.byTicker ?? []).filter(
        (t) => !isClosedPosition(t) && hiddenTickers.includes(t.ticker),
      ).length,
    [result, hiddenTickers],
  )

  /** Every row with no current estimate, in table order - what "Save and next" walks. */
  const noEstimateQueue = useMemo(
    () => rows.filter((row) => !currentFairValue.has(row.ticker)).map((row) => row.ticker),
    [rows, currentFairValue],
  )

  async function addWatch() {
    const ticker = watchDraft.trim().toUpperCase()
    if (ticker === '') return
    setWatchBusy(true)
    try {
      const from = priceFetchFrom(transactions, todayDate())
      const history = await api.prices.fetch(ticker, from)
      await api.priceHistory.put(ticker, { source: 'yahoo', history })
      await setTickerWatched(ticker, true)
      toast.show(`${ticker}: added to your watchlist.`, { status: 'good' })
      setWatchDraft('')
    } catch (err) {
      report(err)
    } finally {
      setWatchBusy(false)
    }
  }

  const removeWatch = useCallback(
    async (ticker: string) => {
      setUnwatching(ticker)
      try {
        await setTickerWatched(ticker, false)
        toast.show(`${ticker}: removed from your watchlist.`, { status: 'good' })
      } catch (err) {
        report(err)
      } finally {
        setUnwatching(null)
      }
    },
    [setTickerWatched, toast, report],
  )

  async function saveFairValue(ticker: string, input: FairValueSheetInput) {
    await api.fairValues.create({ ticker, ...input })
    toast.show(`Fair value set for ${ticker}.`, { status: 'good' })
    await reload()
  }

  const columns: Column<MergedTicker>[] = useMemo(
    () => [
      {
        key: 'ticker',
        header: 'Ticker',
        primary: true,
        sort: (row) => row.ticker,
        render: (row) => (
          <span className="font-mono font-medium">
            {row.ticker}
            {row.watching && (
              <span className="ml-2 text-small font-normal text-ink-muted">Watching</span>
            )}
          </span>
        ),
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
          rows={rows}
          columns={columns}
          rowKey={(row) => row.ticker}
          caption="Your holdings and your fair-value estimates"
          initialSort={{ key: 'ticker', direction: 'asc' }}
          onRowSelect={(row) => setTarget(row.ticker)}
          rowAction={(row) =>
            row.watching ? (
              <Button
                variant="ghost"
                disabled={unwatching === row.ticker}
                onClick={() => void removeWatch(row.ticker)}
              >
                {unwatching === row.ticker ? 'Removing…' : 'Remove'}
              </Button>
            ) : null
          }
          empty={
            <EmptyState
              title="No holdings or watched tickers yet"
              body="Once you have an open position, or watch a ticker below, it shows up here."
            />
          }
        />
        <p className="mt-3 text-small text-ink-muted">Tap a row to set its fair value.</p>
        {hiddenOpenCount > 0 && (
          <p className="mt-3 text-small text-ink-muted">
            {hiddenOpenCount} hidden holding{hiddenOpenCount === 1 ? '' : 's'} left out. Hiding
            changes no number anywhere - unhide in Settings.
          </p>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <div>
          <h2 className="mb-1 text-h3 font-semibold">Watch a ticker</h2>
          <p className="max-w-prose text-small text-ink-secondary">
            Track a company you do not own yet. It gets priced by Update market data and ranked
            above, right alongside your holdings, but never counts toward any total.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextField
            label="Ticker"
            value={watchDraft}
            onChange={(e) => setWatchDraft(e.target.value.toUpperCase())}
            placeholder="ACME"
            className="sm:w-32"
          />
          <Button disabled={watchBusy} onClick={() => void addWatch()}>
            {watchBusy ? 'Checking…' : 'Watch'}
          </Button>
        </div>
      </Card>

      <FairValueSheet
        ticker={target}
        priceFor={(ticker) => rows.find((row) => row.ticker === ticker)?.latestClose ?? null}
        queue={noEstimateQueue}
        onClose={() => setTarget(null)}
        onSave={saveFairValue}
      />
    </div>
  )
}
