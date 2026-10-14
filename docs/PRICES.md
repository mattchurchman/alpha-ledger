# Prices

`GET /api/prices/:ticker?from=YYYY-MM-DD` proxies Yahoo Finance's undocumented v8 chart
endpoint and returns:

```json
{
  "dates": ["2020-01-02", "..."],
  "close": ["325.21", "..."],
  "adjClose": ["298.77", "..."],
  "splits": [{ "date": "2021-07-20", "numerator": 4, "denominator": 1 }],
  "dividends": [{ "date": "2026-09-28", "amount": "1.823" }],
  "asOf": "2026-10-08"
}
```

`dates`/`close`/`adjClose` are parallel arrays, ascending, one entry per trading day from
`from` to today. `close` and `adjClose` are decimal strings rounded to 4 places (Yahoo's
raw floats carry float32 rounding noise past that). `splits` and `dividends` are sorted
ascending by date. `asOf` is the date of the last close returned.

## What was verified

Deployed with `wrangler deploy` to `https://alpha-ledger.alpha-ledger.workers.dev` (free
`workers.dev` subdomain, no custom domain) and hit directly, not just locally:

- `GET /api/health` → `200 {"status":"ok"}`.
- `GET /api/prices/VOO?from=2020-01-01` and the same for `AAPL`, `MSFT`, `KO` → `200`, each
  with 1,701 trading days from 2020-01-02 to today (2026-10-08).
- `GET /api/prices/NVDA?from=2020-01-01` → `200` with both of NVDA's real splits in range:
  `2021-07-20` (4:1) and `2024-06-10` (10:1), on the correct calendar dates.
- `GET /api/prices/ZZZZQQ?from=2020-01-01` (ticker that parses as valid but doesn't exist)
  → clean `404 {"error":"Unknown ticker \"ZZZZQQ\""}`.
- Missing `from`, and a ticker with characters outside `[A-Z0-9.-]` → `400` with a message
  naming the problem.

Yahoo did not block or rate-limit the deployed Worker during this round of checks.

## Observed limits and decisions

- **Yahoo requires a browser-like `User-Agent`.** A request with no `User-Agent` got back
  `HTTP 429` with the plain-text body `Edge: Too Many Requests` — on the very first request,
  so this is Yahoo's edge rejecting non-browser traffic outright, not a true per-account rate
  limit. The Worker always sends a desktop Chrome UA string (`worker/prices.ts`). If Yahoo
  starts blocking Cloudflare's IP ranges specifically (a real risk the spec calls out), this
  won't help and the manual fallback below is the answer — don't reach for a paid/keyed API
  without asking first.
- **Yahoo spells a share class with `-`, M1 spells it with `.`**, and the Worker translates
  between them: `TICKER_PATTERN` accepts both, the ledger stores and displays M1's spelling, and
  `yahooSymbol()` (`src/engine/prices/yahooSymbol.ts`) converts only in the request URL. Until
  task 25b nothing converted, and a dotted symbol 404'd as `Unknown ticker` - which looks exactly
  like a delisting from the screen, while leaving a live holding unpriced and therefore valued at
  $0 (SPEC 6). Pinned by `worker/prices.test.ts`; don't build the URL from the stored ticker.
- **Daily-bar timestamps never need a timezone conversion.** Yahoo's timestamps are UTC
  seconds at US market open (13:30 or 14:30 UTC depending on DST) — always mid-day UTC, never
  near a midnight boundary — so taking the UTC calendar date directly from the timestamp is
  always the correct trading day. No use of `meta.gmtoffset` needed; see the comment in
  `parseYahooChart.ts`.
- **Error response shapes differ by failure type**, so the Worker checks in this order:
  network failure → non-JSON body (edge block, classified by HTTP status) → JSON body with
  `chart.error` (e.g. unknown ticker) → structurally wrong JSON (payload shape changed).
- Not tested: a real sustained rate-limit from Yahoo's application layer (as opposed to the
  edge UA check above) — triggering that deliberately means hammering their API, which this
  task deliberately avoided. If it ever happens, the Worker returns `429` for upstream `403`
  or `429` HTTP statuses with a non-JSON body, or for a JSON `chart.error` whose code or
  description mentions "limit", "throttle", or "too many".

## Manual fallback

There is no separate fallback beyond what is built (SPEC Decision log, task 30): the price CSV
series import (`date,close,adjclose`, one ticker per upload) plus the dated single-price form on
Settings. Both merge into the stored history and are marked manual; the Worker rejects a manual
price dated in the future.
