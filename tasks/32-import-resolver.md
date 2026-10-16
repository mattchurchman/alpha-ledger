# Task 32 - Import resolver: turn the real-data findings into rules

**Model:** Opus. **Effort:** high. **Context budget:** ~120k.
**Runs on:** anywhere (synthetic data only).
**Read:** `docs/REV3_ASSESSMENT.md` (all - it is the spec for this task), `docs/M1_FORMAT.md`
sections "Transaction types", "Splits", "Dedupe", "CASH", "Decisions"; `src/engine/m1/parse.ts`;
the exports of `src/engine/holdings.ts` and `src/engine/defunct.ts` (signatures only - Grep
`^export`); SPEC sections 3 and 4.

## Goal
A pure engine function that takes a full M1 export and the current ledger and returns an
**import plan**: what is new, what is already in, what was fixed automatically and why, and the
few things that need one tap - each with its evidence. Gaps G1, G2, G3, G4 and G7 from the
assessment. No UI, no API in this task.

## Steps
1. **Fixtures first.** Add `tests/fixtures/m1/full-export-v1.csv` and `full-export-v2.csv`
   (synthetic, unfetchable `ZZ*` tickers per task 29). v2 = v1 + ~50 newer rows and must contain
   every known shape: auto-invest identical rows, a `PRESPLITZZAB` pair with a matching split in
   a synthetic price fixture, a `CASH` row **with** a Security Id matching a held ticker's CUSIP,
   a `CASH` row **without** one whose ticker fits only by delisting, an ambiguous `CASH` row (two
   candidates), a transfer in kind, a dotted share-class ticker. Write the expected plan as
   tests before the code; confirm they fail.
2. `src/engine/m1/resolve.ts`, pure, Decimal throughout:
   `planImport({ parsed, accountLabel?, ledger, prices, aliases, ignoredHashes })` →
   `{ accountLabel: {value, inferred, evidence}, fresh[], duplicates: number, autoFixed[],
   proposals[], ignored[], needsYou[] }`.
   - **G7 account:** if no label is given, pick the existing account whose hashes overlap the
     file most (require a clear majority of the file's mappable rows); else `needsYou`.
     Remember the hash includes the label - recompute hashes per candidate label to test overlap.
   - **G1 placeholder:** symbol fails `TICKER_PATTERN` and strips to a ticker with a split event
     within 10 days of the row → `autoFixed` (dropped, reason cites the split). Otherwise `needsYou`.
   - **G2 cash-out:** CUSIP match → `autoFixed`; unique delisting fit (prices end within 15
     trading days before the row; cash ÷ ledger shares within 20% of last close) → `proposals`;
     else `needsYou` listing the candidates. The built `sell` uses `closeOutPlan` from
     `defunct.ts`, shares = the ledger's full open position on that date, amount = the row,
     `source: 'm1'`, `source_row_hash` = the CASH row's hash, note naming the M1 description.
   - **G3 in-kind:** valid symbol + units → `proposals` with the `adjust` built from the row.
   - **G4:** any row whose hash is in `ignoredHashes` or already in the ledger is never
     re-surfaced.
   Thresholds are named constants with a comment saying what each defends against.
3. Every `autoFixed`/`proposals` entry carries a one-line human `evidence` string (e.g. "CUSIP
   matches 14 earlier ZZAB rows"). The UI in task 34 shows it verbatim.
4. Re-run plan on v2 after "saving" v1's plan results into the ledger: **zero** `proposals` and
   `needsYou` must come back for v1's rows. This is the test of the whole rev.
5. SPEC Decision log: the refined rule - "the import never invents a ticker or share count; it
   applies a fix only from evidence in the data, and ties each fix to its source row hash".
   Update M1_FORMAT "CASH" and "Splits" to point at the resolver.

## Out of scope
UI, Worker/API changes, D1 migrations (task 33), real data, new transaction types.

## Acceptance
`npm run check` passes. Handoff lists each shape → bucket for v2, and the step-4 re-run result.

**Next:** tasks/33-import-persistence.md on Sonnet (effort medium) - budget ~60k.
