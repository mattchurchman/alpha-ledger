# Alpha Ledger

A private, personal dashboard that answers two questions:

1. Did my stock picks beat putting the same dollars into VOO on the same dates?
2. Which of my holdings are trading below my own fair-value estimate?

This repository holds source code only. Transaction history, holdings and fair values live in a private database behind a login and are never committed.

## Finish rev 3 with Codex CLI (Omarchy/Linux)

**Start here:** [tasks/CODEX_QUEUE.md](tasks/CODEX_QUEUE.md). It gives the model, reasoning effort, context target, order, owner gates, and exact prompt for each remaining task (33–40). Task 32 is complete.

1. In your local `alpha-ledger` directory, run `git pull` and start `codex`.
2. Select the queue row's model and reasoning effort using `/model`.
3. Paste exactly `Do tasks/codex/33.md` for the first task. Each short Codex overlay links to its existing full task requirements.
4. When Codex reports **done and pushed**, start a fresh session with the next task. For **blocked** or **partial**, finish that same task before moving on.

Codex's standing instructions are in [AGENTS.md](AGENTS.md). The original Claude task files have not been replaced. Task 35 needs your private local M1 exports; task 39 requires your approval before task 40 deploys.

## Building it with Claude Code

Claude's standing instructions are in [CLAUDE.md](CLAUDE.md) and its remaining-work queue is [tasks/QUEUE.md](tasks/QUEUE.md).

For each task, open Claude Code, pick the model at the top of the task file with `/model`, say `Do tasks/NN-name.md`, follow any owner steps, then `/clear` before the next task.

`PROGRESS.md` shows where things stand. `docs/SPEC.md` is the source of truth for behavior.
