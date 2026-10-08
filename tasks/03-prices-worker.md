# Task 03 - Price worker and first deploy
**Model:** Sonnet. **Read:** CLAUDE.md, SPEC sections 2 and 8.

## Goal
Prove free price data works from the deployed Worker, early, because the design depends on it.

## Deliverables
- `GET /api/prices/:ticker?from=YYYY-MM-DD` in the Worker: one outbound call to Yahoo's v8 chart endpoint (daily interval, events for dividends and splits), returns `{dates, close, adjClose, splits, dividends, asOf}`. Sensible errors for unknown ticker, rate limit, upstream change.
- `src/engine/prices/types.ts` and a parser for the Yahoo payload with tests on a saved sample response (public market data is fine to commit).
- First deploy with `wrangler deploy` to a workers.dev address. This endpoint returns only public data, but leave a TODO that task 06 puts it behind login.
- `docs/PRICES.md`: what was verified, observed limits, and the manual fallback format (CSV of date, close, adj close).

## Acceptance
- From the deployed URL: VOO and three stocks return 6+ years of history; a ticker with a known split (for example NVDA or GOOGL) returns the split event; a bogus ticker returns a clean 404.
- If Yahoo blocks the Worker, stop and report options to the user. Do not switch to a paid or keyed source without asking.

## Out of scope
Storing prices, any UI, auth.

## You do
Create a free Cloudflare account and run `npx wrangler login` when the agent asks.
