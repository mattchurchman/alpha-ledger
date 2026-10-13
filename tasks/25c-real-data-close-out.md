# Task 25c - Dividends check and close out validation

**Model:** Sonnet. **Effort:** medium. **Context budget:** ~50k.
**Must run on the owner's computer.**
**Read:** `private/validation.md`, the 25b handoff entry, `src/routes/HowCalculated.tsx` (Known
limitations block, ~line 57), the Import and Reconcile sections of `src/routes/Help.tsx`.

## Gate
25b's handoff must show checks 1, 2, 3 and 5 as pass or fail-fixed. If any is open, stop.

## Do
1. Task 15 step 4: dividends per year from the engine vs M1's tax documents (owner supplies the
   1099-DIV totals per year). Approximate match is the pass.
2. Delete the first "Known limitations" bullet ("The math has not been checked against a real
   export yet"). Re-check the remaining bullets are still true.
3. Decide the reconcile-before-Update case: add a one-line warning on Reconcile when no prices are
   loaded, or record in SPEC Decision log why not.
4. Re-read Help's Import and Reconcile sections against what 25a/25b actually saw; correct them.
5. Mark 15 and 25 done in PROGRESS.md status tables.

## Acceptance
`npm run check` passes; deploy (`npm run build && npx wrangler deploy`) only if the owner says so.

**Next:** none - the backlog is empty. Remaining items are owner-only (docs/REMAINING_WORK.md, "Not tasks").
