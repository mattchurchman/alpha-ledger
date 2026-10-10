/**
 * Wire shapes for `/api/*`. One definition, imported by both sides: the Worker handlers in
 * `worker/api/` and the browser client in `src/api/client.ts`. If a field changes here,
 * neither side can drift from the other without a typecheck failure.
 */

import type { PriceHistory } from '../engine/prices/types'
import type { FairValueEstimate, TickerAlias, Transaction, TransactionType } from '../engine/types'

export type { TickerAlias, Transaction, TransactionType }

/** A `transactions` row as the API returns it: the engine's shape plus its database id. */
export interface TransactionRow extends Transaction {
  id: number
}

/**
 * What a client sends to create a transaction. `excluded` defaults to false and `note` to
 * null, so a hand-entered row needs only the eight fields that carry meaning.
 */
export interface TransactionInput {
  account_label: string
  trade_date: string
  ticker: string
  type: TransactionType
  shares: string | null
  amount_usd: string
  source: 'm1' | 'manual'
  source_row_hash: string
  note?: string | null
  excluded?: boolean
}

/** What a client may change on an existing transaction. Omitted fields are left alone. */
export type TransactionPatch = Partial<Omit<TransactionInput, 'source_row_hash'>>

/** Result of a bulk upsert: what the import screen reports after a confirm. */
export interface BulkUpsertResult {
  /** Rows whose `source_row_hash` was new. */
  inserted: number
  /** Rows whose hash already existed and were left untouched - the dedupe count. */
  skipped: number
}

export interface FairValueRow extends FairValueEstimate {
  id: number
  created_at: string
}

/** `created_at` is set by the server, not the client, so a clock-skewed phone cannot lie. */
export type FairValueInput = Omit<FairValueEstimate, 'note'> & { note?: string | null }

/**
 * One `price_history` row. `history` is the engine's `PriceHistory`, reassembled from the
 * three JSON columns; `asOf` is derived from the last date in the series, not stored.
 */
export interface StoredPriceHistory {
  ticker: string
  fetched_at: string
  source: 'yahoo' | 'manual'
  history: PriceHistory
}

/** What a client sends to `PUT /api/price-history/:ticker`. */
export interface PriceHistoryInput {
  source: 'yahoo' | 'manual'
  history: PriceHistory
}

/** The `meta` table as a plain object. Holds `prices_last_updated` (SPEC 3). */
export type MetaMap = Record<string, string>

/** `GET /api/export` - everything, in one JSON document. */
export interface ExportBundle {
  /** Bumped only if a future task changes the shape; restore refuses anything it predates. */
  format: 1
  exported_at: string
  transactions: TransactionRow[]
  aliases: TickerAlias[]
  fair_values: FairValueRow[]
  price_history: StoredPriceHistory[]
  meta: MetaMap
}

/** What `POST /api/restore` accepts: an export bundle, minus the fields it regenerates. */
export type RestoreBundle = Omit<ExportBundle, 'exported_at'> & { exported_at?: string }

export interface RestoreResult {
  transactions: number
  aliases: number
  fair_values: number
  price_history: number
  meta: number
}

/** Every non-2xx response from `/api/*` has this body. */
export interface ApiErrorBody {
  error: string
}
