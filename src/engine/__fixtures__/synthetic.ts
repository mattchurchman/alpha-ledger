/**
 * Shared synthetic fixtures for the shadow, returns, series and decisions tests. Nothing
 * here is real: invented tickers, round prices, round dollar amounts. No position, amount
 * or symbol from the user's ledger appears in any test in this repo (CLAUDE.md).
 *
 * The calendar is seven trading days chosen so that every number in the tests can be worked
 * out by hand:
 *
 * ```
 * 2025-01-02 Thu   VOO adj 100   ACME close 100
 * 2025-01-03 Fri   VOO adj 100   ACME close 110
 * 2025-01-06 Mon   VOO adj 200   ACME close 120   <- 01-04 and 01-05 are a weekend
 * 2025-01-07 Tue   VOO adj 200   ACME close 150
 * 2025-01-08 Wed   VOO adj 400   ACME close 200
 * 2025-07-01 Tue   VOO adj 400   ACME close 250
 * 2026-01-02 Fri   VOO adj 500   ACME close 300
 * ```
 *
 * The first and last days are **exactly 365 days apart** (2025 is not a leap year), so an
 * IRR over the whole window annualizes over one clean year.
 */

import type { PriceHistory, PriceSplitEvent } from '../prices/types'
import type { Transaction } from '../types'

export const DATES = [
  '2025-01-02',
  '2025-01-03',
  '2025-01-06',
  '2025-01-07',
  '2025-01-08',
  '2025-07-01',
  '2026-01-02',
]

export const FIRST_DAY = DATES[0]
export const LAST_DAY = DATES[DATES.length - 1]
/** A Saturday: used to check that a trade is priced on the next trading day. */
export const WEEKEND_DAY = '2025-01-04'

export function history(
  closes: string[],
  options: { adjClose?: string[]; splits?: PriceSplitEvent[]; dates?: string[] } = {},
): PriceHistory {
  const dates = options.dates ?? DATES
  return {
    dates,
    close: closes,
    adjClose: options.adjClose ?? closes,
    splits: options.splits ?? [],
    dividends: [],
    asOf: dates[dates.length - 1],
  }
}

/** The benchmark. Adjusted close doubles, doubles again, then adds a quarter: 100 -> 500. */
export const VOO = history(['100', '100', '200', '200', '400', '400', '500'])

/** A pick that merely triples while the benchmark quintuples. */
export const ACME = history(['100', '110', '120', '150', '200', '250', '300'])

/**
 * A pick that is exactly half the benchmark's price on every single day. Any buy of it
 * therefore has to come out at zero value added, whatever day it was made on, which is the
 * sharpest self-consistency check there is on the shadow math.
 */
export const BETA = history(['50', '50', '100', '100', '200', '200', '250'])

export const PRICES: Record<string, PriceHistory> = { VOO, ACME, BETA }

let sequence = 0

export function row(
  account: string,
  tradeDate: string,
  ticker: string,
  type: Transaction['type'],
  shares: string | null,
  amount: string,
): Transaction {
  sequence += 1
  return {
    account_label: account,
    trade_date: tradeDate,
    ticker,
    type,
    shares,
    amount_usd: amount,
    source: 'manual',
    source_row_hash: `hash-${sequence}`,
    note: null,
    excluded: false,
  }
}

export const buy = (
  date: string,
  ticker: string,
  shares: string,
  amount: string,
  account = 'taxable',
) => row(account, date, ticker, 'buy', shares, amount)

export const sell = (
  date: string,
  ticker: string,
  shares: string,
  amount: string,
  account = 'taxable',
) => row(account, date, ticker, 'sell', shares, amount)

export const dividend = (date: string, ticker: string, amount: string, account = 'taxable') =>
  row(account, date, ticker, 'dividend', null, amount)

export const adjust = (date: string, ticker: string, shares: string, account = 'taxable') =>
  row(account, date, ticker, 'adjust', shares, '0')
