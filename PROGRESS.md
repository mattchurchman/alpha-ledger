# Progress log - Rev 3

Each agent appends one entry at the bottom when its task is done. Keep entries short.

**This file is the whole log a session needs.** Rev 1-2 shipped and now live in
`docs/history/REV1-2.md` - grep that archive only when a task points at an old decision, never
read it end to end. Rev 3 plan and reasoning: `docs/REV3_ASSESSMENT.md`; order and models:
`tasks/QUEUE.md` (Claude) or `tasks/CODEX_QUEUE.md` (Codex).


## Rev 3 task status
| # | Task | Model | Status |
|---|------|-------|--------|
| 32 | Import resolver: findings become rules | Opus | done |
| 33 | Persist import decisions | Sonnet | done |
| 34 | Import screen v2 | Opus | done |
| 35 | Real full re-import and owner acceptance (supersedes 25c) | Opus | - |
| 36 | Brand palette into tokens | Opus | done |
| 37 | Logo, icons, sign-in screen | Sonnet | done |
| 38 | "S&P 500" wording | Haiku | done |
| 39 | Dashboard facelift | Opus | partial — implemented; owner screenshot approval pending |
| 40 | Release rev 3 | Haiku | - |

## Rev 3 entries

## Rev 3 planning - 2026-10-15 - Opus
Status: done (planning only; no `src/` change).
Built:
- `docs/REV3_ASSESSMENT.md`: every real-data finding (REMAINING_WORK, 25a, 25b, M1_FORMAT)
  checked against the owner's "full export, re-import, no massaging" workflow; gaps G1-G7.
- `public/brand/` (11 SVGs, text outlined from Geist), `docs/BRAND.md`, `docs/brand/` (review
  sheet, owner's concept art).
- Tasks 32-40, `tasks/QUEUE.md`, `docs/REV3_START.md`; CLAUDE.md now reads PROGRESS from `# Rev 3`.
Decisions:
- Benchmark is labelled "S&P 500" in the UI (owner); method text keeps "(VOO)". Task 38.
- 25c superseded by task 35. Green-for-gains from the concept is not adopted (DESIGN 7).
Verified: SVGs rendered at 16-700px in light and dark; `npm run check` untouched by docs/assets.
Open issues: whether M1 puts a Security Id on CASH rows is unverified - task 35 settles it.

**Next:** tasks/32-import-resolver.md on Opus (effort high) - budget ~120k.

## Task 32 - Import resolver: findings become rules - 2026-10-16 - Codex (Opus equivalent, high)
Status: done.
Built:
- `src/engine/m1/resolve.ts`: pure import planning with account inference, dedupe/ignore memory,
  split-placeholder proof, CUSIP and delisting cash-out resolution, and in-kind proposals.
- `src/engine/m1/parse.ts`: ephemeral source-row metadata and account-label rehashing without
  changing the stored transaction shape.
- `tests/fixtures/m1/full-export-v1.csv`, `full-export-v2.csv` and `resolve.test.ts`: synthetic
  full exports, every known shape, 50 newer v2 rows and the save/re-import proof.
- `docs/M1_FORMAT.md` and `docs/SPEC.md`: resolver rules and the evidence/source-hash decision.
Decisions:
- Cash-out holdings are account-scoped. Delisting evidence requires the series to end before
  the CASH row, no more than 15 market dates behind, and cash per ledger share within 20% of the
  last close; all thresholds are named in `resolve.ts`.
- v2 shape map: ordinary rows, both identical auto-invest rows, the dotted share class and 50
  additions -> `fresh`; both `PRESPLITZZAB` rows -> `autoFixed` drops; CUSIP CASH -> `autoFixed`
  sell; unique delisting CASH and in-kind transfer -> `proposals`; ambiguous CASH -> `needsYou`.
Verified: tests were written and observed failing before implementation; `npm run check` passes
(26 files, 504 tests). After saving v1's generated/accepted transactions and ignored split hashes,
planning v2 returns 50 new rows and zero v1 `autoFixed`, `proposals` or `needsYou` (12 duplicates,
2 ignored).
Open issues: none.

**Next:** tasks/33-import-persistence.md on Sonnet (effort medium) - budget ~60k.

## Task 33 - Persist import decisions - 2026-10-16 - Codex
Status: done.
Built:
- `src/data/importIgnoredHashes.ts`: canonical parsing and serialization for the
  `import_ignored_hashes` meta key; malformed or missing values safely read as an empty set.
- `src/api/client.ts`: `importIgnoredHashes.get()` and `set()` helpers. Saving an empty set
  deletes the meta key; non-empty sets are trimmed, deduplicated and sorted before storage.
- `worker/api.test.ts`: resolver-shaped M1 CASH sells and transfer-in-kind adjustments are
  accepted by bulk import, and a second identical post dedupes both by source-row hash.
- Export/restore coverage now includes `import_ignored_hashes`, proving ignored decisions travel
  with the ledger and survive a restore.
Decisions:
- No schema change was needed: existing transaction validation already permits M1-sourced
  `sell` and signed `adjust` rows, and the existing generic meta endpoint is sufficient.
- Hashes remain case-sensitive; unlike tickers, they are opaque identifiers. Normalization only
  trims, deduplicates and sorts them for deterministic JSON.
Verified:
- `npm run check` passes: typecheck, lint, 27 test files and 509 tests.
Open issues: none.

**Next:** tasks/34-import-screen-v2.md on Opus (effort medium) - budget ~100k.

## Task 34 - Import screen v2 - 2026-10-16 - Codex
Status: done.

Built:
- `src/routes/Import.tsx` now renders task 32's plan per file: editable inferred account label
  with evidence, the new/already-in/auto-fixed/needs-you summary, collapsed evidence-backed
  automatic fixes, and explicit Accept/Choose/Ignore decisions. Import stays disabled until every
  question is handled; ignored rows and proven dropped split placeholders are persisted through
  task 33's meta helper.
- Accepted/generated rows are deduplicated into one bulk post. A successful post immediately runs
  Update market data using the just-imported rows, then shows unpriced holdings, delisting
  candidates, split disagreements and price failures with links to the existing Settings,
  close-out and Reconcile fixes. Help and SPEC now describe that ordering.
- `src/data/importWorkflow.ts` keeps decision resolution pure and tested. The resolver now exposes
  its already-computed candidate transactions, so the UI never reconstructs a ticker, share count
  or settlement amount.
- Task 32 follow-up approved by the owner: account inference still accepts a unique majority, and
  now also accepts at least three exact source-row matches uniquely identifying one account. This
  lets a growing full export infer its existing account while one or two coincidental matches and
  ties still ask. The threshold and rationale are in SPEC and resolver tests.
- `scripts/screenshots.ts` includes `/import` and loads the synthetic v2 fixture before shooting.

Verified:
- `npm run check`: typecheck, lint, 28 test files and **514 tests pass**.
- Isolated temporary D1 + `wrangler dev` + 390px Chromium, using only the committed synthetic
  fixtures and intercepted synthetic prices: v1 showed `8 new / 0 already / 3 fixed / 3 needs
  you`; after two Accepts and one candidate choice its one bulk post contained 12 rows. v2 inferred
  `taxable` from 8 exact matches, showed `50 / 12 / 0 / 0`, and posted 50 rows once. A third v2
  preview showed `0 / 62 / 0 / 0`, Import enabled, and caused no third bulk post. No console errors.
- `npm run screenshots -- --route /import --out /tmp/alpha-ledger-task34-shots` produced 390px and
  1280px light/dark shots; both 390px themes were visually reviewed for wrapping, touch targets,
  decision cards and the fixed bottom navigation.
- Privacy: the diff and status contain only source, synthetic fixtures/tests and documentation; no
  `private/`, D1 state, screenshots, credentials, account exports or real holdings are tracked.

Open issues: none.

**Next:** tasks/35-real-reimport.md on Opus (effort high) - budget ~100k, on the owner's computer
with the owner-supplied private files. If those files are not ready, run tasks/36-brand-tokens.md
next as `tasks/CODEX_QUEUE.md` allows.

## Task 36 - Brand palette into tokens - 2026-10-16 - Codex, then audited by Claude (Opus)
Status: **partial. Uncommitted in the working tree. Do not restart it from scratch.**

Built (uncommitted, in `src/index.css` and `docs/DESIGN.md`):
- Brand tokens swapped in, matching `docs/BRAND.md` exactly: Navy `#0b1b3d`, Royal `#1f4fd8`,
  Sky `#7fa2ff`, Mist `#dce3ec` as `--al-rule`, Paper `#f5f7fa` as the light plane, Slate
  `#5b6678` as secondary ink. Dark mode gets a navy-tinted plane/card instead of neutral
  charcoal. Two new tokens, `--al-brand-surface` and `--al-brand-surface-ink`, are defined in all
  three theme blocks and exported through the Tailwind `@theme` block.
- `docs/DESIGN.md` sections 1, 2.1-2.5 and 7 rewritten for the new hexes.

Verified by Claude on 2026-10-16:
- `npm run check` passes: typecheck, lint, 28 files, 514 tests.
- **Every contrast figure in DESIGN sections 2 and 7 was independently recomputed and is correct
  to two decimals** (WCAG 2 relative luminance): ink 16.96:1 light / 15.92:1 dark, weakest of the
  nine light text pairs 4.61:1, weakest dark 5.56:1, white on Navy 16.96:1, status 4.02 / 4.01 /
  4.23 / 5.39 light, graphite VOO 4.57 light / 6.17 dark, weakest ramp label 5.18 light / 4.76
  dark, weakest accent pair 6.18:1. The numbers are trustworthy; they were simply unreproducible
  until now.
- `scripts/validate_palette.mjs` has since been added so those rows can be re-run with
  `npm run palette`. DESIGN section 7 now names that script.

What is left - this is the whole remainder of task 36:
1. `npm run palette` and confirm every row still passes.
2. `npm run build && npm run screenshots` - `screenshots/` is still from 2026-10-12 and does not
   show this palette.
3. Owner reviews `/kit` and home at 390px and 1280px, light and dark. **This is an owner gate.**
4. Commit `src/index.css`, `docs/DESIGN.md`, and flip the status row above to done.

Open issues: none known. The palette is believed correct and merely unreviewed.

**Which uncommitted files belong to what.** Task 36 owns `src/index.css` and the section 1/2
changes in `docs/DESIGN.md`. Everything else uncommitted - `AGENTS.md`, `CLAUDE.md`,
`PROGRESS.md`, `README.md`, `package.json`, `tasks/CODEX_QUEUE.md`, `tasks/codex/*.md`,
`docs/history/`, `scripts/codex-models.sh`, `scripts/validate_palette.mjs`, and section 7 of
`docs/DESIGN.md` - is a 2026-10-16 instruction and tooling refresh, not task work. Commit it
separately or leave it; either way it is not yours to revert.

**Next:** finish the four steps above, then `tasks/37-brand-assets.md`. Task 38 is independent of
all of this and can run at any time.

## Task 36 completion - 2026-10-17 - Codex
Status: done.

Completed:
- Re-ran `npm run palette`: all 42 recorded contrast and colour-separation rows pass.
- `npm run check` passes: typecheck, lint, 28 test files and 514 tests.
- `npm run build` and `npm run screenshots` pass. `/kit` and home were reviewed at 390px and
  1280px in light and dark; the owner approved the displayed screenshots by replying `push`.
- Reviewed the final diff and status: only source, design documentation and the task handoff are
  included; `private/`, local D1 state and generated screenshots remain ignored.
- The local model menu was verified with `./scripts/codex-models.sh`; it lists `gpt-6-astra`.

Open issues: none.

**Next:** `tasks/codex/38.md` on `gpt-5.6-terra`, effort medium.

## Task 38 - Say "S&P 500" where the owner reads it - 2026-10-17 - Codex
Status: done.

Built:
- Replaced user-facing benchmark labels, legends, chart copy, accessibility text and Help prose
  with “S&P 500”; ticker, engine and API identifiers remain unchanged.
- The first method explanation in both Help and How this is calculated identifies the benchmark as
  “S&P 500 (VOO, bought with the same dollars on the same dates)”.
- Added the wording decision to `docs/SPEC.md`.

Verified:
- `npm run check` passes: typecheck, lint, 28 test files and 514 tests.
- `npm run build` passes. Local `/` and `/help` screenshots at 390px and 1280px in light and dark
  were generated and visually reviewed; labels wrap cleanly and no console errors appeared.
- `rg -n 'VOO' src/routes src/ui` now finds only comments, the ticker-entry placeholder, and the
  explicit VOO method references in Help and How this is calculated.

Open issues: none.

**Next:** `tasks/codex/37.md` on `gpt-6-astra`, effort medium.

## Task 37 - Logo, icons, sign-in screen - 2026-10-17 - Codex
Status: done. Model menu verified with `./scripts/codex-models.sh`: `gpt-6-astra`.

Built:
- Wired the approved horizontal light/dark lockups into the header and desktop rail, and
  the stacked lockups into sign-in. Header height and safe-area padding are preserved.
- Regenerated PNG icons from the approved brand SVGs, updated favicon/manifest/theme colours,
  removed obsolete SVGs, and bumped the service-worker cache. Brand SVG artwork is unchanged.
- Documented iOS icon caching and added `--locked` to the screenshot script for reproducible
  sign-in checks using a synthetic unauthenticated response without accessing ledger data.

Verified:
- `npm run icons:gen`, `npm run check` (28 files, 514 tests), and `npm run build` pass.
- `npm run screenshots -- --route /kit --server vite --out /tmp/alpha-ledger-task37` and
  `npm run screenshots -- --route / --server vite --locked --out /tmp/alpha-ledger-task37`
  pass at 390px and 1280px in light/dark. Mobile header and sign-in shots visually reviewed.
- Chromium and the test Worker required execution outside the restricted sandbox; the rerun
  passed. Diff/privacy review excludes private data, credentials and generated screenshots.

Open issues: none. After deployment, remove/re-add the iPhone home-screen app for the new icon.

**Next:** `tasks/codex/39.md` on `gpt-6-astra`, effort high; dashboard owner review before release.

## Task 39 - Dashboard facelift - 2026-10-17 - Codex
Status: partial — implementation complete; owner screenshot approval pending before task 40.
Model menu verified with `./scripts/codex-models.sh`: `gpt-6-astra`.

Built:
- Dashboard hero pairs all-time annualized IRRs with the signed value-added gap, embedded history
  chart and explicitly chart-only range controls. Performance uses existing values and shows a
  dash for unavailable benchmark total gain. Owner approved this scope clarification in chat.
- Account details, warnings, rebuy, allocation and holdings retain their behavior; Help and SPEC
  record the layout and all-time semantics. No engine, price-fetching or financial math changes.
- `scripts/dashboard-preview.ts` and screenshot `--demo` provide synthetic API responses and
  browser assertions, without opening a database or reading private data.

Verified:
- `npm run check`: typecheck, lint, 28 test files and 514 tests pass. `npm run build` passes.
- `npm run screenshots -- --route / --demo --out /tmp/alpha-ledger-task39` passes at 390px/1280px,
  light/dark: range-only behavior, chart/table/keyboard, account selection/refresh/back, preserved
  sections, no horizontal overflow, unavailable IRR, missing-price warning and no-comparison state.
- Screenshots visually reviewed; no browser errors. Diff/privacy review contains only source,
  synthetic preview tooling and docs. Test Worker and Chromium ran outside the restricted sandbox.

Owner action: approve the four `home-{390,1280}-{light,dark}.png` previews in the output folder.
Future carry-over: embedded chart/card composition and compact performance tables could be used
on Stock detail in a separately scoped task; no other screen was restyled here.
**Next:** finish task 39's owner review, then `tasks/codex/35.md`, `gpt-6-astra`, effort high.
