# Task 25b - Check the engine's arithmetic against the spec

**Model:** Opus. **Effort:** high. **Context budget:** ~120k.
**Must run on the owner's computer.**
**Read:** `tasks/QUEUE.md`, `tasks/15-validation.md` (steps 3, 6), SPEC sections 4-6,
`docs/ENGINE_API.md`, `private/triage.md`. Do not read rev-1 PROGRESS entries.

> **Rescoped 2026-10-13 (owner decided).** This task used to also reconcile against M1's own
> share counts and portfolio total (old steps 1, 2, 5). Those compare the engine to an outside
> authority, which the owner does on the Reconcile screen in the finished app - that screen
> exists and is tested. They are now an acceptance checklist in 25c. What is left here is the
> half an agent can actually do: engine versus a fresh reading of the spec. See the 2026-10-13
> Decision log entry in `docs/SPEC.md`.

## Gate
`ls private/m1/*.csv`. None present: stop and print 25a's Owner step A - without transactions
there is nothing to run the engine over. `private/export.json` is **not** required; see Prices.

If `private/recompute.check.ts` is missing, rebuild it from `private/README.md`'s description
first (fresh arithmetic from SPEC 4-6; import nothing from `src/engine/` but `analyze`).

## Prices
The harness needs transactions and price history. Either source works:

- `private/export.json` from the deployed app (25a's owner step B), which also carries the
  aliases and fair values the app resolved - the better bundle when it exists.
- `node private/build-bundle.ts`, which parses the CSVs with the app's own parser and fetches
  Yahoo with the Worker's own URL and parser, writing `private/export.local.json`. It has **no
  aliases and no fair values**, so a renamed or defunct ticker will not hop. A mismatch there is
  the bundle's gap, not an engine bug - read that script's header before chasing one.

## Do - task 15 steps 3 and 6
3. Run the harness on three tickers (simple, split, fully sold), then on the whole ledger. Pass =
   0 difference on every figure.
   ```
   BUNDLE=private/export.local.json TICKERS=AAA,BBB,CCC \
     npx vitest run --config private/vitest.config.ts
   ```
6. Every difference becomes a synthetic regression test under `src/engine/` **first**, then a fix.
   That order: the test must fail before the fix lands, or it is pinning nothing.

Keep a running results table in `private/validation.md`. If you approach the budget, stop after
the current step, hand off, and let 25b run again - do not compact.

## Out of scope
Anything needing M1 as the authority: share-count reconciliation, portfolio total, per-ticker
value added summing to the gap (all 25c). Dividends vs tax documents (25c), UI copy, new features.

## Acceptance
`npm run check` passes; handoff lists each check as pass / fail-fixed / open - no amounts, and
no ticker-with-amount pairs.

**Next:** tasks/25c-real-data-close-out.md on Sonnet (effort medium).
