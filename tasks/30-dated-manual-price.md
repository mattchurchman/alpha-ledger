# Task 30 - Dated manual price, and settle the price fallback

**Model:** Sonnet. **Effort:** medium. **Context budget:** ~60k.
**Read:** `docs/PRICES.md`, `worker/api/priceHistory.ts`, `grep -n "manual\|single" src/data/marketData.ts`,
then the one route that renders the set-a-price form (grep for it; do not open every route).

Yahoo is the only price source. A CSV series import exists, but the single-price form always
writes today's date, so one bad or missing past day cannot be fixed by hand.

## Do
- Add a date field to the single-price form, default today, no future dates. Validate in the
  Worker too (`worker/validate.ts`), with a test in `worker/api.test.ts`.
- Record in `docs/SPEC.md` Decision log that CSV series import + dated single price **is** the
  fallback, and delete the unbuilt fallback design from `docs/PRICES.md` so it stops reading as a plan.
- Update that screen's section in `src/routes/Help.tsx`.

## Out of scope
New price sources, scheduled fetching (hard rule: free, on-tap only).

## Acceptance
`npm run check` passes; a past-dated price written locally shows on the chart at that date.

**Next:** tasks/31-polish-tail.md on Haiku (effort low).
