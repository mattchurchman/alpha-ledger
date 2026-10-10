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
| 05 | Engine: VOO shadow, returns, attribution | Opus | done |
| 06 | Database, API, login | Opus | done |
| 07 | Design system and app shell | Opus | done |
| 08 | Import and reconciliation screens | Sonnet | done |
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

## Task 05 - Engine: VOO shadow, returns, attribution - 2026-10-08 - Opus
Status: done
Built:
- `src/engine/shadow.ts`: the per-ticker VOO buckets. Flows are built from the cash side of each transaction (`buy` buys VOO, `sell` and `dividend` sell it, `split`/`adjust` do nothing), priced on the next benchmark trading day. `shadowBucketsOn`, `shadowTotalOn`, `shadowUnitsByDay`, `benchmarkGrowth`, plus `shadowCoverageWarnings` for flows the benchmark series does not reach.
- `src/engine/returns.ts`: `annualizedIrr` by bisection, `irrWithFinalValue`, `shadowIrr`, `valueAdded`, `percentDifference`, `cashFlows`. Every "show a dash" rule in SPEC 6 is a `null` return.
- `src/engine/series.ts`: `dailySeries(input, ticker?)` - `dates`, `value`, `shadow`, `gap` from the first transaction to `asOf`, portfolio-wide or for one ticker.
- `src/engine/decisions.ts`: `buyDecisions(input, ticker)` - per-buy outcome vs VOO with FIFO sell matching, including per-exit detail.
- `src/engine/index.ts`: `analyze(input)` returning `portfolio`, `byTicker`, `series`, `missingPrices`, `warnings` and a reusable `context`; `tickerSeries(result, ticker)` and `tickerDecisions(result, ticker)` serve the detail screen from that context. `docs/ENGINE_API.md` documents the whole return shape.
- Tests: `shadow.test.ts` (24), `returns.test.ts` (18), `series.test.ts` (8), `decisions.test.ts` (10), `index.test.ts` (18, incl. two performance checks). Shared synthetic fixtures in `src/engine/__fixtures__/synthetic.ts`.
Decisions:
- **Buckets are carried as "units" (`amount / adj(pricingDate)`), recomputed on every call, never stored.** SPEC 5 forbids storing shadow share counts because Yahoo restates adjusted closes after each dividend. Bucket value is then `adj(d) * sum(units)`, which is SPEC's `f * adj(d) / adj(i)` summed, and makes a daily series one multiplication per day instead of a re-sum.
- A flow's **pricing day**, not its trade date, decides which bucket days it counts toward. A weekend trade priced on Monday is simply not in Friday's bucket.
- **IRR is computed in `number`, not `Decimal`** - the one place in the engine that is. The bisection needs fractional powers thousands of times; `Decimal.pow` would make the dashboard crawl, and float64 carries ~15 significant digits into a figure displayed to four. The cash flows themselves stay exact.
- IRR brackets the root in `(-99.99%, 1e9]` and returns **null** if there is none, rather than reporting the bracket edge. Consequence worth knowing before task 10: a big gain over a few days annualizes to a genuine but absurd number (millions of percent), and anything past 1e9 reads as a dash. The display has to clamp or abbreviate; the engine will not lie about it.
- **The per-buy view compares each part to its own end point** - a sold slice against VOO from the buy date to the *sell* date, the unsold remainder to `asOf`. Measuring a slice sold years ago against VOO held until today would compare two different bets.
- **Dividends are deliberately absent from the per-buy view**, so per-buy value added does not sum to the ticker's figure for a ticker that paid one. Allocating dividends across lots is a policy SPEC does not define; inventing one would have been a redesign. Flagged in `docs/ENGINE_API.md` and at the top of `decisions.ts`.
- FIFO lives only in `decisions.ts`; `holdings.ts` keeps average cost. Nothing from the decision view feeds a total, so the two never mix. `adjust`-in shares join the FIFO queue as zero-cost lots (or a later sell would match the wrong lot) but are never reported as buys.
- Daily series values are **rounded to cents** - the one deliberate exception to CLAUDE.md's "round only at display". A chart point is a display artifact, six years is ~1,500 points per line, and `gap` is derived from the rounded lines so the three agree exactly on screen. Headline numbers never pass through here.
- `analyze` includes the portfolio series by default (the dashboard needs it) and takes `includeSeries: false` for screens that do not; per-ticker series and decisions are on demand per SPEC 6, reusing `result.context` so no screen re-resolves aliases or rebuilds flows.
- Adjusted closes are memoized per `PriceHistory` object in a `WeakMap` (`adjSeries`). Assumes a `PriceHistory` handed to the engine is not mutated afterwards.
- `MissingBenchmarkError` uses a declared field rather than a constructor parameter property, matching `YahooUpstreamError`: node's strip-only TypeScript mode (what runs `scripts/*.ts`) rejects parameter properties outright. Found by trying it.
- `benchmark` is a parameter defaulting to `VOO` rather than a hardcoded string, which is what let the "a pick that tracks the benchmark exactly" tests be written.
Verified:
- `npm run check` passes: typecheck + lint + **176 tests** (98 of them from earlier tasks, all still green).
- Every case the task lists has a hand-computed test: single buy, buy-then-sell-everything (closed position still has value added), dividends paid out, negative bucket, non-trading-day trade, selling A to fund B netting to zero shadow flow, and the invariant that per-ticker value added sums to the portfolio figure (asserted to 10 dp, alongside the same for shadow value and current value).
- Performance: `analyze` on 6 years x 60 tickers (1,566 trading days, 5,580 transactions) runs in **~410ms** in Node - ~125ms for `analyze` itself, the rest the portfolio daily series. One ticker's series plus decisions is ~13ms. The test asserts under 1,000ms.
- Extra invariant proved by fixture design: `BETA` is exactly half the benchmark's price on every day, so every buy of it must come out at zero value added, at the ticker level and per buy. It does.
- All fixtures synthetic (ACME/BETA/SYNnn, round numbers, invented dates). `git status` and the full diff reviewed: nothing from `private/`, no real ticker, amount or position anywhere.
Open issues:
- **The engine has never run on real data.** `private/m1/` is still empty (open since task 02), so the whole comparison is proved only against synthetic fixtures. Task 15 is where this gets settled.
- ~410ms in Node means roughly 1-3s on a phone for a 60-ticker portfolio, almost all of it the daily series. Levers if task 10 finds the dashboard sluggish: `includeSeries: false` plus a lazily-loaded chart, or thinning the series to weekly points beyond the last year. Not optimized now - a real M1 account is likelier 10-30 tickers.
- `shadowCoverageWarnings` returns one entry per flow, so a ledger that starts before the fetched VOO history will produce hundreds. Task 09 should fetch VOO from the first transaction date onward (which makes the warning rare), and task 10 should group these before showing them.
- Oversell in `decisions.ts` silently drops the excess shares, matching the holdings engine's stance that `reconcileShares` is where bad share counts surface.
- `src/engine/placeholder.test.ts` is still there, still redundant; tasks 02 and 04 both declined to delete it and so does this one.


## Task 06 - Database, API, login - 2026-10-08 - Opus
Status: done. Deployed and verified against the live URL. One note for whoever does task 14: the app shell is intentionally public now - see Decisions.
Built:
- `migrations/0001_init.sql`: the five SPEC 3 tables with CHECK constraints on `type`/`source`/`excluded`, `source_row_hash` UNIQUE, three indexes. Applied to **both** databases (`--local` and `--remote`), each verified by listing `sqlite_master`.
- `worker/auth.ts`: the gate. One 256-bit `AUTH_TOKEN` secret, compared as a fixed-length SHA-256 digest, exchanged at `POST /api/session` for a signed HttpOnly `SameSite=Strict` cookie good for a year. `worker/api/session.ts` has unlock / sign-out / whoami.
- `worker/index.ts`: gates **every** `/api/*` route, `/api/health` and `/api/prices/*` included. Only `POST`/`DELETE /api/session` sit outside the gate, since they are what create and destroy a session.
- `worker/api/`: `transactions.ts` (list with ticker/account/type filters, create, bulk upsert, patch, exclude, delete), `aliases.ts`, `fairValues.ts`, `priceHistory.ts`, `meta.ts`, `backup.ts` (full JSON export + restore). `worker/validate.ts` is the single place untrusted JSON becomes a typed row.
- `src/api/types.ts` + `src/api/client.ts`: one set of wire types imported by both sides, and a typed client whose `NotAuthenticatedError` is distinct from `ApiError` so a lapsed session shows the unlock screen instead of an error.
- `src/AuthGate.tsx`: the unlock screen, wrapping the whole app. `src/routes/Debug.tsx` at `/debug` is the temporary page the task's "Out of scope" line allows; it exists so the two-device sync check is doable on a phone.
- `docs/SETUP.md`: why not Access, the one-command token generation, the deploy, every verification command, local dev, and a symptom/cause table.
Decisions:
- **Cloudflare Access was dropped, by the user's decision.** Its price is genuinely $0 for one user (confirmed first, as SPEC 2 required), but Zero Trust onboarding demands a payment method on file before an application can be created, which the user ruled a breach of the free-only rule. So SPEC 2's stop-and-ask condition fired one step later than written: the pricing page cleared the price, the signup flow revealed the card. Full reasoning and sources in `docs/SETUP.md` section 0 and the SPEC Decision log.
- **Login is one 256-bit random token, and there is deliberately no password hashing.** A slow KDF exists to make guessing a human-chosen password expensive, and at safe iteration counts it would blow the free plan's ~10ms CPU budget (SPEC 2). 256 random bits are not guessable at any request rate, so a fast fixed-length comparison is the correct tool. **Consequence for later tasks: the credential must stay a generated token and must never become a memorable password**, or the fast comparison stops being safe.
- **The cookie-signing key is derived from the token** (`SHA-256("alpha-ledger/session-key/v1\0" + token)`), not kept as a second secret. One secret is one thing to set, and rotating the token therefore signs every device out - that is the revocation mechanism, and there is no session table to keep.
- **The HMAC is verified before the payload is parsed**, so a forged cookie with a far-future expiry is rejected on the signature and its `exp` is never read. There is a test for exactly that swap.
- **`SameSite=Strict` is what stands in for a CSRF token** - the cookie never rides a cross-site request. `Secure` is omitted only on localhost, where `wrangler dev` serves plain HTTP and the browser would otherwise discard the cookie.
- **The app shell is now public.** This is the one real loss versus Access, which gated the hostname at Cloudflare's edge before any code ran; an in-Worker gate cannot. `index.html` and its JS carry no personal data and every byte of ledger data goes through gated `/api/*`, so this was judged acceptable - but it is a change to SPEC 10 and **task 14's privacy audit should confirm it still holds** once the real screens exist.
- No rate limiting on the unlock route, and none needed at 256 bits; a counter would cost storage and CPU the engine needs.
- **Money and shares are TEXT columns.** Exact decimal strings from parser to D1 to engine; REAL is a float64 and would round a fractional share or a cent. A test asserts `0.123456789` round-trips.
- **Bulk import inserts new hashes and leaves existing rows untouched** (`ON CONFLICT DO NOTHING`). Re-importing an overlapping M1 export must not undo an edit or an exclusion the user has made, and the hash already identifies the row. `skipped` is the dedupe count the Import screen shows; there is a test that an excluded, edited row survives re-import.
- **Restore replaces all five tables**, inside one `db.batch()` (one D1 transaction), and validates the entire bundle **before** issuing any DELETE - so a malformed bundle cannot empty the database. Merging two ledgers is not attempted: ids would collide and hash dedupe would silently drop rows. Export carries row ids so a restore reproduces the database rather than renumbering it.
- `price_history.series_json` stores `{dates, close, adjClose}` only; `asOf` is **derived** from the last date on read, the way `parseYahooChart` computes it, so a stored copy could only disagree. A PUT replaces the row rather than merging, because Yahoo restates adjusted closes after every dividend and mixing two vintages would mix two scales.
- Route tests call the Worker's default export **directly** with a spread-and-modified `env` rather than through `SELF`, which is what makes the signed-out cases testable - each case hands the handler a different secret set.
- **The Workers test pool had to be swapped.** `@cloudflare/vitest-pool-workers` is deprecated and its last version peers on `vitest ^4.1.0` while this repo is on 5. The successor `@cloudflare/vitest-plugin@1.4.0` peers on `^4.1.0 || ^5.0.0`, so **vitest stays at 5**. Its API is a Vite plugin (`cloudflareTest(...)`), not `defineWorkersConfig`.
- Vitest now runs **two projects** (`vitest.engine.config.ts` in node for `src/`, `vitest.worker.config.ts` in workerd for `worker/`), referenced from `vite.config.ts`. The engine project carries the React plugin already, so task 07's component tests need no config change.
- `jose` was added for Access JWT verification and **removed again** when Access was dropped; the token gate needs only WebCrypto. Dependencies are back to what task 05 had plus the test plugin.
- Touched two task-03 lines: `worker/prices.ts` now imports the shared `TICKER_PATTERN` instead of redeclaring it, and its `TODO(task 06)` about the route being ungated is gone - it is gated now.
Verified:
- `npm run check` passes: typecheck + lint + **276 tests** (176 from earlier tasks, all still green).
- Worker tests run **inside workerd against a real local D1**, so the CHECK constraints and the UNIQUE dedupe are exercised for real. Covered: the gate (401 with nothing, 403 wrong token, 403 with no token configured, `/api/health` gated, shell ungated), the unlock flow (cookie issued, cookie opens the data routes, wrong token issues no cookie, sign-out expires it), full CRUD on all five tables, decimal-string fidelity, every validation rejection, bulk upsert including a 250-row batch spanning chunks, and an export/restore round trip asserted equal field-for-field.
- `auth.test.ts` covers the crypto specifically: tampered signature, **payload swapped for an unexpired one**, cookie signed with a previous token, expired session, malformed cookies, whitespace-trimmed secrets, the blank-secret trap (`AUTH_TOKEN="   "` must not be satisfiable by `"   "`), and that only the exact string `true` bypasses.
- `npm run test` passes both **with and without** `.dev.vars` present, so a clean checkout behaves the same.
- **Verified against the live deployment**, version `e945db61`: signed out, `/api/transactions`, `/api/export`, `/api/health` and `/api/prices/VOO` all return `401 missing-credentials`; a wrong bearer token and a wrong unlock both return `403 invalid-token` and the unlock sets no cookie; the real token returns 200. The full browser path was exercised with a cookie jar - unlock, `{"authenticated":true}`, list, **write a row to the remote D1**, sign out, 401 again - and the `Set-Cookie` header is `Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`. The smoke row was deleted afterwards; `/api/export` confirms all five tables empty.
- Before this task the live hostname served task 03's ungated code: `/api/health` and `/api/prices/VOO` answered anyone. Both are now gated.
- Privacy: `git grep` for the owner's email, for `gmail`, and for the token finds nothing; `.dev.vars` is untracked; the only deployed secret is `AUTH_TOKEN` (`wrangler secret list`), and the `OWNER_EMAIL` secret from the Access attempt was deleted. Every fixture is synthetic (ACME/BETA/OLD/NEW, `example.test`, round numbers).
Open issues:
- **The user holds the only copy of `AUTH_TOKEN`.** There is no recovery path by design - losing it means running the step 2 command in `docs/SETUP.md` again to set a new one. The data in D1 is untouched either way.
- **The app shell is publicly readable** (placeholder screens plus `/debug`, whose API calls all 401). No data is exposed, but task 14 should confirm this is still acceptable once the real screens exist and decide whether the `/debug` route should be gone by then.
- `src/routes/Debug.tsx` and its nav link are temporary and should be deleted once the Activity screen can create and delete transactions. Both are commented as such.
- No price caching or Update Market Data flow - the `/api/price-history` routes exist but nothing calls them yet. That is task 09.
- `src/engine/placeholder.test.ts` is still there, still redundant. Tasks 02, 04 and 05 all declined to delete it; so does this one.


## Task 07 - Design system and app shell - 2026-10-09 - Opus
Status: done. `/kit` screenshotted at 390px and 1280px in both themes and reviewed; `npm run check` passes.
Built:
- `docs/DESIGN.md`: the whole system - direction, tokens, type scale, spacing, motion, number formatting, the chart kit, an accessibility checklist, and the validator runs behind every colour claim. It is the file later tasks should read instead of guessing.
- `src/index.css`: three-scope token system (`:root` light, `prefers-color-scheme` guarded by `:not([data-theme='light'])`, `[data-theme='dark']`) exposed to Tailwind through `@theme inline`. **No `dark:` variant appears anywhere in component code** - that is what `inline` buys. Geist + Geist Mono bundled via `@fontsource-variable` (SIL OFL 1.1); nothing is fetched at runtime.
- `src/ui/format.ts` (+34 tests): money, exact money, compact, axis, percent, signed, shares, dates, relative time. `null` renders `—`, never `$0`.
- `src/ui/charts/geometry.ts` (+33 tests): scales, nice ticks, line/step/area builders, min-max decimation, binary-search nearest index, `gapRuns`, `thin`. No chart library - see Decisions.
- The kit in `src/ui/`: `StatTile`, `SignedDelta`, `HistoryChart`, `DivergingBars`, `DiscountMeter`, `StepLineChart`, `Sparkline`, `DataTable`, `BottomSheet`, `Toast`, `ChartFrame`, `EmptyState`/`Skeleton`/`StatusBadge`/`PricesAsOfBadge`, `Card`/`Button`/`Legend`, hand-written `icons.tsx`. One barrel: screens import from `../ui`.
- `src/ui/AppShell.tsx`: bottom tab bar on a phone, 232px side rail from 768px, safe-area insets (`viewport-fit=cover` added to `index.html`), the "prices as of" slot, and a system/light/dark toggle persisted in `localStorage` with a pre-paint stamp in `index.html`.
- `src/routes/Kit.tsx` + `src/kit/synthetic.ts`: the `/kit` demo, 1,566 synthetic daily points from a seeded generator.
- `scripts/screenshots.ts` + `npm run screenshots`: four full-page PNGs of `/kit` into gitignored `screenshots/`, failing on any console error or failed request.
Decisions:
- **No chart library.** Recharts is ~450 KB and one React element per point (1,500 points x 2 lines is the phone budget this task exists to protect); visx is d3-in-React, so over `geometry.ts` it only adds scales and shapes for ~40 KB and a second idiom; uPlot and Chart.js are canvas, which costs the DOM nodes that make the charts accessible and the CSS custom properties that make theming free. Hand-rolled SVG on a tested geometry module adds **0 KB of runtime dependencies** and made the gap-band split, the touch crosshair and the annotated step line ~20 lines each. Full comparison in DESIGN.md 5.1. Revisit past ~20k points; nothing on the roadmap goes there.
- **Beat VOO is blue, trailed VOO is red - deliberately not green/red.** Measured at our surfaces with the dataviz validator: green↔red is ΔE 7.2 under protanopia (inside the 6-8 warn band), blue↔red is 21.6 light / 19.2 dark. Sign is additionally carried by a ▲/▼ glyph and an explicit `+`/`−`, so colour is never load-bearing alone.
- **VOO is graphite, not a second hue.** It is the benchmark, so it is drawn as a reference mark. This knowingly departs from the chroma floor; the alternative was worse, because the obvious second hue is orange and orange↔red fails both floors (ΔE 5.6 CVD / 7.1 normal) - an orange VOO line would be confusable with the red "behind" fill it sits inside. Legend, direct end labels, the readout and the table view all carry the identity.
- **The fair-value line is green**, the only remaining hue that clears every all-pairs gate in both modes beside blue and red. Its one warn (green↔red, light) is a pair that never shares a chart. Green is never used for a delta or a direction anywhere - if a later task needs "good green", that is a token to add, not this one to reuse.
- **Engine values are decimal strings**, so every component takes `string | number | null | undefined` and coerces at the display edge. Charts parse once in a `useMemo`.
- **1,500 points stay smooth** via min-max decimation to the pixel-column count (1,566 -> ~700 at 390px, extremes preserved exactly), memoised paths (a scrub re-renders only the crosshair), and one path per line rather than per point.
- **The scrub readout lives at the top of the card, not in a floating tooltip** - on a phone a bubble lands under your thumb. Fixed min-height, so nothing reflows while dragging. `touch-action: pan-y` on the hit rect: a vertical drag still scrolls the page.
- **`DataTable` collapses to cards by CSS, not a resize listener** - a measured width is wrong for one frame on every load, and a holdings table that reflows after paint looks broken.
- **`/kit` sits outside the auth gate** so a headless browser can open it; it makes no API call and holds nothing real. SPEC 10 already accepts a public shell. **Task 14 should decide whether it ships in the production bundle.**
- `src/ui/zones.ts` is SPEC 7's "thresholds are constants in one file". **Task 12 should import from there**, or move the file into the engine and update the import - not restate the numbers.
- `Card` renders a `div`, not a `section`: a page of twelve unlabelled `<section>`s is worse for a screen reader than none.
- `DivergingBars` is HTML rows, not SVG - each row is then natively focusable and selectable, and the 2px surface gap comes from row padding.
- The gap band is filled at 15% rather than the spec's ~10%: at 10% it vanished against the warm surface, and this band *is* the headline number drawn to scale.
- Task 06's `/debug` link is now a header link rather than a sixth tab, so it stays reachable on a phone (which is what it exists for) and still dies with one deletion.
Verified:
- `npm run check` passes: typecheck + lint + **346 tests** (276 from earlier tasks, all still green; 70 new across `format` and `geometry`).
- `gapRuns` is tested on the cases that actually bite: no crossing, identical lines, a crossing interpolated to the exact fraction (0.75, not the midpoint), a touch that flips the sign, a touch that does not, six alternating crossings asserted to hand each run's last index to the next so the band has no gaps, and leading equality.
- `decimate` is tested to keep a spike on index 137 that no uniform stride would land on.
- Screenshots reviewed at 390px and 1280px in light and dark, plus per-section crops at 390px. Four real defects were found that way and fixed: colliding x-axis dates at 390px (the middle label is now dropped below a 320px plot), `$0.00` and `$250.00` axis ticks (new `moneyAxis`), end labels sitting on top of their own lines (a `paint-order` surface halo), and a dark-mode skeleton that was invisible against the surface.
- Privacy: `git status` and the full diff reviewed. Every number in `src/kit/synthetic.ts` is invented (ACME/BRIK/CNDL…, a seeded LCG, round dates); `screenshots/` is gitignored; no personal data, no secrets, nothing from `private/`.
- Build output: 324 KB JS (100 KB gzipped) and 31 KB CSS, plus 29 KB + 23 KB of latin-subset woff2. Fontsource ships one `@font-face` per unicode subset, so only latin is downloaded.
Open issues:
- **`npm run format` reformats the whole repo**, including documents and worker files earlier tasks wrote without it. It churned 19 unrelated files here and they were reverted. Either run Prettier on the paths you touched, or let one task reformat everything deliberately and commit that on its own.
- `/favicon.ico` 404s - there is no icon set yet. That is **task 13**'s deliverable; the screenshot script ignores that one URL by name.
- `/kit` and `src/kit/synthetic.ts` are in the production bundle. Harmless (no API calls, nothing real) but task 14 should decide.
- No component tests: that would need jsdom and testing-library, and the task's acceptance is the screenshots. The pure modules under the components are covered.
- The side rail is 232px and content caps at `max-w-4xl`; above ~1400px the page is mostly margin. Deliberate (it is a reading-width app), but task 10 may want a wider dashboard grid.
- `src/engine/placeholder.test.ts` is still there, still redundant. Tasks 02, 04, 05 and 06 all declined to delete it; so does this one.

## Task 08 - Import and reconciliation screens - 2026-10-09 - Sonnet
Status: done. `npm run check` passes; manually exercised end to end against `wrangler dev` with the synthetic fixtures and screenshotted at 390px/1280px.
Built:
- `src/routes/Import.tsx`: one screen, two tabs (plain state, no route). **Import**: pick one or more CSV files, each gets an editable account-label field (defaults from the filename), live preview per file (counts by type, date range, new-vs-already-imported, unrecognized rows in a `<details>`, dropped-cash count) computed against the existing ledger's hashes **and** against earlier files in the same pick (so picking the same file twice in one go is caught before confirming, not just on the server). Confirm sends everything to `api.transactions.bulkUpsert` and lets the server's `ON CONFLICT DO NOTHING` be the actual source of truth. **Reconcile**: type in or CSV-upload `ticker,shares` rows, a `actualIsComplete` checkbox (SPEC 4 / `reconcileShares`'s own option), "Check reconciliation" runs `splitAdjustTransactions` + `sharesOn` (today, no prices - this task is out of scope for prices, so splits are not applied; see Decisions) through `reconcileShares`, lists mismatches sorted worst-first, a "Transactions" button loads that ticker's rows inline, and "Add adjustment" opens a form **pre-filled** with `type: adjust` and `shares` set to the mismatch's signed `difference` - the exact fix SPEC 4 describes.
- `src/routes/Activity.tsx`: full list (fetched once, filtered client-side by ticker/account/type - the dataset is one person's trades, not worth round-tripping per filter), add/edit via a shared form, exclude/include as a one-tap toggle, delete behind an inline confirm/cancel (no `window.confirm` - alert dialogs are disallowed for this kind of automation-adjacent UI and a blocking native dialog is worse on a phone anyway). Excluded rows are shown (struck through), not filtered out, matching `listTransactions`'s own comment about why the API returns them.
- `src/routes/TransactionForm.tsx`: the add/edit form, shared by Activity (create/edit) and Import's Reconcile tab (quick adjustment). Takes plain strings and hands them back on submit; the caller decides `TransactionInput` vs `TransactionPatch` since only it knows which. Per-type hint text under Shares explains when it's required, optional, or (for `adjust`) signed.
- `src/routes/Settings.tsx`: alias editor (list, add, remove) via `api.aliases`. The rest of the screen is a one-line placeholder; market data, manual prices, export/restore and "how this is calculated" are later tasks' deliverables per SPEC 9.
- `src/ui/primitives.tsx`: added `TextField`, `Select`, `Checkbox` - the kit had `Button`/`Card`/etc. but no form inputs, and four screens in this task needed consistent ones. Styled from the same tokens as `DataTable`'s own `<select>`.
- Deleted `src/routes/Debug.tsx` and its two nav links (`AppShell`'s `showDebugLink` prop and the `/debug` route in `App.tsx`), per task 06's note: it existed only until Activity could create/delete transactions, which it now can. Updated the two-device sync check in `docs/SETUP.md` section 4 to use Activity instead.
Decisions:
- **Reconciliation does not split-adjust.** `splitAdjustTransactions` is called with `prices: {}`, so every split factor is 1. This task's "Out of scope" line excludes prices entirely, and no stored price history exists yet (task 09 owns fetching and storing it) - there is nothing to split-adjust against. SPEC 4 also notes no split row has been observed in the user's real data yet. If this bites before task 09 lands, it will show up as a reconciliation mismatch, which is the correct, visible failure mode rather than a silently wrong number.
- **The Import screen sends every parsed transaction to `bulkUpsert`, not just the ones it thinks are new.** The client-side new/already-imported count is a preview for the user, not a filter; the server's `source_row_hash` UNIQUE constraint is the only thing that has to be right for "import the same file twice" to be a no-op, and it already was (task 06). Verified by hand: importing `tests/fixtures/m1/activity-all-types.csv` twice gave "3 new" then "0 new · 3 already in your ledger", and the Worker's bulk result was `inserted: 3, skipped: 0` then `inserted: 0, skipped: 3`.
- **"Add adjustment" account defaults to blank, not the ticker's existing account**, because a reconciliation gap can span accounts and picking one would be a guess; the account field's `<datalist>` (built from every account label already in the ledger) makes it a one-tap pick anyway.
- **No `window.confirm`.** Delete goes through an inline "Delete" -> "Confirm delete / Cancel" state swap on the row itself instead. Same reasoning the harness gives for avoiding native dialogs in automated browser control applies to a PWA generally: a blocking modal is a worse mobile pattern than an inline affordance, and it means one less edge case for `BottomSheet`'s own focus handling to interact with.
- **`DataTable`'s cell padding was a bug, fixed here.** Right-aligned columns only had `pl-3` and left-aligned ones only `pr-3`, so a right-aligned column directly followed by a left-aligned one (Activity's Amount -> Note, in this task's own screen) rendered with **zero gap** between them - confirmed visually, not just by reading the code. Changed both `<th>` and `<td>` to symmetric `px-1.5` with `first:pl-0 last:pr-0` so every column pair gets a gap regardless of alignment order. No screen from task 07 happened to hit this adjacency, so it shipped unnoticed until now.
- **Action buttons use `Button`, not `MiniButton`.** The first draft used `MiniButton` (32px) for Edit/Exclude/Delete/Remove/Transactions/Add-adjustment, which reads fine but is below DESIGN.md 3.3's "touch targets ≥44px tall" - that rule is for primary interactive controls, and `MiniButton`'s own doc comment says it's for chart chrome specifically, where a 44px button would dominate. These are not chart chrome. Caught by screenshotting at 390px and measuring, not by inspection.
- **Added `wrangler.jsonc`'s `assets.not_found_handling: "single-page-application"`.** Without it, `GET /activity` (or any route but `/`) 404s instead of serving the shell, because the Worker's catch-all just does `env.ASSETS.fetch(request)` and Cloudflare's asset handler 404s on an unmatched path by default. This predates this task (every route since task 07 had the same problem) but was only discovered now because this is the first task that needed to deep-link into a gated screen to test it. One-line fix, verified: `curl -o /dev/null -w '%{http_code}' $URL/activity` went from 404 to 200.
Verified:
- `npm run check` passes: typecheck + lint + **346 tests** (all pre-existing; this task added no engine/worker code, so no new automated tests - see Open issues).
- Manual end-to-end pass against `npx wrangler dev` (`DEV_AUTH_BYPASS=true`) using `tests/fixtures/m1/activity-all-types.csv`: import once (3 new, 0 already-imported, 3 cash rows dropped, 0 unrecognized, counts/date-range preview correct), import again (0 new, 3 already-imported, confirmed the DB still has exactly the 3 rows) - the acceptance check. Reconciliation: entered a mismatched ACME count, got the right `difference`, used "Add adjustment", watched the ticker drop out of the mismatch list on re-check. Settings: added and removed a ticker alias, both persisted and reflected a toast. Activity: edit opened pre-filled, delete's inline confirm worked, toast feedback on every mutation.
- 390px and 1280px screenshots (ad hoc Playwright script against `wrangler dev`, not a repo script - these screens need the gated API, unlike `/kit`) of Activity, Import and Settings; reviewed for the card/table breakpoint, touch targets, and the `DataTable` padding fix. Dark mode only (the sandbox's default); light mode not separately shot, since this task changed no colors.
- Privacy: `git diff` reviewed; the only real-shaped data anywhere is the pre-existing synthetic fixtures already in `tests/fixtures/m1/`. No filenames, tickers or amounts from the user's real export appear anywhere (none were used - real files still are not in `private/m1/`, see task 02's open issue, still open).
Open issues:
- **No automated tests for these screens.** Same gap task 07 noted: no jsdom/testing-library in this repo, and the task's acceptance criterion is "works at 390px" plus the dedupe check, both exercised by hand this session. If a future task adds component-test infra, Import's live preview math (new/dup counting across a batch) and the reconcile-difference-prefill logic are the two things most worth covering.
- **Reconciliation ignores splits** (see Decisions). Revisit once task 09 stores real price history, or sooner if a real M1 export turns out to contain a split row.
- **The user still has not dropped real M1 exports into `private/m1/`** (task 02's open issue). This task's "You do" line asks for exactly that, plus noting any reconciliation mismatches for task 15 - still the user's to do.
- Settings is sparse by design (just aliases) - tasks 09 (market data refresh, "last updated") and 14 (export/restore, "how this is calculated") both add sections to the same screen; no scaffolding was added for them since guessing their shape would be worse than an empty `Card` placeholder.

## Task 09 - Update market data flow - 2026-10-09 - Sonnet
Status: done. `npm run check` passes; manually exercised end to end against `wrangler dev`, including a real Yahoo round trip.
Built:
- `src/data/marketData.ts` (+24 tests, pure, no I/O): `tickersEverHeld` (every ticker ever held, resolved through aliases); `priceFetchFrom` (SPEC 8's "10 days before the earliest transaction", one range shared by every ticker, matching `series.ts`'s own earliest-transaction convention rather than per-ticker); `isStale`/`tradingDaysBetween` (the shell badge's "more than five trading days behind" rule, task 07 left unimplemented); `runMarketUpdate` (concurrency-limited fetch-and-store with one retry per ticker, a failing ticker never blocking the rest - both fetch and store are injected, so this is tested without a network or a Worker); `parseManualPriceCsv` and `withManualPrice` (the two manual-fallback paths from `docs/PRICES.md`).
- `src/data/usePortfolioData.ts` + `src/data/PortfolioData.tsx`: the data hook task 09 asks for. `PortfolioDataProvider` loads transactions, price history, aliases and meta once on mount, runs `analyze` when VOO has a stored history, and caches the result in a context; `usePortfolioData()` reads it. Split into two files the same way `src/ui/Toast.tsx`/`toastContext.ts` are - a file that exports a hook and a component together breaks fast refresh, and ESLint's `react-refresh/only-export-components` already enforces this elsewhere in the kit.
- `GatedApp` in `src/App.tsx` now wraps the routed shell in `PortfolioDataProvider`; a new `GatedShell` reads `pricesAsOf`/`update`/`runUpdate` and passes them to `AppShell`, which gained `onUpdatePrices`/`updatingPrices` props and a small Update control (new `RefreshIcon`) next to the existing `PricesAsOfBadge` slot - the "shell indicator" half of the task's deliverable, not just Settings.
- `Settings.tsx`'s "Market data" card: the update button (progress as "Updating… d of total", failures listed by ticker after a run) plus the two manual-fallback forms - upload a CSV for one ticker, or set a single current price - both calling `putPriceHistory`, which stores with `source: 'manual'`.
Decisions:
- **`runUpdate` returns the outcome instead of the caller reading `update` state afterward.** The first draft had the Settings handler `await runUpdate()` then read `update.failures` from its own closure - a stale read, since the closure was captured before the state update that the await was waiting on. Returning `UpdateOutcome` from `runUpdate` sidesteps the whole stale-closure class of bug; `update` in render (the JSX failures list) is still live because it re-reads the hook every render.
- **A manual spot-price merges into whatever is already stored rather than replacing it**, keyed by date; a CSV upload replaces the whole row (matching the Worker's own "a fetched history always replaces" comment in `priceHistory.ts`, which the manual CSV path reuses verbatim via `PUT`). Both end up with `source: 'manual'` on the whole row - the schema has one source flag per ticker, not per day, so a spot-price touch on an otherwise-fetched series is now "manual" until the next real Update overwrites it. Documented in the Settings copy ("merges into whatever history is already stored").
- **`pricesAsOf.date` comes from VOO's stored `asOf`, not the newest `asOf` across all tickers.** VOO is fetched on every run alongside everything else, so it is always exactly as fresh as the update that produced it - the one date SPEC 8's "prices as of \<date of last close\>" can mean unambiguously.
- **The manual fallback does not touch `meta.prices_last_updated`.** That timestamp means "the last full Update ran at this time" (SPEC 8); a one-ticker manual correction isn't that, and leaving it alone is what makes the "Stale" badge still trustworthy after a manual patch.
- **No backoff between the automatic retry and the first attempt.** SPEC 8 asks for "retry once", not a delay; `docs/PRICES.md`'s own 429 handling is the Worker's problem, and a client-side pause would only turn one slow ticker into a slower batch for no verified benefit.
Verified:
- `npm run check` passes: typecheck + lint + **370 tests** (346 from earlier tasks, all still green; 24 new in `marketData.test.ts`).
- Manual pass against `npx wrangler dev` (`DEV_AUTH_BYPASS=true`), with the local D1 already holding task 08's synthetic transactions (tickers `ABCD`, `WXYZ`, `ACME`, none of which are real symbols) plus `VOO` from transaction history: clicked "Update market data" from both Settings and the shell's new header control. Confirmed against the Worker's real (not mocked) Yahoo proxy: `VOO` succeeded (`/api/prices/VOO?from=2023-12-27` → 200), the three synthetic tickers each hit `/api/prices/<ticker>` **twice** (the automatic retry) and both came back 404 `Unknown ticker`, landing in the failures list by ticker with the real error text - one failing ticker did not block the others, and the run still set `prices_last_updated` because at least one ticker (VOO) succeeded. Read `network_requests` directly to confirm the retry count and that a full page load/client-side navigation across every route issues **zero** requests to `/api/prices/*` (only `/api/price-history`, the already-stored read) - the acceptance check.
- Manual fallback: uploaded a 3-row CSV for ticker `BETA` ("BETA: stored 3 day(s) from the CSV", confirmed via `GET /api/price-history` - `source: "manual"`, 3 dates) and set a single current price for `ACME` ("ACME: set today's price to 123.45", confirmed as a one-point manual series). Confirmed the shell's "Prices as of"/"updated" timestamps did **not** change from either manual action, only from the Update run.
- Screenshots at 390px (dark, the sandbox default) of Settings' Market data card both idle and post-update-with-failures, and the shell header wrapping correctly at that width.
- Privacy: `git status`/diff reviewed; no real data anywhere - the synthetic fixture tickers from earlier tasks are the only tickers this session's Update/manual-fallback testing ever touched, and no fetched real-world price data (VOO's, which is public market data, not personal) is committed to the repo - it only lives in the gitignored local `.wrangler` D1 state.
Open issues:
- **No component tests**, same gap every UI task has noted since task 07 (no jsdom/testing-library here). The pure logic behind the screen (`marketData.ts`) has the 24 tests; the screen wiring itself was exercised by hand.
- **Dashboard/StockDetail/FairValues still don't read `usePortfolioData().result`** - out of scope for this task (SPEC: "Out of scope: Any analysis screen"), but the hook, `analyze` integration and caching they need are now in place. Tasks 10-12 should read from the context rather than re-fetching.
- **Concurrency is a flat 3**, not configurable and not informed by any real rate-limit signal from Yahoo - `docs/PRICES.md` says Yahoo did not block the deployed Worker during its own checks, but a sustained 429 under this task's own heavier concurrent load was never deliberately triggered (same reasoning `docs/PRICES.md` already gives for not hammering Yahoo on purpose). If a real update run starts seeing 429s, lowering `runMarketUpdate`'s default concurrency is the fix, not re-architecting it.
- **The "set a single current price" form has no date picker** - it always writes today's date. Good enough for "current price" as named, but there's no manual way to backfill one specific past day without going through the CSV path (which is designed for a whole series, not one row).
- `src/engine/placeholder.test.ts` is still there, still redundant. Five tasks running have now declined to delete it.
