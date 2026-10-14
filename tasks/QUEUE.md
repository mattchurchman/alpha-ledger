# Task queue - what is left, in order

The single source of truth for "what do I run next". Each row is one session: `/clear` between rows.
Context budget = expected peak tokens for the whole session (standing reads + work). If a session
passes the budget, finish the current step, write the handoff, and stop rather than compacting.

| Order | Task file | Model | Effort | Context budget | Where it must run | Blocked on |
|---|---|---|---|---|---|---|
| 1 | `tasks/28-kit-code-split.md` | Sonnet | low | ~45k | anywhere | done 2026-10-12 |
| 2 | `tasks/29-reseed-fixtures.md` | Haiku | low | ~35k | anywhere | done 2026-10-12 |
| 3 | `tasks/30-dated-manual-price.md` | Sonnet | medium | ~60k | anywhere | done 2026-10-13 |
| 4 | `tasks/31-polish-tail.md` | Haiku | low | ~45k | anywhere | done 2026-10-13 |
| 5 | `tasks/25a-real-data-intake.md` | Sonnet | medium | ~60k | **owner's computer** | done 2026-10-13 (one account) |
| 6 | `tasks/25b-real-data-validate.md` | Opus | high | ~120k | **owner's computer** | **parked** - needs a CSV in `private/m1/` |
| 7 | `tasks/25c-real-data-close-out.md` | Sonnet | medium | ~50k | **owner's computer** | 25b done, and Part A is the owner's |

Rows 1-5 are done. Rows 6-7 are the real-data validation (old task 15/25), and **nothing else is
queued** - if both are parked, the agent backlog is empty and the remaining work is the owner's
(`docs/REMAINING_WORK.md`, "Not tasks"). Do not invent a row to fill the gap; say the queue is empty.

25b was parked on 2026-10-13: the owner withdrew the one CSV mid-session, which is their call -
real holdings are the thing the app exists to keep private. It also got rescoped the same day,
because three of its five steps were owner acceptance work misfiled as agent work. See the
2026-10-13 Decision log entry in `docs/SPEC.md`, and the note below.

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
