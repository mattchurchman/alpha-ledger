# private/

Put real M1 exports here (for example `private/m1/taxable.csv`). Everything in this folder except this file is git-ignored.

## The recompute check (task 15 step 3)

`private/recompute.check.ts` plus `private/vitest.config.ts` recompute a ticker's invested,
returned, current value, shadow value and value added from scratch - fresh arithmetic, straight
from SPEC sections 4-6, importing nothing from `src/engine/` but `analyze` itself - and diff
them against the engine, figure by figure. Both files are gitignored like everything else here,
so a fresh clone will not have them; the header comment in the check explains what it is for and
how to rebuild it.

```
curl -s -b private/cookie.txt "$URL/api/export" > private/export.json
BUNDLE=private/export.json TICKERS=AAPL,KO npx vitest run --config private/vitest.config.ts
```

Omit `TICKERS` to check every ticker in the ledger. A difference of exactly 0 on every row is
the pass; anything else is a bug in one of the two readings of the spec.

Agents: you may read files here to learn structure. Never copy real tickers-with-amounts, account numbers, or dollar values into code, tests, docs, commit messages, or PROGRESS.md. Test fixtures must be synthetic.
