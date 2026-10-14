# Alpha Ledger specification

Source of truth for behavior. Task files point at sections here by number.

## 1. Purpose and scope

Two questions:

1. Did my stock picking beat investing the same dollars in VOO on the same dates?
2. By my own fair-value estimates, which current holdings look attractive to add to?

One user. Several M1 Finance accounts, analyzed as one combined portfolio by default; since task 19 the dashboard can also be narrowed to a single account, which is the same analysis over that account's own rows (section 9, and the 2026-10-11 Decision log entry on what that does to cost basis). Idle cash is ignored: only money going into and out of securities counts.

Out of scope forever: trading, brokerage connections, AI recommendations, computed fair values, news, social features, crypto, financial planning, tax calculations.

## 2. Architecture

| Piece         | Choice                                                                                                              | Why                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Front end     | Vite + React + TypeScript + Tailwind, installable (PWA)                                                             | One codebase for desktop and iPhone home screen                                |
| Hosting + API | One Cloudflare Worker serving static assets and `/api/*`                                                            | Free, runs only on request, no idle pausing                                    |
| Database      | Cloudflare D1 (SQLite)                                                                                              | Free tier, same vendor, synced across devices                                  |
| Login         | One 256-bit access token held in a password manager, exchanged for a signed year-long HttpOnly cookie by the Worker | Free with no payment method, which Cloudflare Access is not (see Decision log) |
| Prices        | Yahoo Finance chart endpoint, called by the Worker only on user request                                             | Free, no key, includes splits and dividends                                    |
| Math          | Pure TypeScript in `src/engine/`, runs in the browser                                                               | Testable, no server cost                                                       |

Rejected: Supabase (free projects pause after 7 days idle and can be deleted if left paused), GitHub Pages + local storage (no sync, no real privacy).

Known risks, each with a required fallback:

- Yahoo's endpoint is unofficial and may block or change. Fallback: manual price CSV upload per ticker and manual "current price" entry. Task 03 must prove the fetch works from a deployed Worker, not only locally.
- Delisted or renamed tickers may have no data. Fallback: ticker alias table and manual prices.
- ~~Cloudflare Access free-tier terms must be confirmed in task 06 on Cloudflare's own pricing page. If it is not free for one user, stop and ask the user.~~ Resolved in task 06: the plan is free for one user but onboarding demands a payment method, so Access was dropped. See the Decision log.

Free-tier limits to design around (Workers Free): 100,000 requests/day, 50 outbound fetches per request, about 10 ms CPU per request. D1 Free: about 100,000 row writes/day. Therefore:

- The browser asks for one ticker per API call when updating prices.
- A ticker's whole daily history is stored as one JSON row, not one row per day.

## 3. Data model (D1)

- `transactions`: id, account_label, trade_date (YYYY-MM-DD), ticker, type, shares, amount_usd, source (`m1` | `manual`), source_row_hash (unique, for dedupe), note, excluded (bool).
- `ticker_alias`: from_ticker, to_ticker, effective_date. For renames and mergers.
- `price_history`: ticker (pk), fetched_at, series_json (dates, close, adj_close), splits_json, dividends_json, source (`yahoo` | `manual`).
- `fair_value`: id, ticker, value_usd, effective_date, note, created_at. Append-only. Editing means inserting a new row. Deleting a mistaken entry is allowed but must be an explicit action.
- `meta`: key, value. Holds `prices_last_updated` and `hidden_tickers` (a JSON array of symbols the user has hidden from Holdings, Rebuy and Fair values - presentation only, see the Decision log).

Transaction `type` values: `buy`, `sell`, `dividend` (cash paid out by the stock), `split`, `adjust` (manual share correction for spinoffs, mergers, transfers in kind). A reinvested dividend is a `dividend` row plus a `buy` row. Deposits, withdrawals, interest, fees and transfers of cash are dropped at import.

`amount_usd` is always positive; `type` gives the direction.

## 4. Holdings reconstruction

- Shares held on any date = sum of buys minus sells, plus adjusts, up to that date.
- Splits: Yahoo's split events are the single source. Every transaction's share count is converted into today's split terms by multiplying by all split ratios after its trade date. M1 `split` rows are not added on top; they are used only to cross-check. This matches Yahoo's `close`, which is already split-adjusted.
- Cost basis for realized and unrealized gain: average cost per ticker across all accounts. This is for display, not tax.
- Reconciliation: the user can enter or upload current M1 share counts per ticker. Any ticker where reconstructed shares differ by more than 0.001 is flagged, with the fix being an `adjust` or manual transaction.

## 5. VOO shadow (the benchmark)

Each ticker has its own shadow bucket of VOO.

| Real event in ticker T | Shadow bucket T         |
| ---------------------- | ----------------------- |
| Buy $X                 | Buy $X of VOO that day  |
| Sell for $X            | Sell $X of VOO that day |
| Cash dividend $X       | Sell $X of VOO that day |
| Split, adjust          | Nothing                 |

Because both sides have identical cash flows, the difference in value today is the result of stock selection.

Pricing rule: use VOO **adjusted close**, which builds in VOO's own reinvested dividends. For a flow of `f` dollars on day `i` (positive for buys, negative for sells and dividends), its shadow value on day `d` is `f * adj(d) / adj(i)`. Bucket value on day `d` is the sum over all flows up to `d`. Always compute from the freshly stored series. Never store shadow share counts, because Yahoo restates adjusted prices after each dividend.

If the trade date is not a trading day, use the next trading day's price. Trades are priced at the daily close on both sides for the shadow; the real side uses the actual dollars from M1.

A bucket can be negative. It means the stock returned more cash than VOO would have been worth. Show it as is, with the explanatory tooltip from section 9.

## 6. Measures

Per ticker and for the whole portfolio:

- Invested = sum of buys. Returned = sum of sells + dividends.
- Current value = shares today x latest close.
- Total gain = current value + returned - invested. Split into realized, unrealized and dividends for display.
- Shadow value = bucket value today.
- **Value added vs VOO ($)** = current value - shadow value. This is the headline number. It is valid for closed positions too (current value is 0).
- Percent difference (portfolio headline) = value added / shadow value, shown only when shadow value is positive.
- Money-weighted return (IRR, annualized): real side uses flows plus current value as the final flow; shadow side uses the same flows plus shadow value. Solve by bisection on a daily basis. If there is no sign change or the shadow value is not positive, show a dash, never a guess.

Daily history: for every trading day from the first transaction, portfolio value and total shadow value, plus the gap between them. Per-ticker versions of the same series on demand.

Decision-level view: each buy has "value of those shares today (or proceeds when sold, matched first-in-first-out)" versus "the same dollars in VOO to the same end point". Used on the stock detail screen only.

Taxes, fees and cash drag are ignored on both sides. State this once in the app's "How this is calculated" sheet.

## 7. Fair value

- User-entered only. One current value per ticker, with full history kept.
- Discount = (fair value - price) / fair value. Positive means price is below fair value.
- Zones: below fair value by 15% or more = "Deep discount"; 0 to 15% = "Below fair value"; 0 to -15% = "Above fair value"; beyond that = "Well above". Thresholds are constants in one file.
- Old estimates are shown split-adjusted on charts, using the same split events as section 4. The stored value is never rewritten.
- History chart: the stock's price line with the fair value drawn as a step line and a marker at each change, with its note.
- Tickers without a fair value are listed under "No estimate yet", not ranked.
- A fair value applies equally to a watched ticker (section 9's watchlist) - watching does not change what a fair value is or how its discount is computed, only which tickers have one to set.

## 8. Market data

- Nothing fetches prices automatically. One "Update market data" action fetches VOO, every ticker ever held, and every watched ticker, one API call per ticker, with a visible progress count and per-ticker failures listed. A **closed** position whose history is already stored is still fetched, but a failure for it is reported separately as expected rather than as something to fix - a symbol that stopped trading can never be fetched again, and nothing about it can change.
- After an update the app shows "Prices as of <date of last close>, updated <timestamp>". All views use stored data between updates.
- Range: from 10 days before the earliest transaction to today, daily.

## 9. Screens

1. **Dashboard**: an account switcher ("All accounts" plus one stop per label, hidden when there is only one); headline (portfolio value, VOO-equivalent value, dollar gap, percent gap, IRR both sides); an account comparison strip under the headline in the summed view, one tappable line per account with its value and value added; history chart of both lines with the gap shaded; "Rebuy opportunities" ranked by discount, held and watched tickers together, a watched one labelled; holdings table (ticker, price, value, return, value added vs VOO, fair value, discount) - held only, never watched; value-creators-and-destroyers chart across every ticker ever owned, including closed positions - also held only. The switcher narrows every one of those sections, and the choice lives in `?account=`.
2. **Stock detail**: per-ticker measures, real versus shadow chart with buy/sell markers, decision list, fair-value chart and editor, and how the position's shares split across accounts. It honours the same `?account=`, so arriving from a narrowed dashboard keeps that view. For a watched ticker with no transactions, the measures are replaced by a plain "Not held yet" state, and only the price and fair-value chart and editor remain.
3. **Fair values**: one list to enter or update estimates quickly, including on a phone, for both held and watched tickers. A **watchlist**: tickers held nowhere, tracked anyway - add one by ticker (validated against a live price fetch before it is saved), remove it with one tap. A watched ticker gets a fair value exactly like a held one, is fetched by "Update market data" (section 8), and is ranked in Rebuy opportunities - but never reaches Holdings, the portfolio totals, or the value-creators chart, since it is not a position. Buying a watched ticker does not duplicate it: it simply shows up as a holding instead, same ticker, one row.
4. **Activity**: all transactions, filter by ticker/account/type, add, edit, exclude.
5. **Import**: upload one or more M1 CSV files, preview, dedupe, confirm. Then reconciliation.
6. **Settings**: update market data, last refreshed, aliases, manual prices, export all data as JSON, "How this is calculated".
7. **Help**: the user guide. What each screen is for, the order to use them in, how to read the charts, what every number means, and what to do when something looks wrong. Reached from the header on every screen, not from a tab. It makes no API call, so it reads the same before the first import as after. The "How this is calculated" copy is shared with Settings, not duplicated.

Negative-bucket tooltip text: "This position has paid you back more cash than the same money would be worth in VOO, so its VOO equivalent is below zero."

## 10. Privacy

- The repository contains no personal data, no account identifiers, and no secrets. `.gitignore` covers `private/`, CSV files outside test fixtures, and env files.
- Every `/api/*` route requires a valid session: the Worker checks a signed HttpOnly cookie, or the access token as a bearer header. A missing or wrong credential is 401/403, and a Worker with no token configured refuses everything. **The app shell (`index.html` and its JS) is served without a check** - the gate lives inside the Worker, so it cannot gate the hostname the way Cloudflare Access did. The shell contains no personal data; all data goes through `/api/*`.
- No analytics, no third-party scripts, no external fonts fetched at runtime.
- The only outbound call is Worker to Yahoo, containing ticker symbols and dates, nothing else.

## Decision log

- 2026-10-07: Sales mirrored dollar-for-dollar in per-ticker VOO buckets. Dividends treated as cash out of the stock. IRR for percent returns. Accounts combined. Idle cash ignored. Hosted database behind login accepted. (User confirmed.)
- 2026-10-07: M1's CSV column layout is not publicly documented. Task 02 derives it from the user's real export.
- 2026-10-08: **Cloudflare Access is dropped. (User decided.)** Its price is genuinely $0 for one user, but Zero Trust onboarding requires a payment method on file before an application can be created, which the user ruled a breach of the free-only rule. Section 2's stop-and-ask condition therefore fired, one step later than written - the pricing page confirmed the price, and the signup flow revealed the card. Sources in `docs/SETUP.md` section 0.
- 2026-10-08: Login is instead **one 256-bit random access token** (`AUTH_TOKEN`, a Worker secret), exchanged at `POST /api/session` for a signed, HttpOnly, `SameSite=Strict`, year-long cookie. Consequences worth knowing:
  - **No password hashing, deliberately.** A slow KDF exists to make guessing a human-chosen password expensive, and at safe iteration counts it would exceed the free plan's ~10ms CPU per request. 256 random bits are not guessable at any request rate, so the token is compared as a fixed-length SHA-256 digest and no KDF is used. This is why the credential must stay a generated token and never become a memorable password.
  - **The cookie key is derived from the token**, so rotating `AUTH_TOKEN` signs every device out. That is the revocation mechanism; there is no session table.
  - **`SameSite=Strict` stands in for CSRF tokens** - the cookie never rides a cross-site request.
  - **The app shell is public** (see section 10). This is the one real loss versus Access, which gated the hostname at Cloudflare's edge before any code ran.
  - No rate limiting on the unlock route, and none needed at 256 bits; adding a counter would cost storage and CPU this tier has to spare for the engine.
- 2026-10-08: Money and share counts are **TEXT** columns, not REAL. They stay exact decimal strings from the M1 parser through D1 to the engine; SQLite's REAL is a float64 and would round a fractional share or a cent.
- 2026-10-10: **A Help screen was added at `/help`** (section 9, screen 7), outside the 15-task plan and at the user's request. Two constraints came with it, because a guide that disagrees with the app is worse than none: it never restates a threshold or a label in prose (the fair-value zones render from `DEEP_DISCOUNT` / `WELL_ABOVE` and `zoneFor`), and the "How this is calculated" text moved to `src/routes/HowCalculated.tsx` so Settings and Help show one copy. It is not a tab-bar destination - see `docs/DESIGN.md` 5.6.
- 2026-10-08: Bulk import **inserts new `source_row_hash` values and leaves existing ones untouched** rather than overwriting them, so re-importing an overlapping export cannot undo an edit or an exclusion the user has made. A restore, by contrast, replaces all five tables - merging two ledgers is not something this app attempts.
- 2026-10-11: **A defunct ticker is closed by recording the exit, not by filtering or deleting.** A bought-out company keeps showing shares for one reason: M1 pays the buyout out as cash, the parser drops cash rows, so the ledger never recorded the exit. Task 18 therefore writes one manual `sell` for every share held on the settlement date, for the cash received, through the existing transactions API. Shares then go to zero, the ticker leaves Holdings, Rebuy and Fair values on its own, and it keeps its place in the history as Closed. Three consequences the close-out sheet states before it writes anything:
  - The sell's share count is in **its own trade date's** terms, not today's: the shares held are divided back by every split dated after the close-out date, which the engine re-applies when it reads the row. This is what makes the position land on exactly zero.
  - A per-share figure is multiplied by that same trade-date count, and the derived total is rounded to the cent - it stands for money that actually moved. A total typed directly is stored exactly as typed.
  - The cash received is what the VOO bucket is debited by, so **value added reads the buyout price**, not the last close before it. A buyout above the market price shows up as outperformance, carried forward by the benchmark from the settlement date.
- 2026-10-11: **A non-1:1 exchange is recorded as a `ticker_alias` plus an `adjust`.** The alias alone only moves history under the new symbol; it carries no ratio, so 100 old shares becoming 50 new ones would otherwise read as 100. The smallest correct mechanism is the existing `adjust` type for the share delta, dated the effective date, which the close-out sheet offers alongside the alias. Two known limits, in preference to a `share_ratio` column on `ticker_alias` or a new transaction type:
  - A **negative** adjust releases its basis as a realized loss (section 4), so a shrinking ratio shifts the realized/unrealized split. `totalGain`, `valueAdded` and the share count are all unaffected - an adjust moves no money and produces no shadow flow - and reporting a tax-accurate basis is explicitly out of scope.
  - The delta is **not** `shares * (ratio - 1)`. A row's share count is restated by the split events of whatever ticker it resolves under, so the moment the alias moves those rows to the new symbol they are restated by the _new_ ticker's splits instead of the old one's - and right after a rename the new symbol usually has no stored price history at all, so none apply. `exchangePlan` therefore applies the alias first, measures what the moved rows actually contribute, and writes only the gap between that and the target. A 1:1 rename of a ticker that never split correctly writes nothing. (Found by driving the flow against a split fixture, where the naive delta zeroed the position out; `defunct.test.ts` pins it.)
  - The count can still move once prices for the new symbol are fetched, because a rename usually brings the old split history with it under the new ticker. The sheet says so, and the fix is reconciliation (section 4), which exists for exactly this.
- 2026-10-11: **A delisted-looking holding is only reported when the reference series kept going without it.** The valuation date is the newest close across _every_ stored ticker, so a single manual spot price on a symbol nobody holds can drag it months past the real series and leave every holding more than 30 days behind it. When the benchmark's own close is itself that far behind the valuation date, the whole price set is behind - that is "update your prices", not "these companies are gone" - and no stale-price candidate is reported. A **missing** price is reported either way. (Found driving the fixture ledger, where it flagged five of five holdings.)
- 2026-10-11: **Hiding a ticker changes no number.** `hidden_tickers` in `meta` leaves a symbol out of Holdings, Rebuy opportunities and Fair values - the three "what should I do now" lists - and out of nothing else. The headline, the history chart, the value-creators bars and every per-ticker figure still count it in full, the screens that hide it print how many are hidden, and the only place to get one back is Settings. It is a meta row rather than a column so it needs no migration, and it rides along in `/api/export` with everything else. A delisted-looking holding gets a **prompt**, never an automatic close or hide: from the app's side, a data-source outage and a real buyout are indistinguishable, and only one of them should change the ledger.
- 2026-10-11: **The dashboard's value creators and destroyers chart shows only open, priced positions. (User decided.)** Section 9 specified every ticker ever held, closed ones included, and the headline above it still counts every ticker - so the bars no longer sum to it, and the chart's subtitle prints how many were left out for that reason. Two different arguments were collapsed into one filter here, and they are not equally strong. An **unpriced** position is a data gap, not a view preference: `analyze` counts a missing price as $0, so a merged or delisted holding drew as a near-total loss and the bar was never a reading of anything. A **closed** position's `valueAdded` is real and realized, and section 6 defines it for exactly that case, so hiding it hides outperformance the app exists to measure; it is out because the user wants the chart to be about live decisions. If the unpriced ones are ever given a manual history, they reappear on their own.
- 2026-10-11: **A single-account view is `analyze` run again, so its cost basis is that account's own average.** Section 4 pools average cost per ticker across all accounts, and the 2026-10-07 log entry settled that accounts are combined. Task 19 adds a per-account view on top of that without changing either: one account is the same pure call over that account's own rows, which means the pooled average cost is not what a narrowed view uses - it uses the average of the shares bought in that account. What follows, and why it was accepted:
  - **The additive measures still sum to the summed view, exactly**: `currentValue`, `shadowValue`, `valueAdded`, `invested`, `returned`, `totalGain` and `shares`, per ticker and in total. Every transaction carries exactly one `account_label`, so the accounts partition the ledger and both sides of the comparison are built from the rows. `accounts.test.ts` pins this, which is task 19's acceptance check.
  - **The realized/unrealized split does not sum, and neither does `costBasis`.** A sale in one account is matched against that account's own average rather than the pooled one, so the same total gain is booked differently. The Dashboard says so under the switcher whenever a view is narrowed, and `HowCalculated.tsx` says it for both views.
  - **Fair values stay per ticker, not per account** - an estimate is a judgement about a company, not about where the shares are held - so Rebuy opportunities in a narrowed view ranks that account's holdings against the same estimates.
  - The strip deliberately shows only value and value added, the two measures that do add up to the headline above it.
- 2026-10-11: **A watchlist ticker is a `meta` row, like `hidden_tickers`, and never reaches `analyze`.** It has no transactions, so there is nothing for the engine to compute - the two lists Fair values and Rebuy opportunities both show (held plus watched) are joined in one place, `src/data/watchlist.ts`'s `mergeHeldAndWatched`, so they cannot drift apart. Consequences:
  - **A ticker that is both held and watched shows once, as a holding.** The merge drops a watchlist entry that is already held before it ever reaches a screen; nothing deletes it from the stored watchlist, so unselling it back to zero would surface it as watched again, which is the one case where that is correct.
  - **"Watch a ticker" validates by fetching its price history first**, the same live call "Update market data" makes, and stores what it gets before adding the ticker - a typo or a delisted symbol fails the fetch and is never added, rather than being added and then silently missing a price.
  - **Hiding (task 18) and watching share a rule, not a table.** A hidden watched ticker is left out of the merge the same way a hidden holding already was; the two lists are independent otherwise.
- 2026-10-12: **Task 22 replaced the "ledger paper and ink" palette with cooler neutrals and one confident accent. (Owner had no fixed preference, asked for a modern, finished phone app rather than a document.)** `--al-viz-ahead`/`-behind` move to `#0b67d9`/`#d7393b` (light) and `#4e90f0`/`#e4605b` (dark); the fair-value line moves from a pure `#008300` green to a teal `#008b74`/`#00ab92` so it reads less like a status chip while keeping its one job (a level, never a direction). A new `--al-accent` token - the same hue as `--al-viz-ahead`/`--al-viz-you` - is now the app's single interactive color (buttons, active tab, focus, links), replacing the old left-edge-border active state with an accent-wash background plus a duotone icon swap. Cards gained soft elevation (`--al-shadow-card`/`-raised`/`-sheet`) and a larger radius (16px) on top of the existing hairline. Every pairing was re-run through the `dataviz` skill's validator against the new surfaces before shipping - results and hexes are in `docs/DESIGN.md` sections 2 and 7, not restated here. The home-screen icon artwork itself did not change, only its background.
- 2026-10-13: **The price fallback is the CSV series import plus a dated single-price form; nothing more is planned (task 30).** Yahoo stays the only source. The single-price form on Settings now takes a date (default today, no future dates, enforced in the form and again in the Worker for `source: manual`), so one bad or missing past day can be fixed by hand. The unbuilt fallback design was deleted from `docs/PRICES.md` so it no longer reads as a plan.
- 2026-10-13: **Checking the engine against M1's own numbers is the owner's acceptance step in the finished app, not an agent's task. (Owner decided.)** Task 25b asked an agent to reconcile share counts against a hand-written `private/m1/holdings.txt` and to compare a portfolio total the owner types out. Both are the job of the Reconcile screen (`src/engine/reconcile.ts`, wired into Import), which already diffs typed-in M1 share counts against the ledger with section 4's 0.001 tolerance - `tasks/QUEUE.md` had in fact always described those counts as "typed into the app's Reconcile screen", and only 25b's own step 1 invented the file. The split that stands:
  - **Agent work is engine-versus-spec**: the recompute harness (`private/recompute.check.ts`) diffs `analyze` against arithmetic written fresh from sections 4-6. It needs transactions and prices and no outside answer, so it stays in 25b.
  - **Owner work is engine-versus-M1**: share counts, the portfolio total, and whether per-ticker value added sums to the gap. These need M1 as the authority; an agent deriving them from the same CSV the engine reads would be grading the engine against itself. They move to 25c as an acceptance checklist.
  - **Real transactions still earned their place in development** - the CEIX pre-split placeholder, four merger cash-outs and the defunct tickers are shapes nobody would have invented, and they found two parser bugs in 25a. That value is banked in the parser and its tests; it did not require the owner's holdings on top.
