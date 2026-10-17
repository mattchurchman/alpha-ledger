# Codex queue — Rev 3 finishing runbook

**For the owner (Omarchy + Codex CLI):** this is the Codex-specific queue. All original Claude instructions remain in `CLAUDE.md`, `tasks/QUEUE.md`, and `tasks/NN-*.md`. Task 32 is done. Codex must follow each short overlay in `tasks/codex/` plus its linked canonical task, not recreate the project plan.

## Start, then repeat for each row

1. In the local `alpha-ledger` folder, run `git pull` **before** starting Codex (or have Codex check/pull before task work if the tree is clean). Open `codex` from that folder.
2. Type `/model` and select the row's model and **reasoning effort**. If a model is missing, use the fallback below. Do not run a task with an unidentified, silently substituted model.
3. Paste the row's exact prompt, e.g. `Do tasks/codex/33.md`.
4. On success, verify Codex says **done and pushed**, exit/clear the session, use `git pull` if needed, and repeat with the next row. If it says **partial** or **blocked**, follow its owner step and **resume that same task**, not the next one.

Model names reflect Codex with **ChatGPT sign-in** as of 2026-10-16. Preferred: **GPT-6.1 Sol** (`gpt-6.1-sol`) for multi-file work, **GPT-6 Luna** (`gpt-6-luna`) for focused changes. If Sol is unavailable in `/model`, select **GPT-6 Sol** and use the same effort. If Luna is missing, use Sol at **low** effort for that row. These are guidance, not a requirement to purchase API credits. If ChatGPT sign-in models differ, use the current available equivalent and state the substitution in the handoff. Do **not** use retired GPT-5.3-Codex/GPT-5.4 choices from older advice.

## Remaining work (one session per task)

| # | Codex task prompt | Codex model | Effort | Working context target* | Canonical Claude model | Dependency |
|---|---|---|---|---|---|---|
| 33 | `Do tasks/codex/33.md` | GPT-6.1 Sol | medium | ~50k | Sonnet / medium | 32 done |
| 34 | `Do tasks/codex/34.md` | GPT-6.1 Sol | high | ~90k | Opus / medium | 33 |
| 35 | `Do tasks/codex/35.md` | GPT-6.1 Sol | xhigh | ~90k | Opus / high | 34 + owner files; **owner's machine only** |
| 36 | `Do tasks/codex/36.md` | GPT-6.1 Sol | medium | ~60k | Opus / medium | none |
| 37 | `Do tasks/codex/37.md` | GPT-6 Luna | high | ~40k | Sonnet / low | 36 |
| 38 | `Do tasks/codex/38.md` | GPT-6 Luna | medium | ~30k | Haiku / low | none |
| 39 | `Do tasks/codex/39.md` | GPT-6.1 Sol | high | ~90k | Opus / high | 36 + 38 |
| 40 | `Do tasks/codex/40.md` | GPT-6 Luna | high | ~30k | Haiku / low | 32-34, 36-39 + owner approval of 39 |

*These are **planning targets**, not technical token limits or a guaranteed quota. Prefer bounded reads, targeted tests, and a clean handoff to endless context expansion. A reasoning effort is not itself a context allocation.

**Order:** 33 → 34 → 35 → 36 → 37 → 38 → 39 → 40. If the owner hasn't supplied task 35's files, **skip 35 temporarily** and run 36–39, then return to 35 when ready. Task 40 may ship with 35 still open if that fact is clearly recorded; it cannot skip task 39's owner approval.

## Owner actions that agents cannot honestly automate

- **35:** provide fresh M1 activity CSVs for **every** account under `private/m1/` and the live ledger backup under `private/export.json`, all gitignored. Compare the app's reconstructed share counts and portfolio total to M1 yourself when asked. Codex must not invent those independent answers or send your financial records to a remote repo/chat.
- **36 and 39:** review the screenshots. Task 39 requires an explicit **yes** before release 40.
- **40:** approve the production Cloudflare deployment. After successful deploy, remove/re-add the iPhone home-screen app to refresh the icon.

## If Codex loses the thread or stops early

In a **fresh session on the same task's model/effort**, paste:

`Resume tasks/codex/NN.md. Read only its canonical task and latest matching PROGRESS.md handoff. Check git status, finish the unverified acceptance items, commit and push, then stop. Do not begin the next task.`

Only escalate reasoning one level after a failed attempt attributable to reasoning, not for missing private inputs, tests needing credentials, or a permission prompt. Never mark blocked owner checks done. For CLI configuration detail, see the official [Codex model selection](https://learn.chatgpt.com/docs/models) and [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) docs.
