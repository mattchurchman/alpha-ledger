# Task 34 - Import screen v2: drop the export, approve, done

**Model:** Opus. **Effort:** medium. **Context budget:** ~100k.
**Runs on:** anywhere.
**Read:** `docs/REV3_ASSESSMENT.md` (gaps table), task 32 and 33 handoffs, `src/routes/Import.tsx`,
`src/data/marketData.ts` (the Update flow's public function only), `docs/DESIGN.md` sections 3
and 5.6, the Import and Reconcile sections of `src/routes/Help.tsx`.

## Goal
The owner's whole routine becomes: export from M1 → pick the files → glance → **Import** → done.

## Steps
1. Replace the parse preview with the task 32 plan. One summary line per file: "48 new · 2,310
   already in · 3 fixed automatically · 1 needs you". Account label shown as inferred with its
   evidence and editable; only a genuinely new account asks.
2. **Fixed automatically** - collapsed list, each with its evidence line. **Needs you** - expanded,
   each with Accept / Choose (candidates) / Ignore. Ignore writes the hash (task 33). Import is
   enabled when nothing is left in Needs you; Ignore counts as handled.
3. After the bulk post succeeds, run Update market data automatically (gap G5), then show a
   **health summary** card: unpriced holdings, delisted candidates (`delistedCandidates`), split
   disagreements (`crossCheckSplits`), and a "Reconcile with M1" button. Each line links to the
   existing fix (close-out sheet, alias, reconcile). Empty summary says so plainly.
4. Drop the reconcile-before-Update warning idea from 25c B3: record in SPEC Decision log that
   the import now orders it.
5. Rewrite Help's Import and Reconcile sections to describe this flow.
6. Mobile first: check 390px with `npm run screenshots` (add the Import screen with the v2
   fixture to the shooter if it is not there).

## Out of scope
Engine rule changes (send them back as a task-32 follow-up), visual facelift (tasks 36-39),
dashboard.

## Acceptance
`npm run check` passes. A manual run in `wrangler dev`: import v1, then v2 - the second import
needs only the taps v2's ambiguous rows require, and a third import of v2 needs none. Record it.

**Next:** tasks/35-real-reimport.md on Opus (effort high) - budget ~100k. Owner's computer.
If the owner is away from it, run 36-39 first; 35 has no dependents.
