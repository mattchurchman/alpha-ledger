# Task 23 - Release rev 2
**Model:** Haiku. **Next:** none, rev 2 is finished.
**Read:** CLAUDE.md, `docs/INSTALL_IPHONE.md`, `public/sw.js`.

## Goal
Rev 2 is live and on the owner's home screen.

## Deliverables
- Bump `CACHE_NAME` in `public/sw.js` so installed phones pick up the new shell.
- `npm run check`, `npm run build`, `npx wrangler deploy`. Smoke-check live as earlier entries did: `/` returns 200, a signed-out `/api/transactions` returns 401.
- `docs/INSTALL_IPHONE.md`: add how to refresh the installed app, including removing and re-adding the icon if the old one sticks.
- Read `src/routes/Help.tsx` once for statements rev 2 made untrue and fix them.
- Mark the rev 2 table in `PROGRESS.md` complete and record the deployed version.

## Acceptance
- Live site serves the new bundle. `npm run check` passes.

## Out of scope
Any new feature or restyle. If something is broken, report it rather than fixing it here.

## You do
On the iPhone: open the app, confirm the header clears the status bar, set a fair value without the field dropping focus, and open a ticker from Rebuy opportunities.
