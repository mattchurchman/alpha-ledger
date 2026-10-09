import { describe, expect, it } from 'vitest'
import { reconcileShares } from './reconcile'

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
