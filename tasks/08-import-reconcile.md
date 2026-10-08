# Task 08 - Import and reconciliation screens
**Model:** Sonnet. **Read:** CLAUDE.md, SPEC sections 4 and 9 (items 4, 5); `docs/DESIGN.md`; `docs/M1_FORMAT.md`; `src/api/` and `src/engine/m1/` exports.

## Goal
Get six years of history in from a phone or a computer, and trust it.

## Deliverables
- Import screen: pick several CSV files, label each with an account name, preview counts by type and date range, show unrecognized rows, show how many are new versus already imported, confirm to save.
- Activity screen: list with filters, add/edit/exclude/delete, manual `adjust` entry.
- Reconciliation: enter or upload actual share counts, list mismatches with the transactions for that ticker and a one-tap "add adjustment" fix.
- Alias editor in Settings.

## Acceptance
- Importing the same file twice adds nothing the second time.
- Works at 390px. `npm run check` passes. Tested with synthetic fixtures only.

## Out of scope
Prices, analysis views, fair value.

## You do
Import your real files on the deployed site and note any mismatches for task 15.
