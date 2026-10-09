# Alpha Ledger specification

Source of truth for behavior. Task files point at sections here by number.

## 1. Purpose and scope

Two questions:
1. Did my stock picking beat investing the same dollars in VOO on the same dates?
2. By my own fair-value estimates, which current holdings look attractive to add to?

One user. Several M1 Finance accounts, always analyzed as one combined portfolio. Idle cash is ignored: only money going into and out of securities counts.

Out of scope forever: trading, brokerage connections, AI recommendations, computed fair values, news, social features, crypto, financial planning, tax calculations.

## 2. Architecture

| Piece | Choice | Why |
|---|---|---|
| Front end | Vite + React + TypeScript + Tailwind, installable (PWA) | One codebase for desktop and iPhone home screen |
| Hosting + API | One Cloudflare Worker serving static assets and `/api/*` | Free, runs only on request, no idle pausing |
| Database | Cloudflare D1 (SQLite) | Free tier, same vendor, synced across devices |
| Login | One 256-bit access token held in a password manager, exchanged for a signed year-long HttpOnly cookie by the Worker | Free with no payment method, which Cloudflare Access is not (see Decision log) |
| Prices | Yahoo Finance chart endpoint, called by the Worker only on user request | Free, no key, includes splits and dividends |
| Math | Pure TypeScript in `src/engine/`, runs in the browser | Testable, no server cost |

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
- `meta`: key, value. Holds `prices_last_updated`.

Transaction `type` values: `buy`, `sell`, `dividend` (cash paid out by the stock), `split`, `adjust` (manual share correction for spinoffs, mergers, transfers in kind). A reinvested dividend is a `dividend` row plus a `buy` row. Deposits, withdrawals, interest, fees and transfers of cash are dropped at import.

`amount_usd` is always positive; `type` gives the direction.

## 4. Holdings reconstruction

- Shares held on any date = sum of buys minus sells, plus adjusts, up to that date.
- Splits: Yahoo's split events are the single source. Every transaction's share count is converted into today's split terms by multiplying by all split ratios after its trade date. M1 `split` rows are not added on top; they are used only to cross-check. This matches Yahoo's `close`, which is already split-adjusted.
- Cost basis for realized and unrealized gain: average cost per ticker across all accounts. This is for display, not tax.
- Reconciliation: the user can enter or upload current M1 share counts per ticker. Any ticker where reconstructed shares differ by more than 0.001 is flagged, with the fix being an `adjust` or manual transaction.

## 5. VOO shadow (the benchmark)

Each ticker has its own shadow bucket of VOO.

| Real event in ticker T | Shadow bucket T |
|---|---|
| Buy $X | Buy $X of VOO that day |
| Sell for $X | Sell $X of VOO that day |
| Cash dividend $X | Sell $X of VOO that day |
| Split, adjust | Nothing |

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

## 8. Market data

- Nothing fetches prices automatically. One "Update market data" action fetches VOO and every ticker ever held, one API call per ticker, with a visible progress count and per-ticker failures listed.
- After an update the app shows "Prices as of <date of last close>, updated <timestamp>". All views use stored data between updates.
- Range: from 10 days before the earliest transaction to today, daily.

## 9. Screens

1. **Dashboard**: headline (portfolio value, VOO-equivalent value, dollar gap, percent gap, IRR both sides); history chart of both lines with the gap shaded; "Rebuy opportunities" ranked by discount; holdings table (ticker, price, value, return, value added vs VOO, fair value, discount); value-creators-and-destroyers chart across every ticker ever owned, including closed positions.
2. **Stock detail**: per-ticker measures, real versus shadow chart with buy/sell markers, decision list, fair-value chart and editor.
3. **Fair values**: one list to enter or update estimates quickly, including on a phone.
4. **Activity**: all transactions, filter by ticker/account/type, add, edit, exclude.
5. **Import**: upload one or more M1 CSV files, preview, dedupe, confirm. Then reconciliation.
6. **Settings**: update market data, last refreshed, aliases, manual prices, export all data as JSON, "How this is calculated".

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
- 2026-10-08: Bulk import **inserts new `source_row_hash` values and leaves existing ones untouched** rather than overwriting them, so re-importing an overlapping export cannot undo an edit or an exclusion the user has made. A restore, by contrast, replaces all five tables - merging two ledgers is not something this app attempts.
