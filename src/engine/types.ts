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

/**
 * One `fair_value` row (SPEC section 7), minus the server-assigned `created_at`. User-entered
 * only, append-only - an updated estimate is a new row, never a rewrite of an old one.
 */
export interface FairValueEstimate {
  ticker: string
  value_usd: string
  effective_date: string
  note: string | null
}

/**
 * A stored estimate. `id` is needed only to break a tie between two rows entered on the same
 * `effective_date` - the higher id is the later entry, same convention `latestFairValues` uses.
 */
export interface FairValueRecord extends FairValueEstimate {
  id: number
}
