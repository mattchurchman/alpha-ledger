import { describe, expect, it } from 'vitest'
import allTypesCsv from '../../../tests/fixtures/m1/activity-all-types.csv?raw'
import identicalRowsCsv from '../../../tests/fixtures/m1/activity-identical-rows.csv?raw'
import overlapCsv from '../../../tests/fixtures/m1/activity-overlap.csv?raw'
import unrecognizedCsv from '../../../tests/fixtures/m1/activity-unrecognized.csv?raw'
import { parseDate, parseM1Activity, type NormalizedTransaction } from './parse.ts'

const FIXTURES: Record<string, string> = {
  'activity-all-types.csv': allTypesCsv,
  'activity-identical-rows.csv': identicalRowsCsv,
  'activity-overlap.csv': overlapCsv,
  'activity-unrecognized.csv': unrecognizedCsv,
}

const fixture = (name: string): string => FIXTURES[name]

const byTicker = (txns: NormalizedTransaction[], ticker: string): NormalizedTransaction[] =>
  txns.filter((t) => t.ticker === ticker)

describe('parseM1Activity', () => {
  describe('the activity types M1 actually emits', () => {
    const result = parseM1Activity(fixture('activity-all-types.csv'), 'taxable')

    it('maps purchases, sales and dividends and drops the three cash types', () => {
      expect(result.transactions.map((t) => t.type)).toEqual(['buy', 'sell', 'dividend'])
      expect(result.dropped.map((d) => d.reason)).toEqual(['cash transfer', 'interest', 'cash fee'])
      expect(result.unrecognized).toEqual([])
    })

    it('normalizes a fractional purchase', () => {
      expect(result.transactions[0]).toMatchObject({
        account_label: 'taxable',
        trade_date: '2024-01-08',
        ticker: 'ABCD',
        type: 'buy',
        shares: '0.04213',
        amount_usd: '10',
        source: 'm1',
        note: null,
        excluded: false,
      })
    })

    it('makes a sale positive, since type carries the direction', () => {
      expect(result.transactions[1]).toMatchObject({
        type: 'sell',
        shares: '2.5',
        amount_usd: '500',
      })
    })

    it('leaves shares null on a dividend and uses Date, not Posted Date', () => {
      expect(result.transactions[2]).toMatchObject({
        trade_date: '2024-01-06',
        ticker: 'WXYZ',
        type: 'dividend',
        shares: null,
        amount_usd: '12.34',
      })
    })
  })

  describe('rows it refuses to guess at', () => {
    const result = parseM1Activity(fixture('activity-unrecognized.csv'), 'taxable')

    it('reports every questionable row instead of dropping it', () => {
      expect(result.unrecognized.map((u) => u.transaction_type)).toEqual([
        'TRANSFER',
        'SPLIT',
        'OTHER',
        'DIVIDEND',
        'REORGANIZATION',
      ])
    })

    it('still parses the good row in the same file', () => {
      expect(result.transactions).toHaveLength(1)
      expect(result.transactions[0]).toMatchObject({ ticker: 'QRST', type: 'buy' })
    })

    it('separates a transfer in kind from a cash transfer by Unit Type', () => {
      expect(result.unrecognized[0].reason).toMatch(/in kind/)
      expect(result.dropped).toEqual([])
    })

    it('does not drop an OTHER row that is not interest', () => {
      expect(result.unrecognized[2].reason).toMatch(/not read as interest/)
    })

    it('refuses a dividend with no symbol, which cannot be attributed', () => {
      expect(result.unrecognized[3].reason).toMatch(/cannot be attributed/)
    })

    it('reports the line number and raw row so it can be triaged', () => {
      expect(result.unrecognized[4]).toMatchObject({
        line: 6,
        reason: 'unknown Transaction Type "REORGANIZATION"',
      })
      expect(result.unrecognized[4].fields['description']).toBe('Something entirely new happened.')
    })
  })

  describe('source_row_hash', () => {
    it('is stable across re-imports of the same file', () => {
      const first = parseM1Activity(fixture('activity-all-types.csv'), 'taxable')
      const second = parseM1Activity(fixture('activity-all-types.csv'), 'taxable')
      expect(second.transactions.map((t) => t.source_row_hash)).toEqual(
        first.transactions.map((t) => t.source_row_hash),
      )
    })

    it('matches across overlapping exports, so re-importing does not duplicate', () => {
      const full = parseM1Activity(fixture('activity-all-types.csv'), 'taxable')
      const overlap = parseM1Activity(fixture('activity-overlap.csv'), 'taxable')

      const shared = new Set(full.transactions.map((t) => t.source_row_hash))
      const newRows = overlap.transactions.filter((t) => !shared.has(t.source_row_hash))

      expect(overlap.transactions).toHaveLength(4)
      expect(newRows.map((t) => t.ticker)).toEqual(['QRST'])
    })

    it('keeps the same trade in two accounts distinct', () => {
      const taxable = parseM1Activity(fixture('activity-all-types.csv'), 'taxable')
      const roth = parseM1Activity(fixture('activity-all-types.csv'), 'roth')
      expect(roth.transactions[0].source_row_hash).not.toBe(taxable.transactions[0].source_row_hash)
    })

    it('keeps genuinely identical auto-invest rows as separate transactions', () => {
      const result = parseM1Activity(fixture('activity-identical-rows.csv'), 'taxable')
      const hashes = new Set(result.transactions.map((t) => t.source_row_hash))
      expect(result.transactions).toHaveLength(3)
      expect(hashes.size).toBe(3)
    })

    it('gives identical rows the same hashes when a longer export repeats them', () => {
      const two = parseM1Activity(
        fixture('activity-identical-rows.csv').split('\n').slice(0, 3).join('\n'),
        'taxable',
      )
      const three = parseM1Activity(fixture('activity-identical-rows.csv'), 'taxable')

      expect(two.transactions).toHaveLength(2)
      expect(three.transactions.slice(0, 2).map((t) => t.source_row_hash)).toEqual(
        two.transactions.map((t) => t.source_row_hash),
      )
    })
  })

  describe('CSV quirks', () => {
    it('reads quoted fields containing commas', () => {
      const result = parseM1Activity(fixture('activity-all-types.csv'), 'taxable')
      expect(result.dropped[0]).toMatchObject({ transaction_type: 'TRANSFER' })
    })

    it('matches columns by name, not position', () => {
      const reordered = [
        'Transaction Type,Units,Unit Type,Amount,Symbol,Date,Description',
        'PURCHASED,1.5,SHARES,$300.00,ABCD,"Apr 2, 2024",1.5 shares of ABCD purchased.',
      ].join('\n')

      expect(parseM1Activity(reordered, 'taxable').transactions[0]).toMatchObject({
        trade_date: '2024-04-02',
        ticker: 'ABCD',
        shares: '1.5',
        amount_usd: '300',
      })
    })

    it('tolerates a BOM, CRLF endings and trailing blank lines', () => {
      const messy =
        '﻿Date,Symbol,Description,Transaction Type,Amount,Units,Unit Type\r\n' +
        '"Apr 3, 2024",ABCD,bought,PURCHASED,$100.00,1,SHARES\r\n\r\n'

      expect(parseM1Activity(messy, 'taxable').transactions).toHaveLength(1)
    })

    it('throws when a required column is absent', () => {
      expect(() => parseM1Activity('Date,Symbol\n"Apr 3, 2024",ABCD', 'taxable')).toThrow(
        /missing required column/,
      )
    })

    it('throws on an empty file', () => {
      expect(() => parseM1Activity('', 'taxable')).toThrow(/empty/)
    })

    it('reports a row whose numbers will not parse', () => {
      const bad = [
        'Date,Symbol,Description,Transaction Type,Amount,Units,Unit Type',
        '"Apr 4, 2024",ABCD,bought,PURCHASED,$100.00,--,SHARES',
      ].join('\n')

      expect(parseM1Activity(bad, 'taxable').unrecognized[0].reason).toMatch(/unparseable Units/)
    })

    it('strips thousands separators rather than truncating at the comma', () => {
      const big = [
        'Date,Symbol,Description,Transaction Type,Amount,Units,Unit Type',
        '"Apr 5, 2024",ABCD,bought,PURCHASED,"$1,234,567.89",10,SHARES',
      ].join('\n')

      expect(parseM1Activity(big, 'taxable').transactions[0].amount_usd).toBe('1234567.89')
    })
  })

  describe('multi-account imports', () => {
    it('stamps each row with the account label it was given', () => {
      const result = parseM1Activity(fixture('activity-all-types.csv'), 'roth ira')
      expect(new Set(result.transactions.map((t) => t.account_label))).toEqual(new Set(['roth ira']))
      expect(byTicker(result.transactions, 'ABCD')).toHaveLength(2)
    })
  })
})

describe('parseDate', () => {
  it('converts M1 dates without a timezone shift', () => {
    expect(parseDate('Jan 5, 2024')).toBe('2024-01-05')
    expect(parseDate('Oct 14, 2026')).toBe('2026-10-14')
    expect(parseDate('  Dec 31, 1999  ')).toBe('1999-12-31')
  })

  it('rejects anything it does not recognize', () => {
    expect(parseDate('2024-01-05')).toBeNull()
    expect(parseDate('Smarch 5, 2024')).toBeNull()
    expect(parseDate('Jan 32, 2024')).toBeNull()
    expect(parseDate('')).toBeNull()
  })
})
