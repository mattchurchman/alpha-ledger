# Task 20 - Watchlist
**Model:** Sonnet. **Next:** `tasks/21-rebuy-visuals.md` on Sonnet.
**Read:** CLAUDE.md, `docs/SPEC.md` sections 7 and 8, `src/routes/FairValues.tsx`, the rebuy block of `src/routes/Dashboard.tsx`, `src/data/PortfolioData.tsx`.

## Goal
Track tickers the user does not own yet, with a fair value and a discount, next to the ones they do.

## Deliverables
- Storage: a `watchlist` JSON array of upper-case tickers in the `meta` table via `/api/meta`. No migration. Confirm export and restore carry it.
- "Watch a ticker" control on Fair values: validates the symbol by fetching its price history, then adds it. Remove is one tap.
- Update market data also fetches watchlist tickers (the list is built in `PortfolioData.tsx` from `tickersEverHeld`).
- **One synced list.** Fair values and Rebuy opportunities both show held tickers plus watched ones, from one shared pure helper with tests. Watched rows carry a "Watching" badge in words, not colour alone.
- Watched tickers never reach `analyze`, Holdings, portfolio totals or the creators chart.
- Stock detail for a watched ticker with no transactions: price chart, fair-value history and editor, and a plain "Not held yet" state where the measures would be.
- When a watched ticker is bought it shows once, as a holding. Hidden tickers (task 18) stay hidden.
- SPEC: section 7 and section 9 gain the watchlist; add a Decision log entry. Update the Fair values section of Help.

## Acceptance
- Tests for the merge helper: held only, watched only, both, hidden.
- With `npx wrangler dev`: add a ticker, Update, set a fair value, see it ranked on the Dashboard with its badge.
- `npm run check` passes.

## Out of scope
Price alerts, notes or news per ticker, automatic fair values, any scheduled fetch.
