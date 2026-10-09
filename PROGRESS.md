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
