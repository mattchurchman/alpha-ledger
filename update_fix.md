# Update/fix backlog - found during task 25c real-data acceptance

Gitignored, like `triage.md` and `validation.md` - real tickers are fine to name here, M1
transaction detail and dollar amounts are not. Written for a fresh agent with no session
context, so each item explains the mechanism, not just the symptom.

**Design goal for whoever picks this up:** right now every issue below was caught by a human
manually comparing numbers against M1, or by an agent manually curling Yahoo's API to inspect
raw split events. None of that should be necessary. The two outcomes to design for:

1. **Import-time detection.** A CSV upload (or "Update market data") should catch anything in
   this list on its own and surface it as a clear, specific prompt - not a silent wrong number,
   and not a generic "unrecognized row, go figure it out."
2. **A guided fix, not a hand-rolled transaction.** Every fix below currently means figuring out
   the right transaction type, sign, and date by hand (or asking an agent to). Each one should
   instead be a sheet/button that asks only for the one or two facts a human actually has to
   supply (a cash amount, a share count from a statement) and writes the correct transaction
   itself - the same shape `ClosePositionSheet` already does for a cash buyout.

---

## 1. Yahoo encodes a spinoff as a "split" event - inflates the parent ticker's share count

**Confirmed, not theoretical.** Pulled directly from Yahoo's chart API for two real tickers in
this ledger: AT&T (`T`, WarnerMedia spinoff into Warner Bros Discovery, ~Apr 2022) carries a
split event with ratio `1324:1000`; S&P Global (`SPGI`, Mobility Global spinoff, ~Feb 2026)
carries one with ratio `1057:1000`. Neither is a real stock split - no new shares were issued to
existing holders of the parent, nothing physically multiplied. Yahoo's data vendor appears to
encode a spinoff's value-adjustment as a split purely to keep the adjusted-close series
continuous for charting.

SPEC section 4 deliberately treats every Yahoo split event as a literal share multiplier
(`splitFactorAfter` in `src/engine/holdings.ts`), which is the right call for a real split and
silently wrong for this one. The effect compounds with how exact the ratios are: a real split
is a clean small-integer ratio (`2:1`, `3:1`, `3:2`...); both of these are not (`1324:1000`,
`1057:1000`) - that asymmetry is the strongest signal available to tell them apart automatically.

**Severity:** a closed position (bought and fully sold) lands on a small nonzero residual
instead of exactly zero - cosmetic, but it'll never clear in Reconcile. An **open, still-traded**
position (like `SPGI` here) has its share count permanently inflated by the ratio, silently,
with no warning - Reconcile is the only thing that would ever catch it, and only if the owner
happens to type in that exact ticker's M1 count, which doesn't scale (see item 4).

**What a fix needs to do**, roughly in order of how much engineering it buys:
- At minimum, flag any split ratio that doesn't reduce to a small integer/half-integer fraction
  (say, within a numerator/denominator under ~20 after reduction) as "unusual - verify before
  applying," rather than applying it silently. Surface this distinctly from a normal mismatch
  on Reconcile and/or Holdings, naming the suspect ratio and date.
- Better: cross-check against Yahoo's own `events.dividends`/corporate-action data for the same
  date - a real split essentially never coincides with a large one-off distribution; a spinoff
  almost always does.
- A manual override table (`split_override` or similar: ticker + date + "ignore" / "use this
  ratio instead") is probably unavoidable as a backstop, since no heuristic will be 100%
  - surfaced as a one-tap "this isn't a real split" action from wherever the flag shows up,
  not a raw SQL/API fix.

## 2. A spinoff distribution can produce *zero* transaction rows at all

Two real tickers here (`MBGL`, spun off from `SPGI`; `ONL`, spun off from `O`/Realty Income via
the Realty Income-VEREIT merger) have **only a `SOLD` row, ever** - no purchase, no transfer, no
corporate-action row of any kind recording how the shares arrived. M1's CSV export simply never
emits one for a stock-for-stock spinoff distribution (it does emit a `CASH` row for a cash
buyout, which the parser already catches - see item 3 - but a spinoff that pays in shares
produces nothing to catch). The ledger first learns the ticker exists at the moment it's sold,
and selling shares you apparently never received drives the running balance **negative** with
no intermediate warning.

A third case (`WBD`/Warner Bros Discovery, which the same AT&T spinoff above actually funds) is
the same root cause wearing a different shape: real purchases exist, but the account sold more
shares than it ever bought, because the spinoff topped up the share count with no row to show
it.

**What a fix needs to do:** this one doesn't need split-event archaeology - it's visible from
the transaction list alone. At minimum, surface a prompt wherever running share count math
already happens (`sharesOn` / `splitAdjustTransactions` in `src/engine/holdings.ts`, or
Reconcile) whenever a ticker's running balance goes negative at any point in its history:
"X shares of TICKER were sold that the ledger never recorded receiving - likely a spinoff or an
in-kind transfer. Add the shares it actually arrived with." That prompt should open a guided
sheet that asks only for the share count (from the owner's statement) and writes the zero-cost
`adjust` itself, dated before the earliest row that goes negative - not send anyone to Activity
to hand-build an adjust transaction with the right type/sign/date, which is what happened here.

## 3. Merger cash-outs already get caught, but the share count still has to be guessed

This one is already handled reasonably well and is here mostly as a model for item 2's fix, not
a complaint: a `CASH` row with no ticker and a company name (`ACTIVISION BLIZZARD INC`,
`TWITTER INC`, etc.) is correctly flagged as "likely a merger/buyout settlement, needs a sell or
adjust" (`src/engine/m1/parse.ts`, `docs/M1_FORMAT.md`). The remaining gap: there's no link from
that flag to the ticker it's actually about (M1 gives a company name, not a symbol, on this row
type), so whoever resolves it either has to know the ticker from memory or back-derive a share
count from an assumed deal price - which this session got wrong once (an assumed $11.25/share
that was actually $32.50/share, producing a share-count guess nearly 3x too high) before
switching to just reading the ledger's own already-exact lot count. **`ClosePositionSheet`
already computes the correct share count on its own and should always be used over any manual
estimate** - the fix here is smaller: surface the flagged company name with a fuzzy-matched
guess at which held ticker it's about (same CUSIP if the row happens to carry one, or a name
match against held tickers), so the owner lands on "close out ATVI?" instead of a bare skip
notice.

## 4. Reconcile doesn't scale past a handful of holdings

The owner declined to type in M1's share count for all ~71 holdings by hand - a completely
reasonable call, which means every item in this document was found by chasing a ~$350
portfolio-total gap on a quarter-million-dollar ledger rather than by a systematic check. Two
independent improvements:
- **Prioritize by dollar impact.** If/when any mismatches are known (even just the ones large
  enough to move the portfolio total), sort and surface them by `shares × last price`, not
  alphabetically - so a human skimming the list sees the ones that matter first.
- **Make items 1-3 self-reporting**, so Reconcile isn't the only backstop. If spinoffs,
  negative-balance sells, and inflated-split tickers are caught at import/update time per the
  items above, a full manual Reconcile against M1 becomes a confirmation step rather than the
  only way to find a real problem.

## Already fixed this session (for context, not re-work)

`Import.tsx` and `Activity.tsx` each independently fetched their own copy of the transaction
list on mount, separate from the shared `PortfolioDataContext` that Dashboard/Holdings/Close
Position all read. A transaction created via Close Position or Activity updated the shared
cache correctly, but Reconcile - reading its own stale local copy - kept showing numbers from
before the fix. Both screens now read the shared cache directly; nothing further to do here,
just don't reintroduce a second independent fetch anywhere else.
