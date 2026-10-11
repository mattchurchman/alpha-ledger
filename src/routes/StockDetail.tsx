import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, ApiError, NotAuthenticatedError } from '../api/client'
import type { FairValueRow } from '../api/types'
import {
  isClosedPosition,
  sharesByAccount,
  tickerDecisions,
  tickerSeries,
  type BuyDecision,
} from '../engine'
import { splitAdjustedHistory } from '../engine/fairValue'
import { usePortfolioData } from '../data/usePortfolioData'
import { ClosePositionSheet } from './ClosePosition'
import {
  AccountStrip,
  BackIcon,
  Button,
  Card,
  ChartSkeleton,
  DataTable,
  dateShort,
  EmptyState,
  HistoryChart,
  money,
  moneyCompact,
  percent,
  rangeStart,
  RangeSelector,
  SectionHeading,
  shares as formatShares,
  SignedDelta,
  StatTile,
  StepLineChart,
  toNumber,
  useToast,
  type ChartRange,
  type AccountStripRow,
  type Column,
  type HistoryChartMarker,
} from '../ui'

/**
 * SPEC section 9's second screen: for one ticker, did owning it beat VOO, and which buys
 * were good. Every measure is read off `usePortfolioData().resultFor` (task 09's `analyze`
 * cache) and the two on-demand helpers `docs/ENGINE_API.md` describes - `tickerSeries` and
 * `tickerDecisions` - rather than recomputed here (CLAUDE.md).
 *
 * Reached from every ticker mention that behaves like a destination: the dashboard's
 * holdings table and value-creators chart (closed positions only show up there), and
 * Activity's ticker column. Works for a closed position because `valueAdded` and the
 * decision list are both defined when `shares` and `currentValue` are zero (SPEC section 6).
 *
 * Task 19: `?account=` narrows every number on the screen to one account, the same parameter
 * the Dashboard uses and passes along in its links, so arriving from a filtered dashboard
 * keeps the view. The share split below the headline is always the whole position, whichever
 * view is selected - it is the one thing on the screen that is about where the shares live
 * rather than about one account's numbers.
 */
export default function StockDetail() {
  const navigate = useNavigate()
  const toast = useToast()
  const params = useParams<{ ticker: string }>()
  const ticker = (params.ticker ?? '').toUpperCase()
  const {
    loading,
    error,
    prices,
    hiddenTickers,
    setTickerHidden,
    watchlist,
    transactions,
    aliases,
    accounts,
    resultFor,
  } = usePortfolioData()
  const [searchParams, setSearchParams] = useSearchParams()

  /** An unknown label falls back to the summed view, exactly as on the Dashboard. */
  const requestedAccount = searchParams.get('account')
  const account =
    requestedAccount !== null && accounts.includes(requestedAccount) ? requestedAccount : null

  const selectAccount = useCallback(
    (next: string | null) => {
      setSearchParams((prev) => {
        const next_ = new URLSearchParams(prev)
        if (next === null) next_.delete('account')
        else next_.set('account', next)
        return next_
      })
    },
    [setSearchParams],
  )

  /** The analysis this screen reads: all accounts, or the one `?account=` names. */
  const view = resultFor(account)

  const [fairValueRows, setFairValueRows] = useState<FairValueRow[] | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [range, setRange] = useState<ChartRange>('1Y')
  const [closing, setClosing] = useState<string | null>(null)
  const [unhiding, setUnhiding] = useState(false)

  const report = useCallback(
    (err: unknown) => {
      if (err instanceof NotAuthenticatedError) toast.show(err.message, { status: 'critical' })
      else if (err instanceof ApiError)
        toast.show(`${err.status}: ${err.message}`, { status: 'critical' })
      else toast.show(err instanceof Error ? err.message : String(err), { status: 'critical' })
    },
    [toast],
  )

  const reloadFairValues = useCallback(async () => {
    try {
      setFairValueRows(await api.fairValues.list(ticker))
    } catch (err) {
      report(err)
    }
  }, [ticker, report])

  useEffect(() => {
    if (!ticker) return
    let cancelled = false
    api.fairValues.list(ticker).then(
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
  }, [ticker, report])

  async function deleteFairValue(id: number) {
    try {
      await api.fairValues.remove(id)
      setConfirmDeleteId(null)
      toast.show('Fair value deleted.', { status: 'good' })
      await reloadFairValues()
    } catch (err) {
      report(err)
    }
  }

  const fairValueHistory = useMemo(
    () => splitAdjustedHistory(fairValueRows ?? [], prices[ticker]?.splits ?? []),
    [fairValueRows, prices, ticker],
  )

  const fairValueColumns: Column<FairValueRow>[] = [
    {
      key: 'date',
      header: 'Date',
      primary: true,
      sort: (r) => r.effective_date,
      render: (r) => dateShort(r.effective_date),
    },
    {
      key: 'value',
      header: 'Fair value',
      align: 'right',
      sort: (r) => Number(r.value_usd),
      render: (r) => money(r.value_usd),
    },
    {
      key: 'note',
      header: 'Note',
      render: (r) => r.note ?? '—',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) =>
        confirmDeleteId === r.id ? (
          <div className="flex flex-wrap gap-1.5">
            <Button variant="primary" onClick={() => void deleteFairValue(r.id)}>
              Confirm delete
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmDeleteId(r.id)}>
            Delete
          </Button>
        ),
    },
  ]

  /**
   * Shared by the full view below and the watched-ticker view (task 20) - neither `analysis`
   * nor `series` says anything about a ticker's fair value, so this needs no `view` at all.
   */
  const fairValueSection = (
    <section>
      <SectionHeading>Fair value</SectionHeading>
      <StepLineChart
        dates={prices[ticker]?.dates ?? []}
        price={prices[ticker]?.close ?? []}
        estimates={fairValueHistory}
        title={`${ticker} price and your fair value`}
        subtitle="Older estimates are drawn at today's split level - the number you entered is never changed."
      />
      <Card className="mt-4">
        <DataTable
          rows={fairValueRows ?? []}
          columns={fairValueColumns}
          rowKey={(r) => String(r.id)}
          caption={`${ticker} fair-value history`}
          initialSort={{ key: 'date', direction: 'desc' }}
          empty={
            <EmptyState
              title="No estimates yet"
              body="Add one from the Fair values screen."
              action={
                <Button variant="secondary" onClick={() => navigate('/fair-values')}>
                  Go to Fair values
                </Button>
              }
            />
          }
        />
      </Card>
    </section>
  )

  const analysis = useMemo(
    () => view?.byTicker.find((t) => t.ticker === ticker) ?? null,
    [view, ticker],
  )

  /**
   * Where this position's shares actually live. Always the whole position, in every view: "how
   * much of this is in which account" is not a per-account number, and in a narrowed view it is
   * the only thing on the screen that still says what is elsewhere. Nothing is shown when the
   * ticker only ever traded in one account - there is no split to report.
   */
  const accountSplit = useMemo<AccountStripRow[]>(() => {
    if (!view) return []
    const rows = sharesByAccount({ transactions, prices, aliases, asOf: view.asOf, ticker })
    if (rows.length < 2) return []
    return rows.map((row) => ({
      account: row.account,
      figure: formatShares(row.shares),
      delta: (
        <span className="text-small tabular-nums text-ink-secondary">
          {moneyCompact(row.currentValue)}
        </span>
      ),
      selected: row.account === account,
    }))
  }, [view, transactions, prices, aliases, ticker, account])

  const series = useMemo(() => (view ? tickerSeries(view, ticker) : null), [view, ticker])

  /** `series`, windowed to the selected range - same helper and behaviour as the Dashboard chart. */
  const windowedSeries = useMemo(() => {
    if (!series) return null
    const start = rangeStart(series.dates, range)
    return {
      dates: series.dates.slice(start),
      value: series.value.slice(start),
      shadow: series.shadow.slice(start),
    }
  }, [series, range])

  const decisions = useMemo(() => (view ? tickerDecisions(view, ticker) : []), [view, ticker])

  const markers = useMemo<HistoryChartMarker[]>(() => {
    // A buy or sell from before the visible window would otherwise snap to the window's left
    // edge (HistoryChart's forward-snap), which reads as a trade that happened on day one of a
    // range it never touched.
    const windowStart = windowedSeries?.dates[0]
    const inWindow = (date: string) => windowStart === undefined || date >= windowStart
    const out: HistoryChartMarker[] = []
    for (const decision of decisions) {
      if (inWindow(decision.trade_date))
        out.push({ date: decision.trade_date, kind: 'buy', amount: decision.amount })
      for (const exit of decision.exits) {
        if (exit.kind === 'sell' && inWindow(exit.trade_date))
          out.push({ date: exit.trade_date, kind: 'sell', amount: exit.proceeds })
      }
    }
    return out
  }, [decisions, windowedSeries])

  const decisionColumns: Column<BuyDecision>[] = useMemo(
    () => [
      {
        key: 'date',
        header: 'Date',
        primary: true,
        sort: (d) => d.trade_date,
        render: (d) => dateShort(d.trade_date),
      },
      {
        key: 'amount',
        header: 'Dollars',
        align: 'right',
        sort: (d) => Number(d.amount),
        render: (d) => money(d.amount),
      },
      {
        key: 'outcome',
        header: 'Outcome',
        align: 'right',
        sort: (d) => Number(d.outcomeValue),
        render: (d) => money(d.outcomeValue),
      },
      {
        key: 'shadow',
        header: 'VOO outcome',
        align: 'right',
        sort: (d) => Number(d.shadowValue),
        render: (d) => money(d.shadowValue),
      },
      {
        key: 'diff',
        header: 'Difference',
        align: 'right',
        sort: (d) => Number(d.valueAdded),
        render: (d) => (
          <SignedDelta
            value={d.valueAdded}
            format="money"
            size="sm"
            describe={{ up: 'beat VOO by', down: 'trailed VOO by' }}
          />
        ),
      },
    ],
    [],
  )

  const back = (
    <Button variant="ghost" onClick={() => navigate(-1)} className="-ml-1.5 mb-1">
      <BackIcon className="size-4" />
      Back
    </Button>
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-7">
        {back}
        <Card>
          <ChartSkeleton height={140} />
        </Card>
        <ChartSkeleton height={220} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <EmptyState title="Could not load your data" body={error} />
      </div>
    )
  }

  if (!view) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <EmptyState
          title="No comparison yet"
          body="Import your M1 activity and update market data - once VOO has a stored price history, this fills in from your first transaction onward."
          action={
            <Button variant="primary" onClick={() => navigate('/import')}>
              Go to Import
            </Button>
          }
        />
      </div>
    )
  }

  if (!analysis || !series) {
    if (!watchlist.includes(ticker)) {
      return (
        <div className="flex flex-col gap-4">
          {back}
          <EmptyState
            title={`No activity for ${ticker}`}
            body="This ticker has never been bought in your ledger, or the symbol is misspelled."
          />
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-7">
        {back}
        <section>
          <SectionHeading>
            {ticker}
            <span className="ml-2 text-small font-normal text-ink-muted">Watching</span>
          </SectionHeading>
          <Card>
            <EmptyState
              title="Not held yet"
              body="You are watching this ticker but have not bought it, so there are no holding measures to show - just its price and your fair-value estimate, below."
            />
          </Card>
        </section>
        {fairValueSection}
      </div>
    )
  }

  const closed = isClosedPosition(analysis)
  const shadowNegative = (toNumber(analysis.shadowValue) ?? 0) < 0
  const hidden = hiddenTickers.includes(ticker)

  async function unhide() {
    setUnhiding(true)
    try {
      await setTickerHidden(ticker, false)
      toast.show(`${ticker} is back in your lists.`, { status: 'good' })
    } catch (err) {
      report(err)
    } finally {
      setUnhiding(false)
    }
  }

  return (
    <div className="flex flex-col gap-7">
      {back}

      <section>
        <SectionHeading
          action={
            closed ? undefined : <Button onClick={() => setClosing(ticker)}>Close or hide…</Button>
          }
        >
          {ticker}
          {closed && <span className="ml-2 text-small font-normal text-ink-muted">Closed</span>}
          {hidden && <span className="ml-2 text-small font-normal text-ink-muted">Hidden</span>}
          {/* Which view these numbers are: without it a narrowed screen looks like the whole position. */}
          {account !== null && (
            <span className="ml-2 text-small font-normal text-ink-muted">{account} only</span>
          )}
        </SectionHeading>
        <Card>
          <StatTile
            hero
            label="Value added vs VOO"
            value={money(analysis.valueAdded)}
            delta={{
              value: analysis.percentDifference,
              format: 'percent',
              describe: { up: 'ahead of VOO by', down: 'behind VOO by' },
            }}
            footnote={
              closed
                ? "Closed position. Proceeds plus dividends against VOO's."
                : 'Your picks against the same dollars in VOO on the same dates.'
            }
          />
          <div className="mt-5 grid grid-cols-2 gap-5 border-t border-rule pt-4 md:grid-cols-5">
            <StatTile
              label="Shares"
              value={formatShares(analysis.shares)}
              footnote={
                analysis.latestClose === null && !closed
                  ? 'No stored price for this ticker, so its current value reads as $0.'
                  : undefined
              }
            />
            <StatTile label="Current value" value={moneyCompact(analysis.currentValue)} />
            <StatTile
              label="VOO equivalent"
              value={moneyCompact(analysis.shadowValue)}
              footnote={
                shadowNegative
                  ? 'This position has paid you back more cash than the same money would be worth in VOO, so its VOO equivalent is below zero.'
                  : undefined
              }
            />
            <StatTile label="Your IRR" value={percent(analysis.irr, { sign: false })} />
            <StatTile label="VOO IRR" value={percent(analysis.shadowIrr, { sign: false })} />
          </div>
          {hidden && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-4">
              <p className="max-w-prose text-small text-ink-secondary">
                Hidden from Holdings, Rebuy opportunities and Fair values. Every number on this
                screen, and every total on the Dashboard, still counts it in full.
              </p>
              <Button disabled={unhiding} onClick={() => void unhide()}>
                {unhiding ? 'Saving…' : 'Unhide'}
              </Button>
            </div>
          )}
        </Card>
      </section>

      <section>
        <SectionHeading>Your money</SectionHeading>
        <Card>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <StatTile label="Invested" value={moneyCompact(analysis.invested)} />
            <StatTile label="Returned" value={moneyCompact(analysis.returned)} />
            <StatTile
              label="Total return"
              value={
                <SignedDelta
                  value={analysis.totalGain}
                  format="moneyCompact"
                  size="lg"
                  describe={{ up: 'gained', down: 'lost' }}
                />
              }
              footnote={`Realized ${money(analysis.realizedGain)} · Unrealized ${money(
                analysis.unrealizedGain,
              )} · Dividends ${money(analysis.dividendGain)}`}
            />
          </div>
        </Card>
      </section>

      {accountSplit.length > 0 && (
        <section>
          <SectionHeading>Across accounts</SectionHeading>
          <Card>
            <AccountStrip
              rows={accountSplit}
              // Tapping the row you are already in goes back to all accounts, so the strip is
              // the way out of a narrowed view as well as the way in.
              onSelect={(next) => selectAccount(next === account ? null : next)}
              describe={(name) =>
                name === account
                  ? `Show ${ticker} across all accounts`
                  : `Show ${ticker} in ${name} only`
              }
            />
            <p className="mt-3 max-w-prose text-small text-ink-muted">
              Shares and current value per account - the whole position, whichever view you are in.
              Tap one to narrow this screen to it, or tap the one you are in to go back to all
              accounts. An account that held it and sold out is still listed, at zero shares.
            </p>
          </Card>
        </section>
      )}

      <section>
        <SectionHeading>Position versus VOO</SectionHeading>
        <div className="mb-3">
          <RangeSelector value={range} onChange={setRange} />
        </div>
        <HistoryChart
          dates={windowedSeries?.dates ?? series.dates}
          you={windowedSeries?.value ?? series.value}
          benchmark={windowedSeries?.shadow ?? series.shadow}
          markers={markers}
          range={range}
          title={`${ticker} versus its VOO bucket`}
          subtitle="Drag across the chart, or focus it and use the arrow keys."
        />
      </section>

      <section>
        <SectionHeading>Decisions</SectionHeading>
        <Card>
          <DataTable
            rows={decisions}
            columns={decisionColumns}
            rowKey={(d) => `${d.trade_date}-${d.account_label}-${d.amount}-${d.shares}`}
            caption={`${ticker} buy decisions`}
            initialSort={{ key: 'date', direction: 'desc' }}
            empty={
              <EmptyState
                title="No buys to show"
                body="Shares that arrived some other way - a spinoff or a transfer in kind - have no buy to attribute, so SPEC leaves them out of this list."
              />
            }
          />
          <p className="mt-3 text-small text-ink-muted">
            Each row is one buy against the same dollars in VOO to the same end point - a sold slice
            to its sell date, the rest to today. Dividends are not split across buys, so these
            differences do not sum to the value added above.
          </p>
        </Card>
      </section>

      {fairValueSection}

      <ClosePositionSheet ticker={closing} onClose={() => setClosing(null)} />
    </div>
  )
}
