import { describe, expect, it } from 'vitest'
import {
  DATES,
  FIRST_DAY,
  LAST_DAY,
  PRICES,
  VOO,
  WEEKEND_DAY,
  adjust,
  buy,
  dividend,
  history,
  sell,
} from './__fixtures__/synthetic'
import { splitAdjustTransactions } from './holdings'
import {
  benchmarkGrowth,
  benchmarkPricingDate,
  shadowBucketsOn,
  shadowCoverageWarnings,
  shadowFlows,
  shadowTotalOn,
  shadowUnitsByDay,
} from './shadow'
import type { Transaction } from './types'

function flowsFor(transactions: Transaction[]) {
  return shadowFlows(splitAdjustTransactions(transactions, PRICES), VOO)
}

function bucket(transactions: Transaction[], ticker: string, date = LAST_DAY) {
  return (
    (shadowBucketsOn(flowsFor(transactions), VOO, date).get(ticker) ?? null)?.toFixed(2) ?? null
  )
}

describe('benchmarkPricingDate', () => {
  it('prices a trade on its own day when the market traded', () => {
    expect(benchmarkPricingDate(VOO, '2025-01-06')).toBe('2025-01-06')
  })

  it('prices a weekend trade on the next trading day', () => {
    // 2025-01-04 is a Saturday; the next day in the series is Monday the 6th.
    expect(benchmarkPricingDate(VOO, WEEKEND_DAY)).toBe('2025-01-06')
  })

  it('returns null past the end of the series', () => {
    expect(benchmarkPricingDate(VOO, '2026-06-01')).toBeNull()
  })
})

describe('benchmarkGrowth', () => {
  it('is the ratio of adjusted closes', () => {
    // adj 100 -> 500.
    expect(benchmarkGrowth(VOO, FIRST_DAY, LAST_DAY)?.toFixed(4)).toBe('5.0000')
  })

  it('measures from the next trading day when the start is not one', () => {
    // Saturday the 4th prices on Monday the 6th: adj 200 -> 500 = 2.5, not 5.
    expect(benchmarkGrowth(VOO, WEEKEND_DAY, LAST_DAY)?.toFixed(4)).toBe('2.5000')
  })
})

describe('shadowFlows', () => {
  it('buys the benchmark for a buy and sells it for a sell or a dividend', () => {
    const flows = flowsFor([
      buy(FIRST_DAY, 'ACME', '10', '1000'),
      sell('2025-01-06', 'ACME', '2', '240'),
      dividend('2025-01-07', 'ACME', '15'),
    ])

    expect(flows.map((flow) => flow.amount)).toEqual(['1000', '-240', '-15'])
    expect(flows.map((flow) => flow.pricingDate)).toEqual([
      '2025-01-02',
      '2025-01-06',
      '2025-01-07',
    ])
  })

  it('ignores splits and adjusts, which move no money', () => {
    const splitAware = history(['100', '110', '120', '150', '200', '250', '300'], {
      splits: [{ date: '2025-01-07', numerator: 2, denominator: 1 }],
    })
    const flows = shadowFlows(
      splitAdjustTransactions(
        [buy(FIRST_DAY, 'ACME', '10', '1000'), adjust('2025-01-08', 'ACME', '3')],
        { VOO, ACME: splitAware },
      ),
      VOO,
    )

    expect(flows).toHaveLength(1)
    expect(flows[0].amount).toBe('1000')
  })

  it('prices a non-trading-day trade on the next trading day', () => {
    const flows = flowsFor([buy(WEEKEND_DAY, 'ACME', '2', '400')])
    expect(flows[0].pricingDate).toBe('2025-01-06')
  })

  it('drops nothing but marks a flow past the end of the series unpriceable', () => {
    const flows = flowsFor([buy('2026-03-02', 'ACME', '1', '100')])
    expect(flows[0].pricingDate).toBeNull()
  })

  it('leaves out transactions after the as-of date', () => {
    const transactions = [
      buy(FIRST_DAY, 'ACME', '10', '1000'),
      buy('2025-01-08', 'ACME', '1', '200'),
    ]
    const flows = shadowFlows(splitAdjustTransactions(transactions, PRICES), VOO, '2025-01-07')
    expect(flows).toHaveLength(1)
  })
})

describe('shadowCoverageWarnings', () => {
  it('is empty when the benchmark series covers every flow', () => {
    expect(shadowCoverageWarnings(flowsFor([buy(FIRST_DAY, 'ACME', '10', '1000')]), VOO)).toEqual(
      [],
    )
  })

  it('flags a flow dated before the benchmark series starts', () => {
    const warnings = shadowCoverageWarnings(flowsFor([buy('2024-06-03', 'ACME', '1', '100')]), VOO)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].kind).toBe('before-benchmark-series')
  })

  it('flags a flow dated after the benchmark series ends', () => {
    const warnings = shadowCoverageWarnings(flowsFor([buy('2026-03-02', 'ACME', '1', '100')]), VOO)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].kind).toBe('after-benchmark-series')
  })
})

describe('shadowBucketsOn', () => {
  it('values a single buy by the ratio of adjusted closes', () => {
    // $1000 at adj 100 is 10 units; 10 units at adj 500 is $5,000.
    expect(bucket([buy(FIRST_DAY, 'ACME', '10', '1000')], 'ACME')).toBe('5000.00')
  })

  it('takes the sold dollars back out of the bucket', () => {
    // +1000/100 = 10 units, -1200/200 = -6 units, 4 units left; 4 * 500 = 2,000.
    expect(
      bucket(
        [buy(FIRST_DAY, 'ACME', '10', '1000'), sell('2025-01-06', 'ACME', '10', '1200')],
        'ACME',
      ),
    ).toBe('2000.00')
  })

  it('treats a cash dividend as selling that many dollars of the benchmark', () => {
    // 10 units less 200/200 = 1 unit leaves 9; 9 * 500 = 4,500.
    expect(
      bucket([buy(FIRST_DAY, 'ACME', '10', '1000'), dividend('2025-01-06', 'ACME', '200')], 'ACME'),
    ).toBe('4500.00')
  })

  it('goes negative when the stock returned more cash than the benchmark would be worth', () => {
    // +10 units, then -5000/400 = -12.5 units: the bucket is short 2.5 units.
    expect(
      bucket(
        [buy(FIRST_DAY, 'ACME', '10', '1000'), sell('2025-01-08', 'ACME', '10', '5000')],
        'ACME',
      ),
    ).toBe('-1250.00')
  })

  it('values a weekend buy from the next trading day', () => {
    // $400 priced at Monday's adj 200 is 2 units; 2 * 500 = 1,000.
    expect(bucket([buy(WEEKEND_DAY, 'ACME', '2', '400')], 'ACME')).toBe('1000.00')
  })

  it('counts only flows priced on or before the valuation day', () => {
    const transactions = [
      buy(FIRST_DAY, 'ACME', '10', '1000'),
      buy('2025-01-08', 'ACME', '1', '200'),
    ]
    // On 01-07 only the first buy has happened: 10 units at adj 200.
    expect(bucket(transactions, 'ACME', '2025-01-07')).toBe('2000.00')
    // On 01-08 the second adds 200/400 = 0.5 units: 10.5 at adj 400.
    expect(bucket(transactions, 'ACME', '2025-01-08')).toBe('4200.00')
  })

  it('is empty before the benchmark series starts', () => {
    expect(
      shadowBucketsOn(flowsFor([buy(FIRST_DAY, 'ACME', '10', '1000')]), VOO, '2024-01-01').size,
    ).toBe(0)
  })

  it('keeps one bucket per ticker', () => {
    const buckets = shadowBucketsOn(
      flowsFor([buy(FIRST_DAY, 'ACME', '10', '1000'), buy(FIRST_DAY, 'BETA', '20', '1000')]),
      VOO,
      LAST_DAY,
    )
    expect([...buckets.keys()].sort()).toEqual(['ACME', 'BETA'])
    expect(buckets.get('ACME')!.toFixed(2)).toBe('5000.00')
  })
})

describe('shadowTotalOn', () => {
  it('nets to zero shadow flow when selling one ticker funds another', () => {
    const held = [buy(FIRST_DAY, 'ACME', '10', '1000')]
    const swapped = [
      ...held,
      sell('2025-01-06', 'ACME', '10', '1200'),
      buy('2025-01-06', 'BETA', '12', '1200'),
    ]

    // ACME keeps 4 units and BETA gains 1200/200 = 6: the portfolio still holds 10 units,
    // so the total shadow is identical to never having made the swap.
    expect(shadowTotalOn(flowsFor(swapped), VOO, LAST_DAY).toFixed(2)).toBe('5000.00')
    expect(shadowTotalOn(flowsFor(held), VOO, LAST_DAY).toFixed(2)).toBe('5000.00')
  })
})

describe('shadowUnitsByDay', () => {
  it('accumulates units as their pricing days arrive', () => {
    const flows = flowsFor([
      buy(FIRST_DAY, 'ACME', '10', '1000'),
      buy('2025-01-08', 'ACME', '1', '200'),
    ])
    // 10 units from 01-02; the 01-08 buy adds 200/400 = 0.5.
    expect(shadowUnitsByDay(flows, VOO, DATES).map((units) => units.toFixed(1))).toEqual([
      '10.0',
      '10.0',
      '10.0',
      '10.0',
      '10.5',
      '10.5',
      '10.5',
    ])
  })

  it('restricts to one ticker when asked', () => {
    const flows = flowsFor([
      buy(FIRST_DAY, 'ACME', '10', '1000'),
      buy(FIRST_DAY, 'BETA', '20', '1000'),
    ])
    expect(shadowUnitsByDay(flows, VOO, DATES, 'BETA').at(-1)!.toFixed(1)).toBe('10.0')
    expect(shadowUnitsByDay(flows, VOO, DATES).at(-1)!.toFixed(1)).toBe('20.0')
  })
})
