# Task 14 - Privacy and cost audit
**Model:** Sonnet. **Read:** CLAUDE.md, SPEC sections 2, 8, 10; `docs/SETUP.md`.

## Goal
Independent check that the two hard promises hold: private and free. You did not write this code; do not assume it is right.

## Deliverables
- `docs/AUDIT.md` with pass/fail and evidence for each item:
  - Full git history scan for CSV data, dollar amounts tied to tickers, account numbers, emails, tokens (`git log -p` grep, plus a secret scanner such as gitleaks if installable). The access token must appear nowhere.
  - Signed-out requests to **every API route** are refused - `/api/health` and `/api/prices/*` included, not just the data routes.
  - **The app shell is expected to be publicly readable** - this changed in task 06 when Cloudflare Access was dropped, because an in-Worker gate cannot refuse a request at Cloudflare's edge (SPEC 10 and the Decision log). Do not "fix" it by trying to gate static assets. Instead confirm the promise it rests on still holds: fetch the shell signed out and verify it leaks **no** personal data - no tickers, amounts, account labels, email, or token, in the HTML, the JS bundle, or any source map. Say explicitly whether the temporary `/debug` route is still present and whether it should be.
  - API rejects a missing credential, a wrong token, an expired session cookie, and a cookie signed with a previous token (rotate `AUTH_TOKEN` on a scratch Worker to check the last one).
  - No third-party requests from the browser (fonts, analytics, CDNs). Only Worker to Yahoo leaves the system.
  - No cron triggers, no scheduled or background fetches; price calls only after the Update tap.
  - Cloudflare usage for a normal day versus free limits; confirm no paid plan or card-required feature is enabled, and that **no payment method is on file** (task 06 dropped Cloudflare Access precisely because its onboarding demands one).
  - JSON export downloads everything and restore works on a scratch database.
- Fix what fails if small; otherwise list it for the user.

## Acceptance
- Every item passes or has an explicit, user-acknowledged exception.

## Out of scope
New features.
