import { createContext, useContext } from 'react'
import type { MetaMap, StoredPriceHistory, TickerAlias, TransactionRow } from '../api/types'
import type { AnalyzeResult, Transaction } from '../engine'
import type { PriceHistory } from '../engine/prices/types'
import type { PricesAsOf } from '../ui'
import type { UpdateFailure, UpdateOutcome } from './marketData'

/**
 * The context and hook, split out of `PortfolioData.tsx` so that file exports a component
 * only - the same reason `src/ui/toastContext.ts` is split from `Toast.tsx` (fast refresh).
 */

export interface UpdateState {
  running: boolean
  done: number
  total: number
  failures: UpdateFailure[]
  /** Failures that are expected: closed positions whose symbol no longer trades (task 18). */
  tolerated: UpdateFailure[]
  lastRunAt: string | null
}

/**
 * One row of the Dashboard's account comparison strip (task 19). Every field is read straight
 * off that account's own `analyze` result - the strip does no arithmetic of its own, and these
 * are full-precision decimal strings like everything else the engine returns.
 */
export interface AccountSummary {
  account: string
  currentValue: string
  shadowValue: string
  valueAdded: string
  percentDifference: string | null
}

export interface PortfolioData {
  loading: boolean
  error: string | null
  transactions: TransactionRow[]
  aliases: TickerAlias[]
  priceHistory: StoredPriceHistory[]
  /** `priceHistory` reshaped to `{ ticker: history }`, the same map `analyze` was built from. */
  prices: Record<string, PriceHistory>
  meta: MetaMap
  /**
   * Tickers the user has hidden from Holdings, Rebuy and Fair values (task 18). Presentation
   * only: no total or chart changes, and `result` never knows about it.
   */
  hiddenTickers: string[]
  /**
   * Tickers the user is watching but does not hold (task 20). Never reaches `analyze`,
   * Holdings, portfolio totals or the creators chart - `src/data/watchlist.ts`'s
   * `mergeHeldAndWatched` is the one place it joins the held tickers for display.
   */
  watchlist: string[]
  /** null until VOO has a stored history - there is nothing to compare against before that. */
  result: AnalyzeResult | null
  /** Every `account_label` in the ledger, sorted. One entry means there is nothing to switch. */
  accounts: string[]
  /**
   * One summary per account, for the comparison strip. Empty when there is only one account
   * (or none) - there is no comparison to draw, and running `analyze` again would be waste.
   */
  accountSummaries: AccountSummary[]
  /**
   * The analysis a screen should show: `result` for `null` ("All accounts"), otherwise that
   * one account's own, memoised on first ask. SPEC section 4 pools cost basis across accounts,
   * so a single-account view is a fresh `analyze` over its rows and not a slice of the totals.
   * Null when there is no comparison yet, exactly like `result`.
   */
  resultFor: (account: string | null) => AnalyzeResult | null
  pricesAsOf: PricesAsOf
  update: UpdateState
  /**
   * Fetches VOO plus every ticker ever held and stores each series. An import may pass the
   * just-posted rows so its automatic update does not wait for React's next cache render.
   */
  runUpdate: (transactionsOverride?: Transaction[]) => Promise<UpdateOutcome>
  /** Adds or removes one ticker from `hiddenTickers`, then reloads. */
  setTickerHidden: (ticker: string, hidden: boolean) => Promise<void>
  /** Adds or removes one ticker from `watchlist`, then reloads. */
  setTickerWatched: (ticker: string, watched: boolean) => Promise<void>
  /** Re-fetches transactions/prices/aliases/meta and re-runs `analyze`. Call after any edit. */
  reload: () => Promise<void>
  /** The manual fallback: stores a ticker's history as-is, marked `source: 'manual'`. */
  putPriceHistory: (ticker: string, history: PriceHistory) => Promise<void>
}

export const PortfolioDataContext = createContext<PortfolioData | null>(null)

export function usePortfolioData(): PortfolioData {
  const ctx = useContext(PortfolioDataContext)
  if (!ctx) throw new Error('usePortfolioData must be used inside a PortfolioDataProvider')
  return ctx
}
