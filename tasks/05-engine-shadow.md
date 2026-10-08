# Task 05 - Engine: VOO shadow, returns, attribution
**Model:** Opus. **Read:** CLAUDE.md, SPEC sections 5 and 6; `src/engine/holdings.ts` exports only (grep for `export`).

## Goal
The benchmark math that the whole app exists for.

## Deliverables
- `shadow.ts`: per-ticker VOO bucket value on any day using the adjusted-close ratio rule in SPEC 5; portfolio shadow = sum of buckets.
- `returns.ts`: IRR by bisection with the "show a dash" rules; value added in dollars; percent difference rule.
- `series.ts`: daily portfolio value, shadow value and gap from first transaction to last price date; same per ticker.
- `decisions.ts`: per-buy outcome versus VOO with first-in-first-out matching of sells.
- `index.ts`: one `analyze(transactions, prices, aliases)` returning everything the UI needs, typed. Document the return type in `docs/ENGINE_API.md` (short).
- Tests with hand-computed values: single buy; buy then sell everything (closed position still has value added); dividends paid out; negative bucket; non-trading-day trade; two tickers where selling A funds B nets to zero shadow flow; invariant test that sum of per-ticker value added equals portfolio value added.

## Acceptance
- `npm run check` passes, including the invariant test.
- `analyze` on 6 years x 60 tickers of synthetic data runs in under 1 second in Node.

## Out of scope
Fair value, UI, storage, fetching.
