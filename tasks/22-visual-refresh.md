# Task 22 - Visual refresh
**Model:** Opus. **Next:** `tasks/23-release.md` on Haiku.
**Read:** CLAUDE.md, `docs/DESIGN.md` sections 1 to 3, 5.6, 6 and 7, `src/index.css`, `src/ui/icons.tsx`, `src/ui/AppShell.tsx`.

## Goal
The app reads as a modern, finished phone app. The owner has no fixed preference and trusts your judgement: aim for calm, confident and current, not flashy.

## Direction
Replace the "ledger paper and ink" look. Cooler neutral surfaces, one confident accent, soft elevation and rounder cards where they help hierarchy, generous spacing, a tab bar that feels native. Light and dark both stay. Keep mono numerals in columns.

## Deliverables
- New palette as token values in `src/index.css` only. Screens must not gain hand-rolled colours; if a screen needs a colour that has no token, add the token.
- The beat-VOO / trailed-VOO pair must stay distinguishable for colour-blind users and never rely on colour alone. Re-run the checks in DESIGN 7 and record the new results there.
- Icon set in `src/ui/icons.tsx` redrawn as one consistent modern family, hand-written SVG, with a distinct active state in the tab bar. No icon package.
- Header, tab bar, cards, buttons, fields, tables and sheets restyled through `src/ui/` primitives.
- **Keep the home-screen icon artwork**; the owner likes it. Adjust only its background if the new palette requires, and keep the favicon and touch icon from task 16 in step.
- `public/manifest.json` and the `theme-color` and splash colours in `index.html` match the new palette.
- Rewrite DESIGN sections 1 and 2 to describe the new direction, and add a SPEC Decision log entry.
- Extend `scripts/screenshots.ts` to take a route, then shoot `/kit` and the Dashboard at 390px and 1280px in light and dark.

## Acceptance
- Text contrast meets WCAG AA in both themes. No horizontal scroll at 390px on any screen.
- `npm run check` passes.

## Out of scope
New features, layout rewrites of whole screens, new dependencies, runtime-fetched fonts or assets.

## You do
Look at the screenshots and say yes or ask for changes before task 23 deploys it.
