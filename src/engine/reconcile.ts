import Decimal from 'decimal.js'

/** Anything with a ticker and a share count: a `TickerHoldings`, or a typed-in row. */
export interface ShareCount {
  ticker: string
  shares: string
}

export interface ShareMismatch {
  ticker: string
  reconstructed: string
  actual: string
  /** `actual - reconstructed`: positive means the ledger is short of what M1 really holds. */
  difference: string
  reason: 'differs' | 'missing-from-ledger' | 'missing-from-actual'
}

export interface ReconcileOptions {
  /** A ticker whose difference is at or below this is not reported. SPEC section 4: 0.001. */
  tolerance?: string
  /**
   * Whether the supplied counts are a complete snapshot of what M1 holds, in which case a
   * ticker the ledger still holds but the snapshot omits is held at zero and flagged. Turn
   * it off when the user is correcting a few tickers by hand rather than uploading all of
   * them.
   */
  actualIsComplete?: boolean
}

const DEFAULT_TOLERANCE = '0.001'

/**
 * Compares reconstructed share counts against the counts M1 actually reports and returns
 * every ticker that is off by more than the tolerance (SPEC section 4). The fix for each
 * is an `adjust` or manual transaction, which is the import screen's job, not this one's.
 *
 * Both sides are matched case-insensitively on ticker; if the same ticker appears twice on
 * either side its counts are summed, which is what a per-account snapshot of one holding
 * across two accounts looks like.
 */
export function reconcileShares(
  reconstructed: ShareCount[],
  actual: ShareCount[],
  options: ReconcileOptions = {},
): ShareMismatch[] {
  const tolerance = new Decimal(options.tolerance ?? DEFAULT_TOLERANCE)
  const actualIsComplete = options.actualIsComplete ?? true

  const ledger = totalByTicker(reconstructed)
  const held = totalByTicker(actual)

  const mismatches: ShareMismatch[] = []

  for (const ticker of new Set([...ledger.keys(), ...held.keys()])) {
    const inLedger = ledger.get(ticker)
    const inSnapshot = held.get(ticker)

    if (inSnapshot === undefined && !actualIsComplete) continue

    const left = inLedger ?? new Decimal(0)
    const right = inSnapshot ?? new Decimal(0)
    const difference = right.minus(left)
    if (difference.abs().lte(tolerance)) continue

    mismatches.push({
      ticker,
      reconstructed: left.toFixed(),
      actual: right.toFixed(),
      difference: difference.toFixed(),
      reason:
        inLedger === undefined
          ? 'missing-from-ledger'
          : inSnapshot === undefined
            ? 'missing-from-actual'
            : 'differs',
    })
  }

  return mismatches.sort(
    (a, b) =>
      new Decimal(b.difference).abs().comparedTo(new Decimal(a.difference).abs()) ||
      a.ticker.localeCompare(b.ticker),
  )
}

function totalByTicker(counts: ShareCount[]): Map<string, Decimal> {
  const totals = new Map<string, Decimal>()
  for (const { ticker, shares } of counts) {
    const key = ticker.trim().toUpperCase()
    totals.set(key, (totals.get(key) ?? new Decimal(0)).plus(shares))
  }
  return totals
}
