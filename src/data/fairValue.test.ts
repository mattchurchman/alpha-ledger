import { describe, expect, it } from 'vitest'
import type { FairValueRow } from '../api/types'
import { discountFrom, latestFairValues } from './fairValue'

function row(partial: Partial<FairValueRow>): FairValueRow {
  return {
    id: 1,
    ticker: 'ACME',
    value_usd: '100',
    effective_date: '2024-01-01',
    note: null,
    created_at: '2024-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('latestFairValues', () => {
  it('picks the newest effective_date per ticker', () => {
    const rows = [
      row({ id: 1, ticker: 'ACME', effective_date: '2024-01-01', value_usd: '100' }),
      row({ id: 2, ticker: 'ACME', effective_date: '2024-06-01', value_usd: '150' }),
      row({ id: 3, ticker: 'BETA', effective_date: '2024-03-01', value_usd: '20' }),
    ]
    const latest = latestFairValues(rows)
    expect(latest.get('ACME')?.value_usd).toBe('150')
    expect(latest.get('BETA')?.value_usd).toBe('20')
  })

  it('breaks a tied effective_date by the higher id', () => {
    const rows = [
      row({ id: 5, ticker: 'ACME', effective_date: '2024-01-01', value_usd: '100' }),
      row({ id: 7, ticker: 'ACME', effective_date: '2024-01-01', value_usd: '120' }),
    ]
    expect(latestFairValues(rows).get('ACME')?.value_usd).toBe('120')
  })

  it('is empty for no rows', () => {
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
