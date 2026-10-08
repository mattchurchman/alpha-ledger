# Progress log

Each agent appends one entry at the bottom when its task is done. Keep entries short; the next agent reads this file first.

## Entry format
```
## Task NN - name - YYYY-MM-DD - model used
Status: done | partial (say what is left)
Built: 3-6 bullets, file paths included
Decisions: anything the next agent must know that is not in SPEC
Verified: which acceptance checks were run and passed
Open issues: bugs, shortcuts, things the user must do by hand
```

## Task status
| # | Task | Model | Status |
|---|------|-------|--------|
| 01 | Scaffold | Sonnet | done |
| 02 | M1 format and parser | Opus | todo |
| 03 | Price worker and first deploy | Sonnet | todo |
| 04 | Engine: holdings reconstruction | Opus | todo |
| 05 | Engine: VOO shadow, returns, attribution | Opus | todo |
| 06 | Database, API, login | Sonnet | todo |
| 07 | Design system and app shell | Opus | todo |
| 08 | Import and reconciliation screens | Sonnet | todo |
| 09 | Update Market Data flow | Sonnet | todo |
| 10 | Dashboard | Sonnet | todo |
| 11 | Stock detail and decisions | Sonnet | todo |
| 12 | Fair value and history | Sonnet | todo |
| 13 | Installable app and iPhone icon | Haiku | todo |
| 14 | Privacy and cost audit | Sonnet | todo |
| 15 | Real-data validation | Opus | todo |

## Entries

## Task 01 - Scaffold - 2026-10-08 - Sonnet
Status: done
Built:
- Vite + React + TS app in `src/`, Tailwind v4 (`@tailwindcss/vite`), React Router with empty routes for all six SPEC 9 screens (`src/routes/*.tsx`, wired in `src/App.tsx`).
- Vitest configured via `vite.config.ts`; `src/engine/placeholder.test.ts` exercises `decimal.js`.
- `worker/index.ts`: Cloudflare Worker serving built assets via the `ASSETS` binding and answering `GET /api/health`; `wrangler.jsonc` has a D1 binding placeholder (`database_id` is a dummy UUID, real id comes in task 06).
- ESLint (flat config, typescript-eslint) + Prettier; `npm run check` = typecheck + lint + test.
- Three project-reference tsconfigs (`app` for `src/`, `node` for vite/eslint config, `worker` for `worker/`) since the worker runs without DOM lib/types.
- `CLAUDE.md` Commands section filled in.
Decisions:
- Pinned `typescript` to `~6.0.3` instead of the newly-released 7.x: `typescript-eslint@8.71.1` only supports `typescript <6.1.0`. Revisit the pin once typescript-eslint catches up.
- Used Tailwind v4's Vite plugin (CSS-first, no `tailwind.config.js`) since v4 is current and this avoids extra config for a deliverable that's explicitly "styling beyond defaults" out of scope.
- `npm install` flagged `esbuild` and `workerd` postinstall scripts for approval (npm 11 install-scripts gate); approved both since wrangler/vite need their native binaries. Recorded in `package.json`'s `allowScripts`.
Verified:
- `npm run check` passes (typecheck + lint + test).
- `npm run dev` serves the routed shell; all six routes return 200 and render their placeholder screen.
- `npm run build` succeeds; `npx wrangler dev` serves the built `dist/` at `/` (200) and `GET /api/health` returns `{"status":"ok"}`.
- `git status` shows nothing from `private/` or `dist/`.
Open issues:
- `wrangler.jsonc` D1 `database_id` is a placeholder; task 06 must run `wrangler d1 create` and fill in the real id.
- No real styling, logic, or deploy yet - all explicitly out of scope for this task.
