# Task 18 - Close or hide defunct tickers
**Model:** Opus. **Next:** `tasks/19-account-drilldown.md` on Opus.
**Read:** CLAUDE.md, `docs/SPEC.md` sections 3, 4 and 8, `docs/ENGINE_API.md`, `src/engine/holdings.ts` (`resolveTicker`), `src/data/marketData.ts`.

## Background
Companies that were bought out or merged still show as holdings. The lists already filter to tickers with shares above zero; these tickers still have shares because the ledger never recorded the exit (M1 pays a buyout as cash, which the parser drops). So the fix is recording the exit, not filtering harder.

## Deliverables
- **Close position** action on the stock detail screen and on a holdings row. Two paths:
  - *Bought out for cash:* ask the date and the cash received (total or per share). Write one manual `sell` for every share held on that date through the existing transactions API. The ticker then leaves Holdings, Rebuy and Fair values on its own and stays in the creators chart as Closed.
  - *Became another ticker:* create a `ticker_alias` (the Settings form already does this). Check how a non 1:1 exchange ratio is handled today; if it is not, add the smallest correct mechanism (an `adjust`) and say so in the SPEC Decision log.
- **Hide** for anything the user just wants out of sight: a `hidden_tickers` JSON array in the `meta` table via `/api/meta` (no migration). Hidden tickers are left out of Holdings, Rebuy and Fair values, with an "N hidden" line and an Unhide list in Settings. Hiding never changes a total; say that in the UI.
- **Prompt, never auto-remove.** A held ticker in `result.missingPrices`, or whose last stored close is more than 30 days behind `asOf`, gets a "Looks delisted - close or hide?" prompt in the Dashboard warning block.
- Update market data: a failed fetch for a closed ticker that already has stored history is not reported as a failure.
- Update the Help troubleshooting and Settings sections.

## Acceptance
- Engine tests on synthetic data: after a close-out sell, shares are 0, the ticker is closed, and its value added uses the cash received.
- `npm run check` passes.

## Out of scope
Detecting corporate actions automatically, changing any SPEC 5 or 6 formula, deleting transactions.
