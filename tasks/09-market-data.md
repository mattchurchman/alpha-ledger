# Task 09 - Update Market Data flow
**Model:** Sonnet. **Read:** CLAUDE.md, SPEC section 8; `docs/PRICES.md`; `src/api/` exports.

## Goal
One explicit button refreshes prices; nothing else ever does.

## Deliverables
- "Update market data" action (Settings and the shell indicator): fetch VOO plus every ticker ever held, one call per ticker, limited concurrency, progress count, retry once, list failures.
- Save each series to `price_history`; set `prices_last_updated`. Shell shows "Prices as of <last close>, updated <time>".
- Manual fallback: upload a price CSV for a ticker, or set a single current price. Marked as manual in the UI.
- A data hook that loads transactions + prices + aliases once, runs `analyze`, and caches the result in memory for all screens.

## Acceptance
- Network tab shows zero price requests on app load, navigation, or resume. Requests happen only after tapping Update.
- A failing ticker does not block the others. `npm run check` passes.

## Out of scope
Any analysis screen.
