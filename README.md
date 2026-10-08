# Alpha Ledger

A private, personal dashboard that answers two questions:

1. Did my stock picks beat putting the same dollars into VOO on the same dates?
2. Which of my holdings are trading below my own fair-value estimate?

This repository holds source code only. Transaction history, holdings and fair values live in a private database behind a login and are never committed.

## Building it with Claude Code

The build is split into 15 tasks in `tasks/`. For each one:

1. Open Claude Code in this folder.
2. Pick the model named at the top of the task file with `/model`.
3. Say: `Do tasks/NN-name.md`
4. When the agent reports done, check the "You do" items in the task, then `/clear`.

`PROGRESS.md` shows where things stand. `docs/SPEC.md` is the source of truth for behavior.
