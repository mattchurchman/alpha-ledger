import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import {
  FIRST_DAY,
  PRICES,
  WEEKEND_DAY,
  adjust,
  buy,
  dividend,
  sell,
} from './__fixtures__/synthetic'
import { buyDecisions, type BuyDecision } from './decisions'
import type { Transaction } from './types'

const cents = (value: string) => new Decimal(value).toFixed(2)

function decisionsFor(transactions: Transaction[], ticker = 'ACME'): BuyDecision[] {
  return buyDecisions({ transactions, prices: PRICES }, ticker)
}

describe('buyDecisions', () => {
  it('compares a still-held buy with the same dollars in the benchmark', () => {
    const [decision] = decisionsFor([buy(FIRST_DAY, 'ACME', '10', '1000')])

    expect(decision.sharesRemaining).toBe('10')
    expect(cents(decision.remainingValue)).toBe('3000.00') // 10 x close 300
    expect(cents(decision.proceeds)).toBe('0.00')
    expect(cents(decision.outcomeValue)).toBe('3000.00')
    expect(cents(decision.shadowValue)).toBe('5000.00') // $1,000 x adj 500/100
    expect(cents(decision.valueAdded)).toBe('-2000.00')
    expect(decision.closedOn).toBeNull()
    expect(decision.exits).toEqual([])
  })

  it('measures a sold buy against the benchmark to the sell date, not to today', () => {
    // Both sides stop on 01-08: proceeds $2,000 versus $1,000 x adj 400/100 = $4,000.
    const [decision] = decisionsFor([
      buy(FIRST_DAY, 'ACME', '10', '1000'),
      sell('2025-01-08', 'ACME', '10', '2000'),
    ])

    expect(decision.sharesRemaining).toBe('0')
    expect(cents(decision.remainingValue)).toBe('0.00')
    expect(cents(decision.proceeds)).toBe('2000.00')
    expect(cents(decision.shadowValue)).toBe('4000.00')
    expect(cents(decision.valueAdded)).toBe('-2000.00')
    expect(decision.closedOn).toBe('2025-01-08')
    expect(decision.exits).toHaveLength(1)
    expect(decision.exits[0]).toMatchObject({ kind: 'sell', shares: '10' })
  })

  it('matches a partial sell first-in-first-out across two buys', () => {
    // Buy 10 at $100 on 01-02, buy 5 at $200 on 01-06, sell 12 at $200 on 01-08.
    // FIFO takes all 10 of the first lot and 2 of the second.
    const decisions = decisionsFor([
      buy(FIRST_DAY, 'ACME', '10', '1000'),
      buy('2025-01-06', 'ACME', '5', '1000'),
      sell('2025-01-08', 'ACME', '12', '2400'),
    ])

    const [first, second] = decisions
    expect(decisions).toHaveLength(2)

    // First lot: fully sold. Proceeds 2400 x 10/12 = 2000; benchmark 1000 x 400/100 = 4000.
    expect(first.sharesRemaining).toBe('0')
    expect(cents(first.proceeds)).toBe('2000.00')
    expect(cents(first.shadowValue)).toBe('4000.00')
    expect(cents(first.valueAdded)).toBe('-2000.00')
    expect(first.closedOn).toBe('2025-01-08')

    // Second lot: 2 of 5 sold. Proceeds 2400 x 2/12 = 400 against a $400 cost slice grown
    // 400/200 = 2x, so $800. The 3 shares left are worth 3 x 300 = 900 against a $600 cost
    // slice grown 500/200 = 2.5x, so $1,500.
    expect(second.sharesRemaining).toBe('3')
    expect(cents(second.proceeds)).toBe('400.00')
    expect(cents(second.remainingValue)).toBe('900.00')
    expect(cents(second.outcomeValue)).toBe('1300.00')
    expect(cents(second.shadowValue)).toBe('2300.00')
    expect(cents(second.valueAdded)).toBe('-1000.00')
    expect(second.closedOn).toBeNull()
    expect(second.exits).toHaveLength(1)
    expect(second.exits[0].shares).toBe('2')
  })

  it('splits one buy across the several sells that consume it', () => {
    const [decision] = decisionsFor([
      buy(FIRST_DAY, 'ACME', '10', '1000'),
      sell('2025-01-06', 'ACME', '4', '480'),
      sell('2025-01-08', 'ACME', '6', '1200'),
    ])

    expect(decision.exits.map((exit) => [exit.trade_date, exit.shares])).toEqual([
      ['2025-01-06', '4'],
      ['2025-01-08', '6'],
    ])
    // 480 + 1200 = 1680 against 400 x 200/100 + 600 x 400/100 = 800 + 2400.
    expect(cents(decision.proceeds)).toBe('1680.00')
    expect(cents(decision.shadowValue)).toBe('3200.00')
    expect(decision.closedOn).toBe('2025-01-08')
  })

  it('prices a weekend buy from the next trading day', () => {
    // $400 on the Saturday prices at Monday's adj 200, so it grows 500/200 = 2.5x.
    const [decision] = decisionsFor([buy(WEEKEND_DAY, 'ACME', '2', '400')])
    expect(cents(decision.shadowValue)).toBe('1000.00')
    expect(cents(decision.remainingValue)).toBe('600.00') // 2 x close 300
  })

  it('is zero value added for a pick that tracks the benchmark exactly', () => {
    const [decision] = decisionsFor([buy('2025-01-06', 'BETA', '7', '700')], 'BETA')
    expect(cents(decision.valueAdded)).toBe('0.00')
  })

  it('leaves dividends out, since a decision is shares versus the same dollars', () => {
    const withDividend = decisionsFor([
      buy(FIRST_DAY, 'ACME', '10', '1000'),
      dividend('2025-01-06', 'ACME', '200'),
    ])
    const without = decisionsFor([buy(FIRST_DAY, 'ACME', '10', '1000')])
    expect(withDividend[0].valueAdded).toBe(without[0].valueAdded)
  })

  it('keeps adjust-in shares in the queue without reporting them as a buy', () => {
    // 3 shares arrive by adjust before any buy, so the later sell of 3 consumes them and
    // the buy is untouched. Only the buy is a decision.
    const decisions = decisionsFor([
      adjust(FIRST_DAY, 'ACME', '3'),
      buy('2025-01-06', 'ACME', '5', '600'),
      sell('2025-01-07', 'ACME', '3', '450'),
    ])

    expect(decisions).toHaveLength(1)
    expect(decisions[0].sharesRemaining).toBe('5')
    expect(cents(decisions[0].proceeds)).toBe('0.00')
  })

  it('writes shares removed by an adjust off at zero proceeds', () => {
    const [decision] = decisionsFor([
      buy(FIRST_DAY, 'ACME', '10', '1000'),
      adjust('2025-01-06', 'ACME', '-10'),
    ])

    expect(decision.sharesRemaining).toBe('0')
    expect(decision.exits[0]).toMatchObject({ kind: 'adjust', proceeds: '0' })
    expect(cents(decision.outcomeValue)).toBe('0.00')
    // The benchmark side still ran to the day the shares left: 1000 x 200/100.
    expect(cents(decision.shadowValue)).toBe('2000.00')
  })

  it('returns nothing without benchmark history', () => {
    expect(
      buyDecisions(
        { transactions: [buy(FIRST_DAY, 'ACME', '1', '100')], prices: { ACME: PRICES.ACME } },
        'ACME',
      ),
    ).toEqual([])
  })
})
