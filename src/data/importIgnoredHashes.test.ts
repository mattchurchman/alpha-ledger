import { describe, expect, it } from 'vitest'
import {
  IMPORT_IGNORED_HASHES_KEY,
  parseImportIgnoredHashes,
  serializeImportIgnoredHashes,
} from './importIgnoredHashes'

describe('import ignored hashes', () => {
  it('normalizes, deduplicates and round-trips hashes without changing their case', () => {
    const raw = serializeImportIgnoredHashes([' hash-b ', 'hash-A', 'hash-b', ''])
    expect(raw).toBe('["hash-A","hash-b"]')
    expect(parseImportIgnoredHashes(raw)).toEqual(['hash-A', 'hash-b'])
  })

  it('treats missing or malformed values as no ignored rows', () => {
    expect(parseImportIgnoredHashes(undefined)).toEqual([])
    expect(parseImportIgnoredHashes('not json')).toEqual([])
    expect(parseImportIgnoredHashes('{"hash":true}')).toEqual([])
    expect(parseImportIgnoredHashes('["ok",7,null]')).toEqual(['ok'])
  })

  it('uses the documented meta key', () => {
    expect(IMPORT_IGNORED_HASHES_KEY).toBe('import_ignored_hashes')
  })
})
