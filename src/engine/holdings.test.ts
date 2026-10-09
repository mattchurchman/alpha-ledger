import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import {
  computeHoldings,
  crossCheckSplits,
  resolveTicker,
  sharesByDay,
  sharesOn,
  splitAdjustTransactions,
  splitFactorAfter,
  type TickerHoldings,
} from './holdings'
import type { PriceHistory, PriceSplitEvent } from './prices/types'
import type { TickerAlias, Transaction } from './types'

// --- fixtures -------------------------------------------------------------------------
// Synthetic prices and trades throughout; no real position, amount or ticker appears here.
// Jan 6-7 2024 is a weekend, so the series has the gap a real one does.

const DATES = ['2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', '2024-01-08']

function history(closes: string[], splits: PriceSplitEvent[] = []): PriceHistory {
  return {
    dates: DATES,
    close: closes,
    adjClose: closes,
    splits,
    dividends: [],
    asOf: DATES[DATES.length - 1],
  }
}

/** Closes 100, 110, 120, 150, 200. Latest close 200 unless a test passes its own `asOf`. */
const ACME = history(['100', '110', '120', '150', '200'])

let sequence = 0

function row(
  account: string,
  tradeDate: string,
  ticker: string,
  type: Transaction['type'],
  shares: string | null,
  amount: string,
): Transaction {
  sequence += 1
  return {
    account_label: account,
    trade_date: tradeDate,
    ticker,
    type,
    shares,
    amount_usd: amount,
    source: 'manual',
    source_row_hash: `hash-${sequence}`,
    note: null,
    excluded: false,
  }
}

const buy = (date: string, ticker: string, shares: string, amount: string, account = 'taxable') =>
  row(account, date, ticker, 'buy', shares, amount)

const sell = (date: string, ticker: string, shares: string, amount: string, account = 'taxable') =>
  row(account, date, ticker, 'sell', shares, amount)

const dividend = (date: string, ticker: string, amount: string, account = 'taxable') =>
  row(account, date, ticker, 'dividend', null, amount)

const adjust = (date: string, ticker: string, shares: string, account = 'taxable') =>
  row(account, date, ticker, 'adjust', shares, '0')

const splitRow = (date: string, ticker: string, ratio: string | null, account = 'taxable') =>
  row(account, date, ticker, 'split', ratio, '0')

/** Money to cents and shares to six places: the engine keeps full precision internally. */
const cents = (value: string | null) => (value === null ? null : new Decimal(value).toFixed(2))
const qty = (value: string) => new Decimal(value).toFixed(6)

function only(
  transactions: Transaction[],
  prices: Record<string, PriceHistory>,
  aliases?: TickerAlias[],
) {
  const result = computeHoldings({ transactions, prices, aliases })
  expect(result.byTicker).toHaveLength(1)
  return result.byTicker[0]
}

/**
 * SPEC section 6 defines total gain as `current value + returned - invested`, and splits it
 * into realized, unrealized and dividends "for display". Those are only two views of one
 * number if they always agree, so every holding assertion below checks that they do.
 */
function expectGainIdentity(holding: TickerHoldings): void {
  const parts = new Decimal(holding.realizedGain)
    .plus(holding.dividendGain)
    .plus(holding.unrealizedGain)
  expect(parts.toFixed(10)).toBe(new Decimal(holding.totalGain).toFixed(10))
}

// --- split adjustment -----------------------------------------------------------------

describe('splitFactorAfter', () => {
  const forward: PriceSplitEvent = { date: '2024-01-04', numerator: 20, denominator: 1 }
  const reverse: PriceSplitEvent = { date: '2024-01-05', numerator: 1, denominator: 8 }

  it('multiplies by every split after the trade date', () => {
    // 20-for-1 then 1-for-8: 20 * (1/8) = 2.5
    expect(splitFactorAfter('2024-01-02', [forward, reverse]).toFixed()).toBe('2.5')
  })

  it('ignores a split on the trade date itself', () => {
    // Yahoo dates a split on its ex-date and its prices are post-split from that day on,
    // so a trade executed that day is already counted in post-split shares.
    expect(splitFactorAfter('2024-01-04', [forward]).toFixed()).toBe('1')
  })

  it('is 1 when every split predates the trade', () => {
    expect(splitFactorAfter('2024-01-06', [forward, reverse]).toFixed()).toBe('1')
  })

  it('skips nonsense ratios rather than producing zero or infinity', () => {
    const bad: PriceSplitEvent[] = [
      { date: '2024-01-03', numerator: 0, denominator: 1 },
      { date: '2024-01-03', numerator: 2, denominator: 0 },
      forward,
    ]
    expect(splitFactorAfter('2024-01-02', bad).toFixed()).toBe('20')
  })
})

describe('splitAdjustTransactions', () => {
  it('signs shares by type and leaves dividends without a share count', () => {
    const adjusted = splitAdjustTransactions(
      [
        buy('2024-01-02', 'ACME', '2', '200'),
        sell('2024-01-03', 'ACME', '1', '110'),
        dividend('2024-01-04', 'ACME', '5'),
      ],
      { ACME },
    )

    expect(adjusted.map((txn) => txn.signedShares)).toEqual(['2', '-1', null])
  })

  it('drops excluded rows and M1 split rows', () => {
    const excluded = { ...buy('2024-01-02', 'ACME', '2', '200'), excluded: true }
    const adjusted = splitAdjustTransactions(
      [excluded, splitRow('2024-01-04', 'ACME', '20'), buy('2024-01-05', 'ACME', '1', '150')],
      { ACME },
    )

    expect(adjusted).toHaveLength(1)
    expect(adjusted[0].trade_date).toBe('2024-01-05')
  })

  it('orders a same-day sell after the buy that supplied the shares', () => {
    // M1 gives no intraday time; without this order a same-day round trip would sell
    // shares the walker has not added yet and release the wrong basis.
    const adjusted = splitAdjustTransactions(
      [sell('2024-01-02', 'ACME', '1', '100'), buy('2024-01-02', 'ACME', '1', '90')],
      { ACME },
    )

    expect(adjusted.map((txn) => txn.type)).toEqual(['buy', 'sell'])
  })

  it('looks splits up under the ticker the alias renames to', () => {
    // The buy is dated under OLD, but the 2-for-1 split lives on NEW's price history.
    const aliases: TickerAlias[] = [
      { from_ticker: 'OLD', to_ticker: 'NEW', effective_date: '2024-01-04' },
    ]
    const prices = {
      NEW: history(
        ['100', '110', '120', '150', '200'],
        [{ date: '2024-01-05', numerator: 2, denominator: 1 }],
      ),
    }

    const adjusted = splitAdjustTransactions(
      [buy('2024-01-02', 'OLD', '5', '500')],
      prices,
      aliases,
    )

    expect(adjusted[0].ticker).toBe('NEW')
    expect(adjusted[0].splitFactor).toBe('2')
    expect(adjusted[0].signedShares).toBe('10')
  })
})

// --- the cases the task lists ---------------------------------------------------------

describe('computeHoldings', () => {
  it('averages the cost of fractional buys', () => {
    // 1.5 @ $150 + 2.5 @ $275 = 4 shares, $425 basis, $106.25 average.
    // Value 4 x $200 = $800; unrealized $800 - $425 = $375.
    const holding = only(
      [buy('2024-01-02', 'ACME', '1.5', '150'), buy('2024-01-03', 'ACME', '2.5', '275')],
      { ACME },
    )

    expect(qty(holding.shares)).toBe('4.000000')
    expect(cents(holding.costBasis)).toBe('425.00')
    expect(cents(holding.averageCost)).toBe('106.25')
    expect(cents(holding.invested)).toBe('425.00')
    expect(cents(holding.returned)).toBe('0.00')
    expect(cents(holding.currentValue)).toBe('800.00')
    expect(cents(holding.unrealizedGain)).toBe('375.00')
    expect(cents(holding.realizedGain)).toBe('0.00')
    expect(cents(holding.totalGain)).toBe('375.00')
    expect(holding.latestClose).toBe('200')
    expect(holding.latestCloseDate).toBe('2024-01-08')
    expectGainIdentity(holding)
  })

  it('releases basis in proportion on a partial sell', () => {
    // 4 shares / $425 basis, then sell 1 for $150.
    // Basis sold = $425 x 1/4 = $106.25, so realized = $150 - $106.25 = $43.75.
    // Left: 3 shares, $318.75 basis, average still $106.25.
    // Value 3 x $200 = $600; unrealized $600 - $318.75 = $281.25.
    // Total = $600 + $150 - $425 = $325 = $43.75 + $281.25.
    const holding = only(
      [
        buy('2024-01-02', 'ACME', '1.5', '150'),
        buy('2024-01-03', 'ACME', '2.5', '275'),
        sell('2024-01-05', 'ACME', '1', '150'),
      ],
      { ACME },
    )

    expect(qty(holding.shares)).toBe('3.000000')
    expect(cents(holding.costBasis)).toBe('318.75')
    expect(cents(holding.averageCost)).toBe('106.25')
    expect(cents(holding.realizedGain)).toBe('43.75')
    expect(cents(holding.unrealizedGain)).toBe('281.25')
    expect(cents(holding.returned)).toBe('150.00')
    expect(cents(holding.totalGain)).toBe('325.00')
    expectGainIdentity(holding)
  })

  it('leaves exactly nothing behind on a full sell', () => {
    // 4 shares / $425 basis sold for $600: realized $175, basis and shares both zero.
    // A closed position still has a total gain; only its current value is 0.
    const holding = only(
      [
        buy('2024-01-02', 'ACME', '1.5', '150'),
        buy('2024-01-03', 'ACME', '2.5', '275'),
        sell('2024-01-05', 'ACME', '4', '600'),
      ],
      { ACME },
    )

    expect(qty(holding.shares)).toBe('0.000000')
    expect(holding.costBasis).toBe('0')
    expect(holding.averageCost).toBeNull()
    expect(cents(holding.currentValue)).toBe('0.00')
    expect(cents(holding.unrealizedGain)).toBe('0.00')
    expect(cents(holding.realizedGain)).toBe('175.00')
    expect(cents(holding.totalGain)).toBe('175.00')
    expectGainIdentity(holding)
  })

  it('starts a fresh basis when re-entering after a full exit', () => {
    // Full exit above (realized $175), then 2 shares for $400 on the last day.
    // New basis $400, average $200, value 2 x $200 = $400, so unrealized is 0 -
    // the old $175 must stay realized and must not reappear as unrealized gain.
    // Total = $400 + $600 - $825 = $175.
    const holding = only(
      [
        buy('2024-01-02', 'ACME', '1.5', '150'),
        buy('2024-01-03', 'ACME', '2.5', '275'),
        sell('2024-01-05', 'ACME', '4', '600'),
        buy('2024-01-08', 'ACME', '2', '400'),
      ],
      { ACME },
    )

    expect(qty(holding.shares)).toBe('2.000000')
    expect(cents(holding.costBasis)).toBe('400.00')
    expect(cents(holding.averageCost)).toBe('200.00')
    expect(cents(holding.invested)).toBe('825.00')
    expect(cents(holding.returned)).toBe('600.00')
    expect(cents(holding.realizedGain)).toBe('175.00')
    expect(cents(holding.unrealizedGain)).toBe('0.00')
    expect(cents(holding.totalGain)).toBe('175.00')
    expectGainIdentity(holding)
  })

  it('restates a holding through a 20-for-1 split', () => {
    // SPLT closes are split-adjusted, as Yahoo's always are: 100, 105, 110, 108, 120.
    // A 20-for-1 split on 2024-01-04.
    // Buy 1 share on 2024-01-02 for $2,000 (the real pre-split price, 20 x $100).
    //   -> 20 shares in today's terms, $2,000 basis.
    // Sell 0.5 shares on 2024-01-03 for $1,050 (20 x $105 x 0.5)
    //   -> 10 of today's shares. Basis sold = $2,000 x 10/20 = $1,000, realized $50.
    // Left: 10 shares, $1,000 basis. Value 10 x $120 = $1,200, unrealized $200.
    // Total = $1,200 + $1,050 - $2,000 = $250 = $50 + $200.
    const prices = {
      SPLT: history(
        ['100', '105', '110', '108', '120'],
        [{ date: '2024-01-04', numerator: 20, denominator: 1 }],
      ),
    }
    const holding = only(
      [buy('2024-01-02', 'SPLT', '1', '2000'), sell('2024-01-03', 'SPLT', '0.5', '1050')],
      prices,
    )

    expect(qty(holding.shares)).toBe('10.000000')
    expect(cents(holding.costBasis)).toBe('1000.00')
    expect(cents(holding.averageCost)).toBe('100.00')
    expect(cents(holding.realizedGain)).toBe('50.00')
    expect(cents(holding.currentValue)).toBe('1200.00')
    expect(cents(holding.unrealizedGain)).toBe('200.00')
    expect(cents(holding.totalGain)).toBe('250.00')
    expectGainIdentity(holding)
  })

  it('restates a holding through a 1-for-8 reverse split', () => {
    // RVRS closes are already restated upward by the reverse split: 8, 8.5, 9, 9.5, 10.
    // A 1-for-8 reverse split on 2024-01-04, so the ratio is 0.125.
    // Buy 800 shares on 2024-01-02 for $800 (the real price was $1, shown as $8 post-split).
    //   -> 800 x 0.125 = 100 shares today, $800 basis, $8 average.
    // Value 100 x $10 = $1,000; unrealized $200, and that is the whole gain.
    const prices = {
      RVRS: history(
        ['8', '8.5', '9', '9.5', '10'],
        [{ date: '2024-01-04', numerator: 1, denominator: 8 }],
      ),
    }
    const holding = only([buy('2024-01-02', 'RVRS', '800', '800')], prices)

    expect(qty(holding.shares)).toBe('100.000000')
    expect(cents(holding.averageCost)).toBe('8.00')
    expect(cents(holding.currentValue)).toBe('1000.00')
    expect(cents(holding.unrealizedGain)).toBe('200.00')
    expect(cents(holding.totalGain)).toBe('200.00')
    expectGainIdentity(holding)
  })

  it('counts a cash dividend as returned without touching basis', () => {
    // 10 shares for $1,000, then $25 paid out in cash.
    // Shares and basis unchanged. Value 10 x $200 = $2,000, unrealized $1,000.
    // Total = $2,000 + $25 - $1,000 = $1,025 = $1,000 unrealized + $25 dividends.
    const holding = only(
      [buy('2024-01-02', 'ACME', '10', '1000'), dividend('2024-01-05', 'ACME', '25')],
      {
        ACME,
      },
    )

    expect(qty(holding.shares)).toBe('10.000000')
    expect(cents(holding.costBasis)).toBe('1000.00')
    expect(cents(holding.dividendGain)).toBe('25.00')
    expect(cents(holding.returned)).toBe('25.00')
    expect(cents(holding.invested)).toBe('1000.00')
    expect(cents(holding.totalGain)).toBe('1025.00')
    expectGainIdentity(holding)
  })

  it('treats a reinvested dividend as a dividend plus a buy', () => {
    // M1 reports a reinvestment as two rows, so the $25 is both returned and re-invested.
    // 10 shares for $1,000, $25 dividend, then 0.125 shares for $25 at the $200 close.
    // Shares 10.125, basis $1,025, invested $1,025, returned $25.
    // Value 10.125 x $200 = $2,025; unrealized $2,025 - $1,025 = $1,000.
    // Total = $2,025 + $25 - $1,025 = $1,025 = $1,000 + $25.
    const holding = only(
      [
        buy('2024-01-02', 'ACME', '10', '1000'),
        dividend('2024-01-08', 'ACME', '25'),
        buy('2024-01-08', 'ACME', '0.125', '25'),
      ],
      { ACME },
    )

    expect(qty(holding.shares)).toBe('10.125000')
    expect(cents(holding.costBasis)).toBe('1025.00')
    expect(cents(holding.invested)).toBe('1025.00')
    expect(cents(holding.dividendGain)).toBe('25.00')
    expect(cents(holding.currentValue)).toBe('2025.00')
    expect(cents(holding.unrealizedGain)).toBe('1000.00')
    expect(cents(holding.totalGain)).toBe('1025.00')
    expectGainIdentity(holding)
  })

  it('files a renamed ticker’s whole history under the new symbol', () => {
    // OLD became NEW on 2024-01-04. Buy 5 OLD for $500, then 5 NEW for $600.
    // One holding: 10 shares, $1,100 basis, $110 average.
    // Value 10 x $200 = $2,000; unrealized $900, which is the whole gain.
    const aliases: TickerAlias[] = [
      { from_ticker: 'OLD', to_ticker: 'NEW', effective_date: '2024-01-04' },
    ]
    const holding = only(
      [buy('2024-01-02', 'OLD', '5', '500'), buy('2024-01-08', 'NEW', '5', '600')],
      { NEW: ACME },
      aliases,
    )

    expect(holding.ticker).toBe('NEW')
    expect(qty(holding.shares)).toBe('10.000000')
    expect(cents(holding.costBasis)).toBe('1100.00')
    expect(cents(holding.averageCost)).toBe('110.00')
    expect(holding.firstTradeDate).toBe('2024-01-02')
    expect(cents(holding.unrealizedGain)).toBe('900.00')
    expect(cents(holding.totalGain)).toBe('900.00')
    expectGainIdentity(holding)
  })

  it('pools one ticker held in two accounts into a single basis', () => {
    // Taxable buys 2 for $200; Roth buys 3 for $330 -> 5 shares, $530 basis, $106 average.
    // Roth sells 1 for $150: basis sold = $530 x 1/5 = $106, realized $44.
    // Left: 4 shares, $424 basis. Value 4 x $200 = $800; unrealized $376.
    // Total = $800 + $150 - $530 = $420 = $44 + $376.
    const holding = only(
      [
        buy('2024-01-02', 'ACME', '2', '200', 'taxable'),
        buy('2024-01-03', 'ACME', '3', '330', 'roth'),
        sell('2024-01-05', 'ACME', '1', '150', 'roth'),
      ],
      { ACME },
    )

    expect(holding.accounts).toEqual(['roth', 'taxable'])
    expect(qty(holding.shares)).toBe('4.000000')
    expect(cents(holding.costBasis)).toBe('424.00')
    expect(cents(holding.averageCost)).toBe('106.00')
    expect(cents(holding.realizedGain)).toBe('44.00')
    expect(cents(holding.unrealizedGain)).toBe('376.00')
    expect(cents(holding.totalGain)).toBe('420.00')
    expectGainIdentity(holding)
  })

  it('adds shares with no basis on a positive adjust', () => {
    // 10 shares for $1,000, then a transfer in kind brings 2 more.
    // 12 shares, basis still $1,000, so the average drops to $1,000/12 = $83.3333.
    // Value 12 x $200 = $2,400; unrealized $1,400, and invested stays $1,000.
    const holding = only(
      [buy('2024-01-02', 'ACME', '10', '1000'), adjust('2024-01-03', 'ACME', '2')],
      {
        ACME,
      },
    )

    expect(qty(holding.shares)).toBe('12.000000')
    expect(cents(holding.costBasis)).toBe('1000.00')
    expect(new Decimal(holding.averageCost!).toFixed(4)).toBe('83.3333')
    expect(cents(holding.invested)).toBe('1000.00')
    expect(cents(holding.currentValue)).toBe('2400.00')
    expect(cents(holding.totalGain)).toBe('1400.00')
    expectGainIdentity(holding)
  })

  it('writes basis off as a realized loss on a negative adjust', () => {
    // 10 shares for $1,000, then 4 leave with no proceeds (a merger handled by hand).
    // Basis removed = $1,000 x 4/10 = $400, booked as realized -$400.
    // Left: 6 shares, $600 basis. Value 6 x $200 = $1,200; unrealized $600.
    // Total = $1,200 + $0 - $1,000 = $200 = -$400 + $600, which is why the write-off
    // has to land in realized gain rather than vanishing.
    const holding = only(
      [buy('2024-01-02', 'ACME', '10', '1000'), adjust('2024-01-03', 'ACME', '-4')],
      {
        ACME,
      },
    )

    expect(qty(holding.shares)).toBe('6.000000')
    expect(cents(holding.costBasis)).toBe('600.00')
    expect(cents(holding.realizedGain)).toBe('-400.00')
    expect(cents(holding.unrealizedGain)).toBe('600.00')
    expect(cents(holding.totalGain)).toBe('200.00')
    expectGainIdentity(holding)
  })

  it('values the portfolio as of a past date, ignoring later trades', () => {
    // As of 2024-01-03 only the first buy has happened and the close is $110.
    // 2 shares, $200 basis, value $220, unrealized $20.
    const result = computeHoldings({
      transactions: [buy('2024-01-02', 'ACME', '2', '200'), buy('2024-01-05', 'ACME', '5', '750')],
      prices: { ACME },
      asOf: '2024-01-03',
    })

    expect(result.asOf).toBe('2024-01-03')
    expect(qty(result.byTicker[0].shares)).toBe('2.000000')
    expect(cents(result.byTicker[0].currentValue)).toBe('220.00')
    expect(cents(result.byTicker[0].unrealizedGain)).toBe('20.00')
  })

  it('prices a non-trading valuation date at the previous close', () => {
    // 2024-01-06 is a Saturday: the last close on or before it is Friday 2024-01-05, $150.
    const result = computeHoldings({
      transactions: [buy('2024-01-02', 'ACME', '2', '200')],
      prices: { ACME },
      asOf: '2024-01-06',
    })

    expect(result.byTicker[0].latestCloseDate).toBe('2024-01-05')
    expect(cents(result.byTicker[0].currentValue)).toBe('300.00')
  })

  it('reports a still-held ticker with no price instead of guessing one', () => {
    const result = computeHoldings({
      transactions: [buy('2024-01-02', 'ACME', '2', '200'), buy('2024-01-02', 'NOPX', '3', '300')],
      prices: { ACME },
    })

    expect(result.missingPrices).toEqual(['NOPX'])
    const nopx = result.byTicker.find((holding) => holding.ticker === 'NOPX')!
    expect(nopx.latestClose).toBeNull()
    expect(cents(nopx.currentValue)).toBe('0.00')
  })

  it('does not flag a missing price for a position that is already closed', () => {
    const result = computeHoldings({
      transactions: [buy('2024-01-02', 'GONE', '2', '200'), sell('2024-01-05', 'GONE', '2', '300')],
      prices: {},
      asOf: '2024-01-08',
    })

    // Bought for $200, sold for $300: the $100 realized gain is knowable with no price
    // at all, so a closed position must not drag the portfolio into "prices missing".
    expect(result.missingPrices).toEqual([])
    expect(cents(result.byTicker[0].realizedGain)).toBe('100.00')
  })

  it('sums the portfolio totals across tickers', () => {
    // ACME: 2 shares for $200, value 2 x $200 = $400.
    // RVRS: 800 shares for $800 -> 100 after the 1-for-8, value 100 x $10 = $1,000.
    // Invested $1,000, value $1,400, so total gain $400.
    const prices = {
      ACME,
      RVRS: history(
        ['8', '8.5', '9', '9.5', '10'],
        [{ date: '2024-01-04', numerator: 1, denominator: 8 }],
      ),
    }
    const result = computeHoldings({
      transactions: [
        buy('2024-01-02', 'ACME', '2', '200'),
        buy('2024-01-02', 'RVRS', '800', '800'),
      ],
      prices,
    })

    expect(result.byTicker.map((holding) => holding.ticker)).toEqual(['ACME', 'RVRS'])
    expect(cents(result.totals.invested)).toBe('1000.00')
    expect(cents(result.totals.currentValue)).toBe('1400.00')
    expect(cents(result.totals.unrealizedGain)).toBe('400.00')
    expect(cents(result.totals.totalGain)).toBe('400.00')
  })
})

// --- share series ---------------------------------------------------------------------

describe('sharesOn and sharesByDay', () => {
  const transactions = [
    buy('2024-01-02', 'ACME', '2', '200'),
    buy('2024-01-03', 'ACME', '3', '330'),
    sell('2024-01-05', 'ACME', '5', '750'),
  ]

  it('gives the shares held at the close of one day', () => {
    const adjusted = splitAdjustTransactions(transactions, { ACME })

    expect(sharesOn(adjusted, '2024-01-02').get('ACME')!.toFixed()).toBe('2')
    expect(sharesOn(adjusted, '2024-01-04').get('ACME')!.toFixed()).toBe('5')
    expect(sharesOn(adjusted, '2024-01-05').has('ACME')).toBe(false)
  })

  it('gives a series parallel to the price dates', () => {
    const adjusted = splitAdjustTransactions(transactions, { ACME })
    const series = sharesByDay(adjusted, DATES)

    expect(series.get('ACME')!.map((held) => held.toFixed())).toEqual(['2', '5', '5', '0', '0'])
  })

  it('carries a pre-split buy into post-split share counts for every day', () => {
    // One share bought before a 20-for-1 reads as 20 shares on every day, before and
    // after the split, because the whole series is stated in today's terms.
    const prices = {
      SPLT: history(
        ['100', '105', '110', '108', '120'],
        [{ date: '2024-01-04', numerator: 20, denominator: 1 }],
      ),
    }
    const adjusted = splitAdjustTransactions([buy('2024-01-02', 'SPLT', '1', '2000')], prices)
    const series = sharesByDay(adjusted, DATES)

    expect(series.get('SPLT')!.map((held) => held.toFixed())).toEqual([
      '20',
      '20',
      '20',
      '20',
      '20',
    ])
  })
})

// --- aliases --------------------------------------------------------------------------

describe('resolveTicker', () => {
  const aliases: TickerAlias[] = [
    { from_ticker: 'AAA', to_ticker: 'BBB', effective_date: '2020-06-01' },
    { from_ticker: 'BBB', to_ticker: 'CCC', effective_date: '2023-06-01' },
  ]

  it('follows a chain of renames', () => {
    expect(resolveTicker('AAA', '2019-01-01', aliases)).toBe('CCC')
  })

  it('leaves a transaction dated after the rename alone', () => {
    // A symbol freed by a rename can be reassigned to another company, so rows dated
    // after the effective date are taken at face value.
    expect(resolveTicker('AAA', '2021-01-01', aliases)).toBe('AAA')
  })

  it('renames on the effective date itself', () => {
    // The day of the rename could be reported under either symbol, so it is included in
    // the renamed range.
    expect(resolveTicker('AAA', '2020-06-01', [aliases[0]])).toBe('BBB')
  })

  it('stops instead of spinning on a cycle', () => {
    const cycle: TickerAlias[] = [
      { from_ticker: 'XXX', to_ticker: 'YYY', effective_date: '2024-12-31' },
      { from_ticker: 'YYY', to_ticker: 'XXX', effective_date: '2024-12-31' },
    ]
    expect(resolveTicker('XXX', '2024-01-01', cycle)).toBe('YYY')
  })
})

// --- split cross-check ----------------------------------------------------------------

describe('crossCheckSplits', () => {
  const prices = {
    SPLT: history(
      ['100', '105', '110', '108', '120'],
      [{ date: '2024-01-04', numerator: 20, denominator: 1 }],
    ),
  }

  it('says nothing when M1 and Yahoo agree', () => {
    expect(crossCheckSplits([splitRow('2024-01-04', 'SPLT', '20')], prices)).toEqual([])
  })

  it('reports a ratio disagreement', () => {
    const [found] = crossCheckSplits([splitRow('2024-01-04', 'SPLT', '10')], prices)

    expect(found).toMatchObject({ ticker: 'SPLT', m1Ratio: '10', yahooRatio: '20' })
    expect(found.reason).toContain('disagree')
  })

  it('reports a split Yahoo does not have', () => {
    const [found] = crossCheckSplits([splitRow('2024-01-03', 'SPLT', '20')], prices)

    expect(found).toMatchObject({ trade_date: '2024-01-03', yahooRatio: null })
    expect(found.reason).toContain('no split event')
  })

  it('says a split is unchecked when no price history was supplied', () => {
    const [found] = crossCheckSplits([splitRow('2024-01-04', 'ACME', '2')], prices)

    expect(found.reason).toContain('unchecked')
  })

  it('matches only the date when the M1 row has no ratio', () => {
    const [found] = crossCheckSplits([splitRow('2024-01-04', 'SPLT', null)], prices)

    expect(found).toMatchObject({ m1Ratio: null, yahooRatio: '20' })
    expect(found.reason).toContain('only the date')
  })

  it('ignores every row that is not a live split', () => {
    const rows = [
      buy('2024-01-02', 'SPLT', '1', '100'),
      { ...splitRow('2024-01-03', 'SPLT', '99'), excluded: true },
    ]
    expect(crossCheckSplits(rows, prices)).toEqual([])
  })
})
