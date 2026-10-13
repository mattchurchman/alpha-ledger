# Task 28 - Keep `/kit` and synthetic data out of the first-load bundle

**Model:** Sonnet. **Effort:** low. **Context budget:** ~45k.
**Read:** `src/App.tsx` (lines ~10 and ~37), `src/routes/Kit.tsx` imports only, `src/kit/synthetic.ts` header only.
Do not read PROGRESS.md history beyond the Rev 2 status table.

`App.tsx` imports `Kit` statically, so the design-system demo and its fabricated six-year series
ship in the main chunk (514KB / 157KB gzip - over Vite's 500KB warning).

## Do
- `React.lazy` the `Kit` route behind a `Suspense` fallback (use the existing loading state from
  `src/ui/States.tsx`). Keep `/kit` working on the deployed app - DESIGN.md links to it.
- Confirm with `npm run build` that `synthetic.ts` lands in the Kit chunk, not the main one.

## Out of scope
Splitting any other route, dependency swaps, palette changes.

## Acceptance
`npm run check` passes; `npm run build` shows no >500KB warning; before/after main-chunk sizes in
the handoff entry.

**Next:** tasks/29-reseed-fixtures.md on Haiku (effort low).
