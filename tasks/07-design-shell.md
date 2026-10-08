# Task 07 - Design system and app shell
**Model:** Opus. **Read:** CLAUDE.md, SPEC section 9; use the frontend-design and dataviz skills if available.

## Goal
A distinctive look and a reusable chart kit, so later screens are assembly work for a smaller model. Visualization is the priority of this product; it should be fun to open.

## Deliverables
- `docs/DESIGN.md`: the visual direction (you have creative license; avoid generic dashboard templates), color tokens for light and dark including a clear "beat VOO" versus "trailed VOO" pair that also works for color-blind users, type scale, spacing, motion rules, number formatting rules (currency, percent, signed values, compact on mobile).
- Tokens wired into Tailwind. Fonts bundled locally, none fetched at runtime.
- App shell: bottom tab bar on phone, side rail on desktop, safe-area insets, "prices as of" indicator slot, loading and empty states.
- Component kit in `src/ui/` with a `/kit` demo route fed by synthetic data: stat tile, signed delta, two-line history chart with shaded gap and touch scrubbing, diverging bar chart (value creators and destroyers), discount gauge/meter for fair value, step-line overlay chart, sparkline, sortable table that collapses to cards on phone, bottom sheet, toast. Choose one chart library and record why.
- Charts stay smooth with 1,500 daily points on a phone.

## Acceptance
- `/kit` looks right at 390px and 1280px in light and dark. Screenshot both with Playwright and look at them before finishing.
- `npm run check` passes.

## Out of scope
Real data, real screens, API calls.
