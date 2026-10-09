# Setup: database, API, login

Everything needed to take this repository from a clone to a private, synced, logged-in app.
Written so it is repeatable - if the Worker or the database ever has to be recreated, work
straight down this file.

No secrets appear here. The one secret is set with `wrangler secret put`, which reads it from
your terminal and stores it in Cloudflare, never in a file.

What task 06 built: the D1 schema (`migrations/0001_init.sql`), the `/api/*` routes
(`worker/api/`), the token gate (`worker/auth.ts`), the unlock screen (`src/AuthGate.tsx`) and
the typed browser client (`src/api/`).

---

## 0. Why not Cloudflare Access

The original plan was Cloudflare Access, and SPEC section 2 made "confirm it is free for one
user" a stop-and-ask condition. Both halves of that turned out to matter:

- **The price is genuinely zero.** Zero Trust Free covers up to 50 users, Access for
  self-hosted applications and the built-in one-time PIN included
  ([plans page](https://www.cloudflare.com/plans/zero-trust-services/),
  [announcement](https://blog.cloudflare.com/teams-plans/)). The paid step starts past 50 users.
- **But onboarding asks for a payment method anyway**, even when you pick the Free plan
  ([reported here](https://costbench.com/software/business-vpn/cloudflare-zero-trust/free-plan/),
  [community thread](https://community.cloudflare.com/t/how-to-add-an-ztna-app-for-free-in-access-without-entering-credit-card-detail/764129)).
  You would not be charged, but a card on file is what this project's free-only rule exists to
  avoid.

The user ruled that a breach of the rule, so login is a token the Worker checks itself. The
trade-off is recorded in `docs/SPEC.md`'s Decision log; the one thing lost is that the app
shell is now publicly readable, since an in-Worker gate cannot stop a request at Cloudflare's
edge the way Access did. The shell is HTML and JavaScript with no personal data in it, and
every byte of ledger data goes through `/api/*`, which is gated.

---

## 1. D1 database and schema

The database already exists - task 03 created it with `wrangler d1 create alpha-ledger-db`, and
its real id is in `wrangler.jsonc`. Only run the create step if you are starting over.

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

Expect `fair_value`, `meta`, `price_history`, `ticker_alias`, `transactions` (plus SQLite's own
`sqlite_sequence` and `d1_migrations`).

Future schema changes go in a **new** numbered file in `migrations/`. Never edit an applied
one - the remote database records which migrations it has run by name.

---

## 2. The access token

One secret, `AUTH_TOKEN`. Generate it and set it in a single command so the value never lands
in a file or your shell history:

```sh
openssl rand -hex 32 | tee /dev/tty | tr -d '\n' | npx wrangler secret put AUTH_TOKEN
```

`tee /dev/tty` prints the token once so you can copy it. **Put it in your password manager
immediately** - it is not recoverable, and it is the only way into the app.

Confirm it landed (this lists names only, never values):

```sh
npx wrangler secret list
```

Why a generated token and not a password you choose: the free Workers plan allows about 10ms of
CPU per request (SPEC 2), which is not enough for a password hash at a safe iteration count. A
256-bit random token needs no slow hash, because it is not guessable at any request rate. **So
do not replace it with something memorable** - that would quietly remove the only thing making
a fast comparison safe.

### Rotating it, or signing every device out

The cookie-signing key is derived from the token, so re-running the command above does both at
once: new credential, and every existing session immediately invalid. Do it if you ever paste
the token somewhere you regret.

---

## 3. Deploy

```sh
npm run check     # typecheck + lint + tests; must be clean first
npm run build     # produces dist/, which the Worker serves
npx wrangler deploy
```

---

## 4. Verify

Set `URL` and `TOKEN` in your shell first:

```sh
URL=https://alpha-ledger.<your-subdomain>.workers.dev
TOKEN=<the token from step 2>
```

**Signed out.** None of these should return data:

```sh
curl -i $URL/api/transactions                              # 401 missing-credentials
curl -i $URL/api/export                                    # 401
curl -i $URL/api/health                                    # 401 - even liveness is gated
curl -i -H 'Authorization: Bearer wrong' $URL/api/transactions   # 403 invalid-token
curl -i -X POST $URL/api/session \
  -H 'Content-Type: application/json' -d '{"token":"guess"}'     # 403 invalid-token, no cookie
```

**The unlock, and that the cookie works:**

```sh
curl -s -c jar.txt -X POST $URL/api/session \
  -H 'Content-Type: application/json' -d "{\"token\":\"$TOKEN\"}"   # 200 + Set-Cookie
curl -s -b jar.txt $URL/api/session        # {"authenticated":true}
curl -s -b jar.txt $URL/api/transactions   # 200
curl -s -b jar.txt -X DELETE $URL/api/session   # 204, cookie expired
curl -s -b jar.txt $URL/api/transactions   # 401 again
rm jar.txt
```

The `Set-Cookie` header should read:

```
al_session=...; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000
```

`HttpOnly` means page scripts cannot read it, `Secure` means it never travels over plain HTTP,
and `SameSite=Strict` means no other site can make your browser send it - which is what stands
in for a CSRF token.

**In the browser, and that two devices share one database:**

1. Open `$URL` on your laptop. You should get the unlock screen, not the app.
2. Paste the token, click Unlock. The app appears.
3. Go to `/debug`, click **Add a test row**.
4. Open `$URL` on your phone, unlock it the same way, go to `/debug`. **The row should already
   be there.** That is the sync check.
5. Click **Delete debug rows** so nothing fake reaches a real calculation.

---

## 5. Running locally

The local Worker has no token set, so it uses a bypass that only exists locally:

```sh
cp .dev.vars.example .dev.vars   # contains DEV_AUTH_BYPASS=true
npm run build
npx wrangler dev
```

`.dev.vars` is gitignored and is read only by `wrangler dev` and the Vitest worker project. A
deployed Worker cannot see it. With it absent, every local `/api/*` call answers
`403 auth-not-configured`, which is the same fail-closed path a misconfigured deploy takes.

Tests need no setup - `npm run test` runs the engine and client tests in node and the Worker
tests in workerd against a throwaway local D1, applying `migrations/` itself.

---

## 6. Things that will go wrong

| Symptom | Cause |
|---|---|
| `403 auth-not-configured` on the live site | `AUTH_TOKEN` is not set. `npx wrangler secret list`. |
| `401 missing-credentials` | No session cookie and no bearer header - normal when signed out. |
| `403 invalid-token` | Wrong token. Check for a stray space or a truncated paste. |
| `403 invalid-session` | The cookie was signed with a previous token. Unlock again; this is what rotation looks like. |
| `401 session-expired` | The year is up. Unlock again. |
| Unlock screen loops, cookie never sticks | Browser is blocking cookies for the site, or you are on plain HTTP where `Secure` applies. |
| Lost the token | There is no recovery. Run the step 2 command again to set a new one; the data in D1 is untouched. |
| `wrangler deploy` fails on `database_id` | `wrangler.jsonc` has a placeholder. Run step 1 and paste the real id. |
