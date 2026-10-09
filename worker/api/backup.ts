import type {
  ExportBundle,
  FairValueRow,
  MetaMap,
  RestoreResult,
  StoredPriceHistory,
  TickerAlias,
} from '../../src/api/types'
import { json, readJson } from '../http'
import {
  asArray,
  asObject,
  fail,
  parseId,
  reqDate,
  reqDecimal,
  reqEnum,
  reqString,
  reqTicker,
} from '../validate'
import { UPSERT_META } from './meta'
import {
  parsePriceHistory,
  priceHistoryBindings,
  toStoredPriceHistory,
  UPSERT_PRICE_HISTORY,
  type PriceHistoryDbRow,
} from './priceHistory'
import { parseTransactionInput, toTransactionRow, type TransactionDbRow } from './transactions'

const FORMAT = 1

/**
 * Everything in one JSON document (SPEC 9.6). This is the user's only copy of the ledger
 * outside D1, so it carries row ids: a restore then reproduces the database exactly rather
 * than renumbering it.
 */
export async function exportAll(db: D1Database): Promise<Response> {
  const [transactions, aliases, fairValues, prices, meta] = await db.batch([
    db.prepare(
      'SELECT id, account_label, trade_date, ticker, type, shares, amount_usd, source, source_row_hash, note, excluded FROM transactions ORDER BY id',
    ),
    db.prepare('SELECT from_ticker, to_ticker, effective_date FROM ticker_alias ORDER BY from_ticker, effective_date'),
    db.prepare('SELECT id, ticker, value_usd, effective_date, note, created_at FROM fair_value ORDER BY id'),
    db.prepare('SELECT ticker, fetched_at, series_json, splits_json, dividends_json, source FROM price_history ORDER BY ticker'),
    db.prepare('SELECT key, value FROM meta ORDER BY key'),
  ])

  const metaMap: MetaMap = {}
  for (const row of meta.results as { key: string; value: string }[]) metaMap[row.key] = row.value

  const bundle: ExportBundle = {
    format: FORMAT,
    exported_at: new Date().toISOString(),
    transactions: (transactions.results as TransactionDbRow[]).map(toTransactionRow),
    aliases: aliases.results as TickerAlias[],
    fair_values: fairValues.results as FairValueRow[],
    price_history: (prices.results as PriceHistoryDbRow[]).map(toStoredPriceHistory),
    meta: metaMap,
  }

  return json(bundle)
}

/**
 * A restore **replaces** the database. Merging two ledgers is not a thing this app can do
 * safely - ids would collide and `source_row_hash` dedupe would silently drop rows the user
 * expected back - so the five tables are emptied and rewritten inside one batch, which D1
 * runs as a single transaction. A failure part-way therefore leaves the old data in place.
 */
export async function restoreAll(db: D1Database, request: Request): Promise<Response> {
  const body = asObject(await readJson(request), 'bundle')

  if (body.format !== FORMAT) {
    fail(`Unsupported export format ${String(body.format)}; this build reads format ${FORMAT}`)
  }

  const transactions = asArray(body.transactions, '"transactions"').map((raw) => {
    const row = asObject(raw, 'transaction')
    return { id: parseId(String(row.id)), input: parseTransactionInput(row) }
  })

  const aliases = asArray(body.aliases, '"aliases"').map((raw) => {
    const row = asObject(raw, 'alias')
    return {
      from_ticker: reqTicker(row, 'from_ticker'),
      to_ticker: reqTicker(row, 'to_ticker'),
      effective_date: reqDate(row, 'effective_date'),
    }
  })

  const fairValues = asArray(body.fair_values, '"fair_values"').map((raw) => {
    const row = asObject(raw, 'fair value')
    return {
      id: parseId(String(row.id)),
      ticker: reqTicker(row, 'ticker'),
      value_usd: reqDecimal(row, 'value_usd'),
      effective_date: reqDate(row, 'effective_date'),
      note: typeof row.note === 'string' ? row.note : null,
      created_at: reqString(row, 'created_at'),
    }
  })

  const priceHistory = asArray(body.price_history, '"price_history"').map((raw) => {
    const row = asObject(raw, 'price history')
    return {
      ticker: reqTicker(row, 'ticker'),
      fetched_at: reqString(row, 'fetched_at'),
      source: reqEnum(row, 'source', ['yahoo', 'manual'] as const),
      history: parsePriceHistory(row.history),
    } satisfies StoredPriceHistory
  })

  const meta = asObject(body.meta, '"meta"')
  const metaEntries = Object.entries(meta).map(([key, value]) => {
    if (typeof value !== 'string') fail(`meta["${key}"] must be a string`)
    return [key, value] as const
  })

  // Everything is validated before anything is deleted, so a malformed bundle cannot leave
  // the database empty.
  const statements: D1PreparedStatement[] = [
    db.prepare('DELETE FROM transactions'),
    db.prepare('DELETE FROM ticker_alias'),
    db.prepare('DELETE FROM fair_value'),
    db.prepare('DELETE FROM price_history'),
    db.prepare('DELETE FROM meta'),
  ]

  const insertTransaction = db.prepare(
    `INSERT INTO transactions
       (id, account_label, trade_date, ticker, type, shares, amount_usd, source, source_row_hash, note, excluded)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const { id, input } of transactions) {
    statements.push(
      insertTransaction.bind(
        id,
        input.account_label,
        input.trade_date,
        input.ticker,
        input.type,
        input.shares,
        input.amount_usd,
        input.source,
        input.source_row_hash,
        input.note ?? null,
        input.excluded ? 1 : 0,
      ),
    )
  }

  const insertAlias = db.prepare(
    'INSERT INTO ticker_alias (from_ticker, to_ticker, effective_date) VALUES (?, ?, ?)',
  )
  for (const a of aliases) {
    statements.push(insertAlias.bind(a.from_ticker, a.to_ticker, a.effective_date))
  }

  const insertFairValue = db.prepare(
    'INSERT INTO fair_value (id, ticker, value_usd, effective_date, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
  for (const f of fairValues) {
    statements.push(
      insertFairValue.bind(f.id, f.ticker, f.value_usd, f.effective_date, f.note, f.created_at),
    )
  }

  const insertPrices = db.prepare(UPSERT_PRICE_HISTORY)
  for (const p of priceHistory) {
    statements.push(insertPrices.bind(...priceHistoryBindings(p.ticker, p.fetched_at, p.source, p.history)))
  }

  const insertMeta = db.prepare(UPSERT_META)
  for (const [key, value] of metaEntries) statements.push(insertMeta.bind(key, value))

  await db.batch(statements)

  return json({
    transactions: transactions.length,
    aliases: aliases.length,
    fair_values: fairValues.length,
    price_history: priceHistory.length,
    meta: metaEntries.length,
  } satisfies RestoreResult)
}
