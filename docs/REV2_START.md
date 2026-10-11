# Starting rev 2

Rev 2 is eight tasks, `tasks/16` to `tasks/23`. Each runs in its own Claude Code session, one at a time, in order.

## Once, before the first task
1. Open a terminal in your `alpha-ledger` folder.
2. Run `git pull`. This downloads the task files from GitHub.
3. Run `claude` to start Claude Code.

## For every task
1. Type `/model` and pick the model the task names.
2. Type `Do tasks/16-quick-fixes.md` (use the current task's file name).
3. Answer any questions. When it finishes it saves its work to GitHub and prints the next task and model.
4. Type `/clear`, then repeat from step 1 with the next task.

| # | File | Model |
|---|------|-------|
| 16 | `tasks/16-quick-fixes.md` | Haiku |
| 17 | `tasks/17-chart-ranges.md` | Sonnet |
| 18 | `tasks/18-defunct-tickers.md` | Opus |
| 19 | `tasks/19-account-drilldown.md` | Opus |
| 20 | `tasks/20-watchlist.md` | Sonnet |
| 21 | `tasks/21-rebuy-visuals.md` | Sonnet |
| 22 | `tasks/22-visual-refresh.md` | Opus |
| 23 | `tasks/23-release.md` | Haiku |

## Good to know
- Nothing changes on your phone until task 23 deploys. To see a task's work sooner, ask the agent to "deploy this now".
- Task 22 ends with screenshots for you to approve before the release.
- If a task goes wrong, tell the agent what you see. To throw away uncommitted work, ask it to "discard the changes from this task".
- Stopping partway is fine. `PROGRESS.md` records which tasks are done.
