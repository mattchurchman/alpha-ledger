/**
 * Source-row hashes the owner explicitly chose to ignore during an M1 import.
 *
 * The set lives in `meta`, rather than a new table, because it is small configuration state
 * and therefore automatically follows the ledger through export and restore.
 */
export const IMPORT_IGNORED_HASHES_KEY = 'import_ignored_hashes'

function normalize(hashes: Iterable<string>): string[] {
  const set = new Set<string>()
  for (const hash of hashes) {
    const trimmed = hash.trim()
    if (trimmed !== '') set.add(trimmed)
  }
  return [...set].sort()
}

/** A missing or malformed preference is safer as an empty set than a broken import screen. */
export function parseImportIgnoredHashes(raw: string | null | undefined): string[] {
  if (typeof raw !== 'string' || raw.trim() === '') return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return normalize(parsed.filter((entry): entry is string => typeof entry === 'string'))
  } catch {
    return []
  }
}

export function serializeImportIgnoredHashes(hashes: Iterable<string>): string {
  return JSON.stringify(normalize(hashes))
}
