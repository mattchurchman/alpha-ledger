import Decimal from 'decimal.js'
import type { Transaction, TransactionType } from '../types'

export type { TransactionType }

/** A `Transaction` (see `src/engine/types.ts`) that came out of an M1 activity export. */
export interface NormalizedTransaction extends Transaction {
  source: 'm1'
}

export interface DroppedRow {
  line: number
  transaction_type: string
  reason: string
}

/** Raw fields are kept for terminal display during triage; never persist or commit these. */
export interface UnrecognizedRow {
  line: number
  transaction_type: string
  reason: string
  fields: Record<string, string>
}

export interface ParseResult {
  transactions: NormalizedTransaction[]
  dropped: DroppedRow[]
  unrecognized: UnrecognizedRow[]
}

const REQUIRED_COLUMNS = [
  'Date',
  'Symbol',
  'Description',
  'Transaction Type',
  'Amount',
  'Units',
  'Unit Type',
] as const

const HASHED_COLUMNS = [
  'Date',
  'Posted Date',
  'Symbol',
  'Description',
  'Transaction Type',
  'Amount',
  'Units',
  'Unit Type',
  'Unit Price',
  'Security Id',
] as const

const MONTHS: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
}

const INTEREST_DESCRIPTION = /securities lending|\binterest\b/i

export function parseM1Activity(csvText: string, accountLabel: string): ParseResult {
  const rows = parseCsv(csvText)
  const headerRow = rows.findIndex((row) => row.some((cell) => cell.trim() !== ''))
  if (headerRow === -1) {
    throw new Error('M1 activity CSV is empty')
  }

  const columns = indexColumns(rows[headerRow])
  const missing = REQUIRED_COLUMNS.filter((name) => !(name.toLowerCase() in columns))
  if (missing.length > 0) {
    throw new Error(
      `M1 activity CSV is missing required column(s): ${missing.join(', ')}. ` +
        `Found: ${rows[headerRow].join(', ')}`,
    )
  }

  const result: ParseResult = { transactions: [], dropped: [], unrecognized: [] }
  const occurrences = new Map<string, number>()

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.every((cell) => cell.trim() === '')) continue
    classifyRow(row, columns, i + 1, accountLabel, occurrences, result)
  }

  return result
}

function classifyRow(
  row: string[],
  columns: Record<string, number>,
  line: number,
  accountLabel: string,
  occurrences: Map<string, number>,
  result: ParseResult,
): void {
  const get = (name: string): string => (row[columns[name.toLowerCase()]] ?? '').trim()

  const rawType = get('Transaction Type')
  const unitType = get('Unit Type').toUpperCase()
  const type = rawType.toUpperCase()

  const reject = (reason: string): void => {
    result.unrecognized.push({
      line,
      transaction_type: rawType,
      reason,
      fields: rawFields(row, columns),
    })
  }

  switch (type) {
    case 'PURCHASED':
    case 'SOLD': {
      if (unitType !== 'SHARES') {
        reject(`${rawType} row has Unit Type "${unitType}", expected SHARES`)
        return
      }
      const built = buildSecurityTransaction(
        get,
        type === 'PURCHASED' ? 'buy' : 'sell',
        accountLabel,
        occurrences,
        row,
        columns,
      )
      if (typeof built === 'string') reject(built)
      else result.transactions.push(built)
      return
    }

    case 'DIVIDEND': {
      if (unitType !== 'CURRENCY') {
        reject(`DIVIDEND row has Unit Type "${unitType}", expected CURRENCY`)
        return
      }
      const built = buildDividendTransaction(get, accountLabel, occurrences, row, columns)
      if (typeof built === 'string') reject(built)
      else result.transactions.push(built)
      return
    }

    case 'TRANSFER': {
      if (unitType === 'CURRENCY') {
        result.dropped.push({ line, transaction_type: rawType, reason: 'cash transfer' })
      } else {
        reject('transfer in kind; needs an adjust transaction with a share count')
      }
      return
    }

    case 'FEE': {
      result.dropped.push({ line, transaction_type: rawType, reason: 'cash fee' })
      return
    }

    case 'OTHER': {
      if (unitType === 'CURRENCY' && INTEREST_DESCRIPTION.test(get('Description'))) {
        result.dropped.push({ line, transaction_type: rawType, reason: 'interest' })
      } else {
        reject('OTHER row that does not read as interest')
      }
      return
    }

    default:
      reject(type === '' ? 'row has no Transaction Type' : `unknown Transaction Type "${rawType}"`)
  }
}

function buildSecurityTransaction(
  get: (name: string) => string,
  type: 'buy' | 'sell',
  accountLabel: string,
  occurrences: Map<string, number>,
  row: string[],
  columns: Record<string, number>,
): NormalizedTransaction | string {
  const ticker = get('Symbol').toUpperCase()
  if (ticker === '') return `${type} row has no Symbol`

  const tradeDate = parseDate(get('Date'))
  if (tradeDate === null) return `unparseable Date "${get('Date')}"`

  const shares = parseDecimal(get('Units'))
  if (shares === null) return `unparseable Units "${get('Units')}"`
  if (shares.isZero()) return `${type} row has zero Units`

  const amount = parseDecimal(get('Amount'))
  if (amount === null) return `unparseable Amount "${get('Amount')}"`

  return {
    account_label: accountLabel,
    trade_date: tradeDate,
    ticker,
    type,
    shares: shares.toFixed(),
    amount_usd: amount.toFixed(),
    source: 'm1',
    source_row_hash: rowHash(row, columns, accountLabel, occurrences),
    note: null,
    excluded: false,
  }
}

function buildDividendTransaction(
  get: (name: string) => string,
  accountLabel: string,
  occurrences: Map<string, number>,
  row: string[],
  columns: Record<string, number>,
): NormalizedTransaction | string {
  const ticker = get('Symbol').toUpperCase()
  if (ticker === '') return 'DIVIDEND row has no Symbol, so it cannot be attributed'

  const tradeDate = parseDate(get('Date'))
  if (tradeDate === null) return `unparseable Date "${get('Date')}"`

  const amount = parseDecimal(get('Amount'))
  if (amount === null) return `unparseable Amount "${get('Amount')}"`

  return {
    account_label: accountLabel,
    trade_date: tradeDate,
    ticker,
    type: 'dividend',
    shares: null,
    amount_usd: amount.toFixed(),
    source: 'm1',
    source_row_hash: rowHash(row, columns, accountLabel, occurrences),
    note: null,
    excluded: false,
  }
}

/** `Mon D, YYYY` to `YYYY-MM-DD`, without constructing a Date (no timezone shift). */
export function parseDate(value: string): string | null {
  const match = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4})$/.exec(value.trim())
  if (!match) return null

  const month = MONTHS[match[1].toLowerCase()]
  if (month === undefined) return null

  const day = Number(match[2])
  if (day < 1 || day > 31) return null

  return `${match[3]}-${month}-${String(day).padStart(2, '0')}`
}

/** `-$1,234.50` or `--` to a positive Decimal. Direction comes from the row type. */
function parseDecimal(value: string): Decimal | null {
  const cleaned = value.trim().replace(/[$,\s]/g, '')
  if (cleaned === '' || cleaned === '--') return null

  try {
    const parsed = new Decimal(cleaned)
    return parsed.isFinite() ? parsed.abs() : null
  } catch {
    return null
  }
}

function indexColumns(header: string[]): Record<string, number> {
  const columns: Record<string, number> = {}
  header.forEach((name, i) => {
    const key = name.trim().toLowerCase()
    if (key !== '' && !(key in columns)) columns[key] = i
  })
  return columns
}

function rawFields(row: string[], columns: Record<string, number>): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const [name, i] of Object.entries(columns)) {
    fields[name] = (row[i] ?? '').trim()
  }
  return fields
}

function rowHash(
  row: string[],
  columns: Record<string, number>,
  accountLabel: string,
  occurrences: Map<string, number>,
): string {
  const parts = ['m1', accountLabel]
  for (const name of HASHED_COLUMNS) {
    const i = columns[name.toLowerCase()]
    parts.push(i === undefined ? '' : (row[i] ?? '').trim())
  }

  const content = parts.join('\x1f')
  const occurrence = (occurrences.get(content) ?? 0) + 1
  occurrences.set(content, occurrence)

  return fnv1a64(`${content}\x1f${occurrence}`)
}

const FNV_OFFSET = 0xcbf29ce484222325n
const FNV_PRIME = 0x100000001b3n
const MASK_64 = 0xffffffffffffffffn

function fnv1a64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let hash = FNV_OFFSET
  for (const byte of bytes) {
    hash = ((hash ^ BigInt(byte)) * FNV_PRIME) & MASK_64
  }
  return hash.toString(16).padStart(16, '0')
}

/** Minimal RFC 4180 reader: quoted fields, `""` escapes, CRLF or LF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let started = false

  for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
    const char = text[i]

    if (inQuotes) {
      if (char !== '"') {
        field += char
      } else if (text[i + 1] === '"') {
        field += '"'
        i++
      } else {
        inQuotes = false
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      started = true
    } else if (char === ',') {
      row.push(field)
      field = ''
      started = true
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      started = false
    } else if (char !== '\r') {
      field += char
      started = true
    }
  }

  if (started || field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}
