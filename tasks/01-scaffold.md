# Task 01 - Scaffold
**Model:** Sonnet. **Read:** CLAUDE.md, SPEC sections 2 and 10.

## Goal
An empty but working project that every later task builds on.

## Deliverables
- Vite + React + TypeScript app in `src/`, Tailwind, React Router with empty routes for the six screens in SPEC 9.
- Vitest configured; `src/engine/` with one placeholder test. `decimal.js` installed.
- `worker/` with a Cloudflare Worker entry that serves the built assets and answers `GET /api/health`. `wrangler.jsonc` with a D1 binding placeholder. No deploy yet.
- ESLint + Prettier, `npm run check` = typecheck + lint + test.
- Fill in the "Commands" section of CLAUDE.md.

## Acceptance
- `npm run check` passes. `npm run dev` shows the routed shell.
- `git status` shows nothing from `private/`.

## Out of scope
Styling beyond defaults, any real logic, deployment, database tables.

## You do
Install Node.js LTS first if `node -v` fails.
