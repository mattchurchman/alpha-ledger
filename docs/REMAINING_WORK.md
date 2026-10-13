# Remaining work - completion assessment, 2026-10-12

Written after rev 2 (tasks 16-24) shipped. This is an audit of what is actually left, not a
feature wishlist. Each item below is sized to become its own `tasks/NN-*.md` file; the numbering
continues from task 24.

## Where the project stands

**Feature-complete against the spec.** Every screen in `docs/SPEC.md` section 9 exists
(`src/routes/`: Dashboard, StockDetail, FairValues, Activity, Import, Settings, Help,
HowCalculated, ClosePosition, TransactionForm, Kit). All of rev 1 (01-15) and rev 2 (16-24) are
marked done in `PROGRESS.md`, the tree is clean, `HEAD` matches `origin`, and rev 2 is deployed
(`296b3f5`, Cloudflare `3d4d5f38`). The scaffolding tasks planned to remove is gone - the
temporary `/debug` route and its nav link are deleted, and task 14's "no `worker/api/backup.test.ts`"
gap is in fact covered: `worker/api.test.ts` has an `export and restore` block that asserts the
excluded flag survives and that a bundle restores byte-for-byte, row ids included.

**What is not finished is verification, not construction.** One task was never really done, two
defects are confirmed and reproducible, and a handful of deliberate deferrals have accumulated.

### Current check status

~~`npm run check` **fails intermittently** on this machine: `src/engine/index.test.ts > analyze
performance > handles six years of sixty tickers in under 1000ms` measured 1069ms in a full-suite
run, then passed three times out of three when that file was run alone. 486 of 487 tests pass; the
failure is the wall-clock budget, not a wrong number. See task 26.~~

**Fixed by task 26 (2026-10-12).** `npm run check` passes typecheck + lint + 486 tests, verified
five consecutive times including under parallel-build load and once under full CPU saturation.
The perf budget is now a documented tripwire (4000ms) with the measured time printed every run.

---

## Task 25 - Finish task 15: real-data validation - BLOCKED on the owner
**Model:** Opus. **Read:** CLAUDE.md, `tasks/15-validation.md`, SPEC sections 4, 5, 6,
`docs/ENGINE_API.md`, `docs/M1_FORMAT.md`.

This is the one outstanding item that matters more than everything else here combined. The app's
entire purpose is answering "did my picks beat VOO", and that answer has never been checked
against the real portfolio. `private/m1/` does not exist, so all six of task 15's checks are still
open, and `src/routes/HowCalculated.tsx:59-66` still ships a "Known limitations" bullet telling the
user in the app that **"The math has not been checked against a real export yet."**

Run `tasks/15-validation.md` as written. Specifically:
- The user must first drop the real activity CSVs into `private/m1/` (one file per account,
  filename = account label) and run `npm run m1:summary`. Nothing in this task can start before
  that.
- Expect unrecognized rows - transfers in kind, corporate actions, possibly splits. M1's split
  rows currently parse as *unrecognized* rather than as `split` transactions (task 02/04's open
  issue), so real history is also what settles whether M1 exports them at all, and whether
  `crossCheckSplits` ever gets to run on real input.
- Reconcile **after** tapping Update market data, not before: with an empty `prices` table every
  split factor falls back to 1 and reconciliation silently compares unadjusted share counts
  (task 14's open issue). Decide in this task whether that deserves a warning in the UI.
- Delete the first "Known limitations" bullet when the checks pass - it was written to be
  deleted. Re-read Help's Import and Reconcile sections too: both describe a clean import that
  this repo has not proven.

**Out of scope:** new features, redesigns.

## Task 26 - Make `npm run check` a trustworthy gate - DONE 2026-10-12
**Model:** Sonnet (done on Opus). **Read:** `src/engine/index.test.ts` (the `analyze performance` block),
`vitest.engine.config.ts`, CLAUDE.md's Commands section.

CLAUDE.md requires `npm run check` before every commit, so a gate that fails on machine load is a
gate agents will learn to ignore. Reproduced this session: 1069ms against a 1000ms budget in the
full suite, passing alone three times running.

- Decide between raising `BUDGET_MS` with a comment explaining what the number is defending
  against, or moving the assertion out of the blocking suite (a `bench`/tagged run invoked
  deliberately). Keep a perf signal - do not just delete the test; task 05 recorded ~410ms in Node
  as the baseline, and "roughly 1-3s on a phone for 60 tickers" is a real product constraint worth
  a tripwire.
- While in this file, delete `src/engine/placeholder.test.ts`. It has been redundant since task
  02 and **eight** tasks running have declined to remove it on the grounds it was not their call.
  Make it this task's call.

**Acceptance:** `npm run check` passes five consecutive times, including once under load (e.g.
with a parallel `npm run build`).

## Task 27 - Keyboard access for desktop table rows
**Model:** Sonnet. **Read:** `src/ui/DataTable.tsx` (lines ~153 and ~215), `docs/DESIGN.md`
section 3.3.

Confirmed still present. When `onRowSelect` is passed, the phone layout renders a real
`<button>` (line 153) but the desktop layout puts `onClick` on a bare `<tr>` (line 218) with no
`tabIndex` and no `onKeyDown`. A mouse can select a row; a keyboard cannot. Pre-existing since
task 10, noted as out of scope by task 11, and now used by Dashboard holdings, the decision list
and the per-account strip - so it is the one interaction pattern in the app that is mouse-only.

- Fix it in `DataTable` so every caller benefits: either make the first cell's content a real
  button, or give the row `tabIndex={0}` plus Enter/Space handling and an appropriate role.
  Whichever way, the focus ring must be visible on the new accent-wash hover background.
- Check the `rowAction` cell still swallows its own click (the comment at line ~233) and that
  tabbing reaches the action without first selecting the row.

**Acceptance:** `npm run check` passes; keyboard-only walkthrough of the Dashboard holdings table
and one `rowAction` footer, recorded in the handoff entry.

## Task 28 - Keep `/kit` and synthetic data out of the production bundle
**Model:** Sonnet. **Read:** `src/App.tsx` (lines 10 and 37), `src/kit/synthetic.ts`,
`src/routes/Kit.tsx`, task 07 and task 22's open issues in `PROGRESS.md`.

Task 07 flagged that `/kit` plus `src/kit/synthetic.ts` ship to production and asked task 14 to
decide; task 14 never did, and `App.tsx:10` still imports `Kit` statically. Task 22 separately
recorded that the build crossed Vite's 500KB warning line for the first time (514KB / 157KB
gzip). These are the same problem: the design-system demo and its six years of fabricated series
are in the first-load chunk of a personal finance app.

- `React.lazy` the `Kit` route (and anything only it uses) so the demo is a separate chunk, or
  gate it out of production builds entirely. Lazy is preferred - `/kit` is the design system's
  reference and `docs/DESIGN.md` points at it, so it should keep working on the deployed app.
- Report the before/after main-chunk size in the handoff entry. The >500KB warning should be gone.

**Out of scope:** general code-splitting of the real routes, dependency swaps, palette changes.

## Task 29 - Re-seed the synthetic price fixtures
**Model:** Haiku. **Read:** task 20's open issue in `PROGRESS.md`, `docs/PRICES.md`,
`tests/fixtures/`.

Task 20's QA ran "Update market data" against the local fixture, and because the fixture's
synthetic tickers `GOOD` and `VOO` collide with real traded symbols, their fabricated 900-day
history was overwritten with real Yahoo data. Nothing is broken, but the local fixture no longer
tells the story that earlier `PROGRESS.md` entries describe (`GOOD` now reads as a loser rather
than a deep-discount winner), and the benchmark's `asOf` jumping to today surfaces spurious
"looks delisted" warnings on the other synthetic tickers. Any future manual QA session walks into
this.

- Re-seed `GOOD` and `VOO` through the manual price-history endpoint (task 08/09's method:
  delete the stray rows, write fresh fabricated history).
- Rename the colliding fixture symbols to something unfetchable (e.g. `ZZGOOD`, `ZZVOO`) so a
  future Update cannot repeat this. The benchmark symbol is the awkward one - check whether the
  shadow engine's VOO symbol is configurable before committing to renaming it, and say so in the
  handoff if it is not.

## Task 30 - Build the manual price fallback, or write down that there isn't one
**Model:** Sonnet. **Read:** `docs/PRICES.md`, `worker/prices.ts`, `src/data/marketData.ts`.

Market data has a single source, Yahoo, reached from the Worker with no contract and no fallback.
`docs/PRICES.md` *designs* a manual CSV fallback for the day Yahoo blocks the deployed Worker, but
task 03 left it unbuilt and no later task picked it up. The CSV series import exists; what is
missing is the single-day backfill (task 09: "the set-a-single-current-price form has no date
picker - it always writes today's date"), so there is no way to fix one bad or missing past day by
hand.

- Add a date to the manual price form, defaulting to today. That alone closes the gap for the
  common case.
- Then decide explicitly: build the rest of `PRICES.md`'s fallback, or record in the Decision log
  that the CSV series import plus a dated single-price form *is* the fallback, and delete the
  undone design from `PRICES.md` so it stops reading as a plan.

## Task 31 - Polish pass on the open-issue tail
**Model:** Haiku. **Read:** the open-issue blocks for tasks 18-22 in `PROGRESS.md`.

Small, independent, each a few lines. Do them together or drop any that no longer apply:
- `hidden_tickers` is written as `[]` rather than removed when the last ticker is unhidden -
  harmless, slightly untidy in an export.
- `StockDetail`'s headline footnote still reads "Your picks against…" in a narrowed single-account
  view, where the dashboard's equivalent names the account. Wording, not a wrong number.
- `DiscountMap`'s table twin prints an em dash for a watched tile's position value. Believed
  correct; task 21 asked for one confirming glance.
- `accountSummaries` (`src/data/PortfolioData.tsx:172`) runs one `analyze` per account eagerly on
  every ledger change. Two accounts today, so leave it unless this task is cheap - make it lazy
  only if that does not disturb the strip.

---

## Not tasks - things only the owner can do

None of these can be closed by an agent. They are listed so they stop being rediscovered.

- **The iPhone pass.** Task 23 asked for it and it is still outstanding: install per
  `docs/INSTALL_IPHONE.md`, confirm the app opens without Safari's toolbar, confirm the header
  clears the status bar in light *and* dark, set a fair value without the field dropping focus,
  and open a ticker from Rebuy opportunities.
- **A real 390px screenshot.** Tasks 16, 17 and 18 each failed to capture one - the sandbox
  browser would not go below ~555px, and the CDP screenshot path timed out repeatedly. The
  Playwright shooter (`npm run screenshots`) is the reliable path and does render at 390px; what
  is unverified by screenshot is the safe-area inset and the range row's scroll behaviour on a
  device with an actual notch.
- **Approve task 22's screenshots** if that never happened - task 22's "You do" line asked for a
  yes before task 23 deployed, and task 23 deployed.
- **Confirm no Cloudflare payment method is on file** (Billing → Payment methods). The free-only
  hard rule depends on it and task 14's audit could not check it.
- **`gitleaks`** for a second opinion on the privacy audit: `sudo pacman -S gitleaks`, then
  `gitleaks git --no-banner -v .`. Not expected to find anything the manual scan missed.
- **Lighthouse** against the deployed app to confirm PWA installability:
  `lighthouse https://alpha-ledger.alpha-ledger.workers.dev`.

## Deliberate non-work

Recorded so no future session treats these as gaps:
- **No component-test infra** (jsdom + testing-library). Every UI task since 07 has noted it. The
  pure logic under each screen is covered by the 487 engine/data tests; adding the infra is a
  project of its own and nothing in the backlog above is blocked on it. If it ever happens, the
  two things most worth covering are Import's live preview math and the reconcile-difference
  prefill.
- **No M1 holdings-CSV parser.** No holdings export was ever supplied, so writing one means
  inventing a header layout. SPEC 4 reconciliation also accepts manually entered share counts, so
  nothing is blocked. Task 25 may change this if the real export includes a holdings file.
- **Oversell produces a negative share count rather than an error**, by design:
  `reconcileShares` is where bad data is meant to surface, and a negative count there is
  unmissable.
