import { createContext, useContext } from 'react'
import type { MetaMap, StoredPriceHistory, TickerAlias, TransactionRow } from '../api/types'
import type { AnalyzeResult } from '../engine'
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
  /** null until VOO has a stored history - there is nothing to compare against before that. */
  result: AnalyzeResult | null
  pricesAsOf: PricesAsOf
  update: UpdateState
  /** Fetches VOO plus every ticker ever held and stores each series. SPEC 8's one action. */
  runUpdate: () => Promise<UpdateOutcome>
  /** Adds or removes one ticker from `hiddenTickers`, then reloads. */
  setTickerHidden: (ticker: string, hidden: boolean) => Promise<void>
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
