import { useState } from 'react'
import {
  BottomSheet,
  Button,
  Card,
  ChartSkeleton,
  DataTable,
  DiscountMeter,
  DivergingBars,
  EmptyState,
  HistoryChart,
  Label,
  SectionHeading,
  SignedDelta,
  Sparkline,
  StatTile,
  StatusBadge,
  StepLineChart,
  money,
  moneyCompact,
  percent,
  useToast,
  zoneFor,
  type Column,
} from '../ui'
import {
  DEMO_DAYS,
  creators,
  estimates,
  headline,
  history,
  holdings,
  sparkline,
  stockDetail,
  type DemoHolding,
} from '../kit/synthetic'

/**
 * The design system, on one page, fed entirely by synthetic data (`src/kit/synthetic.ts`).
 *
 * This is the route task 07's acceptance check screenshots at 390px and 1280px in both themes,
 * and the reference later tasks assemble screens from. It never calls the API and holds nothing
 * real - see the note at the top of the page.
 */
export default function Kit() {
  const toast = useToast()
  const [sheetOpen, setSheetOpen] = useState(false)

  const columns: Column<DemoHolding>[] = [
    {
      key: 'ticker',
      header: 'Ticker',
      primary: true,
      render: (row) => <span className="font-mono font-medium">{row.ticker}</span>,
      sort: (row) => row.ticker,
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      render: (row) => money(row.price),
      sort: (row) => Number(row.price),
    },
    {
      key: 'value',
      header: 'Value',
      align: 'right',
      render: (row) => moneyCompact(row.value),
      sort: (row) => Number(row.value),
    },
    {
      key: 'valueAdded',
      header: 'vs VOO',
      align: 'right',
      render: (row) => (
        <SignedDelta
          value={row.valueAdded}
          format="moneyCompact"
          size="sm"
          describe={{ up: 'beat VOO by', down: 'trailed VOO by' }}
        />
      ),
      sort: (row) => Number(row.valueAdded),
    },
    {
      key: 'irr',
      header: 'IRR',
      align: 'right',
      render: (row) => (
        <SignedDelta
          value={row.irr}
          format="percent"
          size="sm"
          describe={{ up: 'up', down: 'down' }}
        />
      ),
      sort: (row) => (row.irr === null ? null : Number(row.irr)),
      hideOnCard: true,
    },
    {
      key: 'discount',
      header: 'Discount',
      align: 'right',
      render: (row) =>
        row.discount === null ? (
          <span className="text-ink-muted">No estimate</span>
        ) : (
          <span className={zoneFor(row.discount)?.tone === 'ahead' ? 'text-ahead' : 'text-behind'}>
            {percent(row.discount, { sign: false })}
          </span>
        ),
      sort: (row) => (row.discount === null ? null : Number(row.discount)),
    },
  ]

  return (
    <div className="flex flex-col gap-7">
      <Card className="border-dashed">
        <p className="text-small text-ink-secondary">
          Every number on this page is synthetic (
          <code className="font-mono">src/kit/synthetic.ts</code>
          ). Invented tickers, a seeded generator, no API calls. The history chart carries{' '}
          <strong>{DEMO_DAYS.toLocaleString('en-US')} daily points</strong>, which is the six-year
          figure the kit has to stay smooth at on a phone.
        </p>
      </Card>

      <section>
        <SectionHeading>Headline</SectionHeading>
        <Card>
          <StatTile
            hero
            label="Value added vs VOO"
            value={money(headline.valueAdded)}
            delta={{
              value: headline.percentDifference,
              format: 'percent',
              describe: { up: 'ahead of VOO by', down: 'behind VOO by' },
            }}
            footnote="Your picks against the same dollars in VOO on the same dates."
          />
          <div className="mt-5 grid grid-cols-2 gap-5 border-t border-rule pt-4 md:grid-cols-4">
            <StatTile label="Portfolio value" value={moneyCompact(headline.portfolioValue)} />
            <StatTile label="VOO equivalent" value={moneyCompact(headline.shadowValue)} />
            <StatTile
              label="Your IRR"
              value={percent(headline.irr, { sign: false })}
              trend={{ values: sparkline, label: 'Portfolio value over the last 90 trading days' }}
            />
            <StatTile label="VOO IRR" value={percent(headline.shadowIrr, { sign: false })} />
          </div>
        </Card>
      </section>

      <section>
        <SectionHeading>History, with the gap shaded</SectionHeading>
        <HistoryChart
          dates={history.dates}
          you={history.you}
          benchmark={history.shadow}
          subtitle="Drag across the chart, or focus it and use the arrow keys."
        />
      </section>

      <section>
        <SectionHeading>Value creators and destroyers</SectionHeading>
        <DivergingBars
          items={creators}
          subtitle="Every ticker ever held, closed positions included."
        />
      </section>

      <section>
        <SectionHeading>Discount to fair value</SectionHeading>
        <Card>
          <div className="flex flex-col gap-6">
            <DiscountMeter discount="0.2325" price="184.20" fairValue="240.00" />
            <DiscountMeter discount="-0.1289" price="21.45" fairValue="19.00" />
            <DiscountMeter discount="-0.4100" price="88.00" fairValue="62.00" />
            <DiscountMeter discount={null} price="311.00" />
          </div>
        </Card>
      </section>

      <section>
        <SectionHeading>Price with a fair-value step line</SectionHeading>
        <StepLineChart
          dates={stockDetail.dates}
          price={stockDetail.price}
          estimates={estimates}
          subtitle="Markers are the moments you changed your mind."
        />
      </section>

      <section>
        <SectionHeading>Holdings table</SectionHeading>
        <Card>
          <DataTable
            rows={holdings}
            columns={columns}
            rowKey={(row) => row.ticker}
            caption="Demo holdings, sortable"
            initialSort={{ key: 'valueAdded', direction: 'desc' }}
          />
          <p className="mt-3 text-small text-ink-muted">
            Below 640px every row becomes a card. Resize the window to see it switch - it is CSS,
            not a resize listener.
          </p>
        </Card>
      </section>

      <section>
        <SectionHeading>Signed values</SectionHeading>
        <Card>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="flex flex-col gap-1">
              <Label>Ahead</Label>
              <SignedDelta
                value="18420.55"
                size="lg"
                describe={{ up: 'ahead of VOO by', down: 'behind VOO by' }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Behind</Label>
              <SignedDelta
                value="-9260.10"
                size="lg"
                describe={{ up: 'ahead of VOO by', down: 'behind VOO by' }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Percent</Label>
              <SignedDelta value="0.1487" format="percent" describe={{ up: 'up', down: 'down' }} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Down is good</Label>
              <SignedDelta
                value="-0.0420"
                format="percent"
                goodWhenUp={false}
                describe={{ up: 'more expensive by', down: 'cheaper by' }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>No value</Label>
              <SignedDelta value={null} />
            </div>
          </div>
          <p className="mt-4 text-small text-ink-secondary">
            Three channels carry the sign - glyph, <code className="font-mono">+/−</code>, and hue -
            so none of them is load-bearing alone.
          </p>
        </Card>
      </section>

      <section>
        <SectionHeading>Sparklines</SectionHeading>
        <Card>
          <div className="flex flex-wrap items-center gap-6">
            <Sparkline values={sparkline} label="Portfolio value, last 90 trading days" />
            <Sparkline values={[...sparkline].reverse()} label="A falling example" />
            <Sparkline values={sparkline} width={140} height={40} label="A wider example" />
          </div>
        </Card>
      </section>

      <section>
        <SectionHeading>Overlays</SectionHeading>
        <Card>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => setSheetOpen(true)}>
              Open bottom sheet
            </Button>
            <Button onClick={() => toast.show('Imported 42 transactions, 8 duplicates skipped.')}>
              Toast: good
            </Button>
            <Button
              onClick={() =>
                toast.show('Prices for 3 tickers failed to fetch.', { status: 'warning' })
              }
            >
              Toast: warning
            </Button>
            <Button
              onClick={() => toast.show('Share count does not reconcile.', { status: 'critical' })}
            >
              Toast: critical
            </Button>
          </div>
        </Card>
      </section>

      <section>
        <SectionHeading>States</SectionHeading>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <Label>First load</Label>
            <div className="mt-3">
              <ChartSkeleton height={160} />
            </div>
          </Card>
          <Card>
            <Label>Empty</Label>
            <EmptyState
              title="No transactions yet"
              body="Import an M1 activity export and the rest of the app fills in."
              action={<Button variant="primary">Go to Import</Button>}
            />
          </Card>
          <Card>
            <Label>Status</Label>
            <div className="mt-3 flex flex-col gap-2">
              <StatusBadge status="good">Reconciled against M1&apos;s own share counts</StatusBadge>
              <StatusBadge status="warning">Prices are 9 trading days old</StatusBadge>
              <StatusBadge status="serious">2 tickers failed to fetch</StatusBadge>
              <StatusBadge status="critical">ACME share count does not reconcile</StatusBadge>
            </div>
          </Card>
          <Card>
            <Label>Refetching</Label>
            <p className="mt-2 text-small text-ink-secondary">
              A reload holds the previous render at 55% opacity rather than flashing a skeleton.
            </p>
            <HistoryChart
              dates={history.dates.slice(-120)}
              you={history.you.slice(-120)}
              benchmark={history.shadow.slice(-120)}
              title="Last six months"
              height={140}
              busy
            />
          </Card>
        </div>
      </section>

      <section>
        <SectionHeading>Tokens</SectionHeading>
        <Card>
          <Label>Series and polarity</Label>
          <ul className="mt-2 mb-5 grid grid-cols-2 gap-2 md:grid-cols-3">
            {[
              ['Ahead / beat VOO', 'bg-ahead'],
              ['Behind / trailed VOO', 'bg-behind'],
              ['You', 'bg-you'],
              ['VOO (reference)', 'bg-voo'],
              ['Fair value', 'bg-estimate'],
              ['De-emphasised', 'bg-dim'],
            ].map(([name, background]) => (
              <li key={name} className="flex items-center gap-2 text-small">
                <span
                  className={`size-4 shrink-0 rounded-[3px] ${background}`}
                  aria-hidden="true"
                />
                {name}
              </li>
            ))}
          </ul>

          <Label>Type scale</Label>
          <div className="mt-2 flex flex-col gap-1">
            <p className="text-hero font-semibold">$18,420</p>
            <p className="text-figure font-semibold">$42,180</p>
            <p className="text-h1 font-semibold">Screen title</p>
            <p className="text-h2 font-semibold">Card title</p>
            <p className="text-body">
              Body copy, 15px. Prose is Geist; every figure that sits in a column is Geist Mono.
            </p>
            <p className="font-mono text-small tabular-nums">1,284.07 · 184.20 · 0.004219</p>
            <Label>Column heading</Label>
          </div>
        </Card>
      </section>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="How this is calculated"
        footer={
          <Button variant="primary" className="flex-1" onClick={() => setSheetOpen(false)}>
            Got it
          </Button>
        }
      >
        <div className="flex flex-col gap-3 text-body">
          <p>
            Every dollar you put into a stock is mirrored into a VOO bucket on the same date. Sells
            and dividends come back out of the bucket the same way.
          </p>
          <p>
            <strong>Value added</strong> is what your shares are worth today minus what that bucket
            would be worth. Taxes, fees and cash drag are ignored on both sides.
          </p>
          <p className="text-small text-ink-secondary">
            This sheet is where SPEC section 6 asks for that explanation once. Task 10 wires it up
            for real.
          </p>
        </div>
      </BottomSheet>
    </div>
  )
}
