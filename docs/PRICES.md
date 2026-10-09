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
- **Ticker symbols with a dash work** (e.g. `BRK-B`); Yahoo's own convention uses `-` for the
  share-class separator, not `.`. The ticker regex in `worker/prices.ts` allows both.
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

If Yahoo blocks this Worker outright, the designed fallback (SPEC section 2) is a manual
price CSV per ticker, uploaded through the app:

```
date,close,adjclose
2026-10-08,711.28,711.28
2026-10-07,713.71,713.71
```

- Header row required, exactly these three column names, lowercase.
- `date` is `YYYY-MM-DD`.
- `close` and `adjclose` are plain decimal numbers, no `$` or thousands separators.
- One row per trading day; order doesn't matter, the app sorts on import.
- No splits/dividends columns — under manual entry, use `adjclose` for the chart and enter
  splits/current price by hand (SPEC section 2 fallback note); building CSV support for this
  format is not part of this task.
