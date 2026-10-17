# Starting rev 3

Rev 3 is nine tasks, `tasks/32` to `tasks/40`, run one at a time, each in a fresh session.
Two goals: **re-importing a full M1 export just works** (32-35), and **the first step of a
brand facelift** (36-39). Why each exists: `docs/REV3_ASSESSMENT.md`. Brand: `docs/BRAND.md`.

## Once, before the first task
1. In your `alpha-ledger` folder run `git pull`, then `claude`.

## For every task
1. Type `/clear`.
2. Type `/model`, pick the model the table names, and set the effort.
3. Type `Do tasks/<file>`.
4. Answer any questions. It finishes by pushing to GitHub and printing exactly what to type next.

| # | File | Model | Effort | Budget |
|---|------|-------|--------|--------|
| 32 | `tasks/32-import-resolver.md` | Opus | high | ~120k |
| 33 | `tasks/33-import-persistence.md` | Sonnet | medium | ~60k |
| 34 | `tasks/34-import-screen-v2.md` | Opus | medium | ~100k |
| 35 | `tasks/35-real-reimport.md` | Opus | high | ~100k - **your computer**, fresh M1 exports for every account |
| 36 | `tasks/36-brand-palette.md` | Opus | medium | ~70k |
| 37 | `tasks/37-brand-assets.md` | Sonnet | low | ~45k |
| 38 | `tasks/38-sp500-wording.md` | Haiku | low | ~40k |
| 39 | `tasks/39-dashboard-facelift.md` | Opus | high | ~100k |
| 40 | `tasks/40-release-rev3.md` | Haiku | low | ~35k |

## Good to know
- 36-39 don't depend on 32-35. Away from your computer when 35 comes up? Run 36-39 first.
- Before 35: export full activity for **every** account from M1 into `private/m1/<account>.csv`.
- Nothing changes on your phone until task 40 deploys. After it, delete and re-add the home-screen
  app so iOS picks up the new icon.
- 36 and 39 end with screenshots for you to approve.

## What shipped

- Rev 3 is live at https://alpha-ledger.alpha-ledger.workers.dev; version `9d779174-1fc9-43e2-9363-86ab19e99ca5`.
- Full-export import planning, remembered decisions and the revised import screen are deployed; task 35's real-data acceptance remains owner-deferred and unverified.
- The approved palette, logos, sign-in screen, app icons, S&P 500 wording and dashboard facelift are deployed.
- `npm run check` passes all 514 tests; build and live browser checks pass, with synthetic dashboard data (`scripts/release-smoke.ts`).
- Remove and re-add the iPhone home-screen app to refresh the cached icon; no database migration was required for this release.
