import type { Transaction } from '../engine/types'
import type { ImportPlan, ImportRowReference } from '../engine/m1/resolve'

export type ImportDecision =
  { kind: 'accept' } | { kind: 'choose'; ticker: string } | { kind: 'ignore' }

export type ImportDecisions = Readonly<Record<string, ImportDecision>>

export interface ResolvedImportPlan {
  transactions: Transaction[]
  ignoredHashes: string[]
  unresolved: ImportRowReference[]
}

/**
 * Turns the resolver's evidence-backed plan plus explicit user decisions into the two writes
 * the import screen performs. It deliberately contains no financial logic: candidate
 * transactions come from the engine, and this layer only selects or ignores them.
 */
export function resolveImportPlan(
  plan: ImportPlan,
  decisions: ImportDecisions,
): ResolvedImportPlan {
  const transactions: Transaction[] = [...plan.fresh]
  const ignoredHashes = new Set<string>()
  const unresolved: ImportRowReference[] = []

  for (const fixed of plan.autoFixed) {
    if (fixed.transaction) transactions.push(fixed.transaction)
    else ignoredHashes.add(fixed.sourceRowHash)
  }

  for (const proposal of plan.proposals) {
    const decision = decisions[proposal.sourceRowHash]
    if (decision?.kind === 'accept') transactions.push(proposal.transaction)
    else if (decision?.kind === 'ignore') ignoredHashes.add(proposal.sourceRowHash)
    else unresolved.push(proposal)
  }

  for (const need of plan.needsYou) {
    const decision = decisions[need.sourceRowHash]
    if (decision?.kind === 'ignore' && need.sourceRowHash !== '') {
      ignoredHashes.add(need.sourceRowHash)
      continue
    }
    if (decision?.kind === 'choose') {
      const chosen = need.candidateTransactions?.find(
        (transaction) => transaction.ticker === decision.ticker,
      )
      if (chosen) {
        transactions.push(chosen)
        continue
      }
    }
    unresolved.push(need)
  }

  // A repeated file in the same picker can contribute the same row twice. Keep the Worker's
  // unique constraint as the source of truth, while ensuring this one request posts each hash
  // only once.
  const byHash = new Map(
    transactions.map((transaction) => [transaction.source_row_hash, transaction]),
  )
  return {
    transactions: [...byHash.values()],
    ignoredHashes: [...ignoredHashes].sort(),
    unresolved,
  }
}
