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
| 03 | Price worker and first deploy | Sonnet | done |
| 04 | Engine: holdings reconstruction | Opus | done |
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

## Task 03 - Price worker and first deploy - 2026-10-08 - Sonnet
Status: done
Built:
- `GET /api/prices/:ticker?from=YYYY-MM-DD` in `worker/prices.ts`, wired into `worker/index.ts`. Calls Yahoo's v8 chart endpoint with `period1`/`period2` (from `from` to now) and a browser `User-Agent` header, returns `{dates, close, adjClose, splits, dividends, asOf}`.
- `src/engine/prices/types.ts` (`PriceHistory`, `PriceSplitEvent`, `PriceDividendEvent`) and `src/engine/prices/parseYahooChart.ts`: pure parser from raw Yahoo JSON to `PriceHistory`, throwing `YahooUpstreamError` with a `kind` (`not-found` | `rate-limited` | `bad-shape`) the Worker maps to an HTTP status.
- `src/engine/prices/parseYahooChart.test.ts` (7 tests) against saved real Yahoo responses in `tests/fixtures/prices/` (`voo_with_dividend.json`, `nvda_with_split.json`, `unknown_ticker.json` - all public market data, fine to commit) plus hand-built malformed-shape cases.
- `docs/PRICES.md`: response shape, what was verified against the live deployment, observed Yahoo behavior, and the manual-CSV fallback format.
- First deploy: `npx wrangler deploy` → `https://alpha-ledger.alpha-ledger.workers.dev`.
Decisions:
- **Created the real D1 database early** (`wrangler d1 create alpha-ledger-db`, real id now in `wrangler.jsonc`) because `wrangler deploy` hard-fails on a placeholder `database_id` - there's no way to do this task's "first deploy" deliverable with task 01's placeholder still in place. No schema/tables were created; that's still task 06's job. User approved both this and the deploy itself (classifier blocks deploy-shaped Bash commands by default).
- Yahoo rejects requests with no `User-Agent` at the edge (`HTTP 429`, plain-text `Edge: Too Many Requests`, on the very first request - not a real rate limit). The Worker always sends a desktop Chrome UA. Full reasoning and what's *not* yet proven (a true application-level rate limit) is in `docs/PRICES.md`.
- Daily-bar epoch timestamps are converted straight to a UTC calendar date with no timezone offset math - they're always mid-day UTC (US market open), never near a midnight boundary, so this can't land on the wrong day. See the comment in `parseYahooChart.ts`.
- `close`/`adjClose` are decimal strings rounded to 4 places to strip Yahoo's float32 rounding noise (e.g. raw `198.3699951171875` → `"198.37"`).
- Ticker validation regex is `^[A-Z][A-Z0-9.-]{0,9}$` - allows the dash in `BRK-B`-style symbols.
Verified:
- `npm run check` passes (typecheck + lint + 33 tests).
- Acceptance checks run against the **live deployed URL**, not just locally: `VOO`, `AAPL`, `MSFT`, `KO` from 2020-01-01 each return 1,701 trading days through today; `NVDA` returns both real splits (`2021-07-20` 4:1, `2024-06-10` 10:1) on the correct dates; an invented ticker that still matches the valid-ticker pattern (`ZZZZQQ`) returns a clean `404`; missing `from` and an invalid ticker character both return `400`. Yahoo did not block or rate-limit the Worker in this round.
Open issues:
- Yahoo blocking the deployed Worker outright (vs. the edge UA check, which is handled) has not been observed or tested - there was no safe way to provoke it without hammering their API. If it starts happening, the manual CSV fallback is designed and documented in `docs/PRICES.md` but not built - that's its own task.
- The D1 database now exists but is empty; task 06 still owns schema/migrations.
- No caching/storage of fetched prices - out of scope per this task, lands in task 09 (Update Market Data flow).

## Task 04 - Engine: holdings reconstruction - 2026-10-08 - Opus
Status: done
Built:
- `src/engine/types.ts`: the canonical `Transaction` and `TickerAlias` shapes (SPEC 3). `TransactionType` and `NormalizedTransaction` moved here from `m1/parse.ts`, which now imports and re-exports them - the parser's row type is just a `Transaction` with `source: 'm1'`.
- `src/engine/calendar.ts`: `nextTradingDay` / `previousTradingDay` / `isTradingDay` / `tradingDaysBetween` plus the two binary-search index helpers they share. The "calendar" is always a price series' `dates` array; no holiday table is ever modeled.
- `src/engine/holdings.ts`: `resolveTicker`, `splitFactorAfter`, `splitAdjustTransactions`, `sharesOn`, `sharesByDay`, `computeHoldings`, `crossCheckSplits`. Pure, `decimal.js`, no I/O, no UI imports.
- `src/engine/reconcile.ts`: `reconcileShares(reconstructed, actual, options)` returns every ticker off by more than 0.001, signed as `actual - reconstructed` and sorted biggest-first.
- Tests: `holdings.test.ts` (38), `reconcile.test.ts` (11), `calendar.test.ts` (18). Every case the task lists has its arithmetic worked out in a comment above the assertions.
Decisions:
- **`totalGain = realizedGain + dividendGain + unrealizedGain` is enforced as an invariant**, asserted by `expectGainIdentity` in every holding test. SPEC 6 defines total gain one way and its display split another way; they are only one number if they always agree. Two rules fall out of that: shares arriving by a positive `adjust` carry **no** basis, and shares leaving by a negative `adjust` **write their basis off as a realized loss**. Without the second rule a merger silently loses basis and the two views drift apart.
- A sell releases basis **in proportion** (`basis * sold / held`), not `avgCost * sold`, and a sell that closes the position releases all of it. A full exit therefore leaves exactly 0, not a division crumb that would read as phantom unrealized gain forever.
- **Splits apply strictly after the trade date.** Yahoo dates a split on its ex-date and its `close` series is already post-split from that day on, so a trade executed on the ex-date is in post-split shares and must not be multiplied again.
- **An alias applies to transactions dated on or before its `effective_date`**, not unconditionally. A symbol freed by a rename can be reassigned to another company; this is the only rule under which that stays separable. A stale export with old-symbol rows dated after the rename shows up as an extra ticker, which `reconcileShares` then flags - loud, not silent.
- Same-day ordering is `adjust`, `buy`, `dividend`, `sell`. M1 gives no intraday time, so this is a convention; without it a same-day round trip sells shares the walker has not added yet.
- `sharesOn`/`sharesByDay` return `Decimal`, everything else returns exact decimal **strings** at full internal precision. Rounding is the display layer's job (CLAUDE.md), so tests compare via `toFixed(2)`/`toFixed(6)` rather than pinning 20-significant-digit strings.
- `reconcileShares` treats the supplied counts as a **complete snapshot** by default, so a ticker the ledger holds but the upload omits is flagged as held-at-zero. `{ actualIsComplete: false }` is for the user correcting a few tickers by hand.
- A still-held ticker with no price lands in `missingPrices` and reads as value 0; a **closed** position with no price does not, since its realized gain is knowable without one.
- Kept `src/engine/placeholder.test.ts` (task 02 flagged it as redundant) - still not this task's call.
Verified:
- `npm run check` passes: typecheck + lint + **98 tests**.
- Every case the task names has a test: fractional buys, partial sell, full sell, re-entry after full exit, 20-for-1 mid-holding, 1-for-8 reverse, dividend with and without reinvestment, alias rename, one ticker across two accounts. Plus both `adjust` directions, as-of valuation in the past, a weekend valuation date, missing prices, portfolio totals, and the alias/split/cycle edge cases.
- All fixtures synthetic (ACME/SPLT/RVRS/OLD/NEW, round numbers). `git status` and the diff reviewed: nothing from `private/`.
Open issues:
- **The split cross-check could not be run against real data.** `private/m1/` is still empty (task 02's open issue), so there are no real M1 `split` rows to compare with Yahoo. `crossCheckSplits` is written and tested against synthetic rows; it needs one run once the real CSVs are in place. Note the M1 parser currently emits split rows as *unrecognized* rather than as `split` transactions, so feeding it real history is also what will reveal whether M1 exports split rows at all.
- The engine does not yet know about VOO - no shadow buckets, no IRR, no daily history series. That is task 05, which `sharesByDay` and `calendar.ts` were shaped to feed.
- Oversell (selling more shares than the ledger holds) produces a negative share count rather than an error. That is deliberate: `reconcileShares` is the designated place for bad data to surface, and a negative count there is unmissable.
