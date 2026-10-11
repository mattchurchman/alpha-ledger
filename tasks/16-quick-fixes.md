# Task 16 - Quick fixes
**Model:** Haiku. **Next:** `tasks/17-chart-ranges.md` on Sonnet.
**Read:** CLAUDE.md, then only the files named below.

## Goal
Clear the four small annoyances before any feature work.

## Deliverables
1. **Field loses focus on every keystroke.** Cause is known: the effect in `src/ui/BottomSheet.tsx` lists `onClose` in its dependencies, every caller passes an inline arrow, so each keystroke re-runs the effect and `panelRef.current?.focus()` steals focus. Hold `onClose` in a ref and depend on `open` only. Check the other sheets (Activity, Import, Settings) behave too.
2. **iPhone header under the status bar.** The `<header>` in `src/ui/AppShell.tsx` has no top inset; add `env(safe-area-inset-top)` padding (the tab bar already does this for the bottom). `index.html` uses `black-translucent`, whose status text is always white, so it is unreadable over the light theme, and the two `theme-color` metas look swapped. Make the status bar legible in light and dark. Keep Help's anchor offset (`scroll-mt-32`) clearing the taller header.
3. **Open a ticker from Rebuy opportunities.** In `src/routes/Dashboard.tsx`, each `DiscountMeter` row and each "No estimate yet" / missing-price pill navigates to `/stocks/:ticker`. Targets must meet the 44px floor (DESIGN 3.3); the comment beside the pills explains the old trade-off.
4. **Browser tab icon.** `index.html` has no `rel="icon"`. Add one from `public/icon.svg` plus a 32px PNG fallback, and a real 180px `apple-touch-icon` (it currently points at the 192px file). Keep the existing artwork. No new dependency; Chromium is already used by `scripts/screenshots.ts`.
5. Delete the stray file `alpha-ledger/123`.

## Acceptance
- With `npx wrangler dev`, type six characters into Fair values > Set value without re-clicking.
- 390px screenshot shows the header title fully below the top inset.
- `npm run check` passes.

## Out of scope
New colours, new icons, chart changes, any redesign of the fair-value sheet (task 21).
