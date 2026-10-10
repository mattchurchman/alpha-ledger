import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, NotAuthenticatedError } from '../api/client'
import type { FairValueRow } from '../api/types'
import { tickerDecisions, tickerSeries, type BuyDecision } from '../engine'
import { splitAdjustedHistory } from '../engine/fairValue'
import { usePortfolioData } from '../data/usePortfolioData'
import {
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
  SectionHeading,
  SignedDelta,
  StatTile,
  StepLineChart,
  toNumber,
  useToast,
  type Column,
  type HistoryChartMarker,
} from '../ui'

/**
 * SPEC section 9's second screen: for one ticker, did owning it beat VOO, and which buys
 * were good. Every measure is read off `usePortfolioData().result` (task 09's `analyze`
 * cache) and the two on-demand helpers `docs/ENGINE_API.md` describes - `tickerSeries` and
 * `tickerDecisions` - rather than recomputed here (CLAUDE.md).
 *
 * Reached from every ticker mention that behaves like a destination: the dashboard's
 * holdings table and value-creators chart (closed positions only show up there), and
 * Activity's ticker column. Works for a closed position because `valueAdded` and the
 * decision list are both defined when `shares` and `currentValue` are zero (SPEC section 6).
 */
export default function StockDetail() {
  const navigate = useNavigate()
  const toast = useToast()
  const params = useParams<{ ticker: string }>()
  const ticker = (params.ticker ?? '').toUpperCase()
  const { loading, error, result, prices } = usePortfolioData()

  const [fairValueRows, setFairValueRows] = useState<FairValueRow[] | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

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

  const analysis = useMemo(
    () => result?.byTicker.find((t) => t.ticker === ticker) ?? null,
    [result, ticker],
  )

  const series = useMemo(() => (result ? tickerSeries(result, ticker) : null), [result, ticker])

  const decisions = useMemo(() => (result ? tickerDecisions(result, ticker) : []), [result, ticker])

  const markers = useMemo<HistoryChartMarker[]>(() => {
    const out: HistoryChartMarker[] = []
    for (const decision of decisions) {
      out.push({ date: decision.trade_date, kind: 'buy', amount: decision.amount })
      for (const exit of decision.exits) {
        if (exit.kind === 'sell')
          out.push({ date: exit.trade_date, kind: 'sell', amount: exit.proceeds })
      }
    }
    return out
  }, [decisions])

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

  if (!result) {
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

  const closed = (toNumber(analysis.shares) ?? 0) === 0
  const shadowNegative = (toNumber(analysis.shadowValue) ?? 0) < 0

  return (
    <div className="flex flex-col gap-7">
      {back}

      <section>
        <SectionHeading>
          {ticker}
          {closed && <span className="ml-2 text-small font-normal text-ink-muted">Closed</span>}
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
          <div className="mt-5 grid grid-cols-2 gap-5 border-t border-rule pt-4 md:grid-cols-4">
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

      <section>
        <SectionHeading>Position versus VOO</SectionHeading>
        <HistoryChart
          dates={series.dates}
          you={series.value}
          benchmark={series.shadow}
          markers={markers}
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
    </div>
  )
}
