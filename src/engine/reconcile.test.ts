import { describe, expect, it } from 'vitest'
import { reconcileShares, type ShareCount } from './reconcile'
import { sharesOn, splitAdjustTransactions } from './holdings'
import { buy, history, LAST_DAY } from './__fixtures__/synthetic'
import type { TickerAlias } from './types'
import type { PriceHistory } from './prices/types'

describe('reconcileShares', () => {
  it('says nothing when the two sides agree', () => {
    const mismatches = reconcileShares(
      [
        { ticker: 'ACME', shares: '4' },
        { ticker: 'BETA', shares: '10.5' },
      ],
      [
        { ticker: 'ACME', shares: '4' },
        { ticker: 'BETA', shares: '10.5' },
      ],
    )

    expect(mismatches).toEqual([])
  })

  it('ignores a difference at or inside the 0.001 tolerance', () => {
    // M1 shows share counts rounded for display, so a crumb this size is the rounding,
    // not a missing transaction.
    const mismatches = reconcileShares(
      [{ ticker: 'ACME', shares: '4.0005' }],
      [{ ticker: 'ACME', shares: '4' }],
    )

    expect(mismatches).toEqual([])
  })

  it('flags a difference just past the tolerance', () => {
    // 4.002 - 4 = 0.002, which is more than 0.001.
    const [found] = reconcileShares(
      [{ ticker: 'ACME', shares: '4' }],
      [{ ticker: 'ACME', shares: '4.002' }],
    )

    expect(found).toEqual({
      ticker: 'ACME',
      reconstructed: '4',
      actual: '4.002',
      difference: '0.002',
      reason: 'differs',
    })
  })

  it('signs the difference so it reads as what the ledger is missing', () => {
    // M1 holds 2 shares more than the ledger reconstructed: the fix is an adjust of +2.
    const [found] = reconcileShares(
      [{ ticker: 'ACME', shares: '8' }],
      [{ ticker: 'ACME', shares: '10' }],
    )

    expect(found.difference).toBe('2')

    // And the other way round, when the ledger thinks it holds more than M1 does.
    const [other] = reconcileShares(
      [{ ticker: 'ACME', shares: '10' }],
      [{ ticker: 'ACME', shares: '8' }],
    )

    expect(other.difference).toBe('-2')
  })

  it('flags a ticker M1 holds that the ledger never saw', () => {
    const [found] = reconcileShares([], [{ ticker: 'NEWX', shares: '3' }])

    expect(found).toMatchObject({ reason: 'missing-from-ledger', reconstructed: '0', actual: '3' })
  })

  it('treats the supplied counts as a complete snapshot by default', () => {
    // A full upload that omits ACME means ACME is no longer held, which is a mismatch.
    const [found] = reconcileShares(
      [{ ticker: 'ACME', shares: '4' }],
      [{ ticker: 'BETA', shares: '1' }],
    )

    expect(found).toMatchObject({ ticker: 'ACME', reason: 'missing-from-actual', actual: '0' })
  })

  it('leaves untouched tickers alone when only a few counts were typed in', () => {
    const mismatches = reconcileShares(
      [
        { ticker: 'ACME', shares: '4' },
        { ticker: 'BETA', shares: '1' },
      ],
      [{ ticker: 'BETA', shares: '1' }],
      { actualIsComplete: false },
    )

    expect(mismatches).toEqual([])
  })

  it('sums a ticker listed once per account on either side', () => {
    const mismatches = reconcileShares(
      [{ ticker: 'ACME', shares: '5' }],
      [
        { ticker: 'acme', shares: '2' },
        { ticker: 'ACME', shares: '3' },
      ],
    )

    expect(mismatches).toEqual([])
  })

  it('puts the biggest discrepancy first', () => {
    const mismatches = reconcileShares(
      [
        { ticker: 'ACME', shares: '10' },
        { ticker: 'BETA', shares: '10' },
        { ticker: 'GAMM', shares: '10' },
      ],
      [
        { ticker: 'ACME', shares: '11' },
        { ticker: 'BETA', shares: '2' },
        { ticker: 'GAMM', shares: '14' },
      ],
    )

    expect(mismatches.map((found) => found.ticker)).toEqual(['BETA', 'GAMM', 'ACME'])
  })

  it('honors a caller-supplied tolerance', () => {
    const mismatches = reconcileShares(
      [{ ticker: 'ACME', shares: '4' }],
      [{ ticker: 'ACME', shares: '4.5' }],
      { tolerance: '1' },
    )

    expect(mismatches).toEqual([])
  })
})

/**
 * The Reconcile screen does not call `reconcileShares` on raw rows: it reconstructs today's
 * share count first (`splitAdjustTransactions` then `sharesOn`) and reconciles that. Both
 * halves are tested on their own elsewhere; what these cover is the composition, because
 * task 08 shipped it passing `{}` for prices and nothing for aliases, which makes every
 * split and every rename read as a share mismatch against counts that are actually right.
 */
describe('reconciling a reconstructed share count', () => {
  const SPLIT_DAY = '2025-01-06'
  const RENAME_DAY = '2025-01-07'

  function reconstruct(
    transactions: Parameters<typeof splitAdjustTransactions>[0],
    prices: Record<string, PriceHistory>,
    aliases: TickerAlias[] = [],
  ): ShareCount[] {
    const held = sharesOn(splitAdjustTransactions(transactions, prices, aliases), LAST_DAY)
    return [...held].map(([ticker, qty]) => ({ ticker, shares: qty.toFixed() }))
  }

  const splitPrices = {
    ACME: history(['100', '110', '60', '75', '100', '125', '150'], {
      splits: [{ date: SPLIT_DAY, numerator: 2, denominator: 1 }],
    }),
  }

  it('agrees with the broker across a split', () => {
    // Four shares bought before a 2-for-1 are eight shares today, which is what M1 reports.
    const transactions = [buy('2025-01-02', 'ACME', '4', '400')]

    expect(
      reconcileShares(reconstruct(transactions, splitPrices), [{ ticker: 'ACME', shares: '8' }]),
    ).toEqual([])
  })

  it('reports a split as a mismatch when the price history is withheld', () => {
    // The regression this guards: with no splits in hand the ledger reconstructs 4 shares
    // against M1's 8 and asks the user to "fix" a count that was never wrong.
    const transactions = [buy('2025-01-02', 'ACME', '4', '400')]
    const [found] = reconcileShares(reconstruct(transactions, {}), [
      { ticker: 'ACME', shares: '8' },
    ])

    expect(found).toMatchObject({ ticker: 'ACME', reconstructed: '4', difference: '4' })
  })

  it('agrees with the broker across a rename', () => {
    const transactions = [buy('2025-01-02', 'OLDX', '4', '400')]
    const aliases: TickerAlias[] = [
      { from_ticker: 'OLDX', to_ticker: 'NEWX', effective_date: RENAME_DAY },
    ]

    expect(
      reconcileShares(reconstruct(transactions, {}, aliases), [{ ticker: 'NEWX', shares: '4' }]),
    ).toEqual([])
  })

  it('reports a rename as two mismatches when the aliases are withheld', () => {
    const transactions = [buy('2025-01-02', 'OLDX', '4', '400')]
    const mismatches = reconcileShares(reconstruct(transactions, {}), [
      { ticker: 'NEWX', shares: '4' },
    ])

    expect(mismatches.map((m) => [m.ticker, m.reason])).toEqual([
      ['NEWX', 'missing-from-ledger'],
      ['OLDX', 'missing-from-actual'],
    ])
  })
})
