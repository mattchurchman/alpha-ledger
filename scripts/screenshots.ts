/**
 * Task 07's acceptance check, widened by task 22: screenshot each route at 390px and 1280px, in
 * light and dark, and look at the results.
 *
 * Builds nothing and serves nothing permanently - it starts `vite preview` against `dist/`,
 * shoots four full-page PNGs per route, and shuts the server down. Run `npm run build` first.
 *
 *   npm run screenshots                        # /kit, / and Import v2 -> screenshots/
 *   npm run screenshots -- --route /fair-values
 *   npm run screenshots -- --route /kit --server vite
 *   npm run screenshots -- --out tmp
 *
 * `--route` may be repeated and replaces the default list. A route's file-name stem is the path
 * with slashes turned into dashes (`/` itself becomes `home`), so the four shots of a route sit
 * together alphabetically.
 *
 * Every route but `/kit` reads the API, so the default server is `wrangler dev` (which serves
 * `dist/` *and* answers `/api/*`, and needs `.dev.vars` - see docs/SETUP.md). `--server vite`
 * forces the lighter `vite preview`, which is all `/kit` needs since it runs on synthetic data.
 *
 * It uses `playwright-core` plus the browser already on this machine rather than Playwright's
 * own 150 MB download: `CHROMIUM=/path/to/chrome npm run screenshots` overrides the default.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { chromium, type Browser } from 'playwright-core'

const PORT = 4173
const ORIGIN = `http://localhost:${PORT}`
const CHROMIUM = process.env.CHROMIUM ?? '/usr/bin/chromium'

const outIndex = process.argv.indexOf('--out')
const OUT_DIR = outIndex === -1 ? 'screenshots' : process.argv[outIndex + 1]

/** The component kit, Dashboard, and task 34's full-export decision plan. */
const DEFAULT_ROUTES = ['/kit', '/', '/import']
const routeArgs = process.argv.flatMap((arg, index) =>
  arg === '--route' ? [process.argv[index + 1]] : [],
)
const ROUTES = routeArgs.length > 0 ? routeArgs : DEFAULT_ROUTES

const serverIndex = process.argv.indexOf('--server')
const SERVER =
  serverIndex === -1
    ? ROUTES.every((route) => route === '/kit')
      ? 'vite'
      : 'wrangler'
    : process.argv[serverIndex + 1]
if (SERVER !== 'vite' && SERVER !== 'wrangler') {
  throw new Error(`--server must be "vite" or "wrangler", got ${SERVER}`)
}

/** `/` -> `home`, `/fair-values` -> `fair-values`, `/stocks/GOOD` -> `stocks-GOOD`. */
function stemFor(route: string): string {
  const trimmed = route.replace(/^\/+|\/+$/g, '')
  return trimmed === '' ? 'home' : trimmed.replace(/\//g, '-')
}

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
] as const
const THEMES = ['light', 'dark'] as const

interface Shot {
  name: string
  route: string
  width: number
  height: number
  theme: (typeof THEMES)[number]
}

const SHOTS: Shot[] = ROUTES.flatMap((route) =>
  VIEWPORTS.flatMap(({ width, height }) =>
    THEMES.map((theme) => ({
      name: `${stemFor(route)}-${width}-${theme}`,
      route,
      width,
      height,
      theme,
    })),
  ),
)

function startPreview(): ChildProcess {
  const command =
    SERVER === 'wrangler'
      ? ['wrangler', 'dev', '--port', String(PORT), '--local']
      : ['vite', 'preview', '--port', String(PORT), '--strictPort']
  const server = spawn('npx', command, { stdio: ['ignore', 'pipe', 'inherit'] })
  server.stdout?.on('data', (chunk: Buffer) => process.stdout.write(`  ${SERVER}: ${chunk}`))
  return server
}

async function waitForServer(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${ORIGIN}${ROUTES[0]}`)
      if (response.ok) return
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`${SERVER} did not come up on port ${PORT}`)
}

async function shoot(browser: Browser, shot: Shot): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: 2,
    // Both halves: the OS preference *and* the stored choice, so each shot is unambiguous.
    colorScheme: shot.theme,
  })
  await context.addInitScript(`localStorage.setItem('al.theme', '${shot.theme}')`)

  const page = await context.newPage()
  const problems: string[] = []
  /**
   * Chromium asks for /favicon.ico on its own. `index.html` points at the SVG and PNG icons
   * instead, so the bare `.ico` is absent by design, not a fault in the page.
   */
  const isFavicon = (url: string) => url.includes('favicon.ico')

  page.on('console', (message) => {
    // A failed request also arrives as a console error, but without the URL. The `response`
    // listener below reports the same failure *with* it, so this drops the duplicate rather
    // than hiding anything: a real missing asset still fails the run, named.
    const text = message.text()
    const isBareLoadFailure = text.startsWith('Failed to load resource:')
    if (message.type() === 'error' && !isBareLoadFailure) problems.push(text)
  })
  page.on('pageerror', (error) => problems.push(String(error)))
  page.on('response', (response) => {
    if (response.status() >= 400 && !isFavicon(response.url())) {
      problems.push(`${response.status()} ${response.url()}`)
    }
  })
  page.on('requestfailed', (request) => {
    if (!isFavicon(request.url())) problems.push(`failed ${request.url()}`)
  })

  await page.goto(`${ORIGIN}${shot.route}`, { waitUntil: 'networkidle' })
  if (shot.route === '/import') {
    await page
      .locator('input[type="file"][accept=".csv"]')
      .setInputFiles('tests/fixtures/m1/full-export-v2.csv')
    await page.getByLabel('Account label').fill('taxable')
    await page.getByText('full-export-v2.csv').waitFor()
  }
  // Passed as a string, not a closure: this file is typechecked without the DOM lib (it runs in
  // node), and the expression is evaluated in the page.
  await page.evaluate('document.fonts.ready')
  // The chart draw-in is 420ms; shoot after it has settled.
  await page.waitForTimeout(700)

  const path = `${OUT_DIR}/${shot.name}.png`
  await page.screenshot({ path, fullPage: true })
  console.log(`  ${path}`)

  if (problems.length > 0) {
    console.error(`  !! console errors on ${shot.name}:`)
    for (const problem of problems) console.error(`     ${problem}`)
    process.exitCode = 1
  }

  await context.close()
}

async function main(): Promise<void> {
  if (!existsSync('dist/index.html')) {
    throw new Error('dist/ is missing or empty - run `npm run build` first')
  }
  mkdirSync(OUT_DIR, { recursive: true })

  console.log(`serving dist/ with ${SERVER}`)
  const server = startPreview()
  let browser: Browser | undefined
  try {
    await waitForServer()
    browser = await chromium.launch({ executablePath: CHROMIUM })
    for (const shot of SHOTS) await shoot(browser, shot)
  } finally {
    await browser?.close()
    server.kill('SIGTERM')
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
