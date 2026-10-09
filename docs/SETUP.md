# Setup: database, API, login

Everything needed to take this repository from a clone to a private, synced, logged-in app.
Written so it is repeatable - if the Worker or the database ever has to be recreated, work
straight down this file.

No secrets appear here. Three values are set with `wrangler secret put`, which reads them
from your terminal and stores them in Cloudflare, never in a file.

What task 06 built, for context: the D1 schema (`migrations/0001_init.sql`), the `/api/*`
routes (`worker/api/`), the Access JWT check (`worker/access.ts`), and the typed browser
client (`src/api/`).

---

## 0. Cloudflare Access is free for this

Confirmed on Cloudflare's own pages before building any of it, because SPEC section 2 makes
this a stop-and-ask condition:

- The Zero Trust **Free plan** covers **up to 50 users**, and
  [Cloudflare's Zero Trust plans page](https://www.cloudflare.com/plans/zero-trust-services/)
  describes it as being for "teams under 50 users or enterprise proof-of-concept tests";
  the [Zero Trust For Everyone announcement](https://blog.cloudflare.com/teams-plans/) states
  Zero Trust is free for up to 50 users. One user is one user.
- Access for self-hosted applications, the identity providers, and the built-in one-time PIN
  login are all included at that tier. The paid step is $7/user/month, and only past 50 users.
- Log retention is the one metered extra: 10 GB free, then $1/GB/month. This app generates
  Access login events only, so it will not approach that - but do not turn on extra logging.

So: free for one user, no payment method needed. No stop-and-ask was required.

---

## 1. D1 database and schema

The database already exists - task 03 created it with `wrangler d1 create alpha-ledger-db`,
and its real id is in `wrangler.jsonc`. Only run the create step if you are starting over.

```sh
# Only when recreating from nothing; then paste the printed database_id into wrangler.jsonc.
npx wrangler d1 create alpha-ledger-db

# Apply the schema. Local first - this is the database `wrangler dev` and the tests use.
npx wrangler d1 migrations apply alpha-ledger-db --local

# Then the real one.
npx wrangler d1 migrations apply alpha-ledger-db --remote
```

Check either one:

```sh
npx wrangler d1 execute alpha-ledger-db --local \
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Expect `fair_value`, `meta`, `price_history`, `ticker_alias`, `transactions` (plus SQLite's
own `sqlite_sequence` and `d1_migrations`).

Future schema changes go in a **new** numbered file in `migrations/`. Never edit an applied
one - the remote database records which migrations it has run by name.

---

## 2. Cloudflare Access in front of the whole site

The app is served from a `workers.dev` hostname, with no custom domain. Cloudflare added
one-click Access for exactly that case
([changelog, 2025-10-03](https://developers.cloudflare.com/changelog/post/2025-10-03-one-click-access-for-workers/)),
so no domain purchase or DNS work is needed.

Dashboard labels move around; these were the paths as of October 2026.

**2a. Turn Access on for the Worker's hostname.**

1. <https://dash.cloudflare.com> → **Workers & Pages** → **alpha-ledger**.
2. **Settings** → **Domains & Routes**.
3. Next to the `alpha-ledger.*.workers.dev` URL, click **Enable Cloudflare Access**.
4. Do the same for the **Preview URL** row if one is listed. A preview URL serves the same
   Worker and the same database, so leaving it open would leave the ledger open.

This creates an Access application covering the whole hostname - every path, static assets
and `/api/*` alike.

**2b. Restrict it to one email.**

1. Go to the Zero Trust dashboard: <https://one.dash.cloudflare.com>.
2. **Access controls** → **Applications** → the application just created → **Configure**.
3. Under **Policies**, edit the policy (or add one) so it reads:
   - Action: **Allow**
   - Include: selector **Emails**, value: your login email, and nothing else.
   - No Require or Exclude rules.
   - Delete any default policy that allows a wider group, such as "everyone in your
     organization" or an email-domain rule. One Allow policy listing one address.
4. Save.

**2c. One-time PIN login.**

1. Still in Zero Trust: **Settings** → **Authentication** → **Login methods**.
2. Confirm **One-time PIN** is present and enabled. It is on by default and needs no
   identity provider; signing in emails you a six-digit code.
3. If you added any other login method while experimenting, remove it - fewer ways in.

**2d. Longest session, so the iPhone home-screen app stays signed in.**

1. **Access controls** → **Applications** → **alpha-ledger** → **Configure**.
2. Set **Session Duration** to **1 month**, which is the longest Cloudflare offers
   ([session management docs](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/)).
3. Open the policy as well and set its session duration to **1 month** too, or to "same as
   application". A policy-level duration overrides the application's, so a 24-hour policy
   would quietly undo step 2.

**2e. Copy the AUD tag** (needed in step 3).

**Access controls** → **Applications** → **alpha-ledger** → **Configure** →
**Additional settings** → **Application Audience (AUD) Tag**. It is a 64-character hex
string. Copy it; it is not a password, but it names your application, so it is stored as a
secret rather than committed.

**2f. Note your team domain** (also needed in step 3).

Zero Trust → **Settings** → **Custom Pages** (or the dashboard URL itself) shows your team
name. The value needed is the full origin, with the scheme and no trailing slash:

```
https://<your-team-name>.cloudflareaccess.com
```

---

## 3. The three Worker secrets

Access alone would be enough to stop a browser, but the Worker verifies the signed Access
JWT on every `/api/*` request as a second lock (SPEC 10), and a missing secret makes it
answer 403 rather than letting anything through. Set all three.

Run each command, then paste the value when prompted. Nothing is echoed to a file.

```sh
npx wrangler secret put ACCESS_TEAM_DOMAIN   # https://<your-team-name>.cloudflareaccess.com
npx wrangler secret put ACCESS_AUD           # the 64-char AUD tag from step 2e
npx wrangler secret put OWNER_EMAIL          # your login email
```

Confirm all three landed (this lists names only, never values):

```sh
npx wrangler secret list
```

Why these are secrets and not `vars` in `wrangler.jsonc`: the team domain contains your
Cloudflare account name, the AUD identifies your application, and the email is personal
data. SPEC 10 keeps all three out of the repository.

**Never set `DEV_AUTH_BYPASS` as a secret or a var.** It is the local-only switch described
in step 6, and publishing it would disable the JWT check on the live site.

---

## 4. Deploy

```sh
npm run check     # typecheck + lint + tests; must be clean first
npm run build     # produces dist/, which the Worker serves
npx wrangler deploy
```

---

## 5. Verify

**Signed out.** Use a private browser window, or any browser not signed in to Access.

1. Open `https://alpha-ledger.<your-subdomain>.workers.dev` → you should land on the
   Cloudflare Access login page, not the app.
2. Open `.../api/health` in the same window → the Access login page again.
3. From a terminal, which sends no Access cookie:

   ```sh
   curl -i https://alpha-ledger.<your-subdomain>.workers.dev/api/transactions
   curl -i -H 'Cf-Access-Jwt-Assertion: forged.token.here' \
     https://alpha-ledger.<your-subdomain>.workers.dev/api/transactions
   ```

   Both must come back `401` or `403`, and neither body may contain any ledger data. (A
   `curl` may instead get a `302` to the Access login, which is also a pass - Cloudflare
   stopped it before the Worker.)

**Signed in.** Sign in with the one-time PIN, then confirm the two devices actually share
one database. In the browser console on one device:

```js
await fetch('/api/transactions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    account_label: 'setup-check',
    trade_date: '2026-01-02',
    ticker: 'ACME',
    type: 'buy',
    shares: '1',
    amount_usd: '100.00',
    source: 'manual',
    source_row_hash: 'setup-check-1',
  }),
}).then((r) => r.json())
```

On the second device (the phone, signed in the same way), open `/api/transactions` - the
`setup-check` row should be there. Then remove it, so it never reaches a real calculation:

```js
await fetch('/api/transactions/<the id>', { method: 'DELETE' })
```

**Wrong person.** If you have a second email address, temporarily add it to the Access
policy, sign in as it, and confirm `/api/transactions` returns `403 not-the-owner` - Access
let it to the Worker, and the Worker refused it. Remove that email afterwards. This is the
only check that proves the second lock is doing something Access is not.

---

## 6. Running locally

The local Worker has no Access in front of it, so it uses a bypass that only exists locally:

```sh
cp .dev.vars.example .dev.vars   # contains DEV_AUTH_BYPASS=true
npm run build
npx wrangler dev
```

`.dev.vars` is gitignored and is read only by `wrangler dev` and the Vitest worker project.
A deployed Worker cannot see it. With it absent, every local `/api/*` call answers
`403 access-not-configured`, which is the same fail-closed path a misconfigured deploy takes.

Tests need no setup - `npm run test` runs the engine tests in node and the Worker tests in
workerd against a throwaway local D1, applying `migrations/` itself.

---

## 7. Things that will go wrong

| Symptom | Cause |
|---|---|
| `403 access-not-configured` on the live site | One of the three secrets is missing. `npx wrangler secret list`. |
| `403 not-the-owner` when signed in as yourself | `OWNER_EMAIL` does not match the email Access authenticated. Comparison ignores case, nothing else. |
| `403 invalid-access-token` for everyone | `ACCESS_AUD` or `ACCESS_TEAM_DOMAIN` is wrong - a stale AUD after deleting and recreating the application is the usual reason. |
| Signed out again after a day | A policy-level session duration is overriding the application's. See step 2d. |
| The preview URL serves the app with no login | Access was enabled on the `workers.dev` URL but not the Preview URL. See step 2a step 4. |
| `wrangler deploy` fails on `database_id` | `wrangler.jsonc` has a placeholder. Run step 1 and paste the real id. |
