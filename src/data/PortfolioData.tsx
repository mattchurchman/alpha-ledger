import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import type { MetaMap, StoredPriceHistory, TickerAlias, TransactionRow } from '../api/types'
import {
  accountLabels,
  analyze,
  analyzeAccount,
  DEFAULT_BENCHMARK,
  isClosedPosition,
  type AnalyzeResult,
} from '../engine'
import type { PriceHistory } from '../engine/prices/types'
import {
  HIDDEN_TICKERS_KEY,
  parseHiddenTickers,
  serializeHiddenTickers,
  withHidden,
} from './hiddenTickers'
import {
  isStale,
  priceFetchFrom,
  runMarketUpdate,
  tickersEverHeld,
  type UpdateOutcome,
} from './marketData'
import {
  PortfolioDataContext,
  type AccountSummary,
  type PortfolioData,
  type UpdateState,
} from './usePortfolioData'

/**
 * The data hook task 09 asks for: loads transactions, prices and aliases once, runs `analyze`,
 * and caches the result in memory so every screen (this task's Settings, and later tasks'
 * Dashboard/StockDetail/FairValues) reads the same numbers instead of each re-fetching and
 * re-computing on its own. Nothing here fetches automatically after the first load - the
 * acceptance check is zero price requests on navigation, only on `runUpdate`.
 */

const IDLE_UPDATE: UpdateState = {
  running: false,
  done: 0,
  total: 0,
  failures: [],
  tolerated: [],
  lastRunAt: null,
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function PortfolioDataProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [aliases, setAliases] = useState<TickerAlias[]>([])
  const [priceHistory, setPriceHistory] = useState<StoredPriceHistory[]>([])
  const [meta, setMeta] = useState<MetaMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [update, setUpdate] = useState<UpdateState>(IDLE_UPDATE)

  const loadAll = useCallback(async () => {
    const [txns, history, als, m] = await Promise.all([
      api.transactions.list(),
      api.priceHistory.list(),
      api.aliases.list(),
      api.meta.get(),
    ])
    setTransactions(txns)
    setPriceHistory(history)
    setAliases(als)
    setMeta(m)
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.transactions.list(),
      api.priceHistory.list(),
      api.aliases.list(),
      api.meta.get(),
    ]).then(
      ([txns, history, als, m]) => {
        if (cancelled) return
        setTransactions(txns)
        setPriceHistory(history)
        setAliases(als)
        setMeta(m)
        setLoading(false)
      },
      (err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const reload = useCallback(async () => {
    try {
      await loadAll()
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [loadAll])

  const prices = useMemo<Record<string, PriceHistory>>(() => {
    const map: Record<string, PriceHistory> = {}
    for (const row of priceHistory) map[row.ticker] = row.history
    return map
  }, [priceHistory])

  const result = useMemo<AnalyzeResult | null>(() => {
    if (!prices[DEFAULT_BENCHMARK]) return null
    try {
      return analyze({ transactions, prices, aliases })
    } catch {
      return null
    }
  }, [transactions, prices, aliases])

  const accounts = useMemo(() => accountLabels(transactions), [transactions])

  /**
   * The per-account cache (task 19). The engine's own inputs are held alongside the `Map` so
   * that a new ledger or a new price set replaces the whole object - an account view can never
   * be served from a set of transactions it was not computed from.
   */
  const accountViews = useMemo(
    () => ({ transactions, prices, aliases, cache: new Map<string, AnalyzeResult | null>() }),
    [transactions, prices, aliases],
  )

  const resultFor = useCallback(
    (account: string | null): AnalyzeResult | null => {
      if (account === null) return result
      if (!result) return null

      const cached = accountViews.cache.get(account)
      if (cached !== undefined) return cached

      let next: AnalyzeResult | null
      try {
        next = analyzeAccount({
          transactions: accountViews.transactions,
          prices: accountViews.prices,
          aliases: accountViews.aliases,
          asOf: result.asOf,
          account,
        })
      } catch {
        next = null
      }
      accountViews.cache.set(account, next)
      return next
    },
    [result, accountViews],
  )

  /**
   * The strip's rows, built without the daily series: it needs four numbers per account, and
   * the series is most of what `analyze` costs. The one account the user then switches to is
   * analyzed again by `resultFor`, with its series - a second pass over one account's rows,
   * which is cheaper than building a series per account for a strip that shows none.
   */
  const accountSummaries = useMemo<AccountSummary[]>(() => {
    if (!result || accounts.length < 2) return []
    try {
      return accounts.map((account) => {
        const { portfolio } = analyzeAccount({
          transactions,
          prices,
          aliases,
          asOf: result.asOf,
          account,
          includeSeries: false,
        })
        return {
          account,
          currentValue: portfolio.currentValue,
          shadowValue: portfolio.shadowValue,
          valueAdded: portfolio.valueAdded,
          percentDifference: portfolio.percentDifference,
        }
      })
    } catch {
      return []
    }
  }, [result, accounts, transactions, prices, aliases])

  const hiddenTickers = useMemo(() => parseHiddenTickers(meta[HIDDEN_TICKERS_KEY]), [meta])

  const setTickerHidden = useCallback(
    async (ticker: string, hidden: boolean) => {
      const next = withHidden(hiddenTickers, ticker, hidden)
      await api.meta.put(HIDDEN_TICKERS_KEY, serializeHiddenTickers(next))
      await reload()
    },
    [hiddenTickers, reload],
  )

  const pricesAsOf = useMemo(() => {
    const date = prices[DEFAULT_BENCHMARK]?.asOf ?? null
    return {
      date,
      updatedAt: meta.prices_last_updated ?? null,
      stale: isStale(date, todayDate()),
    }
  }, [prices, meta])

  const putPriceHistory = useCallback(
    async (ticker: string, history: PriceHistory) => {
      await api.priceHistory.put(ticker, { source: 'manual', history })
      await reload()
    },
    [reload],
  )

  /**
   * A closed position whose history is already stored: Yahoo cannot serve a symbol that
   * stopped trading, and there is nothing left to learn about it, so task 18 keeps its
   * failure out of the list of things worth fixing. It is still fetched - a symbol that
   * comes back is stored like any other.
   */
  const toleratedTickers = useMemo(() => {
    const closed = (result?.byTicker ?? []).filter(isClosedPosition).map((t) => t.ticker)
    return new Set(closed.filter((ticker) => prices[ticker] !== undefined))
  }, [result, prices])

  const runUpdate = useCallback(async (): Promise<UpdateOutcome> => {
    if (update.running) return { succeeded: [], failed: [], tolerated: [] }

    const tickers = [
      DEFAULT_BENCHMARK,
      ...tickersEverHeld(transactions, aliases).filter((t) => t !== DEFAULT_BENCHMARK),
    ]
    const from = priceFetchFrom(transactions, todayDate())
    setUpdate({
      running: true,
      done: 0,
      total: tickers.length,
      failures: [],
      tolerated: [],
      lastRunAt: null,
    })

    const outcome = await runMarketUpdate({
      tickers,
      fetchPrice: (ticker) => api.prices.fetch(ticker, from),
      storePrice: async (ticker, history) => {
        await api.priceHistory.put(ticker, { source: 'yahoo', history })
      },
      onProgress: (done, total) => setUpdate((prev) => ({ ...prev, done, total })),
      tolerateFailure: (ticker) => toleratedTickers.has(ticker),
    })

    if (outcome.succeeded.length > 0) {
      await api.meta.put('prices_last_updated', new Date().toISOString())
    }
    await reload()
    setUpdate({
      running: false,
      done: tickers.length,
      total: tickers.length,
      failures: outcome.failed,
      tolerated: outcome.tolerated,
      lastRunAt: new Date().toISOString(),
    })
    return outcome
  }, [update.running, transactions, aliases, reload, toleratedTickers])

  const value: PortfolioData = {
    loading,
    error,
    transactions,
    aliases,
    priceHistory,
    prices,
    meta,
    hiddenTickers,
    result,
    accounts,
    accountSummaries,
    resultFor,
    pricesAsOf,
    update,
    runUpdate,
    setTickerHidden,
    reload,
    putPriceHistory,
  }

  return <PortfolioDataContext.Provider value={value}>{children}</PortfolioDataContext.Provider>
}
