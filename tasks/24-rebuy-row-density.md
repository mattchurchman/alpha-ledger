# Task 24 - Tighten the Rebuy row / Edit button pair
**Model:** Sonnet. **Next:** none yet - pick the next polish item from PROGRESS.md's open issues.
**Read:** CLAUDE.md, `docs/DESIGN.md` section 5.5's `RebuyBars` row, `src/ui/charts/RebuyBars.tsx`, `src/ui/primitives.tsx` (`Button`).

## Goal
Task 21's open issue: `RebuyBars`' row and its Edit button are two separate `min-h-11` targets
side by side - more horizontal space than a single packed row. Acceptable at 390px today, but
tighten it before it is cramped with a long ticker.

## Deliverables
- In `src/ui/charts/RebuyBars.tsx`, reduce the gap between the row button and the Edit button
  (currently `<li className="flex items-center gap-1">`) and/or trim the Edit button's own
  padding so the pair reads as one compact unit rather than two full-width targets. Keep both at
  the 44px touch-target floor (DESIGN line 205/416) - do not shrink the Edit button below it.
- Re-check the row at 390px with a long ticker (synthetic data in `/kit`, e.g. a 6-7 character
  ticker) and confirm the price/fair-value column (`sm:` only) and discount bar still fit without
  the row wrapping or the Edit label clipping.
- Update DESIGN 5.5's `RebuyBars` row if the layout description changes.

## Acceptance
- `npm run check` passes.
- 390px and 1280px `/kit` screenshots, light and dark, with the longest synthetic ticker: no
  horizontal scroll, Edit button not clipped, both targets still read as >=44px tall in the
  screenshot.

## Out of scope
Any new feature, the Discount map's em-dash row (already correct, just noted for a future
glance), palette changes.
