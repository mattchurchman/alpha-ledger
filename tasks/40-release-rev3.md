# Task 40 - Release rev 3

**Model:** Haiku. **Effort:** low. **Context budget:** ~35k.
**Runs on:** anywhere (deploy needs wrangler logged in - owner's computer if not).
**Read:** the rev 3 status table in `PROGRESS.md`, `docs/SETUP.md` deploy section.

## Gate
Tasks 32-34 and 36-39 done; the owner said yes to task 39's screenshots. Task 35 may still be
open - say so in the handoff.

## Steps
1. `npm run check && npm run build`, then `npx wrangler d1 migrations apply alpha-ledger-db
   --remote` if task 33 added any, then `npx wrangler deploy`.
2. Load the deployed app; confirm the new icon, header lockup and dashboard render.
3. Tell the owner to remove and re-add the iPhone home-screen app (icon cache).
4. Write `docs/REV3_START.md`'s "What shipped" section in five lines.

## Acceptance
Deployed version id recorded in the handoff.

**Next:** none queued - rev 3 is complete. Remaining owner items: `docs/REMAINING_WORK.md`, "Not tasks".
