import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError, NotAuthenticatedError } from '../api/client'
import type { FairValueRow } from '../api/types'
import { discountFrom, latestFairValues } from '../data/fairValue'
import { usePortfolioData } from '../data/usePortfolioData'
import {
  Button,
  Card,
  ChartSkeleton,
  DataTable,
  DiscountMeter,
  DivergingBars,
  EmptyState,
  HistoryChart,
  Label,
  MiniButton,
  money,
  moneyCompact,
  percent,
  SectionHeading,
  SignedDelta,
  StatTile,
  toNumber,
  useToast,
  type Column,
} from '../ui'
import type { TickerAnalysis } from '../engine'

/**
 * SPEC section 9's first screen: within five seconds, am I beating VOO, and what looks cheap.
 * Every number here is read off `usePortfolioData().result` (task 09's `analyze` cache) or the
 * fair-value API - nothing is recomputed, per CLAUDE.md, beyond the two SPEC section 7 formulas
 * (the current estimate per ticker, and the discount) that live in `src/data/fairValue.ts`
 * because fair value is outside `analyze`'s domain entirely.
 */

type Range = '1Y' | '3Y' | 'All'
const RANGE_DAYS: Record<Range, number> = { '1Y': 252, '3Y': 756, All: Infinity }

function sliceRange<T>(values: readonly T[], days: number): T[] {
  return Number.isFinite(days) ? values.slice(-days) : [...values]
}

function isClosed(ticker: TickerAnalysis): boolean {
  return (toNumber(ticker.shares) ?? 0) === 0
}

export default function Dashboard() {
  const navigate = useNavigate()
  const toast = useToast()
  const { loading, error, result } = usePortfolioData()
  const [fairValueRows, setFairValueRows] = useState<FairValueRow[] | null>(null)
  const [range, setRange] = useState<Range>('1Y')

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

  const heldTickers = useMemo(
    () => (result ? result.byTicker.filter((t) => !isClosed(t)) : []),
    [result],
  )

  const rebuy = useMemo(() => {
    const ranked: { ticker: string; discount: string; price: string; fairValue: string }[] = []
    const noEstimate: string[] = []
    for (const ticker of heldTickers) {
      const fv = latestFairValue.get(ticker.ticker)
      if (!fv) {
        noEstimate.push(ticker.ticker)
        continue
      }
      if (ticker.latestClose === null) continue
      const discount = discountFrom(ticker.latestClose, fv.value_usd)
      if (discount === null) continue
      ranked.push({
        ticker: ticker.ticker,
        discount,
        price: ticker.latestClose,
        fairValue: fv.value_usd,
      })
    }
    ranked.sort((a, b) => Number(b.discount) - Number(a.discount))
    return { ranked, noEstimate }
  }, [heldTickers, latestFairValue])

  const series = useMemo(() => {
    if (!result?.series) return { dates: [], value: [], shadow: [] }
    const days = RANGE_DAYS[range]
    return {
      dates: sliceRange(result.series.dates, days),
      value: sliceRange(result.series.value, days),
      shadow: sliceRange(result.series.shadow, days),
    }
  }, [result, range])

  const creators = useMemo(
    () =>
      result?.byTicker.map((t) => ({
        label: t.ticker,
        value: t.valueAdded,
        note: isClosed(t) ? 'Closed' : undefined,
      })) ?? [],
    [result],
  )

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
          const fv = latestFairValue.get(row.ticker)
          return fv ? Number(fv.value_usd) : null
        },
        render: (row) => {
          const fv = latestFairValue.get(row.ticker)
          return fv ? money(fv.value_usd) : <span className="text-ink-muted">No estimate</span>
        },
      },
      {
        key: 'discount',
        header: 'Discount',
        align: 'right',
        sort: (row) => {
          const fv = latestFairValue.get(row.ticker)
          if (!fv || row.latestClose === null) return null
          const d = discountFrom(row.latestClose, fv.value_usd)
          return d === null ? null : Number(d)
        },
        render: (row) => {
          const fv = latestFairValue.get(row.ticker)
          if (!fv || row.latestClose === null) return <span className="text-ink-muted">—</span>
          const d = discountFrom(row.latestClose, fv.value_usd)
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
    [latestFairValue],
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

  if (!result) {
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

  const { portfolio } = result
  const irrTrend =
    result.series && result.series.value.length >= 2
      ? { values: result.series.value.slice(-90), label: 'Portfolio value, last 90 trading days' }
      : undefined

  return (
    <div className="flex flex-col gap-7">
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
            footnote="Your picks against the same dollars in VOO on the same dates."
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
        </Card>
      </section>

      <section>
        <SectionHeading
          action={
            <div className="flex gap-1">
              {(['1Y', '3Y', 'All'] as const).map((r) => (
                <MiniButton key={r} pressed={range === r} onClick={() => setRange(r)}>
                  {r}
                </MiniButton>
              ))}
            </div>
          }
        >
          History
        </SectionHeading>
        <HistoryChart
          dates={series.dates}
          you={series.value}
          benchmark={series.shadow}
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
                <DiscountMeter
                  key={item.ticker}
                  label={`${item.ticker} vs fair value`}
                  discount={item.discount}
                  price={item.price}
                  fairValue={item.fairValue}
                />
              ))}
              {rebuy.noEstimate.length > 0 && (
                <div className="border-t border-rule pt-4">
                  <Label>No estimate yet</Label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {rebuy.noEstimate.map((ticker) => (
                      <span
                        key={ticker}
                        className="rounded-full border border-rule px-2 py-0.5 font-mono text-small"
                      >
                        {ticker}
                      </span>
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
            onRowSelect={(row) => navigate(`/stocks/${row.ticker}`)}
            empty={
              <EmptyState
                title="No holdings yet"
                body="Once you have an open position, it shows up here."
              />
            }
          />
          <p className="mt-3 text-small text-ink-muted">
            {heldTickers.length} open position{heldTickers.length === 1 ? '' : 's'}.
          </p>
        </Card>
      </section>

      <section>
        <SectionHeading>Value creators and destroyers</SectionHeading>
        <DivergingBars
          items={creators}
          subtitle="Every ticker ever held, closed positions marked."
        />
      </section>
    </div>
  )
}
