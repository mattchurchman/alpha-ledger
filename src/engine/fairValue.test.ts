import { describe, expect, it } from 'vitest'
import {
  DEEP_DISCOUNT,
  WELL_ABOVE,
  discountFrom,
  latestFairValues,
  splitAdjustedHistory,
  splitAdjustedValue,
  zoneFor,
} from './fairValue'
import type { PriceSplitEvent } from './prices/types'
import type { FairValueRecord } from './types'

function record(partial: Partial<FairValueRecord>): FairValueRecord {
  return {
    id: 1,
    ticker: 'ACME',
    value_usd: '100',
    effective_date: '2024-01-01',
    note: null,
    ...partial,
  }
}

describe('latestFairValues', () => {
  it('picks the newest effective_date per ticker', () => {
    const records = [
      record({ id: 1, ticker: 'ACME', effective_date: '2024-01-01', value_usd: '100' }),
      record({ id: 2, ticker: 'ACME', effective_date: '2024-06-01', value_usd: '150' }),
      record({ id: 3, ticker: 'BETA', effective_date: '2024-03-01', value_usd: '20' }),
    ]
    const latest = latestFairValues(records)
    expect(latest.get('ACME')?.value_usd).toBe('150')
    expect(latest.get('BETA')?.value_usd).toBe('20')
  })

  it('breaks a tied effective_date by the higher id', () => {
    const records = [
      record({ id: 5, ticker: 'ACME', effective_date: '2024-01-01', value_usd: '100' }),
      record({ id: 7, ticker: 'ACME', effective_date: '2024-01-01', value_usd: '120' }),
    ]
    expect(latestFairValues(records).get('ACME')?.value_usd).toBe('120')
  })

  it('is empty for no records', () => {
    expect(latestFairValues([]).size).toBe(0)
  })
})

describe('discountFrom', () => {
  it('is positive when the price sits below the estimate', () => {
    expect(discountFrom('80', '100')).toBe('0.2')
  })

  it('is negative when the price sits above the estimate', () => {
    expect(discountFrom('120', '100')).toBe('-0.2')
  })

  it('is zero when price equals the estimate', () => {
    expect(discountFrom('100', '100')).toBe('0')
  })

  it('is null when the fair value is zero or negative', () => {
    expect(discountFrom('80', '0')).toBeNull()
    expect(discountFrom('80', '-10')).toBeNull()
  })
})

describe('zoneFor', () => {
  it('is deep at and beyond the deep-discount threshold', () => {
    expect(zoneFor(DEEP_DISCOUNT)).toBe('deep')
    expect(zoneFor(0.5)).toBe('deep')
  })

  it('is below between 0 and the deep-discount threshold', () => {
    expect(zoneFor(0)).toBe('below')
    expect(zoneFor(0.1)).toBe('below')
  })

  it('is above between 0 and the well-above threshold', () => {
    expect(zoneFor(-0.01)).toBe('above')
    expect(zoneFor(WELL_ABOVE)).toBe('above')
  })

  it('is well-above beyond that threshold', () => {
    expect(zoneFor(-0.2)).toBe('well-above')
  })

  it('is null for no estimate', () => {
    expect(zoneFor(null)).toBeNull()
  })

  it('accepts a decimal string the same as a number', () => {
    expect(zoneFor('0.2325')).toBe('deep')
  })
})

describe('splitAdjustedValue', () => {
  const forward: PriceSplitEvent = { date: '2024-01-04', numerator: 2, denominator: 1 }

  it('divides by the factor of every split dated after the estimate', () => {
    // A 2-for-1 split after the estimate halves what one old dollar-per-share is worth today.
    expect(
      splitAdjustedValue(record({ effective_date: '2024-01-02', value_usd: '100' }), [forward]),
    ).toBe('50')
  })

  it('is unchanged when every split predates the estimate', () => {
    expect(
      splitAdjustedValue(record({ effective_date: '2024-01-05', value_usd: '100' }), [forward]),
    ).toBe('100')
  })

  it('is unchanged with no splits', () => {
    expect(splitAdjustedValue(record({ value_usd: '42.50' }), [])).toBe('42.5')
  })
})

describe('splitAdjustedHistory', () => {
  it('sorts oldest first and split-adjusts each entry (acceptance: four changes, four steps)', () => {
    const split: PriceSplitEvent = { date: '2024-02-01', numerator: 2, denominator: 1 }
    const records = [
      record({ id: 3, ticker: 'ACME', effective_date: '2024-03-01', value_usd: '60', note: 'c' }),
      record({ id: 1, ticker: 'ACME', effective_date: '2024-01-01', value_usd: '100', note: 'a' }),
      record({ id: 2, ticker: 'ACME', effective_date: '2024-01-15', value_usd: '110', note: 'b' }),
      record({ id: 4, ticker: 'ACME', effective_date: '2024-04-01', value_usd: '70', note: 'd' }),
    ]

    const history = splitAdjustedHistory(records, [split])

    expect(history).toHaveLength(4)
    expect(history.map((h) => h.date)).toEqual([
      '2024-01-01',
      '2024-01-15',
      '2024-03-01',
      '2024-04-01',
    ])
    // The two estimates made before the split are halved; the two after are untouched.
    expect(history.map((h) => h.value)).toEqual(['50', '55', '60', '70'])
    expect(history.map((h) => h.note)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('never rewrites the stored value - only the view is adjusted', () => {
    const split: PriceSplitEvent = { date: '2024-02-01', numerator: 2, denominator: 1 }
    const original = record({ effective_date: '2024-01-01', value_usd: '100' })
    splitAdjustedHistory([original], [split])
    expect(original.value_usd).toBe('100')
  })

  it('is empty for no records', () => {
    expect(splitAdjustedHistory([], [])).toEqual([])
  })
})
