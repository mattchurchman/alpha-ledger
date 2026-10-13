# Task 29 - Make the synthetic price fixtures unfetchable

**Model:** Haiku. **Effort:** low. **Context budget:** ~35k.
**Read:** `docs/PRICES.md`, `grep -rn "GOOD\|'VOO'" src/kit src/engine/__fixtures__ tests/fixtures worker/test`.

Synthetic tickers `GOOD` and `VOO` are real symbols, so tapping Update in local QA overwrote their
fabricated history with real Yahoo data and broke the story the fixtures were built to tell.

## Do
- Rename the colliding *synthetic* symbols to unfetchable ones (`ZZGOOD`; for the benchmark see
  next bullet) everywhere they appear in fixtures and QA seed data.
- The benchmark is `VOO` in the engine. `grep -n "VOO" src/engine/shadow.ts src/engine/index.ts`:
  if the benchmark symbol is a parameter, use `ZZVOO` in fixtures only; if it is hard-coded, leave
  `VOO` alone and say so in the handoff - do not refactor the engine here.
- If a local D1 with fixture data exists (`.wrangler/`), re-seed it via the price-history endpoint;
  if none exists, skip and say so.

## Out of scope
Engine changes, real-data anything.

## Acceptance
`npm run check` passes. Grep shows no synthetic fixture using a real ticker that Update would fetch.

**Next:** tasks/30-dated-manual-price.md on Sonnet (effort medium).
