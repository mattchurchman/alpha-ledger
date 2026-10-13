# Task 25b - Validate the engine against the real ledger

**Model:** Opus. **Effort:** high. **Context budget:** ~120k.
**Must run on the owner's computer.**
**Read:** `tasks/QUEUE.md`, `tasks/15-validation.md` (steps 1-3, 5, 6), SPEC sections 4-6,
`docs/ENGINE_API.md`, `private/triage.md`. Do not read rev-1 PROGRESS entries.

## Gate
`ls private/export.json private/m1/holdings.txt`. Either missing: stop and print 25a's Owner step B.
If `private/recompute.check.ts` is missing, rebuild it from `private/README.md`'s description first
(fresh arithmetic from SPEC 4-6; import nothing from `src/engine/` but `analyze`).

## Do - task 15 steps 1, 2, 3, 5, 6
1. Reconcile: engine share counts vs `private/m1/holdings.txt`. Resolve each mismatch with an alias
   or `adjust`, recording the cause.
2. Portfolio value vs M1's total at the same price date, within rounding (owner supplies the total).
3. Run the harness on three tickers (simple, split, fully sold), then on the whole ledger. Pass = 0
   difference on every figure.
5. Per-ticker value added sums to the portfolio gap; unpriced holdings are listed, not zeroed.
6. Every bug becomes a synthetic regression test, then a fix in `src/engine/`.
Keep a running results table in `private/validation.md`. If you approach the budget, stop after the
current step, hand off, and let 25b run again - do not compact.

## Out of scope
Dividends vs tax documents (25c), UI copy, new features.

## Acceptance
`npm run check` passes; handoff lists each check as pass / fail-fixed / open - no amounts.

**Next:** tasks/25c-real-data-close-out.md on Sonnet (effort medium).
