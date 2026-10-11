import { computeHoldings } from './holdings'
import type { PriceHistory } from './prices/types'
import type { TickerAlias, Transaction } from './types'

/**
 * Per-account views (task 19). Every transaction carries exactly one `account_label`, so one
 * account is not a slice of the all-accounts numbers - it is the same pure call over a
 * filtered ledger with the same prices.
 *
 * What that does and does not preserve, pinned by `accounts.test.ts`:
 *
 * - The additive measures - `currentValue`, `shadowValue`, `valueAdded`, `invested`,
 *   `returned`, `totalGain`, `shares` - sum back to the all-accounts figures exactly, because
 *   the accounts partition the rows and both sides of the comparison are built from the rows.
 * - The realized/unrealized split does **not**, and neither does `costBasis`. SPEC section 4
 *   pools average cost across accounts; a single-account view uses that account's own average,
 *   so a sale is matched against a different basis. Their total is unchanged - only where the
 *   gain is booked moves. Recorded in the SPEC Decision log.
 * - `percentDifference` and both IRRs are ratios, so they never sum. Read them per view.
 */

/**
 * Every account label in the ledger, sorted. Excluded rows are left out, because the engine
 * drops them too (`holdings.ts`): an account whose only rows are excluded has no numbers to
 * show, so offering it as a choice would lead to an empty screen.
 */
export function accountLabels(transactions: Transaction[]): string[] {
  const labels = new Set<string>()
  for (const txn of transactions) if (!txn.excluded) labels.add(txn.account_label)
  return [...labels].sort()
}

/** One account's rows. Plain equality on `account_label` - a label is opaque, never parsed. */
export function transactionsIn(transactions: Transaction[], account: string): Transaction[] {
  return transactions.filter((txn) => txn.account_label === account)
}

/** One account's stake in a single ticker. */
export interface AccountShares {
  account: string
  shares: string
  currentValue: string
}

export interface SharesByAccountInput {
  transactions: Transaction[]
  prices: Record<string, PriceHistory>
  aliases?: TickerAlias[]
  /** Valuation date. Pass the all-accounts result's own `asOf` so the parts agree with it. */
  asOf: string
  /** The ticker to split, **after** alias resolution - the same key `byTicker` uses. */
  ticker: string
}

/**
 * How one ticker's shares split across accounts, for the stock detail screen. This runs
 * `computeHoldings` per account rather than `analyze`: the answer is a share count and what it
 * is worth, so the shadow buckets, the IRRs and the daily series would all be pure waste.
 *
 * Accounts that never traded the ticker are left out. One that traded it and is now flat is
 * kept, with zero shares - "you closed this one out here" is part of the split.
 */
export function sharesByAccount(input: SharesByAccountInput): AccountShares[] {
  const { transactions, prices, aliases = [], asOf, ticker } = input
  const out: AccountShares[] = []

  for (const account of accountLabels(transactions)) {
    const holdings = computeHoldings({
      transactions: transactionsIn(transactions, account),
      prices,
      aliases,
      asOf,
    })
    const holding = holdings.byTicker.find((t) => t.ticker === ticker)
    if (!holding) continue
    out.push({ account, shares: holding.shares, currentValue: holding.currentValue })
  }

  return out
}
