import { describe, expect, it } from 'vitest'
import {
  HIDDEN_TICKERS_KEY,
  isHidden,
  parseHiddenTickers,
  serializeHiddenTickers,
  withHidden,
} from './hiddenTickers'

describe('parseHiddenTickers', () => {
  it('reads a JSON array, normalized', () => {
    expect(parseHiddenTickers('["beta","ACME","beta"," gamma "]')).toEqual([
      'ACME',
      'BETA',
      'GAMMA',
    ])
  })

  it('reads anything unusable as nothing hidden', () => {
    expect(parseHiddenTickers(undefined)).toEqual([])
    expect(parseHiddenTickers(null)).toEqual([])
    expect(parseHiddenTickers('')).toEqual([])
    expect(parseHiddenTickers('   ')).toEqual([])
    expect(parseHiddenTickers('not json')).toEqual([])
    expect(parseHiddenTickers('{"ACME":true}')).toEqual([])
    expect(parseHiddenTickers('[]')).toEqual([])
  })

  it('keeps only the string entries of a mixed array', () => {
    expect(parseHiddenTickers('["ACME",7,null,{"x":1},"beta"]')).toEqual(['ACME', 'BETA'])
  })
})

describe('serializeHiddenTickers', () => {
  it('round-trips through parse', () => {
    const raw = serializeHiddenTickers(['gamma', 'ACME', 'ACME'])
    expect(raw).toBe('["ACME","GAMMA"]')
    expect(parseHiddenTickers(raw)).toEqual(['ACME', 'GAMMA'])
  })

  it('is one meta key, so it needs no migration', () => {
    expect(HIDDEN_TICKERS_KEY).toBe('hidden_tickers')
  })
})

describe('withHidden', () => {
  it('adds and removes, case-insensitively, without duplicating', () => {
    expect(withHidden([], 'acme', true)).toEqual(['ACME'])
    expect(withHidden(['ACME'], 'ACME', true)).toEqual(['ACME'])
    expect(withHidden(['ACME', 'BETA'], 'acme', false)).toEqual(['BETA'])
    expect(withHidden(['ACME'], 'GAMMA', false)).toEqual(['ACME'])
  })

  it('leaves the input array alone', () => {
    const before = ['ACME']
    expect(withHidden(before, 'BETA', true)).toEqual(['ACME', 'BETA'])
    expect(before).toEqual(['ACME'])
  })

  it('ignores a blank ticker', () => {
    expect(withHidden(['ACME'], '  ', true)).toEqual(['ACME'])
  })
})

describe('isHidden', () => {
  it('matches regardless of case or padding', () => {
    expect(isHidden(['ACME'], 'acme')).toBe(true)
    expect(isHidden(['ACME'], ' ACME ')).toBe(true)
    expect(isHidden(['ACME'], 'BETA')).toBe(false)
    expect(isHidden([], 'ACME')).toBe(false)
  })
})
