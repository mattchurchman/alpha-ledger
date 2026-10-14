# Task 25c - Owner acceptance against M1, dividends check, close out validation

**Model:** Sonnet. **Effort:** medium. **Context budget:** ~50k.
**Must run on the owner's computer.**
**Read:** `private/validation.md`, the 25b handoff entry, `src/routes/HowCalculated.tsx` (Known
limitations block, ~line 57), the Import and Reconcile sections of `src/routes/Help.tsx`.

## Gate
25b's handoff must show checks 3 and 6 as pass or fail-fixed. If either is open, stop.
Part A below is the **owner's** work in the running app, not the agent's - the agent's job there
is to prepare the checklist, read back what the owner reports, and act on it.

## Part A - owner acceptance in the app (owner drives, agent records)
Added 2026-10-13 when 25b was rescoped; see the Decision log entry of that date. These compare
the engine to M1, so M1 has to be the authority - an agent deriving them from the same CSV the
engine reads would be grading the engine against itself.

1. **Share counts.** Import each account's CSV, tap **Update market data** (reconciling before
   prices load treats every split as 1:1), then open Reconcile and type in M1's current share
   count per holding. Expect no mismatches outside section 4's 0.001 tolerance. Each one that
   appears: resolve with an alias or an `adjust` from the close-out sheet, and tell the agent the
   cause - a cause that turns out to be an engine bug goes back to 25b as a regression test.
2. **Portfolio total.** Dashboard value vs M1's own total at the same price date, within rounding.
3. **Value added adds up.** Per-ticker value added sums to the portfolio gap, and unpriced
   holdings are listed as unpriced rather than counted as zero.
4. The merger cash-outs listed in `private/triage.md` have share counts back-derived from
   amount ÷ deal price. Confirm each against M1's transaction detail before entering the
   `sell`/`adjust`, or check 1 will chase differences that are artifacts of a guess.

## Part B - agent work
1. Task 15 step 4: dividends per year from the engine vs M1's tax documents (owner supplies the
   1099-DIV totals per year). Approximate match is the pass.
2. Delete the first "Known limitations" bullet ("The math has not been checked against a real
   export yet"). Re-check the remaining bullets are still true - and only delete it if Part A
   actually happened, since that bullet is about exactly this.
3. Decide the reconcile-before-Update case: add a one-line warning on Reconcile when no prices are
   loaded, or record in SPEC Decision log why not. Part A step 1 depends on the owner remembering
   this unaided, which is the argument for the warning.
4. Re-read Help's Import and Reconcile sections against what 25a/25b/Part A actually saw; correct
   them.
5. Mark 15 and 25 done in PROGRESS.md status tables.

## Acceptance
`npm run check` passes; deploy (`npm run build && npx wrangler deploy`) only if the owner says so.
Handoff records Part A's result as the owner reported it - no amounts.

**Next:** none - the backlog is empty. Remaining items are owner-only (docs/REMAINING_WORK.md, "Not tasks").
