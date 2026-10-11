/**
 * Task 16's favicon/apple-touch-icon fix: rasterize public/icon.svg into the PNG fallbacks
 * index.html references, so the existing artwork - not a new icon - backs the browser tab and
 * the iPhone home screen.
 *
 *   npm run icons:gen
 *
 * Uses `playwright-core` plus the browser already on this machine, same as screenshots.ts:
 * `CHROMIUM=/path/to/chrome npm run icons:gen` overrides the default.
 */

import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { resolve } from 'node:path'

const CHROMIUM = process.env.CHROMIUM ?? '/usr/bin/chromium'
const SVG_PATH = resolve('public/icon.svg')
const SIZES = [
  { size: 32, out: 'public/icons/icon-32.png' },
  { size: 180, out: 'public/icons/icon-180.png' },
]

async function generateIcons() {
  const browser = await chromium.launch({ executablePath: CHROMIUM })
  const page = await browser.newPage()

  // Read the SVG once.
  const svg = readFileSync(SVG_PATH, 'utf-8')
  const svgB64 = Buffer.from(svg).toString('base64')
  const dataUrl = `data:image/svg+xml;base64,${svgB64}`

  for (const { size, out } of SIZES) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`
      <html style="margin:0;padding:0;width:${size}px;height:${size}px">
        <body style="margin:0;padding:0;width:${size}px;height:${size}px">
          <img src="${dataUrl}" style="width:${size}px;height:${size}px;display:block;object-fit:contain;" />
        </body>
      </html>
    `)

    const path = resolve(out)
    await page.screenshot({
      path,
      type: 'png',
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    })
    console.log(`Generated ${path}`)
  }

  await browser.close()
}

generateIcons().catch(console.error)
