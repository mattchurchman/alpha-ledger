/** Synthetic data only. No database, private files, or market-data requests. */
import assert from 'node:assert/strict'
import type { BrowserContext, Page } from 'playwright-core'
import type { StoredPriceHistory, TransactionRow } from '../src/api/types.ts'

const dates: string[] = []
for (let time = Date.parse('2024-10-01'); time <= Date.parse('2026-10-01'); time += 86_400_000) {
  const day = new Date(time)
  if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) dates.push(day.toISOString().slice(0, 10))
}
const transactions: TransactionRow[] = [
  { ticker: 'DEMO', account_label: 'Demo growth' },
  { ticker: 'SAMPLE', account_label: 'Demo income' },
].map((row, index) => ({
  ...row,
  id: index + 1,
  trade_date: dates[0],
  type: 'buy',
  shares: '100',
  amount_usd: '10000',
  source: 'manual',
  source_row_hash: `dashboard-demo-${index}`,
  note: null,
  excluded: false,
}))
const history: StoredPriceHistory[] = [
  { ticker: 'DEMO', growth: 0.7 },
  { ticker: 'SAMPLE', growth: -0.1 },
  { ticker: 'VOO', growth: 0.25 },
].map(({ ticker, growth }) => {
  const close = dates.map((_, index) => {
    const progress = index / (dates.length - 1)
    return (100 * (1 + growth * progress + Math.sin(progress * 28) * 0.025)).toFixed(2)
  })
  return {
    ticker,
    fetched_at: '2026-10-01T20:00:00Z',
    source: 'manual',
    history: { dates, close, adjClose: close, splits: [], dividends: [], asOf: dates.at(-1)! },
  }
})

export async function mockDashboard(context: BrowserContext): Promise<void> {
  const responses: Record<string, unknown> = {
    '/api/session': { authenticated: true },
    '/api/transactions': transactions,
    '/api/price-history': history,
    '/api/aliases': [],
    '/api/meta': {},
    '/api/fair-values': [
      {
        id: 1,
        ticker: 'DEMO',
        value_usd: '190',
        effective_date: '2026-10-01',
        note: null,
        created_at: '2026-10-01T20:00:00Z',
      },
      {
        id: 2,
        ticker: 'SAMPLE',
        value_usd: '110',
        effective_date: '2026-10-01',
        note: null,
        created_at: '2026-10-01T20:00:00Z',
      },
    ],
  }
  await context.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    assert.equal(route.request().method(), 'GET', 'Preview must never write')
    assert.ok(path in responses, `Unexpected API request: ${path}`)
    await route.fulfill({ json: responses[path] })
  })
}

export async function checkDashboard(page: Page): Promise<void> {
  const hero = page.getByTestId('dashboard-returns')
  await hero.waitFor()
  const original = await hero.innerText()
  const chart = page.getByRole('application').first()
  const fullPath = await chart.locator('path').first().getAttribute('d')
  const range = page.getByRole('group', { name: 'History chart range only' })
  await range.getByRole('button', { name: '1M', exact: true }).click()
  assert.equal(await hero.innerText(), original, 'Chart range must not change all-time returns')
  assert.notEqual(
    await chart.locator('path').first().getAttribute('d'),
    fullPath,
    'Range must change plotted history',
  )
  await chart.focus()
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Show Value history as a table' }).click()
  assert.ok(await page.getByRole('table').first().isVisible())
  await page.getByRole('button', { name: 'Show Value history as a chart' }).click()
  await range.getByRole('button', { name: '1Y', exact: true }).click()
  await page.getByRole('button', { name: 'Demo income', exact: true }).click()
  assert.ok(page.url().includes('account=Demo+income'))
  await page.waitForFunction(
    `(previous) => document.querySelector('[data-testid="dashboard-returns"]')?.innerText !== previous`,
    original,
  )
  assert.notEqual(await hero.innerText(), original, 'Account selection must change returns')
  assert.ok((await hero.innerText()).includes('−'), 'Losing account must retain negative return')
  const accountFigures = await hero.innerText()
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(await hero.innerText(), accountFigures, 'Refresh must preserve selected account')
  await page.goBack({ waitUntil: 'networkidle' })
  await page.waitForFunction(
    `(expected) => document.querySelector('[data-testid="dashboard-returns"]')?.innerText === expected`,
    original,
  )
  assert.equal(await hero.innerText(), original, 'Back must restore all accounts')
  assert.ok(await page.getByRole('heading', { name: 'Rebuy opportunities', level: 2 }).isVisible())
  assert.ok(await page.getByRole('heading', { name: 'Holdings', exact: true }).isVisible())
  assert.equal(
    await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'),
    true,
    'Page must not overflow horizontally',
  )
  await page.evaluate('window.scrollTo(0, 0)')
  console.log(
    '  dashboard checks: range, table, keyboard, account, refresh, back, sections, width passed',
  )
}

/** Verify the newly prominent returns never turn unavailable values into zeroes. */
export async function checkDashboardEmptyStates(page: Page): Promise<void> {
  await page.route('**/api/transactions', (route) =>
    route.fulfill({ json: transactions.map((row) => ({ ...row, trade_date: dates.at(-1)! })) }),
  )
  await page.reload({ waitUntil: 'networkidle' })
  const hero = page.getByTestId('dashboard-returns')
  await hero.waitFor()
  assert.equal((await hero.innerText()).match(/—/g)?.length, 2, 'Same-day IRRs must be unavailable')
  assert.ok(!(await hero.innerText()).includes('0.0%'), 'Unavailable must never become zero')
  await page.route('**/api/price-history', (route) =>
    route.fulfill({ json: history.filter((row) => row.ticker !== 'SAMPLE') }),
  )
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByText('1 holding with no stored price, counted as $0').waitFor()
  await page.route('**/api/price-history', (route) => route.fulfill({ json: [] }))
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByText('No comparison yet', { exact: true }).waitFor()
  assert.equal(await hero.count(), 0)
  console.log('  dashboard edge checks: unavailable IRR, missing price, no comparison passed')
}
