# Codex queue - Rev 3 finishing runbook

**For the owner (Omarchy + Codex CLI).** Claude's instructions stay in `CLAUDE.md`,
`tasks/QUEUE.md` and `tasks/NN-*.md`. Codex reads `AGENTS.md` (automatically), this queue, and
the one short overlay in `tasks/codex/` for the task being run. Tasks 32, 33 and 34 are done.
**Task 36 is partially done and sitting uncommitted in the working tree** - see the state note
below before touching it.

## Models: read the menu, never recall it

An agent cannot know which models your account offers; that is server-side state newer than any
training data. A previous session guessed "GPT-6.1 Sol" and "GPT-6 Luna" into this file and both
were fabricated. So:

```
./scripts/codex-models.sh      # prints exactly what /model offers on this machine
```

As of 2026-10-16 that is **`gpt-6-astra`** (frontier, current generation) and the older
`gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`. Two tiers are all the fidelity that really
exists here:

| Tier | Model | Use for |
|---|---|---|
| **Heavy** | `gpt-6-astra`, effort **medium** (raise to **high** only for 35 and 39) | multi-file work, engine or import logic, anything with a real-data or acceptance gate |
| **Light** | `gpt-5.6-terra`, effort **medium** | string changes, wording, docs, release checklists |

If `scripts/codex-models.sh` disagrees with this table, **the script wins** - use the closest
listed model and say which you substituted in your handoff. Never run a task on a model you did
not see in that output.

## Start, then repeat for each row

1. `git pull` in `alpha-ledger`, then open `codex` from that folder.
2. `/model` - pick the row's model and reasoning effort.
3. Paste the row's prompt, e.g. `Do tasks/codex/38.md`.
4. On **done and pushed**, `/clear` and run the next row. On **partial** or **blocked**, do its
   owner step and resume *that same task* in a fresh session - not the next one.

## Remaining work (one session per task)

| # | Prompt | Model | Effort | Canonical Claude model | Depends on |
|---|---|---|---|---|---|
| 36 | `Do tasks/codex/36.md` | `gpt-6-astra` | medium | Opus / medium | **partial, see state note** |
| 38 | `Do tasks/codex/38.md` | `gpt-5.6-terra` | medium | Haiku / low | nothing - fully independent |
| 37 | `Do tasks/codex/37.md` | `gpt-6-astra` | medium | Sonnet / low | 36 committed |
| 39 | `Do tasks/codex/39.md` | `gpt-6-astra` | high | Opus / high | 36 + 38, then owner's **yes** |
| 35 | `Do tasks/codex/35.md` | `gpt-6-astra` | high | Opus / high | 34 + owner's private files; **owner's machine only** |
| 40 | `Do tasks/codex/40.md` | `gpt-5.6-terra` | medium | Haiku / low | 36-39 + owner approval of 39 and of the deploy |

**Order: 36 → 38 → 37 → 39 → 35 → 40.** This differs from the original 35-first order on
purpose: 35 needs private files the owner may not have staged yet, and 38 is independent of
everything, so neither should block visible progress. 35 must still land before 40 unless the
owner accepts shipping with it open, recorded in `PROGRESS.md`. 40 can never skip 39's approval.

## Task 36 state note - read before running 36

`src/index.css` and `docs/DESIGN.md` are **modified and uncommitted**. The brand tokens are
already in and verified correct: every contrast figure was independently recomputed and
`npm run palette` passes all 42 rows. **Do not redo the token work and do not revert the tree.**
Only four things remain, and `PROGRESS.md`'s task 36 entry lists them: run `npm run palette`,
`npm run build && npm run screenshots`, get the owner's visual review of `/kit` and home at
390/1280 light and dark, then commit and flip the status row.

**Which uncommitted files belong to what.** Task 36 owns `src/index.css` and the section 1/2
changes in `docs/DESIGN.md`. Everything else uncommitted - `AGENTS.md`, `CLAUDE.md`,
`PROGRESS.md`, `README.md`, `package.json`, `tasks/CODEX_QUEUE.md`, `tasks/codex/*.md`,
`docs/history/`, `scripts/codex-models.sh`, `scripts/validate_palette.mjs`, and section 7 of
`docs/DESIGN.md` - is a 2026-10-16 instruction and tooling refresh, not task work. Commit it
separately or leave it; either way it is not yours to revert.

## Owner actions no agent can honestly automate

- **35:** stage fresh M1 activity CSVs for **every** account under `private/m1/` and the ledger
  backup at `private/export.json` (both gitignored). Compare the app's reconstructed share counts
  and portfolio total against M1 yourself. Codex must never invent those figures or send your
  financial records to a remote repo or chat.
- **36 and 39:** review the screenshots. 39 needs an explicit **yes** before 40.
- **40:** approve the production Cloudflare deploy. Afterwards remove and re-add the iPhone
  home-screen app to refresh the icon.

## If Codex stops early or loses the thread

Fresh session, same model and effort, paste:

`Resume tasks/codex/NN.md. Read only its canonical task and the matching PROGRESS.md entry. Check git status, finish the unverified acceptance items, commit and push, then stop. Do not begin the next task.`

Escalate reasoning one level only after a failure actually caused by reasoning - never for
missing private inputs, credentials, or a permission prompt. Never mark a blocked owner check
done.
