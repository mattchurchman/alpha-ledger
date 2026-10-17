import { describe, expect, it } from 'vitest'
import fullExportV1 from '../../../tests/fixtures/m1/full-export-v1.csv?raw'
import fullExportV2 from '../../../tests/fixtures/m1/full-export-v2.csv?raw'
import type { PriceHistory } from '../prices/types'
import type { Transaction } from '../types'
import { parseM1Activity } from './parse'
import { planImport } from './resolve'

function history(
  dates: string[],
  close: string[],
  splits: PriceHistory['splits'] = [],
): PriceHistory {
  return { dates, close, adjClose: close, splits, dividends: [], asOf: dates.at(-1) ?? '' }
}

const MARKET_DATES = [
  '2025-01-02',
  '2025-01-03',
  '2025-01-06',
  '2025-01-07',
  '2025-01-08',
  '2025-01-09',
  '2025-01-10',
  '2025-01-13',
  '2025-01-14',
  '2025-01-15',
]

const PRICES: Record<string, PriceHistory> = {
  ZZVOO: history(
    MARKET_DATES,
    MARKET_DATES.map(() => '100'),
  ),
  ZZAB: history(
    MARKET_DATES,
    MARKET_DATES.map(() => '20'),
    [{ date: '2025-01-08', numerator: 2, denominator: 1 }],
  ),
  ZZEX: history(
    MARKET_DATES.slice(0, 7),
    MARKET_DATES.slice(0, 7).map(() => '12'),
  ),
  ZZDEL: history(
    MARKET_DATES.slice(0, 7),
    MARKET_DATES.slice(0, 7).map(() => '50'),
  ),
  ZZAMB1: history(
    MARKET_DATES.slice(0, 8),
    MARKET_DATES.slice(0, 8).map(() => '50'),
  ),
  ZZAMB2: history(
    MARKET_DATES.slice(0, 8),
    MARKET_DATES.slice(0, 8).map(() => '25'),
  ),
  ZZAUTO: history(
    MARKET_DATES,
    MARKET_DATES.map(() => '10'),
  ),
  'ZZ.A': history(
    MARKET_DATES,
    MARKET_DATES.map(() => '75'),
  ),
}

const planV1 = (ledger: Transaction[] = [], ignoredHashes: string[] = []) =>
  planImport({
    parsed: parseM1Activity(fullExportV1, 'taxable'),
    accountLabel: 'taxable',
    ledger,
    prices: PRICES,
    aliases: [],
    ignoredHashes,
  })

describe('planImport', () => {
  it('puts every known full-export shape in the evidence-backed bucket', () => {
    const plan = planV1()

    expect(plan.accountLabel).toEqual({
      value: 'taxable',
      inferred: false,
      evidence: 'Account label supplied for this import.',
    })
    expect(plan.fresh.map((row) => row.ticker)).toEqual([
      'ZZAB',
      'ZZEX',
      'ZZAUTO',
      'ZZAUTO',
      'ZZDEL',
      'ZZAMB1',
      'ZZAMB2',
      'ZZ.A',
    ])
    expect(new Set(plan.fresh.map((row) => row.source_row_hash)).size).toBe(8)

    expect(plan.autoFixed.map((entry) => entry.kind)).toEqual([
      'split-placeholder',
      'split-placeholder',
      'cash-out',
    ])
    expect(plan.autoFixed[0].evidence).toContain('ZZAB split 2:1 on 2025-01-08')
    expect(plan.autoFixed[2].evidence).toBe('CUSIP 111111111 matches 1 earlier ZZEX row.')
    expect(plan.autoFixed[2].transaction).toMatchObject({
      ticker: 'ZZEX',
      type: 'sell',
      shares: '10',
      amount_usd: '120',
      source: 'm1',
      note: 'M1 CASH settlement: ZZEX MERGER',
    })

    expect(plan.proposals.map((entry) => entry.kind)).toEqual(['cash-out', 'transfer-in-kind'])
    expect(plan.proposals[0].evidence).toContain('last close $50')
    expect(plan.proposals[0].transaction).toMatchObject({
      ticker: 'ZZDEL',
      type: 'sell',
      shares: '4',
      amount_usd: '208',
    })
    expect(plan.proposals[1].transaction).toMatchObject({
      ticker: 'ZZINK',
      type: 'adjust',
      shares: '3',
      amount_usd: '0',
    })

    expect(plan.needsYou).toHaveLength(1)
    expect(plan.needsYou[0]).toMatchObject({
      kind: 'cash-out',
      candidates: ['ZZAMB1', 'ZZAMB2'],
      candidateTransactions: [
        expect.objectContaining({ ticker: 'ZZAMB1', type: 'sell', shares: '2' }),
        expect.objectContaining({ ticker: 'ZZAMB2', type: 'sell', shares: '4' }),
      ],
    })
    expect(plan.duplicates).toBe(0)
    expect(plan.ignored).toEqual([])
  })

  it('infers an existing account from a unique majority of rehashed mappable rows', () => {
    const taxable = parseM1Activity(fullExportV1, 'taxable')
    const provisional = parseM1Activity(fullExportV1, '')
    const ledger = taxable.transactions.slice(0, 5)

    const plan = planImport({
      parsed: provisional,
      ledger,
      prices: PRICES,
      aliases: [],
      ignoredHashes: [],
    })

    expect(plan.accountLabel.value).toBe('taxable')
    expect(plan.accountLabel.inferred).toBe(true)
    expect(plan.accountLabel.evidence).toBe('5 of 8 mappable rows match account "taxable".')
    expect(plan.duplicates).toBe(5)
  })

  it('infers from a strong unique overlap when a full export has more new rows than old ones', () => {
    const first = planV1()
    const ambiguous = first.needsYou[0]
    const generated = [...first.autoFixed, ...first.proposals].flatMap((entry) =>
      entry.transaction === null ? [] : [entry.transaction],
    )
    const ledger = [
      ...first.fresh,
      ...generated,
      {
        account_label: 'taxable',
        trade_date: '2025-01-14',
        ticker: 'ZZAMB1',
        type: 'sell' as const,
        shares: '2',
        amount_usd: '100',
        source: 'm1' as const,
        source_row_hash: ambiguous.sourceRowHash,
        note: 'M1 CASH settlement: AMBIGUOUS ACQUISITION',
        excluded: false,
      },
    ]
    const ignoredHashes = first.autoFixed
      .filter((entry) => entry.transaction === null)
      .map((entry) => entry.sourceRowHash)

    const next = planImport({
      parsed: parseM1Activity(fullExportV2, ''),
      ledger,
      prices: PRICES,
      aliases: [],
      ignoredHashes,
    })

    expect(next.accountLabel).toMatchObject({ value: 'taxable', inferred: true })
    expect(next.accountLabel.evidence).toBe('8 of 58 mappable rows match account "taxable".')
    expect(next.fresh).toHaveLength(50)
    expect(next.duplicates).toBe(12)
    expect(next.needsYou).toEqual([])
  })

  it('does not infer a mostly-new export from one coincidental matching row', () => {
    const taxable = parseM1Activity(fullExportV2, 'taxable')
    const plan = planImport({
      parsed: parseM1Activity(fullExportV2, ''),
      ledger: taxable.transactions.slice(0, 1),
      prices: PRICES,
      aliases: [],
      ignoredHashes: [],
    })

    expect(plan.accountLabel.value).toBeNull()
    expect(plan.needsYou).toEqual([expect.objectContaining({ kind: 'account' })])
  })

  it('asks for an account instead of guessing from a weak overlap', () => {
    const plan = planImport({
      parsed: parseM1Activity(fullExportV1, ''),
      ledger: parseM1Activity(fullExportV1, 'taxable').transactions.slice(0, 2),
      prices: PRICES,
      aliases: [],
      ignoredHashes: [],
    })

    expect(plan.accountLabel).toMatchObject({ value: null, inferred: false })
    expect(plan.needsYou).toEqual([
      expect.objectContaining({ kind: 'account', evidence: expect.stringContaining('2 of 8') }),
    ])
    expect(plan.fresh).toEqual([])
  })

  it('does not resurface anything whose source hash is stored or ignored', () => {
    const first = planV1()
    const ambiguous = first.needsYou[0]
    const savedAmbiguous: Transaction = {
      account_label: 'taxable',
      trade_date: '2025-01-14',
      ticker: 'ZZAMB1',
      type: 'sell',
      shares: '2',
      amount_usd: '100',
      source: 'm1',
      source_row_hash: ambiguous.sourceRowHash,
      note: 'M1 CASH settlement: AMBIGUOUS ACQUISITION',
      excluded: false,
    }
    const generated = [...first.autoFixed, ...first.proposals].flatMap((entry) =>
      entry.transaction === null ? [] : [entry.transaction],
    )
    const ledger = [...first.fresh, ...generated, savedAmbiguous]
    const ignoredHashes = first.autoFixed
      .filter((entry) => entry.transaction === null)
      .map((entry) => entry.sourceRowHash)

    const next = planImport({
      parsed: parseM1Activity(fullExportV2, 'taxable'),
      accountLabel: 'taxable',
      ledger,
      prices: PRICES,
      aliases: [],
      ignoredHashes,
    })

    expect(next.fresh).toHaveLength(50)
    expect(next.fresh.every((row) => row.ticker.startsWith('ZZN'))).toBe(true)
    expect(next.proposals).toEqual([])
    expect(next.needsYou).toEqual([])
    expect(next.autoFixed).toEqual([])
    expect(next.ignored).toHaveLength(2)
    expect(next.duplicates).toBe(12)
  })

  it('closes only the imported account when another account holds the same ticker', () => {
    const csv = [
      'Date,Posted Date,Symbol,Description,Transaction Type,Amount,Units,Unit Type,Unit Price,Security Id,Security Id Type',
      '"Jan 2, 2025","Jan 2, 2025",ZZONE,bought,PURCHASED,$20.00,2,SHARES,$10.00,123123123,CUSIP',
      '"Jan 10, 2025","Jan 10, 2025",,ZZONE MERGER,CASH,$24.00,--,CURRENCY,--,123123123,CUSIP',
    ].join('\n')
    const otherAccount: Transaction = {
      account_label: 'roth',
      trade_date: '2025-01-02',
      ticker: 'ZZONE',
      type: 'buy',
      shares: '8',
      amount_usd: '80',
      source: 'manual',
      source_row_hash: 'other-account',
      note: null,
      excluded: false,
    }

    const plan = planImport({
      parsed: parseM1Activity(csv, 'taxable'),
      accountLabel: 'taxable',
      ledger: [otherAccount],
      prices: {},
      aliases: [],
      ignoredHashes: [],
    })

    expect(plan.autoFixed[0].transaction).toMatchObject({
      account_label: 'taxable',
      ticker: 'ZZONE',
      shares: '2',
    })
  })

  it('keeps an unsupported placeholder visible when no nearby split proves it is redundant', () => {
    const csv = [
      'Date,Symbol,Description,Transaction Type,Amount,Units,Unit Type',
      '"Jan 8, 2025",PRESPLITZZNOPE,unknown action,SOLD,-$10.00,-1,SHARES',
    ].join('\n')

    const plan = planImport({
      parsed: parseM1Activity(csv, 'taxable'),
      accountLabel: 'taxable',
      ledger: [],
      prices: PRICES,
      aliases: [],
      ignoredHashes: [],
    })

    expect(plan.autoFixed).toEqual([])
    expect(plan.needsYou).toEqual([
      expect.objectContaining({
        kind: 'unrecognized',
        evidence: expect.stringContaining('no nearby split'),
      }),
    ])
  })
})
