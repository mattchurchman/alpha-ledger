import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { accountLabels, sharesByAccount, transactionsIn } from './accounts'
import { analyze, analyzeAccount, type AnalyzeResult } from './index'
import { DATES, LAST_DAY, PRICES, buy, dividend, row, sell } from './__fixtures__/synthetic'
import type { Transaction } from './types'

/**
 * Task 19's acceptance check: the per-account values and shadow values sum to the
 * all-accounts figures. Synthetic fixtures only (CLAUDE.md).
 *
 * The ledger below is built so the one measure that is *not* additive is forced apart too:
 * ACME is bought at $100 in `taxable` and at $200 in `roth`, then ten shares are sold from
 * `taxable`. Pooled across accounts the average cost is $150, so the pooled realized gain is
 * not the sum of the two per-account realized gains - while every total still agrees. That is
 * the SPEC section 4 trade-off this task records, so it is pinned here rather than left to be
 * discovered on screen.
 */

const [D0, , D2, D3, D4] = DATES

function ledger(): Transaction[] {
  return [
    // ACME: the same ticker in two accounts at two very different prices.
    buy(D0, 'ACME', '10', '1000', 'taxable'),
    buy(D2, 'ACME', '10', '2000', 'roth'),
    sell(D4, 'ACME', '10', '2000', 'taxable'),
    // BETA, held in one account only, plus a dividend so one account has every flow type.
    buy(D0, 'BETA', '20', '1000', 'roth'),
    dividend(D3, 'BETA', '40', 'roth'),
    // An account that only ever held something now closed out entirely.
    buy(D0, 'BETA', '10', '500', 'ira'),
    sell(D3, 'BETA', '10', '1000', 'ira'),
  ]
}

const sum = (values: string[]) =>
  values.reduce((acc, value) => acc.plus(value), new Decimal(0)).toFixed()

function perAccount(transactions: Transaction[]): { all: AnalyzeResult; parts: AnalyzeResult[] } {
  const all = analyze({ transactions, prices: PRICES })
  const parts = accountLabels(transactions).map((account) =>
    analyzeAccount({ transactions, prices: PRICES, asOf: all.asOf, account, includeSeries: false }),
  )
  return { all, parts }
}

describe('accountLabels', () => {
  it('is the sorted distinct set of labels', () => {
    expect(accountLabels(ledger())).toEqual(['ira', 'roth', 'taxable'])
  })

  it('leaves out an account whose only rows are excluded', () => {
    const rows = [...ledger(), { ...buy(D0, 'ACME', '1', '100', 'old-brokerage'), excluded: true }]
    expect(accountLabels(rows)).toEqual(['ira', 'roth', 'taxable'])
  })

  it('is empty for an empty ledger', () => {
    expect(accountLabels([])).toEqual([])
  })
})

describe('transactionsIn', () => {
  it('keeps only that account, in order', () => {
    const rows = transactionsIn(ledger(), 'taxable')
    expect(rows.map((r) => [r.ticker, r.type])).toEqual([
      ['ACME', 'buy'],
      ['ACME', 'sell'],
    ])
  })

  it('is empty for a label nobody traded under', () => {
    expect(transactionsIn(ledger(), 'nope')).toEqual([])
  })
})

describe('analyzeAccount', () => {
  it('values and shadow values sum to the all-accounts figures', () => {
    const { all, parts } = perAccount(ledger())

    expect(sum(parts.map((p) => p.portfolio.currentValue))).toBe(all.portfolio.currentValue)
    expect(sum(parts.map((p) => p.portfolio.shadowValue))).toBe(all.portfolio.shadowValue)
    expect(sum(parts.map((p) => p.portfolio.valueAdded))).toBe(all.portfolio.valueAdded)
  })

  it('invested, returned and total gain sum too', () => {
    const { all, parts } = perAccount(ledger())

    expect(sum(parts.map((p) => p.portfolio.invested))).toBe(all.portfolio.invested)
    expect(sum(parts.map((p) => p.portfolio.returned))).toBe(all.portfolio.returned)
    expect(sum(parts.map((p) => p.portfolio.totalGain))).toBe(all.portfolio.totalGain)
  })

  it('sums per ticker, not just in total', () => {
    const { all, parts } = perAccount(ledger())

    for (const ticker of all.byTicker) {
      const slices = parts.flatMap((p) => p.byTicker.filter((t) => t.ticker === ticker.ticker))
      expect(sum(slices.map((t) => t.shares))).toBe(ticker.shares)
      expect(sum(slices.map((t) => t.currentValue))).toBe(ticker.currentValue)
      expect(sum(slices.map((t) => t.shadowValue))).toBe(ticker.shadowValue)
      expect(sum(slices.map((t) => t.valueAdded))).toBe(ticker.valueAdded)
    }
  })

  it('values one account on its own average cost, which is the pooled split moving', () => {
    const { all, parts } = perAccount(ledger())
    const pooled = all.byTicker.find((t) => t.ticker === 'ACME')
    const slices = parts.flatMap((p) => p.byTicker.filter((t) => t.ticker === 'ACME'))

    // Pooled: 20 shares at an average of $150, so the ten sold for $2,000 realize $500.
    expect(pooled?.realizedGain).toBe('500')
    // `taxable` on its own bought at $100 and sold at $200, so it realizes $1,000 - and
    // `roth`, which sold nothing, realizes nothing. The two do not sum to the pooled figure.
    expect(slices.map((t) => t.realizedGain)).toEqual(['0', '1000'])
    expect(sum(slices.map((t) => t.realizedGain))).not.toBe(pooled?.realizedGain)
    // What does hold: the split moved, the total did not.
    expect(sum(slices.map((t) => t.totalGain))).toBe(pooled?.totalGain)
  })

  it('reads an account that holds nothing as an empty comparison, not a throw', () => {
    const result = analyzeAccount({
      transactions: ledger(),
      prices: PRICES,
      asOf: LAST_DAY,
      account: 'nobody',
    })
    expect(result.byTicker).toEqual([])
    expect(result.portfolio.currentValue).toBe('0')
    expect(result.portfolio.valueAdded).toBe('0')
  })

  it('carries the all-accounts valuation date into every part', () => {
    const { all, parts } = perAccount(ledger())
    for (const part of parts) expect(part.asOf).toBe(all.asOf)
  })
})

describe('sharesByAccount', () => {
  const split = (ticker: string) =>
    sharesByAccount({ transactions: ledger(), prices: PRICES, asOf: LAST_DAY, ticker })

  it('splits a ticker held in two accounts, and sums to the position', () => {
    const rows = split('ACME')
    expect(rows).toEqual([
      { account: 'roth', shares: '10', currentValue: '3000' },
      { account: 'taxable', shares: '0', currentValue: '0' },
    ])

    const all = analyze({ transactions: ledger(), prices: PRICES })
    const position = all.byTicker.find((t) => t.ticker === 'ACME')
    expect(sum(rows.map((r) => r.shares))).toBe(position?.shares)
    expect(sum(rows.map((r) => r.currentValue))).toBe(position?.currentValue)
  })

  it('keeps an account that closed the position out, at zero shares', () => {
    expect(split('BETA')).toEqual([
      { account: 'ira', shares: '0', currentValue: '0' },
      { account: 'roth', shares: '20', currentValue: '5000' },
    ])
  })

  it('leaves out accounts that never traded the ticker', () => {
    const rows = sharesByAccount({
      transactions: [...ledger(), row('side', D0, 'ZZVOO', 'buy', '1', '100')],
      prices: PRICES,
      asOf: LAST_DAY,
      ticker: 'ACME',
    })
    expect(rows.map((r) => r.account)).toEqual(['roth', 'taxable'])
  })

  it('is empty for a ticker nobody traded', () => {
    expect(split('NOPE')).toEqual([])
  })
})
