import { describe, expect, it } from 'vitest'
import {
  mergeHeldAndWatched,
  parseWatchlist,
  serializeWatchlist,
  WATCHLIST_KEY,
  withWatched,
} from './watchlist'
import type { PriceHistory } from '../engine/prices/types'

function history(close: string): PriceHistory {
  return {
    dates: ['2026-01-01', '2026-01-02'],
    close: ['1', close],
    adjClose: ['1', close],
    splits: [],
    dividends: [],
    asOf: '2026-01-02',
  }
}

describe('parseWatchlist', () => {
  it('reads a JSON array, normalized', () => {
    expect(parseWatchlist('["beta","ACME","beta"," gamma "]')).toEqual(['ACME', 'BETA', 'GAMMA'])
  })

  it('reads anything unusable as watching nothing', () => {
    expect(parseWatchlist(undefined)).toEqual([])
    expect(parseWatchlist(null)).toEqual([])
    expect(parseWatchlist('')).toEqual([])
    expect(parseWatchlist('not json')).toEqual([])
    expect(parseWatchlist('{"ACME":true}')).toEqual([])
    expect(parseWatchlist('[]')).toEqual([])
  })
})

describe('serializeWatchlist', () => {
  it('round-trips through parse', () => {
    const raw = serializeWatchlist(['gamma', 'ACME', 'ACME'])
    expect(raw).toBe('["ACME","GAMMA"]')
    expect(parseWatchlist(raw)).toEqual(['ACME', 'GAMMA'])
  })

  it('is one meta key, so it needs no migration', () => {
    expect(WATCHLIST_KEY).toBe('watchlist')
  })
})

describe('withWatched', () => {
  it('adds and removes, case-insensitively, without duplicating', () => {
    expect(withWatched([], 'acme', true)).toEqual(['ACME'])
    expect(withWatched(['ACME'], 'ACME', true)).toEqual(['ACME'])
    expect(withWatched(['ACME', 'BETA'], 'acme', false)).toEqual(['BETA'])
    expect(withWatched(['ACME'], 'GAMMA', false)).toEqual(['ACME'])
  })

  it('leaves the input array alone', () => {
    const before = ['ACME']
    expect(withWatched(before, 'BETA', true)).toEqual(['ACME', 'BETA'])
    expect(before).toEqual(['ACME'])
  })
})

describe('mergeHeldAndWatched', () => {
  it('held only: passes holdings through, unwatched', () => {
    const rows = mergeHeldAndWatched([{ ticker: 'ACME', latestClose: '10' }], [], [], {})
    expect(rows).toEqual([{ ticker: 'ACME', latestClose: '10', watching: false }])
  })

  it('watched only: looks up the latest stored close, flagged watching', () => {
    const rows = mergeHeldAndWatched([], ['BETA'], [], { BETA: history('5.50') })
    expect(rows).toEqual([{ ticker: 'BETA', latestClose: '5.50', watching: true }])
  })

  it('watched only, with no stored price yet: latestClose is null', () => {
    const rows = mergeHeldAndWatched([], ['BETA'], [], {})
    expect(rows).toEqual([{ ticker: 'BETA', latestClose: null, watching: true }])
  })

  it('both: held and watched tickers merge, sorted by ticker', () => {
    const rows = mergeHeldAndWatched([{ ticker: 'ZETA', latestClose: '20' }], ['ACME'], [], {
      ACME: history('3'),
    })
    expect(rows).toEqual([
      { ticker: 'ACME', latestClose: '3', watching: true },
      { ticker: 'ZETA', latestClose: '20', watching: false },
    ])
  })

  it('a ticker that is both held and watched shows once, as a holding', () => {
    const rows = mergeHeldAndWatched([{ ticker: 'ACME', latestClose: '10' }], ['ACME'], [], {
      ACME: history('11'),
    })
    expect(rows).toEqual([{ ticker: 'ACME', latestClose: '10', watching: false }])
  })

  it('hidden: a hidden watched ticker is left out entirely', () => {
    const rows = mergeHeldAndWatched([], ['ACME', 'BETA'], ['ACME'], {
      BETA: history('5'),
    })
    expect(rows).toEqual([{ ticker: 'BETA', latestClose: '5', watching: true }])
  })
})
