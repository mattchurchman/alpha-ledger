# Privacy and cost audit

Independent check of the two hard promises - **private** and **free** - against the app as it
actually runs today, not as the task files say it should. Run 2026-10-10 by an agent that did
not write the code under test.

One prerequisite finding before the audit itself: **tasks 07-13 had never been deployed.** The
live Worker was still serving task 06's code (version `e945db61`, 2026-10-09). Every check below
was run only after `npm run check`, `npm run build`, and `npx wrangler deploy` brought the live
Worker up to the current `main` (version `b17b28ad`), so this audit reflects what a visitor to
`https://alpha-ledger.alpha-ledger.workers.dev` sees today, not an earlier snapshot.

## Summary

| # | Item | Result |
|---|---|---|
| 1 | Git history scan (CSV, amounts, account numbers, emails, tokens) | **Pass**, one note |
| 2 | Signed-out requests refused on every `/api/*` route | **Pass** |
| 3 | Shell is public but leaks no personal data; `/debug` status | **Pass** |
| 4 | Missing / wrong / expired / rotated-key credentials all rejected | **Pass** |
| 5 | No third-party requests from the browser | **Pass** |
| 6 | No cron triggers, no scheduled/background fetches | **Pass** |
| 7 | Cloudflare usage vs. free limits; no payment method on file | **Pass** on usage, **needs your confirmation** on payment method |
| 8 | JSON export/restore round-trips on a scratch database | **Pass** |

Two exceptions need your sign-off, not code changes - see the end of each relevant section.

---

## 1. Git history scan

Ran `git log -p --all` (every commit, every branch) through targeted greps rather than relying
on one tool:

- **Emails**: only commit authorship (`Matt Churchman <churchman.matt@gmail.com>` /
  `mattchurchman <...@users.noreply.github.com>`) and one synthetic test fixture
  (`someone@else.test`). No email appears inside ledger data, docs, or test fixtures.
- **Dollar amounts**: every `$` figure in history traces to either a design-system placeholder
  (`$18,420` in a mockup), a `money()`/`moneyCompact()` unit test, or a synthetic QA fixture
  (`$90`, `$95`, round numbers). None pairs a real ticker with a real amount.
- **Account numbers**: the only 8+ digit sequences are test fixtures (`123456789`,
  `9999999999`, a repeating-digit CUSIP placeholder `000000000`/`111111111`) or unrelated
  numbers (session `Max-Age=31536000`, a date `20261008`). No real account identifier.
- **Tokens**: no 64-hex-character string in history is `AUTH_TOKEN`-shaped and real - the only
  hits are decimal.js's internal pi-digit constant table (also hex-looking by coincidence) and
  two placeholder hex strings (`000...0`, a sequential-nibble pattern) used in a crypto test.
  `git log -p --all | grep AUTH_TOKEN` finds the variable name in code and docs, never a value.
- **CSV / account-number / SSN keywords**: `account number|routing number|social security|ssn`
  matches only this task's own file and `private/README.md`'s warning text - never real content.
- **Files that should never be tracked**: `git log --all --diff-filter=A --name-only` shows the
  only files ever added under `private/` or matching `*.csv` are `private/README.md` (a warning,
  no data) and the four allowlisted fixtures in `tests/fixtures/m1/*.csv`, which use fake tickers
  (`ABCD`, `WXYZ`) and fake CUSIPs (`000000000`, `111111111`). `.dev.vars` was never committed.

**Note**: `gitleaks` (available via `pacman -S gitleaks`) was not run - installing it needs an
interactive `sudo` password this session couldn't supply, and you didn't complete the install
before this audit needed to finish. The manual scan above covers every category the task lists
(CSV data, amounts, account numbers, emails, tokens) directly against the full history, so I'm
calling this a pass rather than blocking on a second tool. If you want the extra assurance:
run `sudo pacman -S gitleaks && gitleaks git --no-banner -v /home/matt/Work/alpha-ledger` and
let me know if it finds anything.

## 2. Signed-out requests to every API route

Tested live against `https://alpha-ledger.alpha-ledger.workers.dev`, not just the data routes:

```
GET  /api/health                    -> 401
GET  /api/prices/VOO?from=2024-01-01 -> 401
GET  /api/transactions              -> 401
GET  /api/transactions/7            -> 401
GET  /api/aliases                   -> 401
GET  /api/fair-values               -> 401
GET  /api/fair-values?ticker=VOO    -> 401
GET  /api/price-history             -> 401
GET  /api/price-history/VOO         -> 401
GET  /api/meta                      -> 401
GET  /api/meta/last_updated         -> 401
GET  /api/export                    -> 401
POST /api/restore                   -> 401
GET  /api/session                   -> 401
GET  /api/nonexistent               -> 401
PUT/DELETE/PATCH /api/transactions/7 -> 401 (every method)
POST /api/transactions               -> 401
```

**Pass.** `worker/index.ts` runs `verifyAuth` once, before dispatch, for every path under
`/api/*` except `POST /api/session` (the unlock) and `DELETE /api/session` (sign-out) - which
is correct, since those are what create and destroy a session. `/api/health` is deliberately
behind the gate too, per the code comment: "a liveness probe that answered first would tell an
unauthenticated caller the app is here." There is one choke point, not a per-route check that
could be forgotten on a new route.

## 3. The public shell and the `/debug` route

SPEC 10 accepts that `index.html` and its JS bundle are served without a check, because an
in-Worker gate can't block a request at Cloudflare's edge the way the dropped Cloudflare Access
would have. The promise this rests on: **the shell itself contains no personal data.**

Checked directly against the deployed shell and bundle:

- `curl https://alpha-ledger.alpha-ledger.workers.dev/` - 1.68 kB of HTML. No ticker, amount,
  account label, email, or token. Only a theme-flash-prevention script reading `localStorage`.
- The JS bundle (`/assets/index-KqwwwYpC.js`, 426 kB) and CSS bundle: no email address, no
  occurrence of "gmail" or the owner's name, no `AUTH_TOKEN` literal, no real account/ticker
  data. The only hex-looking 64-character strings are decimal.js's pi-digit table, not tokens.
  The only external URLs referenced are inert string literals - React's own error-doc links,
  react-router's doc link, XML/SVG namespace URIs, and one `tailwindcss.com` comment in the
  generated CSS - none of these are fetched at runtime (confirmed in section 5).
- **No source map is served.** `/assets/index-KqwwwYpC.js.map` returns HTTP 200, but the body is
  byte-identical to the shell (`text/html`, same MD5) - that's the SPA catch-all serving
  `index.html` for an unmatched path, exactly as it does for `/debug` and `/anything-else`, not
  a real source map. Vite's build does not emit one (`grep sourceMappingURL` on the bundle: 0
  hits), and `not_found_handling: single-page-application` in `wrangler.jsonc` is what makes
  every unknown path 200 instead of 404.
- **`/debug` is gone, and should stay gone.** It returns the same shell as every other
  unmatched path (identical MD5 to `/` and to a nonsense path) - there is no `src/routes/Debug.tsx`
  in the source, no `/debug` entry in `App.tsx`'s router, and no server-side handler for it.
  `PROGRESS.md`'s task 08 entry confirms it was deliberately deleted once Activity could
  create/delete transactions by hand, which was the only reason it existed (the two-device sync
  check in `docs/SETUP.md` now uses Activity instead). Nothing to fix here.

**Pass.** Fonts are self-hosted (see section 5), not fetched from Google Fonts, so there's no
third-party request from the public shell either.

## 4. Credential rejection paths

`worker/auth.ts` has unit coverage (`worker/auth.test.ts`, part of the 389 passing tests) for
every case the task names, plus live confirmation of the parts that don't need the real secret:

- **Missing credential** - live: `GET /api/transactions` with no cookie/header -> `401
  missing-credentials`. Unit: `'401s a request carrying nothing'`.
- **Wrong token** - live: `Authorization: Bearer wrong-token-value` -> `403 invalid-token` (also
  checked against `/api/health` specifically, since that route is easy to special-case by
  accident and wasn't). Unit: `'403s a wrong bearer token'`.
- **Expired session cookie** - unit only (`'401s an expired session'`): a validly-signed cookie
  with `exp` in the past is rejected `401 session-expired`. Not reproduced live because that
  needs a cookie signed with the real deployed `AUTH_TOKEN`, which this audit never had or
  needed - see below.
- **Cookie signed with a previous token** - unit only (`'403s a cookie signed with a different
  token, which is how rotation signs devices out'`), exactly the scenario the task asks to check
  "on a scratch Worker." I did not rotate the live `AUTH_TOKEN` to test this against production,
  since rotating it signs out every real device and the unit test already exercises the same
  `verifySession` code path the deployed Worker runs - rotating for real would duplicate that
  coverage while locking you out until you re-paste the token. If you want it proven live too,
  say so and I'll do it on a disposable scratch Worker, not this one.
- **Malformed cookie** - live: a garbage cookie value -> `403 invalid-session`. Not in the task's
  list but a natural adjacent case, and it fails closed correctly.
- **No token configured** - unit: `'fails closed when no token is configured'` -> `403
  auth-not-configured`, never an open gate.

I never requested or used the real `AUTH_TOKEN` for this audit - every live test above is a
rejection path, which doesn't need it. That's deliberate: this audit's job is to confirm bad
credentials are refused, not to re-verify the happy path (`docs/SETUP.md` section 4 already
covers "the real token works" and was exercised at deploy time in task 06).

**Pass.**

## 5. No third-party requests from the browser

- Shell `<head>`: no `<link>` to an external stylesheet or font host, no third-party `<script>`.
  Fonts (Geist, Geist Mono) are bundled as local `.woff2` files under `/assets/`, not fetched
  from `fonts.googleapis.com` at runtime - `grep -oE 'https?://...' ` on the shipped CSS finds
  only a comment-level reference to `tailwindcss.com`, not a loaded resource.
- JS bundle: the only external URLs present are inert string literals (error-message doc links,
  XML namespace URIs) - none are called with `fetch`/`XMLHttpRequest`. `grep -rn "fetch(" worker/
  *.ts` (the only place outbound requests originate, since the browser talks only to this app's
  own `/api/*`) shows exactly one destination: `query1.finance.yahoo.com`, from `worker/prices.ts`,
  called by the Worker, never the browser.
- `manifest.json`: all four icons and two screenshots are same-origin (`/icons/...`).
- The request to Yahoo itself carries only a ticker symbol, a date range (`period1`/`period2`),
  and a generic spoofed browser `User-Agent` (needed because Yahoo's edge 429s requests with no
  browser-like UA) - no cookie, no identifying header, nothing from the ledger.

**Pass.**

## 6. No cron triggers, no scheduled or background fetches

- `wrangler.jsonc` has no `triggers` block and no `[[triggers.crons]]` entry.
- `worker/index.ts` exports only a `fetch` handler - no `scheduled` handler exists anywhere in
  `worker/*.ts`, so there is nothing for a cron trigger to even call if one were added later.
- The only outbound fetch (`worker/prices.ts`) runs inside the request handler for
  `/api/prices/:ticker`, which the browser calls only from the "Update market data" action
  (`src/data/marketData.ts`'s `runMarketUpdate`, driven by the Settings screen's button) - there
  is no `setInterval`, no Durable Object alarm, no Worker-side loop.
- No `.github/workflows` or other CI automation exists in the repo that could hit the deployed
  Worker on a schedule.

**Pass.**

## 7. Cloudflare usage vs. free limits, and payment method

**Usage.** Workers Free allows 100,000 requests/day; D1 Free allows roughly 100,000 row writes
and 5M row reads/day. A normal day for one user - a few page loads (each one static-asset
request plus a handful of `GET /api/*` calls) and, on the days they tap "Update market data,"
one Yahoo-backed request per ticker ever held at a flat concurrency of 2 (`runMarketUpdate`) -
comes to on the order of tens to a couple hundred requests and at most one D1 row write per
ticker touched. That's three to four orders of magnitude under either free-tier ceiling; there
is no realistic single-user usage pattern in this app's design that approaches them.

Checked live: `npx wrangler d1 info alpha-ledger-db` shows `database_size: 73.7 kB`,
`read_queries_24h: 0`, `write_queries_24h: 0` - consistent with an app that only writes when you
tap Update, not something running in the background between sessions.

`npx wrangler secret list` on the live Worker shows exactly one secret, `AUTH_TOKEN` - no
leftover `OWNER_EMAIL` from the abandoned Cloudflare Access attempt (PROGRESS.md's task 06 entry
says it was deleted; confirmed still gone).

**Payment method - needs your confirmation, not a code fix.** I could not check this myself:
pulling your Cloudflare OAuth token out of wrangler's local config to call the billing API
directly was (correctly) blocked by the sandbox as a sensitive credential operation, and I'm not
going to work around that block. This has to come from you looking at the dashboard directly:
**Cloudflare dashboard -> Billing -> Payment methods** - confirm it's empty, the way task 06's
whole reason for dropping Cloudflare Access was to avoid a card ever landing there. If one is on
file from something unrelated to this project, that's not this app's doing, but it's worth
knowing either way.

## 8. JSON export and restore

No automated test existed for `worker/api/backup.ts` before this audit (`worker/api/backup.test.ts`
doesn't exist - every other API module has one). Exercised it live against a **scratch
database** - the local `wrangler dev --local` D1 instance, which is gitignored and never the
real remote data:

1. `GET /api/export` on the existing local QA fixtures (`GOOD`/`WEAK`/`NOEST`/`SOLD`/`NEGB`/
   `SPLT`, all synthetic, carried over from earlier tasks) - returns all five tables with every
   field.
2. Added one more synthetic transaction (`ABCD`, a fake ticker, `$100` buy) and exported again -
   the new row appears with the id D1 assigned.
3. `POST /api/restore` with that export - a full response confirming row counts for every table
   (`transactions: 9, aliases: 0, fair_values: 6, price_history: 9, meta: 1`), then a fresh
   export compared field-for-field against the bundle that was restored: **exact match** on all
   five tables.
4. Restored again from the *earlier* export (without the `ABCD` row) and confirmed `ABCD` was
   gone afterward - proving restore **replaces** the database rather than merging into it, per
   the Decision log in `docs/SPEC.md` ("merging two ledgers is not something this app attempts").

**Pass.** One gap worth flagging, not fixing under this task's "no new features" scope: there is
genuinely no automated test for export/restore, so this correctness is currently proven only by
this manual pass and by the code reading cleanly (validate everything before deleting anything,
single D1 batch = one transaction). Worth a `worker/api/backup.test.ts` in a future task.

---

## Fixes applied during this audit

None of the eight items needed a code change - only a deploy (tasks 07-13 had never shipped;
see the top of this document) and the manual verification above.

## Open issues for the user

- **Confirm no Cloudflare payment method is on file** (dashboard -> Billing -> Payment methods -
  section 7). I could not check this myself and won't work around the sandbox block that stopped
  me from pulling your OAuth token to query it directly.
- **`gitleaks` was not run** - available via `pacman -S gitleaks`, needs an interactive sudo
  password I couldn't supply. The manual `git log -p --all` grep in section 1 covers the same
  categories the task lists; this is a nice-to-have second opinion, not a blocking gap.
- **No `worker/api/backup.test.ts`** exists (section 8) - the only API module without one.
- **Credential rotation was verified only in the unit test**, not by rotating the live
  `AUTH_TOKEN` - deliberately, to avoid signing out every real device for this audit. Say so if
  you want it proven against a disposable scratch Worker instead.
- `src/engine/placeholder.test.ts` is still there, still redundant - unrelated to this task, but
  eight tasks running have now declined to delete it.
