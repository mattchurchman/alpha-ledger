/** Canonical engine-side shapes for the rows SPEC section 3 stores in D1. */

export type TransactionType = 'buy' | 'sell' | 'dividend' | 'split' | 'adjust'

/**
 * One `transactions` row. `shares` and `amount_usd` are exact decimal strings so no
 * precision is lost before the engine wraps them in `Decimal`.
 *
 * `amount_usd` is always positive; `type` gives the direction. `shares` is positive for
 * `buy` and `sell`, null for `dividend`, and **signed** for `adjust` - an adjust is a
 * correction, so it is the one type whose share count may be negative.
 */
export interface Transaction {
  account_label: string
  trade_date: string
  ticker: string
  type: TransactionType
  shares: string | null
  amount_usd: string
  source: 'm1' | 'manual'
  source_row_hash: string
  note: string | null
  excluded: boolean
}

/** One `ticker_alias` row: `from_ticker` became `to_ticker` on `effective_date`. */
export interface TickerAlias {
  from_ticker: string
  to_ticker: string
  effective_date: string
}
