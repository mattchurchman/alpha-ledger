# Task 15 - Real-data validation
**Model:** Opus. **Read:** CLAUDE.md, SPEC sections 4, 5, 6; `docs/ENGINE_API.md`; PROGRESS.md open issues.

## Goal
Confirm the numbers are right on the real portfolio before the user relies on them.

## Steps (work with the user; keep real numbers out of git and PROGRESS.md)
1. Reconciliation: every current holding matches M1's share count. Resolve each mismatch (missed split, spinoff, transfer, rename) with an alias or `adjust`.
2. Portfolio value matches M1's holdings total at the same price date, within rounding.
3. Pick three tickers (one simple, one with a split, one fully sold). Recompute invested, returned, shadow value and value added by hand in a scratch script under `private/` and compare with the app.
4. Total dividends per year match M1's tax documents approximately.
5. Sanity: sum of per-ticker value added equals the portfolio gap; tickers with missing prices are listed, not silently valued at zero.
6. Turn any bug found into a synthetic regression test, then fix it.

## Deliverables
- Fixes plus regression tests. A short "Known limitations" section added to the in-app "How this is calculated" sheet.
- PROGRESS.md entry stating which checks passed, described without amounts.

## Out of scope
New features, redesigns.
