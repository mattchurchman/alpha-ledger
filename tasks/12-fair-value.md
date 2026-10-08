# Task 12 - Fair value and history
**Model:** Sonnet. **Read:** CLAUDE.md, SPEC section 7; `docs/DESIGN.md`; `src/api/` fair-value client.

## Goal
Fast entry of my own estimates, and a record of how they changed against price.

## Deliverables
- `src/engine/fairValue.ts` + tests: current estimate per ticker, discount, zone, split-adjusted history for charting.
- Fair values screen: all holdings in one list, tap to enter a new value with optional note and date (default today); saving always adds a history row.
- History on stock detail: price line with fair-value step line, a marker per change showing value, date and note; list of past estimates with delete for mistakes (confirm first).
- Dashboard rebuy ranking and holdings table now use this module.

## Acceptance
- Changing an estimate four times shows four steps and four list rows; the earlier ones are unchanged in the database.
- An estimate made before a split is drawn at the split-adjusted level. Entry is comfortable one-handed at 390px. `npm run check` passes.

## Out of scope
Any computed or suggested fair value.
