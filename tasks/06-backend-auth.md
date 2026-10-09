# Task 06 - Database, API, login
**Model:** Sonnet. **Read:** CLAUDE.md, SPEC sections 2, 3, 10; `worker/` entry file.

> **DONE 2026-10-08, with one deliverable changed.** The Cloudflare Access parts below
> (struck through) were abandoned: Access is free for one user, but Zero Trust onboarding
> requires a payment method on file, which breaks the free-only rule. The user decided to drop
> it. Login is instead a 256-bit `AUTH_TOKEN` the Worker checks itself, exchanged for a signed
> year-long HttpOnly cookie. **SPEC sections 2 and 10 and the Decision log are the current
> truth, not this file**; `docs/SETUP.md` has the setup and `PROGRESS.md` the handoff.
>
> One consequence that outlives this task: the app shell is now publicly readable, because an
> in-Worker gate cannot stop a request at Cloudflare's edge. No data is in the shell. Task 14
> should confirm that is still acceptable.

## Goal
Private, synced storage that only the owner can reach.

## Deliverables
- D1 migration for the tables in SPEC 3. Local and remote databases created.
- `/api` routes: transactions (list, bulk upsert by hash, create, update, exclude, delete), aliases, fair values (list, add, delete), price history (get all, put one), meta, full JSON export, full JSON restore.
- ~~Cloudflare Access application covering the whole hostname, policy = allow only the owner's email, one-time PIN login, longest session length offered. First confirm on Cloudflare's own pricing page that this is free for one user; if not, stop and ask.~~ **Replaced:** one 256-bit `AUTH_TOKEN` Worker secret, unlocked at `POST /api/session` for a signed HttpOnly `SameSite=Strict` cookie lasting a year.
- ~~Worker verifies the Access JWT on every `/api/*` call (signature, audience, email match from a secret/env var).~~ **Replaced:** the Worker verifies the session cookie's HMAC, or the token as a bearer header, on every `/api/*` call. Local dev bypass only when running under `wrangler dev`.
- Typed client in `src/api/`. Route tests using the Workers test pool.
- `docs/SETUP.md`: exact commands the user ran, so the setup is repeatable. No secrets in it.

## Acceptance
- ~~Signed out (private browser window): the site and `/api/health` both redirect to the Access login.~~ **Replaced:** signed out, `/api/health` and every data route return 401; the site serves the unlock screen. A request with no or wrong credential straight to `/api/transactions` gets 401/403.
- Signed in: create a transaction on one device, see it on another.
- ~~The owner's email is not in the repository (`git grep` for it returns nothing).~~ **Replaced and widened:** neither the owner's email nor the access token is in the repository.

## Out of scope
UI beyond a temporary debug page, price fetching logic.

## You do
~~Follow the agent's click-by-click steps in the Cloudflare dashboard; give it your login email as a secret, not in a file.~~ **Replaced:** store the generated access token in a password manager. There is no recovery path; losing it means generating a new one.
