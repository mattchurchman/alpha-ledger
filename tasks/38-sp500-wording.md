# Task 38 - Say "S&P 500" where the owner reads it

**Model:** Haiku. **Effort:** low. **Context budget:** ~40k.
**Runs on:** anywhere.
**Read:** only the files Grep finds. Do not read PROGRESS.md entries.

## Decision (owner, 2026-10-15)
"S&P 500" is the common name; VOO is how the app buys it. User-facing text says **S&P 500**. The
method is still VOO, so the explanation keeps it: first mention on How it's calculated and in
Help reads "the S&P 500 (VOO, bought with the same dollars on the same dates)".

## Steps
1. `Grep -n "VOO" src/routes src/ui` (~90 hits). Change **visible strings only** - labels,
   headings, legends, aria-labels, Help prose. Leave identifiers, engine/API names, comments,
   test names and the ticker in data alone.
2. Charts: series legend "S&P 500". Signed deltas: "vs S&P 500".
3. SPEC Decision log: one line recording the wording decision.

## Out of scope
Any engine, API or variable renames. Any layout change.

## Acceptance
`npm run check` passes; handoff lists files touched and confirms `Grep "VOO" src/routes src/ui`
now hits only identifiers, comments and the How-calculated/Help method lines.

**Next:** tasks/39-dashboard-facelift.md on Opus (effort high) - budget ~100k.
