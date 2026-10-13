# Task 26 - Make `npm run check` a trustworthy gate

**Model:** Sonnet. **Read:** `src/engine/index.test.ts` (the `analyze performance` block),
`vitest.engine.config.ts`, CLAUDE.md's Commands section, task 26 in `docs/REMAINING_WORK.md`.

CLAUDE.md requires `npm run check` before every commit, so a gate that fails on machine load is a
gate agents will learn to ignore. The completion assessment reproduced 1069ms against a 1000ms
budget in a full-suite run, passing alone three times running. 486 of 487 tests pass; the failure
is the wall-clock budget, not a wrong number.

## Do

- Decide between raising `BUDGET_MS` with a comment explaining what the number is defending
  against, or moving the assertion out of the blocking suite (a `bench`/tagged run invoked
  deliberately). Keep a perf signal - do not just delete the test; task 05 recorded ~410ms in Node
  as the baseline, and "roughly 1-3s on a phone for 60 tickers" is a real product constraint worth
  a tripwire.
- Delete `src/engine/placeholder.test.ts`. It has been redundant since task 02 and eight tasks
  running have declined to remove it on the grounds it was not their call. Make it this task's
  call.

## Out of scope

Engine optimisation, new test infrastructure (jsdom/testing-library), touching any other test.

## Acceptance

`npm run check` passes five consecutive times, including once under load (e.g. with a parallel
`npm run build`).

**Next:** tasks/27-table-keyboard.md on Sonnet.
