# Task 04 - Engine: holdings reconstruction
**Model:** Opus. **Read:** CLAUDE.md, SPEC sections 3, 4, 6; `docs/M1_FORMAT.md`; `src/engine/prices/types.ts`.

## Goal
From transactions and price data, know exactly what was held on any day.

## Deliverables (all in `src/engine/`, pure functions, decimal.js)
- `holdings.ts`: split-adjust transactions to today's terms using Yahoo split events; apply ticker aliases; shares per ticker per day; average-cost basis; realized, unrealized and dividend gain per ticker; invested and returned totals.
- `reconcile.ts`: compare reconstructed shares with supplied actual shares; return mismatches over 0.001.
- `calendar.ts`: trading-day helpers (next trading day from a price series).
- Tests with hand-computed expected values: fractional buys, partial and full sells, re-entry after full exit, a 20-for-1 split mid-holding, a reverse split, dividend with and without reinvestment, alias rename, same ticker across two accounts.

## Acceptance
- `npm run check` passes. Every case above has a test whose expected numbers are worked out in a comment.
- Cross-check: the M1 `split` rows from the user's real data (if any) agree with Yahoo's split events for those tickers; report disagreements in PROGRESS.md without real amounts.

## Out of scope
VOO shadow, IRR, UI, storage.
