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
Vite + React + TypeScript, Tailwind, Vitest. Cloudflare Workers (static assets + API) with D1. Cloudflare Access in front of everything. Charts per `docs/DESIGN.md` once task 07 creates it.

## Commands
Filled in by task 01.
