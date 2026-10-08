# Task 02 - M1 format and parser
**Model:** Opus. **Read:** CLAUDE.md, `private/README.md`, SPEC sections 3 and 10.

## Before starting, ask the user to
Download the activity CSV for **each** M1 account and save them in `private/m1/`. On the web: open the account under Invest, go to Activity, and use the download option (labelled "Activity Summary" or "Download CSV"). On iPhone: Settings, Accounts, the three dots beside the account, "Download CSV file". Also ask them to download the Holdings CSV per account if offered. If history comes back shorter than the account's life, ask them to try date ranges year by year, then to request older history from M1 support.

## Goal
Turn real M1 exports into the normalized `transactions` shape.

## Deliverables
- `docs/M1_FORMAT.md`: the real column names, every distinct activity type found and how each maps to `buy`/`sell`/`dividend`/`split`/dropped, date format, sign conventions, how reinvested dividends, splits, transfers and fractional shares appear, and how far back each file goes. Use invented example rows only.
- `src/engine/m1/parse.ts`: CSV text + account label in, normalized transactions + list of unrecognized rows out. Unknown row types are reported, never silently dropped. Stable `source_row_hash` per row so re-importing overlapping files does not duplicate.
- Holdings CSV parser if that file exists (ticker, shares) for reconciliation.
- Synthetic fixtures in `tests/fixtures/m1/` covering every row type found, plus tests.
- A local script `npm run m1:summary` that prints, for the real files, counts by type and date range per account and the unrecognized rows. Output to terminal only.

## Acceptance
- Tests pass. The summary script runs on all real files with zero unrecognized rows, or each remaining one is listed in PROGRESS.md with a proposed handling.
- `git diff --cached` contains no real amounts, account numbers or file contents.

## Out of scope
UI, database, prices, split math.
