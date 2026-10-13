# Task queue - what is left, in order

The single source of truth for "what do I run next". Each row is one session: `/clear` between rows.
Context budget = expected peak tokens for the whole session (standing reads + work). If a session
passes the budget, finish the current step, write the handoff, and stop rather than compacting.

| Order | Task file | Model | Effort | Context budget | Where it must run | Blocked on |
|---|---|---|---|---|---|---|
| 1 | `tasks/28-kit-code-split.md` | Sonnet | low | ~45k | anywhere | done 2026-10-12 |
| 2 | `tasks/29-reseed-fixtures.md` | Haiku | low | ~35k | anywhere | - |
| 3 | `tasks/30-dated-manual-price.md` | Sonnet | medium | ~60k | anywhere | - |
| 4 | `tasks/31-polish-tail.md` | Haiku | low | ~45k | anywhere | - |
| 5 | `tasks/25a-real-data-intake.md` | Sonnet | medium | ~60k | **owner's computer** | owner step A |
| 6 | `tasks/25b-real-data-validate.md` | Opus | high | ~120k | **owner's computer** | owner step B |
| 7 | `tasks/25c-real-data-close-out.md` | Sonnet | medium | ~50k | **owner's computer** | 25b done |

Row 1 is done; rows 2-4 are independent; any order works. Rows 5-7 are the real-data validation (old task 15/25)
split into three so no single session has to hold the whole ledger plus the engine in context.

## What "real data" means (read this before 25a-c)

Agents have been saying "needs real data" without saying what. It is exactly these, and none of
them is ever in git - which is why an agent working from a fresh clone (cloud session, new
machine) will **never** find them and must stop rather than guess:

| Thing | Path on the owner's computer | How it gets there |
|---|---|---|
| M1 activity CSVs, one per account | `private/m1/<account-label>.csv` | Owner downloads from M1 (Activity > export) and saves them there |
| M1 current share counts per holding | typed into the app's Reconcile screen | Owner reads them off M1's Holdings page |
| Export bundle of the live ledger | `private/export.json` | `curl` from the deployed app - see 25a "Owner step B" |
| Login cookie for that curl | `private/cookie.txt` | One `curl` against `/api/session` - see 25a |
| Recompute harness | `private/recompute.check.ts`, `private/vitest.config.ts` | Built by task 15 on the owner's machine; 25b rebuilds it if missing |

Anything imported through the deployed app's Import screen is stored in the Cloudflare D1
database `alpha-ledger-db` (bound in `wrangler.jsonc`), behind the `AUTH_TOKEN` gate. It is not in
the repo and not in `private/` until someone exports it.
