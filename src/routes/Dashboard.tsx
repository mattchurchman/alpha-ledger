import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiError, NotAuthenticatedError } from '../api/client'
import type { FairValueRow } from '../api/types'
import { usePortfolioData } from '../data/usePortfolioData'
import { mergeHeldAndWatched } from '../data/watchlist'
import { delistedCandidates, isClosedPosition } from '../engine'
import { discountFrom, latestFairValues, splitAdjustedValue } from '../engine/fairValue'
import { ClosePositionSheet } from './ClosePosition'
import {
  AccountStrip,
  AccountSwitcher,
  Button,
  Card,
  ChartSkeleton,
  DataTable,
  DiscountMeter,
  DivergingBars,
  EmptyState,
  HistoryChart,
  Label,
  money,
  moneyCompact,
  percent,
  rangeStart,
  RangeSelector,
  SectionHeading,
  shares as formatShares,
  SignedDelta,
  StatTile,
  StatusBadge,
  useToast,
  type AccountStripRow,
  type ChartRange,
  type Column,
} from '../ui'
import type { TickerAnalysis } from '../engine'

/**
 * SPEC section 9's first screen: within five seconds, am I beating VOO, and what looks cheap.
 * Every number here is read off `usePortfolioData().resultFor` (task 09's `analyze` cache) or the
 * fair-value API - nothing is recomputed, per CLAUDE.md, beyond the SPEC section 7 formulas
 * (the current estimate per ticker, its split adjustment, and the discount) that live in
 * `src/engine/fairValue.ts`, a module `analyze` never touches because fair value is outside its
 * domain entirely.
 *
 * Task 19 made the whole screen switchable: `view` is either the all-accounts analysis or one
 * account's own, and every section below reads `view` rather than the summed result. The
 * selection lives in `?account=` so the back button and a refresh both keep it, and it rides
 * along on every link out to a stock so the detail screen opens in the same view.
 */

export default function Dashboard() {
  const navigate = useNavigate()
  const toast = useToast()
  const {
    loading,
    error,
    prices,
    hiddenTickers,
    watchlist,
    accounts,
    accountSummaries,
    resultFor,
  } = usePortfolioData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [fairValueRows, setFairValueRows] = useState<FairValueRow[] | null>(null)
  const [range, setRange] = useState<ChartRange>('1Y')
  const [closing, setClosing] = useState<string | null>(null)

  /**
   * A label that is not in the ledger - a stale bookmark, or a renamed account - falls back to
   * the summed view. The alternative is a screen of zeroes with no way to tell why.
   */
  const requestedAccount = searchParams.get('account')
  const account =
    requestedAccount !== null && accounts.includes(requestedAccount) ? requestedAccount : null

  const selectAccount = useCallback(
    (next: string | null) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          if (next === null) params.delete('account')
          else params.set('account', next)
          return params
        },
        // A push, not a replace: switching views is a step the back button should undo.
        { replace: false },
      )
    },
    [setSearchParams],
  )

  /** The analysis every section below reads. `null` account means all of them, summed. */
  const view = resultFor(account)

  /** Links out carry the view, so the stock screen opens on the same account. */
  const stockPath = useCallback(
    (ticker: string) =>
      account === null
        ? `/stocks/${ticker}`
        : `/stocks/${ticker}?account=${encodeURIComponent(account)}`,
    [account],
  )

  const report = useCallback(
    (err: unknown) => {
      if (err instanceof NotAuthenticatedError) toast.show(err.message, { status: 'critical' })
      else if (err instanceof ApiError)
        toast.show(`${err.status}: ${err.message}`, { status: 'critical' })
      else toast.show(err instanceof Error ? err.message : String(err), { status: 'critical' })
    },
    [toast],
  )

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

  /**
   * The latest estimate per ticker, restated at today's split level (SPEC section 7) so it
   * compares correctly against `latestClose`, which is always already in post-split terms.
   */
  const currentFairValue = useMemo(() => {
    const current = new Map<string, string>()
    for (const [ticker, fv] of latestFairValue) {
      current.set(ticker, splitAdjustedValue(fv, prices[ticker]?.splits ?? []))
    }
    return current
  }, [latestFairValue, prices])

  /**
   * Open positions the user has not hidden. Hiding is presentation only (task 18) - the
   * headline above, the history chart and the totals all still count a hidden ticker in full,
   * which is why this filter lives here and not in the engine.
   */
  const heldTickers = useMemo(
    () =>
      view
        ? view.byTicker.filter((t) => !isClosedPosition(t) && !hiddenTickers.includes(t.ticker))
        : [],
    [view, hiddenTickers],
  )

  const hiddenOpenCount = useMemo(
    () =>
      (view?.byTicker ?? []).filter((t) => !isClosedPosition(t) && hiddenTickers.includes(t.ticker))
        .length,
    [view, hiddenTickers],
  )

  /**
   * Looks delisted, so prompt - never act. A quiet data-source outage and a real buyout are
   * indistinguishable from here, and only one of them should change the ledger. Anything
   * already hidden is left out: the user has said they do not want to see it.
   */
  const delisted = useMemo(() => {
    if (!view) return []
    return delistedCandidates({
      ...view,
      benchmarkCloseDate: prices[view.benchmark]?.asOf ?? null,
    }).filter((c) => !hiddenTickers.includes(c.ticker))
  }, [view, prices, hiddenTickers])

  /**
   * Rebuy opportunities ranks everything you might buy, not only what you hold: watched
   * tickers (task 20) join through the same `mergeHeldAndWatched` helper Fair values reads, so
   * the two lists can never drift apart.
   */
  const watchableTickers = useMemo(
    () => mergeHeldAndWatched(heldTickers, watchlist, hiddenTickers, prices),
    [heldTickers, watchlist, hiddenTickers, prices],
  )

  const rebuy = useMemo(() => {
    const ranked: {
      ticker: string
      discount: string
      price: string
      fairValue: string
      watching: boolean
    }[] = []
    const noEstimate: { ticker: string; watching: boolean }[] = []
    for (const ticker of watchableTickers) {
      const fairValue = currentFairValue.get(ticker.ticker)
      if (fairValue === undefined) {
        noEstimate.push({ ticker: ticker.ticker, watching: ticker.watching })
        continue
      }
      if (ticker.latestClose === null) continue
      const discount = discountFrom(ticker.latestClose, fairValue)
      if (discount === null) continue
      ranked.push({
        ticker: ticker.ticker,
        discount,
        price: ticker.latestClose,
        fairValue,
        watching: ticker.watching,
      })
    }
    ranked.sort((a, b) => Number(b.discount) - Number(a.discount))
    return { ranked, noEstimate }
  }, [watchableTickers, currentFairValue])

  const series = useMemo(() => {
    if (!view?.series) return { dates: [], value: [], shadow: [] }
    const start = rangeStart(view.series.dates, range)
    return {
      dates: view.series.dates.slice(start),
      value: view.series.value.slice(start),
      shadow: view.series.shadow.slice(start),
    }
  }, [view, range])

  /**
   * SPEC 9 put every ticker ever held in this chart. Narrowed at the user's request to
   * positions that are both still open and still priced. A closed position's bar is settled
   * history rather than a live decision, and an unpriced one's bar is not a reading at all:
   * `analyze` counts a missing price as $0, so a merged or delisted holding draws as a total
   * loss. The counts come back with the rows so the subtitle can say what was left out -
   * these bars no longer sum to the headline above, and silently dropping them would hide
   * that.
   */
  const creators = useMemo(() => {
    const rows = view?.byTicker ?? []
    const open = rows.filter((t) => !isClosedPosition(t))
    return {
      items: open
        .filter((t) => t.latestClose !== null)
        .map((t) => ({ label: t.ticker, value: t.valueAdded })),
      closed: rows.length - open.length,
      unpriced: open.filter((t) => t.latestClose === null).length,
    }
  }, [view])

  /** The strip's rows: the data layer's summaries, formatted by the kit's own formatters. */
  const accountRows = useMemo<AccountStripRow[]>(
    () =>
      accountSummaries.map((summary) => ({
        account: summary.account,
        figure: moneyCompact(summary.currentValue),
        delta: (
          <SignedDelta
            value={summary.valueAdded}
            format="moneyCompact"
            size="sm"
            describe={{ up: 'beat VOO by', down: 'trailed VOO by' }}
          />
        ),
      })),
    [accountSummaries],
  )

  const creatorsSubtitle = useMemo(() => {
    const hidden: string[] = []
    if (creators.closed > 0) hidden.push(`${creators.closed} closed`)
    if (creators.unpriced > 0) hidden.push(`${creators.unpriced} with no stored price`)
    const base = 'Open positions, against the same dollars in VOO.'
    return hidden.length === 0 ? base : `${base} ${hidden.join(' and ')} not shown.`
  }, [creators])

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
        key: 'shares',
        header: 'Shares',
        align: 'right',
        sort: (row) => Number(row.shares),
        render: (row) => formatShares(row.shares),
      },
      {
        key: 'price',
        header: 'Price',
        align: 'right',
        sort: (row) => (row.latestClose === null ? null : Number(row.latestClose)),
        render: (row) => money(row.latestClose),
      },
      {
        key: 'value',
        header: 'Value',
        align: 'right',
        sort: (row) => Number(row.currentValue),
        render: (row) => moneyCompact(row.currentValue),
      },
      {
        key: 'return',
        header: 'Return',
        align: 'right',
        sort: (row) => Number(row.totalGain),
        render: (row) => (
          <SignedDelta
            value={row.totalGain}
            format="moneyCompact"
            size="sm"
            describe={{ up: 'gained', down: 'lost' }}
          />
        ),
      },
      {
        key: 'valueAdded',
        header: 'vs VOO',
        align: 'right',
        sort: (row) => Number(row.valueAdded),
        render: (row) => (
          <SignedDelta
            value={row.valueAdded}
            format="moneyCompact"
            size="sm"
            describe={{ up: 'beat VOO by', down: 'trailed VOO by' }}
          />
        ),
      },
      {
        key: 'fairValue',
        header: 'Fair value',
        align: 'right',
        hideOnCard: true,
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
          return d === null ? (
            <span className="text-ink-muted">—</span>
          ) : (
            <span className={Number(d) >= 0 ? 'text-ahead' : 'text-behind'}>
              {percent(d, { sign: false })}
            </span>
          )
        },
      },
    ],
    [currentFairValue],
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-7">
        <Card>
          <ChartSkeleton height={140} />
        </Card>
        <ChartSkeleton height={220} />
        <ChartSkeleton height={160} />
      </div>
    )
  }

  if (error) {
    return <EmptyState title="Could not load your data" body={error} />
  }

  if (!view) {
    return (
      <EmptyState
        title="No comparison yet"
        body="Import your M1 activity and update market data - once VOO has a stored price history, this fills in from your first transaction onward."
        action={
          <Button variant="primary" onClick={() => navigate('/import')}>
            Go to Import
          </Button>
        }
      />
    )
  }

  const { portfolio } = view
  const irrTrend =
    view.series && view.series.value.length >= 2
      ? { values: view.series.value.slice(-90), label: 'Portfolio value, last 90 trading days' }
      : undefined

  return (
    <div className="flex flex-col gap-7">
      {/*
       * Renders nothing with one account, so a single-account ledger reads exactly as it did
       * before task 19. The line under it only appears once a view is narrowed - it is where
       * the cost-basis caveat belongs, since that is the one number that is not just a slice
       * of the summed figure (SPEC section 4, and the Decision log).
       */}
      {accounts.length > 1 && (
        <section>
          <AccountSwitcher accounts={accounts} value={account} onChange={selectAccount} />
          {account !== null && (
            <p className="mt-1 max-w-prose text-small text-ink-muted">
              {account} only. Cost basis here is this account&rsquo;s own average cost, not the
              pooled one, so realized and unrealized gain are split differently from the
              all-accounts view - their total is the same.
            </p>
          )}
        </section>
      )}

      <section>
        <SectionHeading>Headline</SectionHeading>
        <Card>
          <StatTile
            hero
            label="Value added vs VOO"
            value={money(portfolio.valueAdded)}
            delta={{
              value: portfolio.percentDifference,
              format: 'percent',
              describe: { up: 'ahead of VOO by', down: 'behind VOO by' },
            }}
            footnote={
              account === null
                ? 'Your picks against the same dollars in VOO on the same dates.'
                : `${account} only: its picks against the same dollars in VOO on the same dates.`
            }
          />
          <div className="mt-5 grid grid-cols-2 gap-5 border-t border-rule pt-4 md:grid-cols-4">
            <StatTile label="Portfolio value" value={moneyCompact(portfolio.currentValue)} />
            <StatTile label="VOO equivalent" value={moneyCompact(portfolio.shadowValue)} />
            <StatTile
              label="Your IRR"
              value={percent(portfolio.irr, { sign: false })}
              trend={irrTrend}
            />
            <StatTile label="VOO IRR" value={percent(portfolio.shadowIrr, { sign: false })} />
          </div>
          {/*
           * The comparison strip, in the summed view only - inside the one account's view the
           * strip would just be the headline above it repeated. Value and value added are the
           * two measures that do sum to that headline, which is why they are the two here.
           */}
          {account === null && accountSummaries.length > 0 && (
            <div className="mt-4 border-t border-rule pt-4">
              <Label>By account</Label>
              <div className="mt-2">
                <AccountStrip rows={accountRows} onSelect={selectAccount} />
              </div>
              <p className="mt-2 max-w-prose text-small text-ink-muted">
                Value and value added, per account. They add up to the headline above. Tap one to
                narrow every section below to it.
              </p>
            </div>
          )}
          {/*
           * `analyze` reports still-held tickers it could not price (ENGINE_API: "they read as
           * value 0"), and until this block nothing showed them - every total above was quietly
           * short by whatever they are worth. SPEC section 8 lists per-ticker fetch failures on
           * the Update screen; this is the same fact where the affected numbers actually are.
           */}
          {view.missingPrices.length > 0 && (
            <div className="mt-4 border-t border-rule pt-4">
              <StatusBadge status="warning">
                {view.missingPrices.length} holding
                {view.missingPrices.length === 1 ? '' : 's'} with no stored price, counted as $0
              </StatusBadge>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {/* Now tappable 44px pills that navigate to the stock detail screen. */}
                {view.missingPrices.map((ticker) => (
                  <button
                    key={ticker}
                    type="button"
                    onClick={() => navigate(stockPath(ticker))}
                    className="rounded-full border border-rule px-2 py-0.5 font-mono text-small min-h-11 flex items-center hover:bg-sunken transition-colors duration-[120ms]"
                  >
                    {ticker}
                  </button>
                ))}
              </div>
              <p className="mt-2 max-w-prose text-small text-ink-secondary">
                Portfolio value, total return and value added are all short by what these are worth.
                Run Update market data, or set a price by hand, in Settings.
              </p>
            </div>
          )}
          {/*
           * Task 18's prompt, never an auto-removal. A bought-out company keeps showing shares
           * because the ledger never recorded the exit, and no price arriving for it looks
           * exactly like the free data source having a bad day - so this asks rather than
           * deciding.
           */}
          {delisted.length > 0 && (
            <div className="mt-4 border-t border-rule pt-4">
              <StatusBadge status="serious">
                {delisted.length === 1
                  ? 'A holding looks delisted'
                  : `${delisted.length} holdings look delisted`}
              </StatusBadge>
              <ul className="mt-2 flex flex-col gap-2">
                {delisted.map((candidate) => (
                  <li
                    key={candidate.ticker}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="text-small text-ink-secondary">
                      <span className="font-mono font-medium text-ink">{candidate.ticker}</span>{' '}
                      {candidate.reason === 'no-price'
                        ? 'has no stored price at all'
                        : `last traded ${candidate.daysBehind} days before the valuation date`}
                      .
                    </span>
                    <Button
                      onClick={() => setClosing(candidate.ticker)}
                      aria-label={`Close or hide ${candidate.ticker}`}
                    >
                      Close or hide…
                    </Button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 max-w-prose text-small text-ink-secondary">
                If one of these was bought out or merged, record the exit and it leaves these lists
                on its own. Nothing is ever removed for you.
              </p>
            </div>
          )}
        </Card>
      </section>

      <section>
        <SectionHeading>History</SectionHeading>
        <div className="mb-3">
          <RangeSelector value={range} onChange={setRange} />
        </div>
        <HistoryChart
          dates={series.dates}
          you={series.value}
          benchmark={series.shadow}
          range={range}
          subtitle="Drag across the chart, or focus it and use the arrow keys."
        />
      </section>

      <section>
        <SectionHeading>Rebuy opportunities</SectionHeading>
        <Card className="flex flex-col gap-6">
          {fairValueRows === null ? (
            <ChartSkeleton height={120} />
          ) : rebuy.ranked.length === 0 && rebuy.noEstimate.length === 0 ? (
            <EmptyState
              title="Nothing to rank yet"
              body="Add a fair value for a holding and it shows up here."
              action={
                <Button variant="secondary" onClick={() => navigate('/fair-values')}>
                  Add a fair value
                </Button>
              }
            />
          ) : (
            <>
              {rebuy.ranked.map((item) => (
                <button
                  key={item.ticker}
                  type="button"
                  onClick={() => navigate(stockPath(item.ticker))}
                  className="-mx-4 -my-2 px-4 py-2 text-left hover:bg-sunken"
                >
                  {item.watching && <Label className="mb-1 block">Watching</Label>}
                  <DiscountMeter
                    label={`${item.ticker} vs fair value`}
                    discount={item.discount}
                    price={item.price}
                    fairValue={item.fairValue}
                  />
                </button>
              ))}
              {rebuy.noEstimate.length > 0 && (
                <div className="border-t border-rule pt-4">
                  <Label>No estimate yet</Label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {rebuy.noEstimate.map((item) => (
                      <button
                        key={item.ticker}
                        type="button"
                        onClick={() => navigate(stockPath(item.ticker))}
                        className="rounded-full border border-rule px-2 py-0.5 font-mono text-small min-h-11 flex items-center gap-1.5 hover:bg-sunken transition-colors duration-[120ms]"
                      >
                        {item.ticker}
                        {item.watching && (
                          <span className="text-micro font-normal text-ink-muted">Watching</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    className="mt-3"
                    onClick={() => navigate('/fair-values')}
                  >
                    Add a fair value
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      </section>

      <section>
        <SectionHeading>Holdings</SectionHeading>
        <Card>
          <DataTable
            rows={heldTickers}
            columns={columns}
            rowKey={(row) => row.ticker}
            caption="Current holdings"
            initialSort={{ key: 'valueAdded', direction: 'desc' }}
            onRowSelect={(row) => navigate(stockPath(row.ticker))}
            rowAction={(row) => (
              <Button
                onClick={() => setClosing(row.ticker)}
                aria-label={`Close or hide ${row.ticker}`}
              >
                Close…
              </Button>
            )}
            empty={
              <EmptyState
                title="No holdings yet"
                body="Once you have an open position, it shows up here."
              />
            }
          />
          <p className="mt-3 text-small text-ink-muted">
            {heldTickers.length} open position{heldTickers.length === 1 ? '' : 's'}.
            {hiddenOpenCount > 0 && (
              <>
                {' '}
                {hiddenOpenCount} hidden, and still counted in every total above - unhide in{' '}
                <button
                  type="button"
                  onClick={() => navigate('/settings')}
                  className="underline decoration-rule underline-offset-4 hover:text-ink"
                >
                  Settings
                </button>
                .
              </>
            )}
          </p>
        </Card>
      </section>

      <section>
        <SectionHeading>Value creators and destroyers</SectionHeading>
        <DivergingBars
          items={creators.items}
          subtitle={creatorsSubtitle}
          onSelect={(ticker) => navigate(stockPath(ticker))}
        />
      </section>

      <ClosePositionSheet ticker={closing} onClose={() => setClosing(null)} />
    </div>
  )
}
