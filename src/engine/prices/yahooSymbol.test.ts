import { describe, expect, it } from 'vitest'
import { yahooSymbol } from './yahooSymbol'

/**
 * Regression: task 25b, 2026-10-13. Running the real ledger through the price fetch left a
 * held share-class position unpriced, reported as `Unknown ticker`. It was not delisted -
 * Yahoo spells a share class `BRK-B` and M1 spells it `BRK.B`, and nothing converted between
 * them. An unpriced holding is valued at $0 (SPEC 6), so the position read as a near-total
 * loss. Synthetic symbols here; the shape is what matters, not the company.
 */
describe('yahooSymbol', () => {
  it('spells a share-class separator the way Yahoo does', () => {
    expect(yahooSymbol('ZZ.B')).toBe('ZZ-B')
  })

  it('leaves a plain symbol alone', () => {
    expect(yahooSymbol('ZZTOP')).toBe('ZZTOP')
  })

  it('leaves a symbol that already uses the dash alone', () => {
    expect(yahooSymbol('ZZ-B')).toBe('ZZ-B')
  })

  it('is idempotent, so a translated symbol can be translated again', () => {
    expect(yahooSymbol(yahooSymbol('ZZ.B'))).toBe(yahooSymbol('ZZ.B'))
  })

  it('uppercases, matching how tickers are stored', () => {
    expect(yahooSymbol('zz.b')).toBe('ZZ-B')
  })

  it('converts every dot, not only the first', () => {
    expect(yahooSymbol('ZZ.A.B')).toBe('ZZ-A-B')
  })
})
