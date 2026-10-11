# Task 21 - Rebuy visuals and faster fair-value entry
**Model:** Sonnet. **Next:** `tasks/22-visual-refresh.md` on Opus.
**Read:** CLAUDE.md, `docs/DESIGN.md` sections 2.5, 3.3 and 5, `src/ui/charts/DiscountMeter.tsx`, `src/ui/charts/DivergingBars.tsx`, `src/routes/FairValues.tsx`.

## Goal
Thirty tickers read at a glance, and setting a fair value takes one tap and a few keystrokes.

## Deliverables
- **`RebuyBars`** in `src/ui/charts/`: one 44px row per ticker sorted by discount. A horizontal bar grows from a centre line (fair value): one side below fair value, the other above, clamped at 30% with a marker like `DiscountMeter`. Each row shows ticker, discount, zone label, price and fair value, and the Watching badge. Tap opens stock detail. Show the top eight with "Show all".
- **Discount map** toggle beside it: tiles sized by position value (watched tickers a fixed small outlined tile), shaded by zone with the sequential ramp, tap to open. Layout maths goes in `geometry.ts` with tests.
- **Allocation strip** above Holdings: one stacked horizontal bar, a segment per holding by value, tap to open. No donuts (DESIGN 1).
- **Fair-value entry.** Extract the sheet from `FairValues.tsx` into a shared `FairValueSheet` and open it straight from a rebuy row, a "No estimate yet" pill and stock detail. In the sheet: decimal keypad, the field focused on open, Enter saves, current price shown with a live discount preview from `discountFrom`, and "Save and next" walks the tickers that have no estimate. On Fair values the whole row opens the sheet.
- Add each new component to `/kit` on synthetic data. Document them in DESIGN 5.5. Update Help.

## Acceptance
- Geometry tests for the bar clamp and the tile layout, including 1 and 30 items.
- 390px and 1280px `/kit` screenshots, light and dark, with 30 synthetic tickers: no horizontal scroll.
- `npm run check` passes.

## Out of scope
A chart library, computed fair values, palette changes (task 22).
