# Task 06 - Database, API, login
**Model:** Sonnet. **Read:** CLAUDE.md, SPEC sections 2, 3, 10; `worker/` entry file.

## Goal
Private, synced storage that only the owner can reach.

## Deliverables
- D1 migration for the tables in SPEC 3. Local and remote databases created.
- `/api` routes: transactions (list, bulk upsert by hash, create, update, exclude, delete), aliases, fair values (list, add, delete), price history (get all, put one), meta, full JSON export, full JSON restore.
- Cloudflare Access application covering the whole hostname, policy = allow only the owner's email, one-time PIN login, longest session length offered. First confirm on Cloudflare's own pricing page that this is free for one user; if not, stop and ask.
- Worker verifies the Access JWT on every `/api/*` call (signature, audience, email match from a secret/env var). Local dev bypass only when running under `wrangler dev`.
- Typed client in `src/api/`. Route tests using the Workers test pool.
- `docs/SETUP.md`: exact dashboard clicks and commands the user ran, so the setup is repeatable. No secrets in it.

## Acceptance
- Signed out (private browser window): the site and `/api/health` both redirect to the Access login. A request with no or forged JWT straight to `/api/transactions` gets 401/403.
- Signed in: create a transaction on one device, see it on another.
- The owner's email is not in the repository (`git grep` for it returns nothing).

## Out of scope
UI beyond a temporary debug page, price fetching logic.

## You do
Follow the agent's click-by-click steps in the Cloudflare dashboard; give it your login email as a secret, not in a file.
