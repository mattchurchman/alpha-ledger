/**
 * Prints what the parser makes of the real exports in private/m1/.
 * Terminal only: this reads personal data and must never write it anywhere.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { parseM1Activity, type ParseResult } from '../src/engine/m1/parse.ts'

const DIR = 'private/m1'

function csvFiles(dir: string): string[] {
  try {
    if (!statSync(dir).isDirectory()) return []
  } catch {
    return []
  }
  return readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.csv'))
    .sort()
    .map((name) => join(dir, name))
}

function tally(values: string[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

function report(file: string, result: ParseResult): void {
  const dates = result.transactions.map((t) => t.trade_date).sort()
  const range = dates.length > 0 ? `${dates[0]} to ${dates[dates.length - 1]}` : 'no dated rows'

  console.log(`\n${file}`)
  console.log(`  account label: ${basename(file, '.csv')}`)
  console.log(`  kept ${result.transactions.length} transactions (${range})`)
  for (const [type, count] of tally(result.transactions.map((t) => t.type))) {
    console.log(`    ${type.padEnd(9)} ${count}`)
  }

  console.log(`  dropped ${result.dropped.length} cash rows`)
  for (const [reason, count] of tally(result.dropped.map((d) => d.reason))) {
    console.log(`    ${reason.padEnd(14)} ${count}`)
  }

  console.log(`  tickers: ${new Set(result.transactions.map((t) => t.ticker)).size}`)

  if (result.unrecognized.length === 0) {
    console.log('  unrecognized: none')
    return
  }

  console.log(`  unrecognized: ${result.unrecognized.length}`)
  for (const row of result.unrecognized) {
    console.log(`    line ${row.line}: ${row.reason}`)
    console.log(`      ${JSON.stringify(row.fields)}`)
  }
}

const files = csvFiles(DIR)

if (files.length === 0) {
  console.log(`No CSV files in ${DIR}/.`)
  console.log('Download the activity CSV for each M1 account and save it there, named')
  console.log('after the account (for example private/m1/taxable.csv) — the filename')
  console.log('becomes the account label.')
  process.exit(0)
}

let unrecognized = 0

for (const file of files) {
  try {
    const result = parseM1Activity(readFileSync(file, 'utf8'), basename(file, '.csv'))
    unrecognized += result.unrecognized.length
    report(file, result)
  } catch (error) {
    console.log(`\n${file}`)
    console.log(`  FAILED: ${error instanceof Error ? error.message : String(error)}`)
    unrecognized++
  }
}

console.log(
  unrecognized === 0
    ? `\nAll ${files.length} file(s) parsed with zero unrecognized rows.`
    : `\n${unrecognized} row(s) across ${files.length} file(s) need classifying.`,
)
