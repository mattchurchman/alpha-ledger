# M1 activity CSV format

How M1's activity export maps onto the `transactions` shape in SPEC section 3.

Every example row in this file is invented. Real exports live in `private/m1/` and never enter git.

## Provenance of this document

The column names and the activity types in the "Transaction types" table below were taken
from a real export header plus a sample of real rows supplied by the user on 2026-10-08.
`npm run m1:summary` ran against the first real file (one account) on 2026-10-13 - see the
`CASH` section below for what that surfaced. It is still not confirmed against every account.
Anything marked "not yet observed" is a prediction, not a fact. The parser reports unknown rows
rather than guessing, so a type we have not seen will surface loudly rather than be dropped.

## Columns

Header, in the order it appears:

```
Date,Posted Date,Symbol,Description,Transaction Type,Amount,Units,Unit Type,Unit Price,Security Id,Security Id Type
```

The parser matches columns by name (case-insensitive, trimmed), not by position, so M1
reordering or appending columns will not break it. A missing required column throws.

| Column             | Example                             | Notes                                                                             |
| ------------------ | ----------------------------------- | --------------------------------------------------------------------------------- |
| `Date`             | `"Jan 5, 2024"`                     | Activity date. This becomes `trade_date`. Always quoted, because of the comma.    |
| `Posted Date`      | `"Jan 4, 2024"`                     | Settlement/posting date. **Ignored** — see Decisions. Can be earlier than `Date`. |
| `Symbol`           | `ABCD`                              | Ticker. Empty on cash rows (deposits, interest, fees).                            |
| `Description`      | `0.5 shares of ABCD purchased.`     | Prose. The only place the ticker appears on some fee rows.                        |
| `Transaction Type` | `PURCHASED`                         | The discriminator. See table below.                                               |
| `Amount`           | `$10.00`, `-$500.00`, `"$1,500.00"` | Signed, `$`-prefixed, thousands-separated, quoted when it contains a comma.       |
| `Units`            | `0.04213`, `-2.5`, `--`             | Share count, signed. `--` on cash rows. Up to 5 decimal places observed.          |
| `Unit Type`        | `SHARES` or `CURRENCY`              | Distinguishes a securities row from a cash row. Load-bearing — see Decisions.     |
| `Unit Price`       | `$237.45`, `--`                     | Display-rounded. **Not authoritative** — see Decisions.                           |
| `Security Id`      | `000000000`                         | CUSIP. Empty on cash rows.                                                        |
| `Security Id Type` | `CUSIP`                             | Only `CUSIP` observed.                                                            |

### Date format

`Mon D, YYYY` — three-letter English month, no zero padding on the day (`Jan 5, 2024`,
`Oct 14, 2024`). Parsed by month-name lookup into `YYYY-MM-DD`. No `Date` object is
constructed, so there is no timezone shift. An unparseable date makes the row unrecognized.

### Sign conventions

Signs describe the change to the thing being transacted, **not** the cash flow of the account:

| Row               | `Amount`                          | `Units`  |
| ----------------- | --------------------------------- | -------- |
| Purchase          | positive (cash into the position) | positive |
| Sale              | **negative** (position reduced)   | negative |
| Dividend received | positive                          | `--`     |
| Fee charged       | negative                          | `--`     |
| Cash deposit      | positive                          | `--`     |

Note that a sale carries a negative `Amount` even though the account receives cash. So
"negative means money left the account" is wrong, and the parser never relies on it.

SPEC section 3 requires `amount_usd` to be positive with `type` giving the direction, so
the parser takes the absolute value of both `Amount` and `Units` and discards the sign
after using `Transaction Type` to decide direction.

## Transaction types

| `Transaction Type` | `Unit Type`   | Maps to                                                 | Notes                                                               |
| ------------------ | ------------- | ------------------------------------------------------- | ------------------------------------------------------------------- |
| `PURCHASED`        | `SHARES`      | `buy`                                                   | Requires `Symbol`, `Units`, `Amount`.                               |
| `SOLD`             | `SHARES`      | `sell`                                                  | As above. Negative `Units`/`Amount` made positive.                  |
| `DIVIDEND`         | `CURRENCY`    | `dividend`                                              | Cash paid out by the stock. Requires `Symbol`. `shares` is null.    |
| `TRANSFER`         | `CURRENCY`    | _dropped_                                               | ACH deposit/withdrawal. Cash, so out of scope per SPEC 3.           |
| `TRANSFER`         | `SHARES`      | _unrecognized_                                          | A transfer **in kind**. Needs an `adjust`; see Decisions.           |
| `FEE`              | `CURRENCY`    | _dropped_                                               | Dividend withholding and similar. Cash.                             |
| `OTHER`            | `CURRENCY`    | _dropped_ **only if** the description reads as interest | Securities-lending interest and account interest. See Decisions.    |
| `OTHER`            | anything else | _unrecognized_                                          | `OTHER` is a grab-bag; anything not plainly interest gets reported. |
| `CASH`             | `CURRENCY`    | _unrecognized_                                          | Merger/buyout cash settlement; see Decisions.                       |
| anything else      | —             | _unrecognized_                                          | Reported with the raw row so it can be classified.                  |

"Dropped" means recognized and deliberately discarded per SPEC section 3 ("Deposits,
withdrawals, interest, fees and transfers of cash are dropped at import"). The parser
still counts dropped rows by reason, so `npm run m1:summary` shows them.

### Reinvested dividends

M1 emits these as two separate rows — a `DIVIDEND` row for the cash and a `PURCHASED`
row for the shares bought with it. That is already exactly what SPEC section 3 asks for
("A reinvested dividend is a `dividend` row plus a `buy` row"), so no special handling
exists. Nothing links the two rows; none is needed.

### Splits — booked against a placeholder symbol

No split _type_ appeared in the sample, and per SPEC section 4 none is needed: Yahoo's split
events are the single source of truth and an M1 split row is only ever a cross-check.

What a real export did carry, found on 2026-10-10 when the user's first import failed, is a
split booked as ordinary `SOLD`/`PURCHASED` rows where the `Symbol` is **a placeholder rather
than a ticker** — `PRESPLITCEIX` for the CEIX position as it stood before the split. Two
consequences:

- **It is not importable as a transaction.** Nothing can price `PRESPLITCEIX`, so storing it
  would add a phantom holding the engine values at zero, and the share movement it describes
  is one SPEC 4 already applies from the price history. The parser therefore checks `Symbol`
  against `TICKER_PATTERN` (`src/engine/types.ts`, the same constant the Worker validates
  with) and reports anything else as unrecognized. The import resolver
  (`src/engine/m1/resolve.ts`) then auto-drops the row only when the stripped ticker has a split
  event within its evidence window; without that proof it remains a question for the owner.
- **The check has to happen in the parser, not only at the API.** Before it did, the preview
  counted the row as new and `POST /api/transactions/bulk` then rejected the entire batch with
  `400 "ticker" is not a valid ticker: PRESPLITCEIX` — one row blocking a whole file.

Other corporate actions may well use the same placeholder trick under a different prefix. The
pattern check catches the shape rather than the word, so they surface the same way: reported and
skipped. Only the known `PRESPLIT<ticker>` shape is resolved automatically, and only with the
nearby split evidence above; anything else can be fixed with an `adjust` if real shares moved.

### Fractional shares

Routine. `Units` carries up to 5 decimal places. Values are kept as exact decimal strings
end to end and never pass through a float — see Decisions.

### Example rows

Invented, but structurally identical to the real thing, including the mixed quoting:

```csv
Date,Posted Date,Symbol,Description,Transaction Type,Amount,Units,Unit Type,Unit Price,Security Id,Security Id Type
"Jan 8, 2024","Jan 8, 2024",ABCD,0.04213 shares of ABCD purchased.,PURCHASED,$10.00,0.04213,SHARES,$237.45,000000000,CUSIP
"Jan 7, 2024","Jan 7, 2024",ABCD,2.5 shares of ABCD sold.,SOLD,-$500.00,-2.5,SHARES,$200.00,000000000,CUSIP
"Jan 6, 2024","Jan 5, 2024",WXYZ,Dividend of 111111111 $12.34 received.,DIVIDEND,$12.34,--,CURRENCY,--,111111111,CUSIP
"Jan 5, 2024","Jan 5, 2024",,ACH deposit of $1500 completed.,TRANSFER,"$1,500.00",--,CURRENCY,--,,
"Jan 4, 2024","Jan 4, 2024",,Securities lending interest of $0.07 received.,OTHER,$0.07,--,CURRENCY,--,,
"Jan 3, 2024","Jan 3, 2024",,DIV:WXYZ(Fee @0.015000):TAXCD:A,FEE,-$0.42,--,CURRENCY,--,,
```

## Dedupe: `source_row_hash`

Re-importing overlapping exports must not duplicate transactions, so every row gets a
stable hash. It is built from, joined by `\x1f`:

1. the literal `m1`
2. the account label
3. the raw trimmed values of `Date`, `Posted Date`, `Symbol`, `Description`,
   `Transaction Type`, `Amount`, `Units`, `Unit Type`, `Unit Price`, `Security Id`
4. an occurrence index (see below)

Properties this gives:

- **Stable across re-imports.** Built from raw source text, so it does not move if the
  parser's mapping logic changes later.
- **Independent of the file.** The filename and date range are not in the hash, so the
  same row appearing in two overlapping exports hashes identically and dedupes.
- **Per account.** The account label _is_ in the hash, so the same trade in two accounts
  stays two transactions.

### The occurrence index, and why it exists

M1 auto-invest produces genuinely identical rows: two $20 buys of the same ticker at the
same price on the same day are two real transactions, but every source column matches. A
content-only hash would collapse them and silently lose one.

So each row carries a 1-based counter of how many byte-identical rows have been seen
before it within the same account. The first gets `1`, the second `2`.

This is order-independent, because the rows being counted are identical — the Nth
identical row gets index N no matter how the file is sorted. Re-importing the same export,
or a different export covering the same day, yields the same counters and therefore the
same hashes.

**Known limit:** if one export truncates mid-day and contains 1 of 2 identical rows while
another contains both, the counters disagree for the second row and it imports as a new
transaction. Reconciliation (SPEC section 4) is the backstop. This is a deliberate trade:
over-importing a visible duplicate beats silently dropping a real trade.

### Hash function

FNV-1a, 64-bit, via `BigInt`, rendered as 16 lowercase hex characters. Chosen because it
is synchronous — Web Crypto's `digest` is async, and SPEC section 2 requires the engine to
be pure synchronous TypeScript runnable in the browser. It is not a cryptographic hash and
does not need to be; nothing here is adversarial. Collision risk across a few thousand
rows at 64 bits is negligible.

### `CASH` - a row type not in the original sample

Found on 2026-10-13 running `npm run m1:summary` against the first real export. `Transaction
Type` is `CASH`, `Unit Type` is `CURRENCY`, `Symbol` is empty, and `Description` is a bare
company name (no "shares of" / "dividend of" prose). Every occurrence observed so far names a
company that was acquired or taken private around the row's date (e.g. Twitter, Activision
Blizzard) - this reads as M1's label for a merger/buyout cash settlement paid out when a held
position stopped trading.

The parser still reports it rather than guessing from company-name prose. The import resolver
(`src/engine/m1/resolve.ts`) handles that reported row from stronger evidence: an exact CUSIP
match to earlier ticker rows is auto-fixed; otherwise one held ticker whose price history ends
near the settlement and whose last close fits the cash per held share becomes a one-tap
proposal. The share count always comes from the ledger through `closeOutPlan`, never from
inventing one from the amount. Ambiguous or unsupported rows stay visible for the owner, and
every resulting `sell` keeps the CASH row's own `source_row_hash` so it cannot return on the next
full import.

## Decisions

- **`Date` is `trade_date`; `Posted Date` is ignored.** `Date` is the activity date, which
  is what the VOO shadow in SPEC section 5 has to line up against. The two differ on some
  dividend rows (the sample had `Date` one day _later_ than `Posted Date`). SPEC 3's
  `transactions` has no posted-date column and adding one is out of scope here.
- **`Unit Price` is ignored; price is `Amount / Units` where needed.** The column is
  display-rounded and does not reconcile — in a sampled sale, `Units` times the stated
  `Unit Price` came out a few cents away from `Amount`, because the price was rounded to
  the cent before being printed. `Amount` and `Units` are the authoritative pair.
- **`Unit Type` decides cash vs securities, not `Symbol` emptiness.** This is what makes a
  transfer _in kind_ separable from a cash transfer — same `Transaction Type`, different
  `Unit Type`. The parser reports in-kind transfers instead of silently importing an `adjust`;
  the resolver turns a valid ticker and the row's own units into an evidence-backed proposal.
  It never picks a share count that the export did not supply.
- **`OTHER` is only dropped when the description reads as interest** (matching
  `securities lending` or the word `interest`). Dropping the whole grab-bag would risk
  discarding a spinoff or an in-kind movement. Anything else gets reported.
- **Amounts and share counts are exact decimal strings, never numbers.** `shares` and
  `amount_usd` leave the parser as strings like `"0.04213"`, normalized through
  `decimal.js` (so `"$1,500.00"` becomes `"1500"`). Per CLAUDE.md, money and shares use
  `decimal.js` in the engine and round only at display; handing out a float here would
  throw precision away at the boundary before the engine ever sees it.
- **A missing required column throws rather than returning an error.** A file without a
  `Transaction Type` column is not a parseable M1 export and should stop the import, not
  produce a partial one.

## Holdings CSV — not yet implemented

The task lists a holdings parser "if that file exists". No holdings export has been
supplied, and M1's holdings columns are not known. Writing one now would mean inventing a
header layout, so it is deferred rather than guessed. Reconciliation (SPEC section 4) also
accepts manually entered share counts, so nothing is blocked. See `PROGRESS.md`.
