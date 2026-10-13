# Task 25a - Real-data intake and triage

**Model:** Sonnet. **Effort:** medium. **Context budget:** ~60k.
**Must run in Claude Code on the owner's computer**, in the repo folder that holds `private/`.
**Read:** `tasks/QUEUE.md` ("What real data means"), `docs/M1_FORMAT.md`, `private/README.md`.

## Gate - check before anything else
Run `ls private/m1/*.csv`. If it lists nothing, **stop** and print Owner step A below verbatim.
Do not proceed, do not invent data, do not look elsewhere for it.

## Owner step A (the owner does this, not the agent)
1. In M1, export the full activity history for each account as CSV.
2. Save each one as `private/m1/<account-label>.csv` (e.g. `private/m1/taxable.csv`, `private/m1/roth.csv`).
   The filename becomes the account label in the app.
3. Run `git status` - the CSVs must **not** appear (they are gitignored). If they do, stop.

## Do (agent)
1. `npm run m1:summary`. It prints to the terminal only.
2. For every unrecognized row type, decide how it maps (transfer in kind, split, spinoff, rename,
   fee, other) using `docs/M1_FORMAT.md`. If M1 exports splits, note it: task 02/04 left split
   rows parsing as unrecognized, and this is what settles it.
3. Fix parser gaps the real file exposes, each with a **synthetic** fixture in `tests/fixtures/m1/`
   and a test. No real tickers-with-amounts, dates-with-amounts, or account numbers in git.
4. Write the per-row decisions (real values allowed) to `private/triage.md` - gitignored.

## Then print Owner step B verbatim and stop
1. In the deployed app: Import each CSV, then tap **Update market data** (reconciling before
   prices load silently treats every split factor as 1).
2. Get a login cookie and export the ledger (replace TOKEN with your AUTH_TOKEN):
   ```
   URL=https://alpha-ledger.alpha-ledger.workers.dev
   curl -s -c private/cookie.txt -H 'Content-Type: application/json' -d '{"token":"TOKEN"}' "$URL/api/session"
   curl -s -b private/cookie.txt "$URL/api/export" > private/export.json
   ```
3. Write M1's current share count per holding into `private/m1/holdings.txt` (`TICKER shares` per line).

## Acceptance
`npm run check` passes; `git status` shows nothing under `private/`; handoff entry (no amounts)
lists row types found and how each maps.

**Next:** tasks/25b-real-data-validate.md on Opus (effort high) - after owner step B.
