# Task 39 - Dashboard facelift, toward the concept

**Model:** Opus. **Effort:** high. **Context budget:** ~100k.
**Runs on:** anywhere.
**Read:** `docs/BRAND.md`, the concept screenshot at `docs/brand/concept-2.png`,
`docs/DESIGN.md` sections 3 and 5, `src/routes/Dashboard.tsx`, `src/ui/StatTile.tsx`,
`src/ui/charts/HistoryChart.tsx` (props only), task 36's handoff.

## Goal
One slow, visible step: the dashboard's first screen reads like the concept's phone mock -
calm, card-based, the headline answer first. Same numbers, same engine.

## Steps
1. **Hero card** "Portfolio vs S&P 500": two large figures side by side (your return, S&P 500
   return) for the selected range, the signed gap beneath, then the history chart and the range
   selector. Ahead is blue, behind red, S&P 500 graphite - not the concept's green.
2. **Performance card**: a compact two-column table - Total return and Annualized return
   (`annualizedIrr`) for you vs S&P 500. No volatility: the engine does not compute it.
3. Card treatment from task 36's elevation token; consistent 16px gutters; type scale per
   DESIGN 3.2 with tabular figures for every number.
4. Keep everything below the fold working unchanged (holdings, rebuy, account strip). Do not
   restyle other screens - list what would carry over in the handoff for a future task.
5. Update Help's Dashboard section if anything moved.

## Out of scope
New metrics, allocation donut, other screens, engine changes.

## Acceptance
`npm run check` passes; screenshots at 390px and 1280px, light and dark, sent to the owner for a
yes before task 40.

**Next:** tasks/40-release-rev3.md on Haiku (effort low) - budget ~35k. Needs the owner's yes.
