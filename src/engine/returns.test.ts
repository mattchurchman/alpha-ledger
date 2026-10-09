import { describe, expect, it } from 'vitest'
import { FIRST_DAY, LAST_DAY, PRICES, buy, dividend, sell } from './__fixtures__/synthetic'
import { splitAdjustTransactions } from './holdings'
import {
  annualizedIrr,
  cashFlows,
  irrWithFinalValue,
  percentDifference,
  shadowIrr,
  valueAdded,
  type IrrFlow,
} from './returns'

const flow = (date: string, amount: string): IrrFlow => ({ date, amount })

describe('cashFlows', () => {
  it('signs a buy as money out and a sell or dividend as money in', () => {
    const adjusted = splitAdjustTransactions(
      [
        buy(FIRST_DAY, 'ACME', '10', '1000'),
        sell('2025-01-06', 'ACME', '2', '240'),
        dividend('2025-01-07', 'ACME', '15'),
      ],
      PRICES,
    )

    expect(cashFlows(adjusted, LAST_DAY)).toEqual([
      flow('2025-01-02', '-1000'),
      flow('2025-01-06', '240'),
      flow('2025-01-07', '15'),
    ])
  })

  it('can be narrowed to one ticker and cut off at the as-of date', () => {
    const adjusted = splitAdjustTransactions(
      [
        buy(FIRST_DAY, 'ACME', '10', '1000'),
        buy(FIRST_DAY, 'BETA', '20', '1000'),
        buy('2025-01-08', 'ACME', '1', '200'),
      ],
      PRICES,
    )

    expect(cashFlows(adjusted, '2025-01-07', 'ACME')).toEqual([flow('2025-01-02', '-1000')])
  })
})

describe('annualizedIrr', () => {
  it('solves a one-year 10% gain exactly', () => {
    // 2025 is not a leap year: 2025-01-02 to 2026-01-02 is 365 days, so t = 1.
    expect(annualizedIrr([flow('2025-01-02', '-1000'), flow('2026-01-02', '1100')])).toBe(
      '0.100000',
    )
  })

  it('annualizes over more than one year', () => {
    // 730 days = 2 years; 1.1^2 = 1.21, so the annual rate is still 10%.
    expect(annualizedIrr([flow('2025-01-02', '-1000'), flow('2027-01-02', '1210')])).toBe(
      '0.100000',
    )
  })

  it('solves a loss', () => {
    expect(annualizedIrr([flow('2025-01-02', '-1000'), flow('2026-01-02', '500')])).toBe(
      '-0.500000',
    )
  })

  it('handles an interim contribution', () => {
    // -1000 at t=0, -1000 at t=1, +2310 at t=2 is 10%: 1000*1.1^2 + 1000*1.1 = 1210 + 1100.
    expect(
      annualizedIrr([
        flow('2025-01-02', '-1000'),
        flow('2026-01-02', '-1000'),
        flow('2027-01-02', '2310'),
      ]),
    ).toBe('0.100000')
  })

  it('shows a dash when money only ever went one way', () => {
    expect(annualizedIrr([flow('2025-01-02', '-1000'), flow('2026-01-02', '-500')])).toBeNull()
    expect(annualizedIrr([flow('2025-01-02', '1000'), flow('2026-01-02', '500')])).toBeNull()
  })

  it('shows a dash with fewer than two flows', () => {
    expect(annualizedIrr([])).toBeNull()
    expect(annualizedIrr([flow('2025-01-02', '-1000')])).toBeNull()
    // A zero flow is not a flow.
    expect(annualizedIrr([flow('2025-01-02', '-1000'), flow('2026-01-02', '0')])).toBeNull()
  })

  it('shows a dash when every flow lands on one day: there is nothing to annualize over', () => {
    expect(annualizedIrr([flow('2025-01-02', '-1000'), flow('2025-01-02', '1100')])).toBeNull()
  })

  it('shows a dash rather than guessing when the rate is beyond the search bracket', () => {
    // A 300% gain in six days annualizes past 1e9; the engine refuses to invent a number.
    expect(annualizedIrr([flow('2025-01-02', '-1000'), flow('2025-01-08', '4000')])).toBeNull()
  })

  it('ignores an unparseable date rather than throwing', () => {
    expect(annualizedIrr([flow('not-a-date', '-1000'), flow('2026-01-02', '1100')])).toBeNull()
  })
})

describe('irrWithFinalValue', () => {
  it('appends the closing value as the final flow', () => {
    expect(irrWithFinalValue([flow('2025-01-02', '-1000')], '1100', '2026-01-02')).toBe('0.100000')
  })

  it('does not append a zero closing value, so a closed position still solves', () => {
    const flows = [flow('2025-01-02', '-1000'), flow('2026-01-02', '1100')]
    expect(irrWithFinalValue(flows, '0', '2026-01-02')).toBe('0.100000')
  })
})

describe('shadowIrr', () => {
  it('matches the real side when the bucket is positive', () => {
    expect(shadowIrr([flow('2025-01-02', '-1000')], '1100', '2026-01-02')).toBe('0.100000')
  })

  it('shows a dash when the bucket is zero or negative', () => {
    expect(shadowIrr([flow('2025-01-02', '-1000')], '0', '2026-01-02')).toBeNull()
    expect(shadowIrr([flow('2025-01-02', '-1000')], '-250', '2026-01-02')).toBeNull()
  })
})

describe('valueAdded and percentDifference', () => {
  it('is current value less shadow value', () => {
    expect(valueAdded('3000', '5000')).toBe('-2000')
    expect(valueAdded('0', '-1250')).toBe('1250')
  })

  it('divides value added by the shadow value', () => {
    expect(percentDifference('3000', '5000')).toBe('-0.4')
    expect(percentDifference('6000', '5000')).toBe('0.2')
  })

  it('shows a dash when the shadow value is not positive', () => {
    expect(percentDifference('100', '0')).toBeNull()
    expect(percentDifference('0', '-1250')).toBeNull()
  })
})
