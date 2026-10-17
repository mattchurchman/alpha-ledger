import { describe, expect, it } from 'vitest'
import type { ImportPlan } from '../engine/m1/resolve'
import type { Transaction } from '../engine/types'
import { resolveImportPlan } from './importWorkflow'

const transaction = (hash: string, ticker = 'ZZONE'): Transaction => ({
  account_label: 'taxable',
  trade_date: '2025-01-02',
  ticker,
  type: 'buy',
  shares: '1',
  amount_usd: '10',
  source: 'm1',
  source_row_hash: hash,
  note: null,
  excluded: false,
})

function plan(): ImportPlan {
  const reference = (sourceRowHash: string) => ({
    line: 2,
    sourceRowHash,
    transactionType: 'CASH',
    description: sourceRowHash,
  })
  return {
    accountLabel: { value: 'taxable', inferred: true, evidence: 'matched existing rows' },
    fresh: [transaction('fresh')],
    duplicates: 10,
    autoFixed: [
      {
        ...reference('fixed-transaction'),
        kind: 'cash-out',
        evidence: 'CUSIP match',
        transaction: transaction('fixed-transaction'),
      },
      {
        ...reference('fixed-drop'),
        kind: 'split-placeholder',
        evidence: 'nearby split',
        transaction: null,
      },
    ],
    proposals: [
      {
        ...reference('proposal'),
        kind: 'transfer-in-kind',
        evidence: 'ticker and units supplied',
        transaction: transaction('proposal'),
      },
    ],
    ignored: [],
    needsYou: [
      {
        ...reference('ambiguous'),
        kind: 'cash-out',
        evidence: 'two candidates fit',
        candidates: ['ZZA', 'ZZB'],
        candidateTransactions: [transaction('ambiguous', 'ZZA'), transaction('ambiguous', 'ZZB')],
      },
    ],
  }
}

describe('resolveImportPlan', () => {
  it('keeps Import blocked until every proposal and question has a decision', () => {
    const resolved = resolveImportPlan(plan(), {})

    expect(resolved.transactions.map((row) => row.source_row_hash)).toEqual([
      'fresh',
      'fixed-transaction',
    ])
    expect(resolved.ignoredHashes).toEqual(['fixed-drop'])
    expect(resolved.unresolved.map((row) => row.sourceRowHash)).toEqual(['proposal', 'ambiguous'])
  })

  it('posts accepted and chosen rows once and persists every ignored source hash', () => {
    const duplicateFresh = plan()
    duplicateFresh.fresh.push(transaction('fresh'))
    const resolved = resolveImportPlan(duplicateFresh, {
      proposal: { kind: 'accept' },
      ambiguous: { kind: 'choose', ticker: 'ZZB' },
    })

    expect(resolved.transactions.map((row) => `${row.source_row_hash}:${row.ticker}`)).toEqual([
      'fresh:ZZONE',
      'fixed-transaction:ZZONE',
      'proposal:ZZONE',
      'ambiguous:ZZB',
    ])
    expect(resolved.ignoredHashes).toEqual(['fixed-drop'])
    expect(resolved.unresolved).toEqual([])
  })

  it('treats Ignore as a complete decision', () => {
    const resolved = resolveImportPlan(plan(), {
      proposal: { kind: 'ignore' },
      ambiguous: { kind: 'ignore' },
    })

    expect(resolved.ignoredHashes).toEqual(['ambiguous', 'fixed-drop', 'proposal'])
    expect(resolved.unresolved).toEqual([])
  })
})
