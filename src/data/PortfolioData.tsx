import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import type { MetaMap, StoredPriceHistory, TickerAlias, TransactionRow } from '../api/types'
import { analyze, DEFAULT_BENCHMARK, type AnalyzeResult } from '../engine'
import type { PriceHistory } from '../engine/prices/types'
import {
  isStale,
  priceFetchFrom,
  runMarketUpdate,
  tickersEverHeld,
  type UpdateOutcome,
} from './marketData'
import { PortfolioDataContext, type PortfolioData, type UpdateState } from './usePortfolioData'

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

  const runUpdate = useCallback(async (): Promise<UpdateOutcome> => {
    if (update.running) return { succeeded: [], failed: [] }

    const tickers = [
      DEFAULT_BENCHMARK,
      ...tickersEverHeld(transactions, aliases).filter((t) => t !== DEFAULT_BENCHMARK),
    ]
    const from = priceFetchFrom(transactions, todayDate())
    setUpdate({ running: true, done: 0, total: tickers.length, failures: [], lastRunAt: null })

    const outcome = await runMarketUpdate({
      tickers,
      fetchPrice: (ticker) => api.prices.fetch(ticker, from),
      storePrice: async (ticker, history) => {
        await api.priceHistory.put(ticker, { source: 'yahoo', history })
      },
      onProgress: (done, total) => setUpdate((prev) => ({ ...prev, done, total })),
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
      lastRunAt: new Date().toISOString(),
    })
    return outcome
  }, [update.running, transactions, aliases, reload])

  const value: PortfolioData = {
    loading,
    error,
    transactions,
    aliases,
    priceHistory,
    prices,
    meta,
    result,
    pricesAsOf,
    update,
    runUpdate,
    reload,
    putPriceHistory,
  }

  return <PortfolioDataContext.Provider value={value}>{children}</PortfolioDataContext.Provider>
}
