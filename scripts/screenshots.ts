/**
 * Task 07's acceptance check: screenshot `/kit` at 390px and 1280px, in light and dark, and
 * look at the results.
 *
 * Builds nothing and serves nothing permanently - it starts `vite preview` against `dist/`,
 * shoots four full-page PNGs, and shuts the server down. Run `npm run build` first.
 *
 *   npm run screenshots              # -> screenshots/
 *   npm run screenshots -- --out tmp
 *
 * It uses `playwright-core` plus the browser already on this machine rather than Playwright's
 * own 150 MB download: `CHROMIUM=/path/to/chrome npm run screenshots` overrides the default.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { chromium, type Browser } from 'playwright-core'

const PORT = 4173
const URL = `http://localhost:${PORT}/kit`
const CHROMIUM = process.env.CHROMIUM ?? '/usr/bin/chromium'

const outIndex = process.argv.indexOf('--out')
const OUT_DIR = outIndex === -1 ? 'screenshots' : process.argv[outIndex + 1]

const SHOTS = [
  { name: 'kit-390-light', width: 390, height: 844, theme: 'light' },
  { name: 'kit-390-dark', width: 390, height: 844, theme: 'dark' },
  { name: 'kit-1280-light', width: 1280, height: 900, theme: 'light' },
  { name: 'kit-1280-dark', width: 1280, height: 900, theme: 'dark' },
] as const

function startPreview(): ChildProcess {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  server.stdout?.on('data', (chunk: Buffer) => process.stdout.write(`  preview: ${chunk}`))
  return server
}

async function waitForServer(timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(URL)
      if (response.ok) return
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`vite preview did not come up on port ${PORT}`)
}

async function shoot(browser: Browser, shot: (typeof SHOTS)[number]): Promise<void> {
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
   * Chromium asks for /favicon.ico on its own and there is no icon set yet - that is task 13's
   * deliverable, not a fault in the page.
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

  await page.goto(URL, { waitUntil: 'networkidle' })
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
