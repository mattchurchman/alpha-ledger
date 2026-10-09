import type {
  BulkUpsertResult,
  TransactionInput,
  TransactionPatch,
  TransactionRow,
} from '../../src/api/types'
import { apiError, json, readJson } from '../http'
import {
  asArray,
  asObject,
  fail,
  optBool,
  optDecimal,
  optString,
  parseId,
  reqDate,
  reqDecimal,
  reqEnum,
  reqString,
  reqTicker,
} from '../validate'

const TYPES = ['buy', 'sell', 'dividend', 'split', 'adjust'] as const
const SOURCES = ['m1', 'manual'] as const

/** D1 gives `excluded` back as 0/1 and everything else as the column type. */
export interface TransactionDbRow {
  id: number
  account_label: string
  trade_date: string
  ticker: string
  type: TransactionRow['type']
  shares: string | null
  amount_usd: string
  source: TransactionRow['source']
  source_row_hash: string
  note: string | null
  excluded: number
}

export function toTransactionRow(row: TransactionDbRow): TransactionRow {
  return { ...row, excluded: row.excluded === 1 }
}

const COLUMNS =
  'id, account_label, trade_date, ticker, type, shares, amount_usd, source, source_row_hash, note, excluded'

/** Exported so `backup.ts` validates a restored row exactly as a created one. */
export function parseTransactionInput(value: unknown): TransactionInput {
  const body = asObject(value, 'transaction')
  const type = reqEnum(body, 'type', TYPES)
  return {
    account_label: reqString(body, 'account_label'),
    trade_date: reqDate(body, 'trade_date'),
    ticker: reqTicker(body, 'ticker'),
    type,
    // An `adjust` is a correction, so it is the one type whose share count may be negative
    // (engine types.ts). Everything else counts shares in one direction only.
    shares: optDecimal(body, 'shares', { allowNegative: type === 'adjust' }),
    // Always positive; `type` carries the direction (SPEC 3). Zero is allowed because an
    // `adjust` moves shares with no cash attached.
    amount_usd: reqDecimal(body, 'amount_usd'),
    source: reqEnum(body, 'source', SOURCES),
    source_row_hash: reqString(body, 'source_row_hash'),
    note: optString(body, 'note'),
    excluded: optBool(body, 'excluded', false),
  }
}

/** Only the fields actually present are validated, so a patch can touch one column. */
function parsePatch(value: unknown): TransactionPatch {
  const body = asObject(value, 'patch')
  const patch: TransactionPatch = {}
  if ('account_label' in body) patch.account_label = reqString(body, 'account_label')
  if ('trade_date' in body) patch.trade_date = reqDate(body, 'trade_date')
  if ('ticker' in body) patch.ticker = reqTicker(body, 'ticker')
  if ('type' in body) patch.type = reqEnum(body, 'type', TYPES)
  if ('source' in body) patch.source = reqEnum(body, 'source', SOURCES)
  if ('amount_usd' in body) patch.amount_usd = reqDecimal(body, 'amount_usd')
  if ('note' in body) patch.note = optString(body, 'note')
  if ('excluded' in body) patch.excluded = optBool(body, 'excluded', false)
  if ('shares' in body) {
    // A patch may not carry `type`, so the sign rule has to look at the type it is landing
    // on. The permissive read is safe: `reconcileShares` is where a wrong count surfaces.
    const type = patch.type
    patch.shares = optDecimal(body, 'shares', { allowNegative: type === undefined || type === 'adjust' })
  }
  if (Object.keys(patch).length === 0) fail('Patch must change at least one field')
  return patch
}

export async function listTransactions(db: D1Database, params: URLSearchParams): Promise<Response> {
  const where: string[] = []
  const binds: string[] = []

  const ticker = params.get('ticker')
  if (ticker) {
    where.push('ticker = ?')
    binds.push(ticker.toUpperCase())
  }
  const account = params.get('account')
  if (account) {
    where.push('account_label = ?')
    binds.push(account)
  }
  const type = params.get('type')
  if (type) {
    if (!TYPES.includes(type as (typeof TYPES)[number])) fail(`Unknown type "${type}"`)
    where.push('type = ?')
    binds.push(type)
  }

  // Excluded rows are returned with their flag rather than filtered out: the Activity screen
  // has to show them to let the user un-exclude one, and the engine skips them itself.
  const sql =
    `SELECT ${COLUMNS} FROM transactions` +
    (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ' ORDER BY trade_date, id'

  const { results } = await db
    .prepare(sql)
    .bind(...binds)
    .all<TransactionDbRow>()
  return json(results.map(toTransactionRow))
}

export async function createTransaction(db: D1Database, request: Request): Promise<Response> {
  const input = parseTransactionInput(await readJson(request))
  const row = await db
    .prepare(
      `INSERT INTO transactions
         (account_label, trade_date, ticker, type, shares, amount_usd, source, source_row_hash, note, excluded)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING ${COLUMNS}`,
    )
    .bind(
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
    )
    .first<TransactionDbRow>()
    .catch((err: unknown) => {
      if (isUniqueViolation(err)) {
        fail(`A transaction with source_row_hash "${input.source_row_hash}" already exists`)
      }
      throw err
    })

  if (!row) return apiError('Insert returned no row', 500)
  return json(toTransactionRow(row), 201)
}

/**
 * Bulk import. Existing hashes are left **untouched** rather than overwritten: re-importing
 * an overlapping M1 export must not undo an edit or an exclusion the user has since made,
 * and the hash already identifies the row uniquely (docs/M1_FORMAT.md), so there is nothing
 * new to write. `skipped` is therefore the dedupe count the Import screen shows.
 */
export async function bulkUpsertTransactions(db: D1Database, request: Request): Promise<Response> {
  const body = asObject(await readJson(request), 'body')
  const rows = asArray(body.transactions, '"transactions"').map(parseTransactionInput)
  if (rows.length === 0) return json({ inserted: 0, skipped: 0 } satisfies BulkUpsertResult)

  const statement = db.prepare(
    `INSERT INTO transactions
       (account_label, trade_date, ticker, type, shares, amount_usd, source, source_row_hash, note, excluded)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (source_row_hash) DO NOTHING`,
  )

  // One statement per row (a multi-row VALUES list would blow past D1's bound-parameter
  // ceiling), chunked into batches so a big first import stays inside one request.
  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE).map((r) =>
      statement.bind(
        r.account_label,
        r.trade_date,
        r.ticker,
        r.type,
        r.shares,
        r.amount_usd,
        r.source,
        r.source_row_hash,
        r.note ?? null,
        r.excluded ? 1 : 0,
      ),
    )
    const results = await db.batch(chunk)
    for (const result of results) inserted += result.meta.changes
  }

  return json({ inserted, skipped: rows.length - inserted } satisfies BulkUpsertResult)
}

const BATCH_SIZE = 100

export async function updateTransaction(
  db: D1Database,
  id: number,
  request: Request,
): Promise<Response> {
  const patch = parsePatch(await readJson(request))
  const sets: string[] = []
  const binds: (string | number | null)[] = []

  for (const [field, value] of Object.entries(patch)) {
    sets.push(`${field} = ?`)
    binds.push(field === 'excluded' ? (value ? 1 : 0) : (value as string | null))
  }
  binds.push(id)

  const row = await db
    .prepare(`UPDATE transactions SET ${sets.join(', ')} WHERE id = ? RETURNING ${COLUMNS}`)
    .bind(...binds)
    .first<TransactionDbRow>()

  if (!row) return apiError(`No transaction with id ${id}`, 404)
  return json(toTransactionRow(row))
}

/** Exclude/include is its own route because it is a one-tap action on the Activity screen. */
export async function setTransactionExcluded(
  db: D1Database,
  id: number,
  request: Request,
): Promise<Response> {
  const body = asObject(await readJson(request), 'body')
  const excluded = optBool(body, 'excluded', true)

  const row = await db
    .prepare(`UPDATE transactions SET excluded = ? WHERE id = ? RETURNING ${COLUMNS}`)
    .bind(excluded ? 1 : 0, id)
    .first<TransactionDbRow>()

  if (!row) return apiError(`No transaction with id ${id}`, 404)
  return json(toTransactionRow(row))
}

export async function deleteTransaction(db: D1Database, id: number): Promise<Response> {
  const { meta } = await db.prepare('DELETE FROM transactions WHERE id = ?').bind(id).run()
  if (meta.changes === 0) return apiError(`No transaction with id ${id}`, 404)
  return new Response(null, { status: 204 })
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed/i.test(err.message)
}

/** Routes under `/api/transactions`. `rest` is the path after that prefix. */
export async function handleTransactions(
  db: D1Database,
  request: Request,
  rest: string,
  params: URLSearchParams,
): Promise<Response | null> {
  const method = request.method

  if (rest === '') {
    if (method === 'GET') return listTransactions(db, params)
    if (method === 'POST') return createTransaction(db, request)
    return apiError('Method not allowed', 405)
  }

  if (rest === '/bulk') {
    if (method !== 'POST') return apiError('Method not allowed', 405)
    return bulkUpsertTransactions(db, request)
  }

  const excludeMatch = /^\/(\d+)\/exclude$/.exec(rest)
  if (excludeMatch) {
    if (method !== 'POST') return apiError('Method not allowed', 405)
    return setTransactionExcluded(db, parseId(excludeMatch[1]), request)
  }

  const idMatch = /^\/(\d+)$/.exec(rest)
  if (idMatch) {
    const id = parseId(idMatch[1])
    if (method === 'PATCH') return updateTransaction(db, id, request)
    if (method === 'DELETE') return deleteTransaction(db, id)
    return apiError('Method not allowed', 405)
  }

  return null
}
