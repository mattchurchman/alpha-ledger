import Decimal from 'decimal.js'
import { calendarDaysBetween, closeOutPlan } from '../defunct'
import { resolveTicker, sharesOn, splitAdjustTransactions } from '../holdings'
import type { PriceHistory, PriceSplitEvent } from '../prices/types'
import { TICKER_PATTERN, type TickerAlias, type Transaction } from '../types'
import { parseDate, rehashM1Row, type ParsedM1Row, type ParseResult } from './parse'

// More than half the already-mappable rows must agree, preventing a short or mostly-new file
// from being silently assigned to the wrong account.
export const ACCOUNT_OVERLAP_MAJORITY = new Decimal('0.5')
// A full export can contain more new rows than old ones. Three exact, uniquely best source-row
// matches are strong enough to identify that existing account without making one coincidental
// repeated trade silently choose it.
export const ACCOUNT_OVERLAP_STRONG_MATCHES = 3
// A split outside this window is weak evidence that an invalid M1 symbol is only a split marker.
export const SPLIT_EVIDENCE_DAYS = 10
// A cash settlement should follow the final quoted close promptly; a wider window catches
// unrelated stale holdings and turns a useful proposal into a guess.
export const DELISTING_TRADING_DAYS = 15
// Buyout consideration can differ from the last public close, while a gap larger than this is
// too weak to identify a ticker without another piece of evidence.
export const CASH_PRICE_TOLERANCE = new Decimal('0.2')

export interface ImportAccountLabel {
  value: string | null
  inferred: boolean
  evidence: string
}

export interface ImportRowReference {
  line: number
  sourceRowHash: string
  transactionType: string
  description: string
}

export interface AutoFixedImport extends ImportRowReference {
  kind: 'split-placeholder' | 'cash-out'
  evidence: string
  /** Null means the proven fix is to drop the redundant source row. */
  transaction: Transaction | null
}

export interface ImportProposal extends ImportRowReference {
  kind: 'cash-out' | 'transfer-in-kind'
  evidence: string
  transaction: Transaction
}

export interface IgnoredImport extends ImportRowReference {
  evidence: string
}

export interface ImportNeedsYou extends ImportRowReference {
  kind: 'account' | 'cash-out' | 'unrecognized'
  evidence: string
  candidates?: string[]
  /**
   * Transactions the resolver can build safely for the named candidates. The screen only
   * chooses among these; it never reconstructs shares or settlement cash itself.
   */
  candidateTransactions?: Transaction[]
}

export interface ImportPlan {
  accountLabel: ImportAccountLabel
  fresh: Transaction[]
  duplicates: number
  autoFixed: AutoFixedImport[]
  proposals: ImportProposal[]
  ignored: IgnoredImport[]
  needsYou: ImportNeedsYou[]
}

export interface PlanImportInput {
  parsed: ParseResult
  accountLabel?: string
  ledger: readonly Transaction[]
  prices: Record<string, PriceHistory>
  aliases: readonly TickerAlias[]
  ignoredHashes: readonly string[]
}

interface DelistingFit {
  ticker: string
  transaction: Transaction
  lastClose: Decimal
  tradingDays: number
  difference: Decimal
}

export function planImport(input: PlanImportInput): ImportPlan {
  const accountLabel = resolveAccountLabel(input)
  const plan: ImportPlan = {
    accountLabel,
    fresh: [],
    duplicates: 0,
    autoFixed: [],
    proposals: [],
    ignored: [],
    needsYou: [],
  }

  if (accountLabel.value === null) {
    plan.needsYou.push(accountNeed(accountLabel.evidence))
    return plan
  }

  const label = accountLabel.value
  const rowByOriginalHash = new Map(input.parsed.rows.map((row) => [row.source_row_hash, row]))
  const ledgerHashes = new Set(input.ledger.map((transaction) => transaction.source_row_hash))
  const ignoredHashes = new Set(input.ignoredHashes)

  for (const transaction of input.parsed.transactions) {
    const row = rowByOriginalHash.get(transaction.source_row_hash)
    const sourceRowHash = row ? rehashM1Row(row, label) : transaction.source_row_hash
    const relabelled: Transaction = {
      ...transaction,
      account_label: label,
      source_row_hash: sourceRowHash,
    }

    if (ignoredHashes.has(sourceRowHash)) {
      if (row) plan.ignored.push(ignoredEntry(row, sourceRowHash))
    } else if (ledgerHashes.has(sourceRowHash)) {
      plan.duplicates += 1
    } else {
      plan.fresh.push(relabelled)
    }
  }

  // Cash-outs need the ledger state that will exist after ordinary fresh rows are saved. This
  // is what lets a from-scratch full export resolve an old settlement from earlier rows in that
  // same file, without double-counting rows already present in the ledger.
  const planningLedger: Transaction[] = [...input.ledger, ...plan.fresh]

  for (const row of input.parsed.rows) {
    if (row.disposition !== 'unrecognized') continue

    const sourceRowHash = rehashM1Row(row, label)
    if (ignoredHashes.has(sourceRowHash)) {
      plan.ignored.push(ignoredEntry(row, sourceRowHash))
      continue
    }
    if (ledgerHashes.has(sourceRowHash)) {
      plan.duplicates += 1
      continue
    }

    const type = field(row, 'Transaction Type').toUpperCase()
    if (type === 'CASH') {
      resolveCash(row, sourceRowHash, label, planningLedger, input, plan)
    } else if (type === 'TRANSFER' && field(row, 'Unit Type').toUpperCase() === 'SHARES') {
      resolveTransfer(row, sourceRowHash, label, plan)
    } else {
      resolvePlaceholderOrUnknown(row, sourceRowHash, input, plan)
    }
  }

  return plan
}

function resolveAccountLabel(input: PlanImportInput): ImportAccountLabel {
  const supplied = input.accountLabel?.trim()
  if (supplied) {
    return {
      value: supplied,
      inferred: false,
      evidence: 'Account label supplied for this import.',
    }
  }

  const mappable = input.parsed.rows.filter((row) => row.disposition === 'transaction')
  const accounts = [...new Set(input.ledger.map((row) => row.account_label).filter(Boolean))]
  const ledgerHashes = new Set(input.ledger.map((row) => row.source_row_hash))
  const scores = accounts
    .map((account) => ({
      account,
      matches: mappable.filter((row) => ledgerHashes.has(rehashM1Row(row, account))).length,
    }))
    .sort((a, b) => b.matches - a.matches || a.account.localeCompare(b.account))

  const best = scores[0]
  const second = scores[1]
  const majority = best
    ? new Decimal(best.matches).div(mappable.length || 1).greaterThan(ACCOUNT_OVERLAP_MAJORITY)
    : false
  const uniquelyBest = best && best.matches > (second?.matches ?? -1)
  const strongExactOverlap = best && best.matches >= ACCOUNT_OVERLAP_STRONG_MATCHES
  if (best && uniquelyBest && (majority || strongExactOverlap)) {
    return {
      value: best.account,
      inferred: true,
      evidence: `${best.matches} of ${mappable.length} mappable rows match account "${best.account}".`,
    }
  }

  const overlap = best ? `${best.matches} of ${mappable.length}` : `0 of ${mappable.length}`
  return {
    value: null,
    inferred: false,
    evidence: `Best account overlap is ${overlap} mappable rows; enter the account label.`,
  }
}

function resolvePlaceholderOrUnknown(
  row: ParsedM1Row,
  sourceRowHash: string,
  input: PlanImportInput,
  plan: ImportPlan,
): void {
  const symbol = field(row, 'Symbol').toUpperCase()
  const stripped = symbol.startsWith('PRESPLIT') ? symbol.slice('PRESPLIT'.length) : ''
  const date = parseDate(field(row, 'Date'))

  if (!TICKER_PATTERN.test(symbol) && TICKER_PATTERN.test(stripped) && date !== null) {
    const ticker = resolveTicker(stripped, date, [...input.aliases])
    const split = nearbySplit(input.prices[ticker]?.splits ?? [], date)
    if (split) {
      plan.autoFixed.push({
        ...rowReference(row, sourceRowHash),
        kind: 'split-placeholder',
        evidence: `${ticker} split ${split.numerator}:${split.denominator} on ${split.date}; this M1 placeholder is redundant and will be dropped.`,
        transaction: null,
      })
      return
    }

    plan.needsYou.push({
      ...rowReference(row, sourceRowHash),
      kind: 'unrecognized',
      evidence: `${symbol} strips to ${ticker}, but no nearby split proves the row is redundant.`,
    })
    return
  }

  plan.needsYou.push({
    ...rowReference(row, sourceRowHash),
    kind: 'unrecognized',
    evidence: row.reason ?? 'M1 row is not recognized.',
  })
}

function resolveCash(
  row: ParsedM1Row,
  sourceRowHash: string,
  accountLabel: string,
  planningLedger: Transaction[],
  input: PlanImportInput,
  plan: ImportPlan,
): void {
  const date = parseDate(field(row, 'Date'))
  const amount = exactDecimal(field(row, 'Amount'), true)
  if (date === null || amount === null || !amount.isPositive()) {
    plan.needsYou.push({
      ...rowReference(row, sourceRowHash),
      kind: 'cash-out',
      evidence: 'The CASH row does not have a usable date and positive amount.',
    })
    return
  }

  const securityId = field(row, 'Security Id')
  const cusipRows =
    securityId === ''
      ? []
      : input.parsed.rows.filter(
          (candidate) =>
            candidate.line < row.line &&
            field(candidate, 'Security Id') === securityId &&
            field(candidate, 'Security Id Type').toUpperCase() === 'CUSIP' &&
            TICKER_PATTERN.test(field(candidate, 'Symbol').toUpperCase()),
        )
  const cusipTickers = [
    ...new Set(cusipRows.map((candidate) => resolvedRowTicker(candidate, input.aliases))),
  ].sort()

  if (cusipTickers.length === 1) {
    const ticker = cusipTickers[0]
    const transaction = cashSell(
      planningLedger,
      input.prices,
      input.aliases,
      ticker,
      date,
      amount,
      accountLabel,
      sourceRowHash,
      field(row, 'Description'),
    )
    if (transaction) {
      const count = cusipRows.filter(
        (candidate) => resolvedRowTicker(candidate, input.aliases) === ticker,
      ).length
      plan.autoFixed.push({
        ...rowReference(row, sourceRowHash),
        kind: 'cash-out',
        evidence: `CUSIP ${securityId} matches ${count} earlier ${ticker} ${count === 1 ? 'row' : 'rows'}.`,
        transaction,
      })
      planningLedger.push(transaction)
      return
    }

    plan.needsYou.push({
      ...rowReference(row, sourceRowHash),
      kind: 'cash-out',
      candidates: [ticker],
      evidence: `CUSIP ${securityId} identifies ${ticker}, but the ledger has no open ${ticker} position on ${date}.`,
    })
    return
  }

  if (cusipTickers.length > 1) {
    const candidateTransactions = cusipTickers.flatMap((ticker) => {
      const transaction = cashSell(
        planningLedger,
        input.prices,
        input.aliases,
        ticker,
        date,
        amount,
        accountLabel,
        sourceRowHash,
        field(row, 'Description'),
      )
      return transaction ? [transaction] : []
    })
    plan.needsYou.push({
      ...rowReference(row, sourceRowHash),
      kind: 'cash-out',
      candidates: cusipTickers,
      ...(candidateTransactions.length > 0 ? { candidateTransactions } : {}),
      evidence: `CUSIP ${securityId} appears on more than one ticker: ${cusipTickers.join(', ')}.`,
    })
    return
  }

  const fits = delistingFits(
    planningLedger,
    input.prices,
    input.aliases,
    date,
    amount,
    accountLabel,
    sourceRowHash,
    field(row, 'Description'),
  )
  if (fits.length === 1) {
    const fit = fits[0]
    plan.proposals.push({
      ...rowReference(row, sourceRowHash),
      kind: 'cash-out',
      evidence: `${fit.ticker}'s last close $${fit.lastClose.toFixed()} was ${fit.tradingDays} trading ${fit.tradingDays === 1 ? 'day' : 'days'} before this row; cash per held share differs by ${fit.difference.times(100).toDecimalPlaces(1).toFixed()}%.`,
      transaction: fit.transaction,
    })
    return
  }

  const candidates = fits.map((fit) => fit.ticker).sort()
  plan.needsYou.push({
    ...rowReference(row, sourceRowHash),
    kind: 'cash-out',
    ...(candidates.length > 0 ? { candidates } : {}),
    ...(fits.length > 0 ? { candidateTransactions: fits.map((fit) => fit.transaction) } : {}),
    evidence:
      candidates.length > 0
        ? `More than one held ticker fits the settlement amount and timing: ${candidates.join(', ')}.`
        : 'No held ticker has both a recent final close and a matching cash-per-share amount.',
  })
}

function resolveTransfer(
  row: ParsedM1Row,
  sourceRowHash: string,
  accountLabel: string,
  plan: ImportPlan,
): void {
  const ticker = field(row, 'Symbol').toUpperCase()
  const date = parseDate(field(row, 'Date'))
  const shares = exactDecimal(field(row, 'Units'), false)
  if (!TICKER_PATTERN.test(ticker) || date === null || shares === null || shares.isZero()) {
    plan.needsYou.push({
      ...rowReference(row, sourceRowHash),
      kind: 'unrecognized',
      evidence: 'The transfer in kind does not have a valid ticker, date and non-zero share count.',
    })
    return
  }

  plan.proposals.push({
    ...rowReference(row, sourceRowHash),
    kind: 'transfer-in-kind',
    evidence: `M1 reports ${shares.toFixed()} ${ticker} shares transferred in kind on ${date}.`,
    transaction: {
      account_label: accountLabel,
      trade_date: date,
      ticker,
      type: 'adjust',
      shares: shares.toFixed(),
      amount_usd: '0',
      source: 'm1',
      source_row_hash: sourceRowHash,
      note: `M1 transfer in kind: ${field(row, 'Description')}`,
      excluded: false,
    },
  })
}

function delistingFits(
  transactions: Transaction[],
  prices: Record<string, PriceHistory>,
  aliases: readonly TickerAlias[],
  date: string,
  amount: Decimal,
  accountLabel: string,
  sourceRowHash: string,
  description: string,
): DelistingFit[] {
  const accountTransactions = transactions.filter(
    (transaction) => transaction.account_label === accountLabel,
  )
  const adjusted = splitAdjustTransactions(accountTransactions, prices, [...aliases])
  const held = sharesOn(adjusted, date)
  const marketDates = [...new Set(Object.values(prices).flatMap((history) => history.dates))].sort()
  const fits: DelistingFit[] = []

  for (const ticker of [...held.keys()].sort()) {
    const history = prices[ticker]
    if (!history || history.dates.length === 0) continue

    let lastIndex = 0
    for (let i = 1; i < history.dates.length; i++) {
      if (history.dates[i] > history.dates[lastIndex]) lastIndex = i
    }

    const lastDate = history.dates[lastIndex]
    if (lastDate >= date) continue
    const tradingDays = marketDates.filter(
      (marketDate) => marketDate > lastDate && marketDate <= date,
    ).length
    if (tradingDays > DELISTING_TRADING_DAYS) continue

    const lastClose = exactDecimal(history.close[lastIndex] ?? '', false)
    if (lastClose === null || !lastClose.isPositive()) continue
    const transaction = cashSell(
      accountTransactions,
      prices,
      aliases,
      ticker,
      date,
      amount,
      accountLabel,
      sourceRowHash,
      description,
    )
    if (!transaction || transaction.shares === null) continue

    const perShare = amount.div(new Decimal(transaction.shares).abs())
    const difference = perShare.minus(lastClose).abs().div(lastClose)
    if (difference.greaterThan(CASH_PRICE_TOLERANCE)) continue
    fits.push({ ticker, transaction, lastClose, tradingDays, difference })
  }

  return fits
}

function cashSell(
  transactions: Transaction[],
  prices: Record<string, PriceHistory>,
  aliases: readonly TickerAlias[],
  ticker: string,
  date: string,
  amount: Decimal,
  accountLabel: string,
  sourceRowHash: string,
  description: string,
): Transaction | null {
  const accountTransactions = transactions.filter(
    (transaction) => transaction.account_label === accountLabel,
  )
  const outcome = closeOutPlan({
    transactions: accountTransactions,
    prices,
    aliases: [...aliases],
    ticker,
    date,
    cash: amount.toFixed(),
    cashBasis: 'total',
  })
  if (!outcome.ok) return null

  return {
    account_label: accountLabel,
    trade_date: outcome.sell.trade_date,
    ticker: outcome.sell.ticker,
    type: 'sell',
    shares: outcome.sell.shares,
    amount_usd: outcome.sell.amount_usd,
    source: 'm1',
    source_row_hash: sourceRowHash,
    note: `M1 CASH settlement: ${description}`,
    excluded: false,
  }
}

function nearbySplit(splits: readonly PriceSplitEvent[], date: string): PriceSplitEvent | null {
  return (
    [...splits]
      .filter((split) => Math.abs(calendarDaysBetween(date, split.date)) <= SPLIT_EVIDENCE_DAYS)
      .sort(
        (a, b) =>
          Math.abs(calendarDaysBetween(date, a.date)) -
            Math.abs(calendarDaysBetween(date, b.date)) || a.date.localeCompare(b.date),
      )[0] ?? null
  )
}

function exactDecimal(value: string, absolute: boolean): Decimal | null {
  const cleaned = value.trim().replace(/[$,\s]/g, '')
  if (cleaned === '' || cleaned === '--') return null
  try {
    const parsed = new Decimal(cleaned)
    if (!parsed.isFinite()) return null
    return absolute ? parsed.abs() : parsed
  } catch {
    return null
  }
}

function field(row: ParsedM1Row, name: string): string {
  return row.fields[name.toLowerCase()] ?? ''
}

function resolvedRowTicker(row: ParsedM1Row, aliases: readonly TickerAlias[]): string {
  const symbol = field(row, 'Symbol').toUpperCase()
  const date = parseDate(field(row, 'Date'))
  return date === null ? symbol : resolveTicker(symbol, date, [...aliases])
}

function rowReference(row: ParsedM1Row, sourceRowHash: string): ImportRowReference {
  return {
    line: row.line,
    sourceRowHash,
    transactionType: field(row, 'Transaction Type'),
    description: field(row, 'Description'),
  }
}

function ignoredEntry(row: ParsedM1Row, sourceRowHash: string): IgnoredImport {
  return {
    ...rowReference(row, sourceRowHash),
    evidence: 'This source row hash was previously ignored.',
  }
}

function accountNeed(evidence: string): ImportNeedsYou {
  return {
    line: 0,
    sourceRowHash: '',
    transactionType: '',
    description: '',
    kind: 'account',
    evidence,
  }
}
