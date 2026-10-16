# Rev 3 assessment - 2026-10-15

Written before rev 3. Assesses every finding agents have recorded about real data
(`docs/REMAINING_WORK.md`, the 25a and 25b handoffs in `PROGRESS.md`, `docs/M1_FORMAT.md`) against
one goal the owner set:

> My default workflow is: full export from M1, re-import into the app. I may have ~50 new
> transactions since last time. I should not have to massage the data the way I did to get it
> where it is now. The findings should become rules the import applies by itself.

Rev 3 is that, plus the first step of a brand and visual facelift (`docs/BRAND.md`).

## What already works on a full re-import

- **Dedupe.** `source_row_hash` (M1_FORMAT "Dedupe") is built from raw row text plus an
  occurrence index, so a full export re-imported over the ledger adds only the new rows. The
  "truncated mid-day" limit only bites on partial exports; a full export never truncates.
- **Share-class tickers.** M1's `BRK.B` vs Yahoo's `BRK-B` is translated at fetch time (25b
  finding 2). No owner action, ever.
- **Decimal residue.** 25b finding 1 was a harness bug, not an app bug. Nothing to apply.
- **Hand fixes survive.** Manual `sell`/`adjust` rows live in D1 and a re-import never touches
  them.

## Where the owner still has to massage data - the gaps

| # | Finding (source) | What happens on re-import today | Rule rev 3 applies |
|---|---|---|---|
| G1 | Split placeholders, `PRESPLITCEIX` (M1_FORMAT, 25a) | Listed as *unrecognized* on **every** import, forever | Auto-drop when price history has a split for the stripped ticker near that date. Zero guesses. |
| G2 | `CASH` merger cash-outs (25a; 4 triaged, 2 more found in 25b) | Listed as unrecognized every import; owner works out ticker and share count by hand, enters a `sell` that nothing links back to the row | Resolve from evidence, in order: (1) the row's `Security Id` (CUSIP) matches the CUSIP on earlier rows of a ticker - exact; (2) a held ticker whose prices stop just before the row date and whose last close × shares held ≈ the cash amount - one-tap proposal. Shares come from the ledger, never from arithmetic on the amount. The saved `sell` carries the CASH row's own hash, so the next import sees it as already done. |
| G3 | Transfers in kind (M1_FORMAT) | Unrecognized every import | The row has `Symbol` and `Units`, so propose the `adjust` directly; one tap; saved under the row's hash. |
| G4 | No memory of decisions | Anything the owner chose to ignore comes back next time | "Ignore this row" stores its hash (`meta.import_ignored_hashes`), exported and restored with the ledger. |
| G5 | Reconcile before Update market data treats every split as 1:1 (task 14, 25c B3) | Owner must remember the order | Import ends by running Update market data itself, then shows a health summary. The ordering trap disappears instead of getting a warning. |
| G6 | Delistings found only by scrolling (task 18, 25b's 6 unpriced tickers) | Owner must notice | The post-import health summary lists unpriced holdings, delisted candidates and split disagreements (`crossCheckSplits`) with the fix for each. |
| G7 | Account label typed per file (Import) | A mistyped label silently makes a second account and doubles every trade | Infer the label from hash overlap with existing accounts; only ask for a genuinely new account. |

The design rule this preserves: **the import never invents a ticker or a share count.** Every
automatic fix is backed by evidence already in the data (a CUSIP, the ledger's own share count,
Yahoo's split events), and anything the evidence does not settle becomes a one-tap question with
the evidence shown - not a silent guess, and not a dead end. The SPEC Decision log entry is
written by task 32.

## Still open, carried into rev 3

- **Owner acceptance against M1** (25c Part A): share counts, portfolio total, the cash-out share
  counts. Folded into task 35, which runs it right after a from-scratch re-import - the moment it
  means the most. 25c is superseded.
- **Only one account has ever been through the real-data path.** Task 35 needs every account's
  CSV.
- **The alias hop was never exercised on real data** (25b). Task 35 runs against the app's own
  export, which carries aliases.
- **Unverified assumption:** that M1 puts a `Security Id` on `CASH` rows. If it does not, G2
  falls back to the delisting fit, which is still one tap per cash-out, once. Task 32 must not
  depend on it; task 35 reports which path the real data took.

## Visual direction, in one paragraph

Concept 2 ("Ledger": navy, royal blue, light gray, off-white; rising bars that end in an L). The
brand assets are in `public/brand/` and documented in `docs/BRAND.md`. Two concept details are
deliberately **not** adopted: green for "ahead" (DESIGN.md section 7 records green/red failing
the colour-blind floor - ahead stays blue) and a volatility figure (the engine does not compute
one, and SPEC 6 does not ask for it). The benchmark is labelled "S&P 500" in the UI, with "(VOO)"
where the method is explained - common vernacular, same math.
