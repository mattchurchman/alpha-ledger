# Task 17 - Chart scaling and shorter ranges
**Model:** Sonnet. **Next:** `tasks/18-defunct-tickers.md` on Opus.
**Read:** CLAUDE.md, `docs/DESIGN.md` section 5, `src/ui/charts/HistoryChart.tsx`, `src/ui/charts/geometry.ts`, the range code at the top of `src/routes/Dashboard.tsx`.

## Goal
The history chart is readable at every range, and the user can look closer than one year.

## Deliverables
- **Dynamic y-axis.** Cause is known: `HistoryChart.tsx` builds its domain with `paddedDomain(..., { includeZero: true })`, which pins the axis to $0 and flattens both lines. Fit the domain to the values visible in the selected range (both series, with padding). Ticks stay round via `niceTicks`. The gap band must still fill correctly without a zero baseline.
- **Ranges:** 1W, 1M, 3M, 6M, YTD, 1Y, 3Y, All. Data is daily closes, so nothing finer. Move the range maths out of `Dashboard.tsx` into a tested pure helper (trading-day counts are fine; YTD is by date). Default stays 1Y.
- Eight buttons must fit at 390px with 44px targets: a horizontally scrollable segmented row is acceptable.
- X-axis labels adapt: day and month for short ranges, month and year for long ones.
- Give the real-versus-shadow chart on `src/routes/StockDetail.tsx` the same selector and scaling.
- Update the chart section of `src/routes/Help.tsx` and DESIGN 5 where they describe the axis.

## Acceptance
- Geometry and range helpers have Vitest cases, including a range longer than the data and a flat series.
- 390px screenshots at 1M and All on synthetic data (`src/kit/synthetic.ts`): the lines use most of the plot height in both.
- `npm run check` passes.

## Out of scope
Intraday data, new chart types, colours, scheduled price fetching.
