# Task queue - what is left, in order

The single source of truth for "what do I run next". Each row is one session: `/clear` between rows.
Context budget = expected peak tokens for the whole session (standing reads + work). If a session
passes the budget, finish the current step, write the handoff, and stop rather than compacting.

| Order | Task file | Model | Effort | Context budget | Where it must run | Blocked on |
|---|---|---|---|---|---|---|
| 1 | `tasks/32-import-resolver.md` | Opus | high | ~120k | anywhere | - |
| 2 | `tasks/33-import-persistence.md` | Sonnet | medium | ~60k | anywhere | 32 |
| 3 | `tasks/34-import-screen-v2.md` | Opus | medium | ~100k | anywhere | 33 |
| 4 | `tasks/35-real-reimport.md` | Opus | high | ~100k | **owner's computer** | 34, and fresh CSVs for every account |
| 5 | `tasks/36-brand-palette.md` | Opus | medium | ~70k | anywhere | - |
| 6 | `tasks/37-brand-assets.md` | Sonnet | low | ~45k | anywhere | 36 |
| 7 | `tasks/38-sp500-wording.md` | Haiku | low | ~40k | anywhere | - |
| 8 | `tasks/39-dashboard-facelift.md` | Opus | high | ~100k | anywhere | 36, 38 |
| 9 | `tasks/40-release-rev3.md` | Haiku | low | ~35k | anywhere | 32-34, 36-39, owner's yes on 39 |

Rev 3 (2026-10-15). Why each task exists: `docs/REV3_ASSESSMENT.md`. Rows 5-8 do not depend on
1-4, so if the owner is away from their computer when row 4 comes up, run 5-8 first.

Rev 2 rows 1-6 (tasks 25a-31) are done. Rev 2 row 7, `tasks/25c-real-data-close-out.md`, is
**superseded by task 35**, which runs its Part A right after a from-scratch real re-import - do
not run 25c on its own.

## What "real data" means (read this before 25a-c)

Agents have been saying "needs real data" without saying what. It is exactly these, and none of
them is ever in git - which is why an agent working from a fresh clone (cloud session, new
machine) will **never** find them and must stop rather than guess:

| Thing | Path on the owner's computer | How it gets there | Who needs it |
|---|---|---|---|
| M1 activity CSVs, one per account | `private/m1/<account-label>.csv` | Owner downloads from M1 (Activity > export) and saves them there | **agent** - 25b has nothing to run without one |
| M1 current share counts per holding | typed into the app's Reconcile screen | Owner reads them off M1's Holdings page | **owner only** - never a file for an agent |
| M1's portfolio total, and 1099-DIV totals | owner reads them out when 25c asks | M1's Holdings page / tax documents | **owner only** |
| Export bundle of the live ledger | `private/export.json` | `curl` from the deployed app - see 25a "Owner step B" | agent, optional - `private/build-bundle.ts` makes a thinner one from the CSVs |
| Login cookie for that curl | `private/cookie.txt` | One `curl` against `/api/session` - see 25a | only if exporting |
| Recompute harness | `private/recompute.check.ts`, `private/vitest.config.ts` | Built by task 15 on the owner's machine; 25b rebuilds it if missing | agent |

The "owner only" rows are deliberate, not an oversight to be tidied away by writing them into a
file. They are what the engine is **graded against**; an agent that derives them from the same
CSV the engine reads has graded the engine against itself and proved nothing. An earlier draft of
25b asked for a `private/m1/holdings.txt` - that file should not exist, and this table always said
so.

Anything imported through the deployed app's Import screen is stored in the Cloudflare D1
database `alpha-ledger-db` (bound in `wrangler.jsonc`), behind the `AUTH_TOKEN` gate. It is not in
the repo and not in `private/` until someone exports it.
