# Task 35 - Real full re-import from scratch, and owner acceptance (supersedes 25c)

**Model:** Opus. **Effort:** high. **Context budget:** ~100k.
**Runs on:** **owner's computer.** Needs `private/m1/<account>.csv` for **every** account (fresh
full exports) and `private/export.json` of the deployed ledger (25a "Owner step B").
**Read:** `docs/REV3_ASSESSMENT.md` "Still open", `tasks/25c-real-data-close-out.md` (Part A and
B), `private/triage.md`, `private/validation.md`, task 34 handoff.

## Owner step (before the agent starts)
Export full activity for every account from M1 into `private/m1/`, and the live ledger into
`private/export.json`. Run `git status` - nothing from `private/` may appear.

## Steps
1. **Zero-touch test.** Against an empty local D1 (`wrangler dev`), import every real CSV through
   the task 32 planner. Count what lands in `needsYou` and `proposals`. Target: proposals only
   for genuinely ambiguous rows, nothing else. Record which G2 path each cash-out took (CUSIP vs
   delisting fit) - this settles the assessment's unverified assumption. No amounts in git.
2. **Diff against the live ledger.** Compare the from-scratch result with `private/export.json`:
   every transaction difference is explained (a hand fix the planner now makes by itself, or a
   hand fix the planner should make - that becomes a regression test with a synthetic row).
   The alias hop gets exercised here; note how.
3. **Owner acceptance, 25c Part A** - the owner drives, the agent records: share counts on
   Reconcile vs M1, portfolio total vs M1, value added sums to the gap. Then 25c Part B items 1,
   2, 4, 5 (item 3 was settled by task 34).
4. Mark 15, 25 and 25c done in the status tables; add a superseded note to 25c's queue row.

## Out of scope
Deploying (task 40), UI changes beyond bug fixes the run exposes.

## Acceptance
`npm run check` passes; handoff states the step-1 counts and Part A results as the owner
reported them - no amounts, no tickers paired with amounts.

**Next:** tasks/36-brand-palette.md on Opus (effort medium) - budget ~70k.
