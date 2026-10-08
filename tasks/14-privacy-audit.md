# Task 14 - Privacy and cost audit
**Model:** Sonnet. **Read:** CLAUDE.md, SPEC sections 2, 8, 10; `docs/SETUP.md`.

## Goal
Independent check that the two hard promises hold: private and free. You did not write this code; do not assume it is right.

## Deliverables
- `docs/AUDIT.md` with pass/fail and evidence for each item:
  - Full git history scan for CSV data, dollar amounts tied to tickers, account numbers, emails, tokens (`git log -p` grep, plus a secret scanner such as gitleaks if installable).
  - Signed-out requests to every static path and every API route are refused.
  - API rejects a missing, expired and wrong-audience token.
  - No third-party requests from the browser (fonts, analytics, CDNs). Only Worker to Yahoo leaves the system.
  - No cron triggers, no scheduled or background fetches; price calls only after the Update tap.
  - Cloudflare usage for a normal day versus free limits; confirm no paid plan or card-required feature is enabled.
  - JSON export downloads everything and restore works on a scratch database.
- Fix what fails if small; otherwise list it for the user.

## Acceptance
- Every item passes or has an explicit, user-acknowledged exception.

## Out of scope
New features.
