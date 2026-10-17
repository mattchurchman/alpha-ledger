/** Read-only production smoke check; dashboard API responses are synthetic and intercepted. */
import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'
import { mockDashboard, checkDashboard, checkDashboardEmptyStates } from './dashboard-preview.ts'

// Usage: node scripts/release-smoke.ts https://your-worker.workers.dev /tmp/release-smoke
const origin = new URL(process.argv[2]).origin
const output = process.argv[3] ?? '/tmp/alpha-ledger-release-smoke'
await mkdir(output, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium' })
try {
  const context = await browser.newContext({ serviceWorkers: 'block' })
  try {
    for (const path of ['/api/session', '/api/transactions', '/api/export', '/api/health']) {
      const response = await context.request.get(`${origin}${path}`)
      assert.equal(response.status(), 401, `Signed-out ${path} must be protected`)
    }
    for (const asset of [
      'manifest.json',
      'sw.js',
      'brand/favicon.svg',
      'brand/lockup.svg',
      'brand/lockup-reverse.svg',
      'brand/lockup-stacked.svg',
      'brand/lockup-stacked-reverse.svg',
      'icons/icon-180.png',
      'icons/app-192.png',
      'icons/app-512.png',
      'icons/app-maskable-192.png',
      'icons/app-maskable-512.png',
    ]) {
      const response = await context.request.get(`${origin}/${asset}`)
      assert.equal(response.status(), 200, `Missing deployed asset: ${asset}`)
      assert.deepEqual(await response.body(), await readFile(`public/${asset}`), asset)
    }
    console.log('Live auth protection and deployed brand/icon assets passed')
  } finally {
    await context.close()
  }

  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark'] as const) {
      for (const demo of [false, true]) {
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 900 },
          colorScheme: theme,
          serviceWorkers: 'block',
        })
        try {
          await context.addInitScript(`localStorage.setItem('al.theme', '${theme}')`)
          if (demo) await mockDashboard(context)
          const page = await context.newPage()
          const errors: string[] = []
          page.on('pageerror', (error) => errors.push(error.message))
          page.on('console', (message) => {
            if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
              errors.push(message.text())
            }
          })
          page.on('requestfailed', (request) => errors.push(`Failed: ${request.url()}`))
          page.on('response', (response) => {
            const path = new URL(response.url()).pathname
            if (response.status() >= 400 && path !== '/favicon.ico' &&
                !(path === '/api/session' && !demo && response.status() === 401)) {
              errors.push(`${response.status()} ${path}`)
            }
          })
          await page.goto(origin, { waitUntil: 'networkidle' })
          if (demo) await checkDashboard(page)
          else await page.getByLabel('Access token').waitFor()
          const logo = page.getByRole('img', { name: 'Alpha Ledger', exact: true }).first()
          assert.ok(await logo.isVisible(), 'Brand lockup must be visible')
          assert.equal(
            await page.evaluate(
              `Array.from(document.querySelectorAll('img[alt="Alpha Ledger"]'))
                .filter(img => img.getClientRects().length > 0)
                .every(img => img.complete && img.naturalWidth > 0)`,
            ),
            true,
            'Visible brand images must load',
          )
          await page.evaluate('document.fonts.ready')
          await page.waitForTimeout(700)
          const path = `${output}/${demo ? 'dashboard' : 'signin'}-${width}-${theme}.png`
          await page.screenshot({ path, fullPage: true })
          if (demo) await checkDashboardEmptyStates(page)
          assert.deepEqual(errors, [], 'Browser errors')
          console.log(`Passed: ${path}`)
        } finally {
          await context.close()
        }
      }
    }
  }
} finally {
  await browser.close()
}
