# Task 33 - Persist import decisions so a re-import remembers them

**Model:** Sonnet. **Effort:** medium. **Context budget:** ~60k.
**Runs on:** anywhere.
**Read:** task 32's handoff entry, `src/engine/m1/resolve.ts` (types only), `worker/api/transactions.ts`,
`worker/api/meta.ts`, `worker/api/backup.ts`, `worker/validate.ts`, `src/api/client.ts`.

## Goal
The Worker accepts everything task 32's plan produces, and "ignore this row" survives export,
restore and the next import (gap G4).

## Steps
1. `POST /api/transactions/bulk` must accept resolver-built rows: `source: 'm1'` with type `sell`
   or `adjust` and a `source_row_hash` that came from a CASH or in-kind row. Check `validate.ts`
   allows them; add tests in `worker/api.test.ts` proving a second identical bulk post inserts
   nothing (the hash is the dedupe).
2. `meta` key `import_ignored_hashes` (JSON array of hashes). Add/remove through the existing meta
   endpoint; remove the key when empty (task 31's `hidden_tickers` precedent). Export and restore
   carry it - extend the existing `export and restore` test.
3. Client: `src/api/client.ts` helpers for both, with tests alongside the existing ones.

## Out of scope
Import screen UI (task 34), new tables or migrations unless step 1 proves one necessary - if so,
stop and say why first.

## Acceptance
`npm run check` passes; handoff lists the new/changed endpoints and tests.

**Next:** tasks/34-import-screen-v2.md on Opus (effort medium) - budget ~100k.
