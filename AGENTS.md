# Alpha Ledger — Codex operating rules

This file is for **Codex CLI** on the owner's Omarchy/Linux machine. Claude Code still uses `CLAUDE.md`. Preserve Claude's task files and model recommendations; Codex uses `tasks/CODEX_QUEUE.md` and `tasks/codex/*.md` instead.

## When the owner says "Do tasks/codex/NN.md"

1. Read the named Codex task overlay, its **one** linked canonical `tasks/NN-*.md` file, and only the **Rev 3** status table and recent relevant handoff in `PROGRESS.md`. Do not read the entire historical progress log.
2. Verify prerequisite task statuses against `PROGRESS.md`. If already done, report that and identify the next unfinished task; do not redo it.
3. Follow the canonical task's Goal, Steps, Out of scope, Acceptance, and owner gates. The Codex overlay only adds execution guidance and efficiency controls; it does not supersede product requirements.
4. First inspect the exact functions/files mentioned in the task with `rg` and bounded file reads. State a short 3-5-step plan, then implement. Avoid repository-wide exploratory dumps, browsing, new abstractions, unrelated tidy-ups, and repeated reading of long documents.
5. Write/adjust focused tests before or alongside behavioral code; do not claim something ran unless it ran. Run `npm run check`; for UI/build/deploy tasks run the additional canonical acceptance checks. Repair only failures caused by your task; report unrelated blockers accurately.
6. Confirm `git status --short` and review `git diff` before committing. Never stage secrets, financial data, `private/`, database dumps, credentials, account exports, or screenshots of actual holdings. Commit task-scoped changes, update only the relevant `PROGRESS.md` status/handoff, push, and STOP. Never start the next task without a new prompt.
7. End with **done / partial / blocked**, tests actually run, commit and push status, any owner action, and the next Codex task/model/effort from `tasks/CODEX_QUEUE.md`. If unable to push, say so explicitly and provide the commit SHA and one simple recovery instruction.

## Product invariants

Adopt `CLAUDE.md` **Hard rules**, **Stack**, and **Commands** (not its Claude-only session protocol or model selection). `docs/SPEC.md` is product truth. The app is **free-only**, private, manually refreshed, mobile-first at 390px. No paid API, background/scheduled price polling, extra financial feature, or unstated change to financial calculations. Money/shares use `decimal.js` inside the pure `src/engine/` layer; UI displays existing engine output. Preserve the tested color-blind-safe ahead/behind palette rules.

If a spec conflict, missing tool, unrecognized financial row, security/privacy risk, or missing owner decision blocks a safe implementation, stop and give the owner a plain-English yes/no choice rather than guessing. Never fabricate M1 figures or mark owner validation as passed.

## Session and deployment discipline

- Owner chooses model and reasoning effort with `/model` **before** prompting the task. You cannot silently switch models; do not waste context repeatedly debating tiers.
- One task = one fresh Codex session. If work approaches the task's *planning* context budget, finish a safe substep, record precise continuation in `PROGRESS.md`, commit/push a coherent partial, and stop. Do not compact an unclear state and pretend acceptance passed.
- Task 35 is **local-only on the owner's machine** with owner-supplied private data; never push or paste that data into chat. Use an isolated local test database, not live production.
- Task 40 is the only deployment task. Require explicit owner approval before remote D1 migration/deploy. Don't deploy to production while running any other task.
- Keep replies useful for a non-programmer: what changed, what passed, and exactly what they must do next. No command-heavy tutorial unless something is blocked.
