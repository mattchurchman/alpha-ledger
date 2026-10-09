# Alpha Ledger - standing rules for every agent

Personal web app: did my stock picks beat buying VOO with the same dollars on the same dates, and which holdings are below my own fair value.

## How a session works

1. Read `PROGRESS.md`, then the one task file the user names in `tasks/`. Read `docs/SPEC.md` sections the task lists, not the whole file, unless told.
2. Do only that task. Respect its "Out of scope" list. Do not start the next task.
3. Run the acceptance checks. Fix failures before finishing.
4. Append a handoff entry to `PROGRESS.md` (format is in that file), commit, and stop. The user will clear context.

If the task conflicts with the spec or reality (an API changed, a file is missing), stop and tell the user rather than improvising a redesign. Record spec changes in `docs/SPEC.md` under "Decision log".

## Hard rules

- Privacy: nothing from `private/` or the database ever enters git. Fixtures are synthetic. Run `git status` and review the diff before every commit.
- Free only: no paid APIs, no paid tiers, no scheduled or always-on jobs. Market data is fetched only when the user taps Update.
- Scope: no trading, brokerage connections, AI recommendations, computed fair values, news, social, crypto, or financial planning.
- All financial math lives in `src/engine/` as pure TypeScript with no I/O and no UI imports, covered by Vitest. UI never recomputes numbers on its own.
- Money and shares: use `decimal.js` in the engine; round only at display.
- Mobile first: every screen must work at 390px wide before desktop polish.
- Keep context small: prefer Grep and targeted reads over opening whole directories.

## Stack (decided, see SPEC section 2)

Vite + React + TypeScript, Tailwind, Vitest. Cloudflare Workers (static assets + API) with D1. Login is a 256-bit `AUTH_TOKEN` the Worker checks, exchanged for a signed year-long cookie - Cloudflare Access was dropped because its onboarding demands a payment method (see SPEC Decision log).

Design system and component kit: **`docs/DESIGN.md`**, implemented in `src/ui/` and demoed at `/kit`. Screens import from `../ui` and must not hand-roll colours, number formatting, or charts - there is no chart library, just tested SVG geometry in `src/ui/charts/geometry.ts`.

## Commands

- `npm run dev` - Vite dev server for the front end (routed shell only, no worker/API).
- `npm run build` - typecheck, then build the front end to `dist/`.
- `npm run check` - typecheck + lint + test; run before every commit.
- `npm run test` - Vitest once (engine tests).
- `npm run typecheck` - `tsc -b` across app, node, and worker tsconfigs.
- `npm run lint` / `npm run format` - ESLint / Prettier.
- `npm run screenshots` - after `npm run build`, shoots `/kit` at 390px and 1280px in light and
  dark into `screenshots/` (gitignored). Uses the system Chromium, not a Playwright download.
- `npx wrangler dev` - run the Worker locally (serves `dist/`, answers `/api/*`, needs `npm run build` first, and `.dev.vars` for the auth bypass - see `docs/SETUP.md`).
- `npx wrangler d1 migrations apply alpha-ledger-db --local` / `--remote` - apply `migrations/`.
