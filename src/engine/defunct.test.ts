import { describe, expect, it } from 'vitest'
import {
  calendarDaysBetween,
  closeOutPlan,
  closedTickers,
  delistedCandidates,
  exchangePlan,
  isClosedPosition,
  type CloseOutInput,
  type CloseOutSell,
  type ExchangeInput,
} from './defunct'
import { analyze } from './index'
import { buy, DATES, history, LAST_DAY, PRICES, row, VOO } from './__fixtures__/synthetic'
import type { Transaction } from './types'

/**
 * Task 18's acceptance check, on the synthetic fixtures only (CLAUDE.md: nothing real in a
 * test). BETA is the instrument that makes the money assertions exact - it is worth precisely
 * half the benchmark on every single day, so a buyout **at the market price** has to come out
 * at zero value added, and a buyout above it has to come out at exactly the premium, carried
 * forward by the benchmark from the buyout date to the valuation date.
 */

/** The close-out sell as a transaction the ledger can hold, the way the sheet writes it. */
function sellFrom(plan: CloseOutSell): Transaction {
  return row('taxable', plan.trade_date, plan.ticker, 'sell', plan.shares, plan.amount_usd)
}

function plan(transactions: Transaction[], rest: Omit<CloseOutInput, 'transactions'>) {
  const result = closeOutPlan({ ...rest, transactions })
  if (!result.ok) throw new Error(`expected a plan, got: ${result.reason}`)
  return result.sell
}

describe('isClosedPosition', () => {
  it('is true only at exactly zero shares', () => {
    expect(isClosedPosition({ shares: '0' })).toBe(true)
    expect(isClosedPosition({ shares: '0.000000' })).toBe(true)
    expect(isClosedPosition({ shares: '0.0000001' })).toBe(false)
    expect(isClosedPosition({ shares: '12' })).toBe(false)
  })

  it('lists the closed tickers out of a mixed set', () => {
    expect(
      closedTickers([
        { ticker: 'ACME', shares: '10' },
        { ticker: 'BETA', shares: '0' },
        { ticker: 'GAMMA', shares: '0' },
      ]),
    ).toEqual(['BETA', 'GAMMA'])
  })
})

describe('closeOutPlan', () => {
  const bought = [buy(DATES[0], 'BETA', '10', '500')]

  it('sells every share held on the date, for a total as typed', () => {
    const sell = plan(bought, {
      prices: PRICES,
      ticker: 'BETA',
      date: DATES[4],
      cash: '2000',
      cashBasis: 'total',
    })

    expect(sell).toMatchObject({
      ticker: 'BETA',
      trade_date: DATES[4],
      shares: '10',
      amount_usd: '2000',
      sharesHeldToday: '10',
      perShare: '200',
    })
  })

  it('multiplies a per-share figure by the shares held that day', () => {
    const sell = plan(bought, {
      prices: PRICES,
      ticker: 'BETA',
      date: DATES[4],
      cash: '250',
      cashBasis: 'perShare',
    })

    expect(sell.amount_usd).toBe('2500')
    expect(sell.perShare).toBe('250')
  })

  it('rounds a derived total to the cent', () => {
    const sell = plan([buy(DATES[0], 'BETA', '3', '150')], {
      prices: PRICES,
      ticker: 'BETA',
      date: DATES[4],
      cash: '10.005',
      cashBasis: 'perShare',
    })

    // 3 * 10.005 = 30.015, which is not a sum of cents that could ever have been paid.
    expect(sell.amount_usd).toBe('30.02')
  })

  it("writes the share count in the trade date's own terms when a split came later", () => {
    const splitTicker = {
      ...PRICES,
      GAMMA: history(['100', '110', '60', '75', '100', '125', '150'], {
        splits: [{ date: DATES[3], numerator: 2, denominator: 1 }],
      }),
    }
    const sell = plan([buy(DATES[0], 'GAMMA', '10', '1000')], {
      prices: splitTicker,
      ticker: 'GAMMA',
      date: DATES[2],
      cash: '600',
      cashBasis: 'total',
    })

    // 10 shares bought became 20 in today's terms, but only 10 existed on DATES[2].
    expect(sell.sharesHeldToday).toBe('20')
    expect(sell.shares).toBe('10')

    const closed = analyze({
      transactions: [buy(DATES[0], 'GAMMA', '10', '1000'), sellFrom(sell)],
      prices: splitTicker,
    }).byTicker.find((t) => t.ticker === 'GAMMA')
    expect(closed?.shares).toBe('0')
  })

  it('refuses a date with nothing held, a bad date, and a non-positive amount', () => {
    const base = {
      transactions: bought,
      prices: PRICES,
      ticker: 'BETA' as const,
      cash: '100',
      cashBasis: 'total' as const,
    }
    expect(closeOutPlan({ ...base, date: '2024-12-31' })).toMatchObject({ ok: false })
    expect(closeOutPlan({ ...base, date: 'soon' })).toMatchObject({ ok: false })
    expect(closeOutPlan({ ...base, date: DATES[4], cash: '0' })).toMatchObject({ ok: false })
    expect(closeOutPlan({ ...base, date: DATES[4], cash: '-5' })).toMatchObject({ ok: false })
    expect(closeOutPlan({ ...base, date: DATES[4], cash: 'lots' })).toMatchObject({ ok: false })
  })

  describe('once the sell is in the ledger', () => {
    /** BETA at DATES[4] closes at 200, so 10 shares at the market is $2,000. */
    function closedOut(cash: string) {
      const sell = plan(bought, {
        prices: PRICES,
        ticker: 'BETA',
        date: DATES[4],
        cash,
        cashBasis: 'total',
      })
      const result = analyze({ transactions: [...bought, sellFrom(sell)], prices: PRICES })
      const beta = result.byTicker.find((t) => t.ticker === 'BETA')
      if (!beta) throw new Error('BETA missing from the analysis')
      return beta
    }

    it('leaves zero shares, a closed position, and the cash as what was returned', () => {
      const beta = closedOut('2000')

      expect(beta.shares).toBe('0')
      expect(isClosedPosition(beta)).toBe(true)
      expect(beta.currentValue).toBe('0')
      expect(beta.returned).toBe('2000')
      expect(beta.realizedGain).toBe('1500')
      expect(beta.totalGain).toBe('1500')
      expect(beta.costBasis).toBe('0')
      expect(beta.averageCost).toBeNull()
    })

    it('values it at the market price as exactly matching VOO', () => {
      // BETA is half the benchmark every day, so buying it and being bought out at its own
      // close can only ever tie with putting the same dollars in VOO on the same dates.
      expect(closedOut('2000').valueAdded).toBe('0')
      expect(closedOut('2000').shadowValue).toBe('0')
    })

    it('carries a premium over the market price through to value added', () => {
      // $2,500 for a position the market priced at $2,000 is $500 extra on DATES[4]. The
      // benchmark's adjusted close goes 400 -> 500 from there to the valuation date, so the
      // extra cash left the VOO bucket $625 short of zero - and value added is 0 - (-625).
      const beta = closedOut('2500')

      expect(beta.returned).toBe('2500')
      expect(beta.shadowValue).toBe('-625')
      expect(beta.valueAdded).toBe('625')
    })

    it('reads a shortfall against the market the same way, with the sign flipped', () => {
      const beta = closedOut('1500')

      expect(beta.shadowValue).toBe('625')
      expect(beta.valueAdded).toBe('-625')
    })
  })
})

describe('exchangePlan', () => {
  const asOf = LAST_DAY

  function planFor(
    transactions: Transaction[],
    rest: Omit<ExchangeInput, 'transactions' | 'asOf'> & { asOf?: string },
  ) {
    const outcome = exchangePlan({ asOf, ...rest, transactions })
    if (!outcome.ok) throw new Error(`expected a plan, got: ${outcome.reason}`)
    return outcome.plan
  }

  const bought = [buy(DATES[0], 'BETA', '100', '5000')]
  const base = { prices: PRICES, from: 'BETA', to: 'GAMMA', effectiveDate: DATES[4] }

  it('writes nothing for a straight 1:1 rename', () => {
    const plan = planFor(bought, { ...base, ratio: '1' })

    expect(plan.alias).toEqual({
      from_ticker: 'BETA',
      to_ticker: 'GAMMA',
      effective_date: DATES[4],
    })
    expect(plan.sharesHeld).toBe('100')
    expect(plan.targetShares).toBe('100')
    expect(plan.sharesFromAliasAlone).toBe('100')
    expect(plan.adjust).toBeNull()
  })

  it('removes shares when one old share became less than one new one', () => {
    const plan = planFor(bought, { ...base, ratio: '0.5' })

    expect(plan.targetShares).toBe('50')
    expect(plan.adjust).toEqual({ ticker: 'GAMMA', trade_date: DATES[4], shares: '-50' })
  })

  it('adds shares when one old share became more than one', () => {
    expect(planFor(bought, { ...base, ratio: '2.5' }).adjust).toEqual({
      ticker: 'GAMMA',
      trade_date: DATES[4],
      shares: '150',
    })
  })

  /**
   * The case that makes the pre-alias share count the wrong thing to compute from. A row is
   * restated by the splits of whatever ticker it resolves under, so moving BETA's history to
   * a symbol with no stored splits drops BETA's own split - and a delta worked out from the
   * figure on screen would bake that difference in as a permanent error.
   */
  it('measures what the moved rows actually become, not what the old ticker showed', () => {
    const split = {
      ...PRICES,
      BETA: history(['50', '50', '100', '100', '200', '200', '250'], {
        splits: [{ date: DATES[2], numerator: 2, denominator: 1 }],
      }),
    }
    const txns = [buy(DATES[0], 'BETA', '100', '5000')]

    // On screen BETA reads 200 shares: 100 bought, doubled by its own split.
    const plan = planFor(txns, { ...base, prices: split, ratio: '0.5' })
    expect(plan.sharesHeld).toBe('200')
    expect(plan.targetShares).toBe('100')
    // Under GAMMA, which has no split events, the same buy is only 100 again...
    expect(plan.sharesFromAliasAlone).toBe('100')
    // ...so the naive 200 * (0.5 - 1) = -100 would have left nothing at all.
    expect(plan.adjust).toBeNull()

    const after = analyze({
      transactions: txns,
      prices: split,
      aliases: [plan.alias],
    }).byTicker.find((t) => t.ticker === 'GAMMA')
    expect(after?.shares).toBe('100')
  })

  it('leaves the new ticker-s own existing position alone', () => {
    const txns = [buy(DATES[0], 'BETA', '100', '5000'), buy(DATES[0], 'ACME', '10', '1000')]
    const plan = planFor(txns, { ...base, to: 'ACME', ratio: '0.5' })

    // 100 BETA become 50 ACME; the 10 ACME already held are not part of the exchange.
    expect(plan.sharesFromAliasAlone).toBe('100')
    expect(plan.adjust).toEqual({ ticker: 'ACME', trade_date: DATES[4], shares: '-50' })

    const after = analyze({
      transactions: [...txns, row('taxable', DATES[4], 'ACME', 'adjust', '-50', '0')],
      prices: PRICES,
      aliases: [plan.alias],
    }).byTicker.find((t) => t.ticker === 'ACME')
    expect(after?.shares).toBe('60')
  })

  it('refuses an empty, identical or unusable input', () => {
    const outcome = (rest: Partial<ExchangeInput>) =>
      exchangePlan({ transactions: bought, asOf, ...base, ratio: '1', ...rest })

    expect(outcome({ to: '' })).toMatchObject({ ok: false })
    expect(outcome({ to: 'BETA' })).toMatchObject({ ok: false })
    expect(outcome({ effectiveDate: 'soon' })).toMatchObject({ ok: false })
    expect(outcome({ ratio: '0' })).toMatchObject({ ok: false })
    expect(outcome({ ratio: '-1' })).toMatchObject({ ok: false })
    expect(outcome({ from: 'NOTHELD' })).toMatchObject({ ok: false })
  })
})

describe('calendarDaysBetween', () => {
  it('counts calendar days, across a month and a year boundary', () => {
    expect(calendarDaysBetween('2026-01-02', '2026-01-02')).toBe(0)
    expect(calendarDaysBetween('2026-01-31', '2026-02-01')).toBe(1)
    expect(calendarDaysBetween('2025-12-25', '2026-01-24')).toBe(30)
    expect(calendarDaysBetween('2026-02-01', '2026-01-31')).toBe(-1)
  })
})

describe('delistedCandidates', () => {
  const asOf = '2026-01-02'

  it('flags a held ticker with no stored price at all', () => {
    expect(
      delistedCandidates({
        byTicker: [{ ticker: 'ACME', shares: '10', latestCloseDate: null }],
        missingPrices: ['ACME'],
        asOf,
      }),
    ).toEqual([{ ticker: 'ACME', reason: 'no-price', lastCloseDate: null, daysBehind: null }])
  })

  it('flags a held ticker whose last close stopped more than 30 days back', () => {
    expect(
      delistedCandidates({
        byTicker: [{ ticker: 'BETA', shares: '4', latestCloseDate: '2025-11-14' }],
        missingPrices: [],
        asOf,
      }),
    ).toEqual([
      { ticker: 'BETA', reason: 'stale-price', lastCloseDate: '2025-11-14', daysBehind: 49 },
    ])
  })

  it('leaves alone a current price, a closed position, and exactly 30 days', () => {
    expect(
      delistedCandidates({
        byTicker: [
          { ticker: 'ACME', shares: '10', latestCloseDate: '2026-01-02' },
          { ticker: 'BETA', shares: '0', latestCloseDate: '2024-03-01' },
          { ticker: 'DELTA', shares: '1', latestCloseDate: '2025-12-03' },
        ],
        missingPrices: [],
        asOf,
      }),
    ).toEqual([])
  })

  it('still flags a closed-looking price gap on a position held with no price, once only', () => {
    const flagged = delistedCandidates({
      byTicker: [{ ticker: 'ACME', shares: '10', latestCloseDate: '2025-01-02' }],
      missingPrices: ['ACME'],
      asOf,
    })

    expect(flagged).toHaveLength(1)
    expect(flagged[0]).toMatchObject({ reason: 'no-price', daysBehind: 365 })
  })

  it('reports nothing stale when the benchmark itself has stopped', () => {
    // The valuation date is the newest close across every stored ticker, so one manual spot
    // price on a symbol nobody holds can drag it months past the real series. Then every
    // holding lags it, and none of them is delisted - the prices just need updating.
    const input = {
      byTicker: [
        { ticker: 'ACME', shares: '10', latestCloseDate: '2025-06-13' },
        { ticker: 'BETA', shares: '4', latestCloseDate: '2025-06-13' },
      ],
      missingPrices: [],
      asOf,
    }

    expect(delistedCandidates(input).map((c) => c.ticker)).toEqual(['ACME', 'BETA'])
    expect(delistedCandidates({ ...input, benchmarkCloseDate: '2025-06-13' })).toEqual([])
    // A current benchmark is what makes a lagging ticker mean something.
    expect(delistedCandidates({ ...input, benchmarkCloseDate: asOf }).map((c) => c.ticker)).toEqual(
      ['ACME', 'BETA'],
    )
  })

  it('still reports a missing price when the benchmark has stopped', () => {
    expect(
      delistedCandidates({
        byTicker: [{ ticker: 'ACME', shares: '10', latestCloseDate: null }],
        missingPrices: ['ACME'],
        asOf,
        benchmarkCloseDate: '2024-01-01',
      }),
    ).toMatchObject([{ ticker: 'ACME', reason: 'no-price' }])
  })

  it('takes the threshold from the caller and sorts by ticker', () => {
    const flagged = delistedCandidates(
      {
        byTicker: [
          { ticker: 'ZETA', shares: '1', latestCloseDate: '2025-12-20' },
          { ticker: 'ACME', shares: '1', latestCloseDate: '2025-12-20' },
        ],
        missingPrices: [],
        asOf,
      },
      { staleDays: 5 },
    )

    expect(flagged.map((c) => c.ticker)).toEqual(['ACME', 'ZETA'])
  })

  it('reads an unexceptional analysis as having nothing to prompt about', () => {
    const result = analyze({
      transactions: [buy(DATES[0], 'ACME', '10', '1000'), buy(DATES[1], 'BETA', '4', '200')],
      prices: PRICES,
    })

    expect(result.asOf).toBe(LAST_DAY)
    expect(VOO.asOf).toBe(LAST_DAY)
    expect(delistedCandidates(result)).toEqual([])
  })
})
