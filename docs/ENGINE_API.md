# Engine API

One entry point. The UI calls `analyze` once, reads numbers off the result, and never
recomputes anything itself (CLAUDE.md). Two helpers serve the stock detail screen from the
same work.

```ts
import { analyze, tickerSeries, tickerDecisions } from './engine'

const result = analyze({ transactions, prices, aliases })
```

Everything is pure: prices come in through the argument, nothing is fetched or stored.
**All money and share figures are exact decimal strings at full internal precision** - wrap
them in `Decimal` or format them, but do not parse them as floats before rounding. Rounding
is the display layer's job. The one exception is the daily series, noted below.

## `analyze(input)`

| Input | |
|---|---|
| `transactions` | `Transaction[]` (SPEC section 3) |
| `prices` | `Record<ticker, PriceHistory>`, keyed by the ticker **after** alias resolution. Must include the benchmark, or `analyze` throws `MissingBenchmarkError`. |
| `aliases` | `TickerAlias[]`, optional |
| `asOf` | valuation date, optional; defaults to the newest `asOf` across `prices` |
| `benchmark` | optional, defaults to `VOO` |
| `includeSeries` | optional, defaults to true; false skips the portfolio daily series |

### Result

```
asOf            string      the date everything is valued on
benchmark       string      the ticker the shadow was built from
portfolio       PortfolioAnalysis
byTicker        TickerAnalysis[]      alphabetical, closed positions included
series          DailySeries | null    null only when includeSeries was false
missingPrices   string[]    still-held tickers with no usable price; they read as value 0
warnings        ShadowCoverageWarning[]   benchmark series does not cover the ledger
context         SeriesContext   opaque; pass the whole result to the helpers below
```

`TickerAnalysis` is every field of `TickerHoldings` (the real side, from `holdings.ts` -
`shares`, `costBasis`, `invested`, `returned`, `realizedGain`, `dividendGain`,
`unrealizedGain`, `currentValue`, `totalGain`, `latestClose`, `accounts`, …) plus:

| Field | |
|---|---|
| `shadowValue` | the ticker's VOO bucket today. **Can be negative** - the stock returned more cash than VOO would have been worth. Show it as is. |
| `valueAdded` | `currentValue - shadowValue`. The headline. Valid for closed positions, where `currentValue` is 0. |
| `percentDifference` | `valueAdded / shadowValue`, or **null** when the bucket is not positive. Render null as a dash. |
| `irr` | annualized money-weighted return as a decimal fraction (`"0.123456"` is 12.3456%), or **null**. |
| `shadowIrr` | the same on the benchmark side: identical cash flows, bucket value as the final one. Null whenever the bucket is not positive. |

`PortfolioAnalysis` is `PortfolioTotals` plus those same five fields.

**Invariant the UI can rely on:** portfolio `valueAdded` equals the sum of the per-ticker
`valueAdded`, exactly, and equals `currentValue - shadowValue`. Tested.

### Nulls mean "show a dash", never zero

`irr` and `shadowIrr` are null when there is nothing to solve: fewer than two cash flows, no
sign change among them, every flow on one day, or no root inside (-99.99%, 1e9]. The engine
does not guess a rate. Note the flip side: a large gain over a few days annualizes to an
absurd but genuine figure (millions of percent). The display should clamp or abbreviate
those; the engine reports what the math says.

## `tickerSeries(result, ticker)` and `tickerDecisions(result, ticker)`

Per SPEC section 6 these are on demand, so they are not in the `analyze` result. Both take
the whole `AnalyzeResult` and reuse its `context`, so neither re-resolves aliases or
rebuilds flows.

`DailySeries` is four parallel arrays - `dates`, `value`, `shadow`, `gap` - one entry per
trading day from the first transaction to `asOf`. These are the only numbers the engine
rounds: **2 decimal places**, because a chart point is a display artifact and a six-year
series is ~1,500 points per line. `gap` is computed from the rounded lines, so the three
agree exactly on screen.

`BuyDecision[]` is one entry per buy, oldest first: `shares`, `amount`, `sharesRemaining`,
`remainingValue`, `proceeds`, `outcomeValue`, `shadowValue`, `valueAdded`, `exits[]`,
`closedOn`. Sells are matched first-in-first-out. Two cautions, both explained at the top of
`decisions.ts`:

- Each part is compared against the benchmark **to its own end point** - a sold slice to the
  sell date, the rest to `asOf`.
- Dividends are not attributed to lots, so per-buy `valueAdded` does **not** sum to the
  ticker's `valueAdded` for a ticker that paid one. The ticker-level figure is the one to
  show as truth; this view answers "was this particular purchase a good idea".

## Module map

| File | |
|---|---|
| `types.ts` | `Transaction`, `TickerAlias` |
| `calendar.ts` | trading-day helpers; the "calendar" is always a price series' `dates` |
| `holdings.ts` | the real side: shares, basis, gains, split adjustment, alias resolution |
| `reconcile.ts` | reconstructed shares versus the broker's own counts |
| `shadow.ts` | the VOO buckets (SPEC section 5) |
| `returns.ts` | IRR, value added, percent difference (SPEC section 6) |
| `series.ts` | the daily history |
| `decisions.ts` | the per-buy view |
| `index.ts` | `analyze` |

## Performance

`analyze` on six years of daily prices for 60 tickers and 5,580 transactions: **~410ms** in
Node, of which ~125ms is `analyze` itself and the rest the portfolio daily series. One
ticker's series plus its decisions is ~13ms. Measured on the synthetic dataset in
`index.test.ts`, which asserts the whole thing stays under one second.
