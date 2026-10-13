# Task 31 - Polish the open-issue tail

**Model:** Haiku. **Effort:** low. **Context budget:** ~45k.
**Read:** only the files named below. Do not read PROGRESS.md entries.

Four small independent items. Skip any that no longer reproduce and say which.
1. Unhiding the last ticker writes `hidden_tickers` as `[]` - remove the key instead
   (`src/data/hiddenTickers.ts`, its test).
2. `src/routes/StockDetail.tsx`: in a single-account view the headline footnote says "Your picks
   against..." - name the account, matching Dashboard's wording.
3. `src/ui/charts/DiscountMap.tsx`: a watched (unheld) tile's table twin shows an em dash for
   position value. Confirm that is intended; change nothing if so.
4. `src/data/PortfolioData.tsx:~172`: `accountSummaries` runs `analyze` per account eagerly. Make
   it lazy only if it is a few lines and the account strip still renders identically; else skip.

## Out of scope
Anything not listed.

## Acceptance
`npm run check` passes; handoff lists each item as fixed / confirmed / skipped.

**Next:** tasks/25a-real-data-intake.md on Sonnet (effort medium) - owner must do step A first.
