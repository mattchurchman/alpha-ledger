# M1 activity CSV format

How M1's activity export maps onto the `transactions` shape in SPEC section 3.

Every example row in this file is invented. Real exports live in `private/m1/` and never enter git.

## Provenance of this document

The column names and the activity types in the "Transaction types" table below were taken
from a real export header plus a sample of real rows supplied by the user on 2026-10-08.
It is **not** yet confirmed against the full history of every account — `npm run m1:summary`
has not been run on real files (none are in `private/m1/` yet). Anything marked
"not yet observed" is a prediction, not a fact. The parser reports unknown rows rather
than guessing, so a type we have not seen will surface loudly rather than be dropped.

## Columns

Header, in the order it appears:

```
Date,Posted Date,Symbol,Description,Transaction Type,Amount,Units,Unit Type,Unit Price,Security Id,Security Id Type
```

The parser matches columns by name (case-insensitive, trimmed), not by position, so M1
reordering or appending columns will not break it. A missing required column throws.

| Column | Example | Notes |
|---|---|---|
| `Date` | `"Jan 5, 2024"` | Activity date. This becomes `trade_date`. Always quoted, because of the comma. |
| `Posted Date` | `"Jan 4, 2024"` | Settlement/posting date. **Ignored** — see Decisions. Can be earlier than `Date`. |
| `Symbol` | `ABCD` | Ticker. Empty on cash rows (deposits, interest, fees). |
| `Description` | `0.5 shares of ABCD purchased.` | Prose. The only place the ticker appears on some fee rows. |
| `Transaction Type` | `PURCHASED` | The discriminator. See table below. |
| `Amount` | `$10.00`, `-$500.00`, `"$1,500.00"` | Signed, `$`-prefixed, thousands-separated, quoted when it contains a comma. |
| `Units` | `0.04213`, `-2.5`, `--` | Share count, signed. `--` on cash rows. Up to 5 decimal places observed. |
| `Unit Type` | `SHARES` or `CURRENCY` | Distinguishes a securities row from a cash row. Load-bearing — see Decisions. |
| `Unit Price` | `$237.45`, `--` | Display-rounded. **Not authoritative** — see Decisions. |
| `Security Id` | `000000000` | CUSIP. Empty on cash rows. |
| `Security Id Type` | `CUSIP` | Only `CUSIP` observed. |

### Date format

`Mon D, YYYY` — three-letter English month, no zero padding on the day (`Jan 5, 2024`,
`Oct 14, 2024`). Parsed by month-name lookup into `YYYY-MM-DD`. No `Date` object is
constructed, so there is no timezone shift. An unparseable date makes the row unrecognized.

### Sign conventions

Signs describe the change to the thing being transacted, **not** the cash flow of the account:

| Row | `Amount` | `Units` |
|---|---|---|
| Purchase | positive (cash into the position) | positive |
| Sale | **negative** (position reduced) | negative |
| Dividend received | positive | `--` |
| Fee charged | negative | `--` |
| Cash deposit | positive | `--` |

Note that a sale carries a negative `Amount` even though the account receives cash. So
"negative means money left the account" is wrong, and the parser never relies on it.

SPEC section 3 requires `amount_usd` to be positive with `type` giving the direction, so
the parser takes the absolute value of both `Amount` and `Units` and discards the sign
after using `Transaction Type` to decide direction.

## Transaction types

| `Transaction Type` | `Unit Type` | Maps to | Notes |
|---|---|---|---|
| `PURCHASED` | `SHARES` | `buy` | Requires `Symbol`, `Units`, `Amount`. |
| `SOLD` | `SHARES` | `sell` | As above. Negative `Units`/`Amount` made positive. |
| `DIVIDEND` | `CURRENCY` | `dividend` | Cash paid out by the stock. Requires `Symbol`. `shares` is null. |
| `TRANSFER` | `CURRENCY` | *dropped* | ACH deposit/withdrawal. Cash, so out of scope per SPEC 3. |
| `TRANSFER` | `SHARES` | *unrecognized* | A transfer **in kind**. Needs an `adjust`; see Decisions. |
| `FEE` | `CURRENCY` | *dropped* | Dividend withholding and similar. Cash. |
| `OTHER` | `CURRENCY` | *dropped* **only if** the description reads as interest | Securities-lending interest and account interest. See Decisions. |
| `OTHER` | anything else | *unrecognized* | `OTHER` is a grab-bag; anything not plainly interest gets reported. |
| anything else | — | *unrecognized* | Reported with the raw row so it can be classified. |

"Dropped" means recognized and deliberately discarded per SPEC section 3 ("Deposits,
withdrawals, interest, fees and transfers of cash are dropped at import"). The parser
still counts dropped rows by reason, so `npm run m1:summary` shows them.

### Reinvested dividends

M1 emits these as two separate rows — a `DIVIDEND` row for the cash and a `PURCHASED`
row for the shares bought with it. That is already exactly what SPEC section 3 asks for
("A reinvested dividend is a `dividend` row plus a `buy` row"), so no special handling
exists. Nothing links the two rows; none is needed.

### Splits — not yet observed

No split row appeared in the sample. Per SPEC section 4, Yahoo's split events are the
single source of truth and M1 split rows are only ever a cross-check, so the parser does
not need to map them. If a split type shows up it becomes an unrecognized row, which is
the correct outcome: it gets reported, and SPEC 4's math is unaffected.

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
- **Per account.** The account label *is* in the hash, so the same trade in two accounts
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

## Decisions

- **`Date` is `trade_date`; `Posted Date` is ignored.** `Date` is the activity date, which
  is what the VOO shadow in SPEC section 5 has to line up against. The two differ on some
  dividend rows (the sample had `Date` one day *later* than `Posted Date`). SPEC 3's
  `transactions` has no posted-date column and adding one is out of scope here.
- **`Unit Price` is ignored; price is `Amount / Units` where needed.** The column is
  display-rounded and does not reconcile — in a sampled sale, `Units` times the stated
  `Unit Price` came out a few cents away from `Amount`, because the price was rounded to
  the cent before being printed. `Amount` and `Units` are the authoritative pair.
- **`Unit Type` decides cash vs securities, not `Symbol` emptiness.** This is what makes a
  transfer *in kind* separable from a cash transfer — same `Transaction Type`, different
  `Unit Type`. In-kind transfers are reported rather than auto-mapped, because SPEC 3
  describes `adjust` as a manual correction and picking a share count for someone is not
  the parser's call.
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
