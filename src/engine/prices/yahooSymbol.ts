/**
 * Translate a stored ticker into the symbol Yahoo's chart endpoint expects.
 *
 * M1 writes a share class with a dot (`BRK.B`); Yahoo spells the same company with a dash
 * (`BRK-B`) and answers `404` with `chart.error.code = "Not Found"` for the dotted form, which
 * the Worker reports as `Unknown ticker` - indistinguishable, from the screen, from a company
 * that no longer trades. The holding then has no price at all, and SPEC section 6 values an
 * unpriced holding at $0, so a live position reads as a near-total loss.
 *
 * `docs/PRICES.md` has recorded the dash convention since task 03, and `TICKER_PATTERN` allows
 * both spellings; what was missing was anything that actually converted between them.
 *
 * The translation lives here, at the fetch boundary, rather than being fixed in the data:
 *
 *   - **Not a `ticker_alias` row.** An alias means "this company was renamed on this date" and
 *     moves history under the new symbol. `BRK.B` was never renamed - two vendors spell one
 *     company differently - and an alias would make the app display Yahoo's spelling rather
 *     than the one on the owner's statements.
 *   - **Not normalized at import.** The ledger should read back the way M1 wrote it, so a row
 *     can still be matched against an M1 statement by eye.
 *
 * Only `.` is touched. Yahoo also uses suffixes like `.TO` for non-US exchanges, which would
 * break under this - but M1 is US-only, `TICKER_PATTERN` caps a symbol at 10 characters, and
 * nothing in this app fetches a foreign listing. Revisit if that ever changes.
 */
export function yahooSymbol(ticker: string): string {
  return ticker.toUpperCase().replace(/\./g, '-')
}
