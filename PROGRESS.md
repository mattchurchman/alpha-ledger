# Progress log

Each agent appends one entry at the bottom when its task is done. Keep entries short; the next agent reads this file first.

## Entry format
```
## Task NN - name - YYYY-MM-DD - model used
Status: done | partial (say what is left)
Built: 3-6 bullets, file paths included
Decisions: anything the next agent must know that is not in SPEC
Verified: which acceptance checks were run and passed
Open issues: bugs, shortcuts, things the user must do by hand
```

## Task status
| # | Task | Model | Status |
|---|------|-------|--------|
| 01 | Scaffold | Sonnet | done |
| 02 | M1 format and parser | Opus | partial |
| 03 | Price worker and first deploy | Sonnet | todo |
| 04 | Engine: holdings reconstruction | Opus | todo |
| 05 | Engine: VOO shadow, returns, attribution | Opus | todo |
| 06 | Database, API, login | Sonnet | todo |
| 07 | Design system and app shell | Opus | todo |
| 08 | Import and reconciliation screens | Sonnet | todo |
| 09 | Update Market Data flow | Sonnet | todo |
| 10 | Dashboard | Sonnet | todo |
| 11 | Stock detail and decisions | Sonnet | todo |
| 12 | Fair value and history | Sonnet | todo |
| 13 | Installable app and iPhone icon | Haiku | todo |
| 14 | Privacy and cost audit | Sonnet | todo |
| 15 | Real-data validation | Opus | todo |

## Entries

## Task 01 - Scaffold - 2026-10-08 - Sonnet
Status: done
Built:
- Vite + React + TS app in `src/`, Tailwind v4 (`@tailwindcss/vite`), React Router with empty routes for all six SPEC 9 screens (`src/routes/*.tsx`, wired in `src/App.tsx`).
- Vitest configured via `vite.config.ts`; `src/engine/placeholder.test.ts` exercises `decimal.js`.
- `worker/index.ts`: Cloudflare Worker serving built assets via the `ASSETS` binding and answering `GET /api/health`; `wrangler.jsonc` has a D1 binding placeholder (`database_id` is a dummy UUID, real id comes in task 06).
- ESLint (flat config, typescript-eslint) + Prettier; `npm run check` = typecheck + lint + test.
- Three project-reference tsconfigs (`app` for `src/`, `node` for vite/eslint config, `worker` for `worker/`) since the worker runs without DOM lib/types.
- `CLAUDE.md` Commands section filled in.
Decisions:
- Pinned `typescript` to `~6.0.3` instead of the newly-released 7.x: `typescript-eslint@8.71.1` only supports `typescript <6.1.0`. Revisit the pin once typescript-eslint catches up.
- Used Tailwind v4's Vite plugin (CSS-first, no `tailwind.config.js`) since v4 is current and this avoids extra config for a deliverable that's explicitly "styling beyond defaults" out of scope.
- `npm install` flagged `esbuild` and `workerd` postinstall scripts for approval (npm 11 install-scripts gate); approved both since wrangler/vite need their native binaries. Recorded in `package.json`'s `allowScripts`.
Verified:
- `npm run check` passes (typecheck + lint + test).
- `npm run dev` serves the routed shell; all six routes return 200 and render their placeholder screen.
- `npm run build` succeeds; `npx wrangler dev` serves the built `dist/` at `/` (200) and `GET /api/health` returns `{"status":"ok"}`.
- `git status` shows nothing from `private/` or `dist/`.
Open issues:
- `wrangler.jsonc` D1 `database_id` is a placeholder; task 06 must run `wrangler d1 create` and fill in the real id.
- No real styling, logic, or deploy yet - all explicitly out of scope for this task.

## Task 02 - M1 format and parser - 2026-10-08 - Opus
Status: partial. The parser, docs, fixtures, tests and summary script are done, but the acceptance check "summary script runs on all real files with zero unrecognized rows" has NOT been run against real data - `private/m1/` is still empty. See Open issues.
Built:
- `docs/M1_FORMAT.md`: columns, date format, sign conventions, the type-to-`transactions` mapping, dedupe design and decisions. All example rows invented.
- `src/engine/m1/parse.ts`: `parseM1Activity(csvText, accountLabel)` returns `{ transactions, dropped, unrecognized }`. Pure, synchronous, no I/O. Includes its own RFC-4180 CSV reader (quoted commas, `""`, BOM, CRLF) so there is no dependency.
- `src/engine/m1/parse.test.ts` (25 tests) + synthetic fixtures in `tests/fixtures/m1/` covering every observed type, the unrecognized cases, identical auto-invest rows and an overlapping export.
- `scripts/m1-summary.ts` + `npm run m1:summary`: prints per-account counts by type, date range, dropped-cash counts and the full raw text of unrecognized rows. Terminal only, reads `private/m1/*.csv`, filename becomes the account label.
- Config: `.gitignore` now un-ignores `tests/fixtures/**/*.csv` (the blanket `*.csv` rule was hiding them); `tsconfig.node.json` and `eslint.config.js` extended to cover `scripts/`.
Decisions (detail and reasoning in `docs/M1_FORMAT.md`):
- Observed types: `PURCHASED`->`buy`, `SOLD`->`sell`, `DIVIDEND`->`dividend`. `TRANSFER`/`FEE`/`OTHER` with `Unit Type` `CURRENCY` are dropped as cash per SPEC 3.
- **`Unit Type` is the cash-vs-securities discriminator, not an empty `Symbol`.** This is what separates a transfer *in kind* (reported, needs an `adjust`) from a cash transfer (dropped).
- **`OTHER` is only dropped when its description reads as interest.** It is a grab-bag type; the sample had securities-lending interest, but a spinoff could land there too, so anything else is reported rather than discarded.
- No split row appeared in the sample. None is needed: SPEC 4 makes Yahoo the sole split source. If one shows up it becomes an unrecognized row, which is the correct, loud outcome.
- Reinvested dividends need no special handling - M1 already emits a `DIVIDEND` row plus a `PURCHASED` row, exactly the shape SPEC 3 asks for.
- `shares` and `amount_usd` leave the parser as **exact decimal strings**, not numbers, so no precision is lost before the engine wraps them in `Decimal`. `amount_usd` is always positive; `type` carries direction.
- `Date` becomes `trade_date`; `Posted Date` is ignored (they differ on some dividend rows, and SPEC 3 has no column for it). `Unit Price` is ignored too - it is display-rounded and does not reconcile against `Amount`/`Units`.
- `source_row_hash` is FNV-1a 64-bit (synchronous; Web Crypto's digest is async and SPEC 2 wants a sync browser engine) over `m1` + account label + the raw source columns + an **occurrence index**. The index exists because M1 auto-invest emits byte-identical rows that are genuinely separate transactions; a content-only hash would silently merge them. It is order-independent, so overlapping exports dedupe correctly.
Verified:
- `npm run check` passes (typecheck + lint + 26 tests).
- Parsed the user's real 8-row sample out-of-tree: 5 transactions kept, 3 cash rows dropped, **zero unrecognized**; fractional shares, the negative-amount sale and the `$1,000.00` quoted-comma amount all came through correctly.
- `npm run m1:summary` verified two ways: with `private/m1/` absent (prints instructions) and against copies of the synthetic fixtures (correct per-account counts, date ranges and unrecognized triage output).
- `git diff --cached` grepped for every ticker, CUSIP and dollar value in the user's sample: clean. An earlier draft had reused a few real figures in the doc and fixtures; those were replaced with invented ones.
Open issues:
- **The user must drop the real activity CSVs into `private/m1/`** (one per account, filename = account label) and run `npm run m1:summary`. Until then, the type list in `docs/M1_FORMAT.md` reflects one sample, not full history. Expect unrecognized rows from older history - splits, transfers in kind, corporate actions - each of which needs a mapping decision.
- **Holdings CSV parser not written.** No holdings export was supplied and M1's columns for it are unknown, so writing one would mean inventing a header layout. Deferred rather than guessed; SPEC 4 reconciliation also accepts manually entered share counts, so nothing is blocked.
- `src/engine/placeholder.test.ts` from task 01 is now redundant (real engine tests exist). Left in place - deleting it was not this task's call.
