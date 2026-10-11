# Task 19 - Per-account drill-down
**Model:** Opus. **Next:** `tasks/20-watchlist.md` on Sonnet.
**Read:** CLAUDE.md, `docs/SPEC.md` sections 4 to 6, `docs/ENGINE_API.md`, `src/data/PortfolioData.tsx`, `src/routes/Dashboard.tsx`.

## Goal
The summed view stays the default; the user can switch the whole dashboard to one account.

## Background
Every transaction carries `account_label`. `PortfolioData.tsx` runs `analyze` once over all of them. `analyze` is pure, so one account is the same call on a filtered ledger with the same prices.

## Deliverables
- Account switcher at the top of the Dashboard: "All accounts" plus one entry per label. Hidden when there is only one account. The choice lives in the URL (`?account=`) so back and refresh keep it.
- A memoised per-account `analyze` result in the data layer; "All accounts" keeps using the existing one. No UI arithmetic.
- Every dashboard section follows the selection: headline, history, rebuy, holdings, creators.
- An account comparison strip under the headline in the "All" view: one row per account with value and value added vs VOO; tap to switch.
- Stock detail keeps the selected account when opened from a filtered dashboard, and shows how the position's shares split across accounts.
- SPEC 4 says cost basis is averaged across all accounts. In a single-account view it is that account's own average. Record this in the Decision log and in `HowCalculated.tsx`.
- Fair values stay per ticker, not per account.
- Update the Dashboard section of Help.

## Acceptance
- Engine or data-layer test on the synthetic fixture: the per-account values and shadow values sum to the all-accounts figures.
- 390px screenshot of the switcher and the comparison strip.
- `npm run check` passes.

## Out of scope
Renaming or merging accounts, per-account fair values, tax lots.
