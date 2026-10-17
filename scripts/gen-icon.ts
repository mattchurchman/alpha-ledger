/**
 * Rasterize the home-screen artwork into every PNG the app references, so a palette change
 * never leaves the icons behind. Task 16 added the favicon and apple-touch sizes; task 22 added
 * the four manifest icons, which until then had been produced by hand.
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
const SIZES = [
  { size: 32, out: 'public/icons/icon-32.png', svg: 'public/brand/icon.svg' },
  { size: 180, out: 'public/icons/icon-180.png', svg: 'public/brand/icon-maskable.svg' },
  { size: 192, out: 'public/icons/app-192.png', svg: 'public/brand/icon-maskable.svg' },
  { size: 512, out: 'public/icons/app-512.png', svg: 'public/brand/icon-maskable.svg' },
  // The maskable pair carries its own artwork: the same drawing inset into the safe zone.
  { size: 192, out: 'public/icons/app-maskable-192.png', svg: 'public/brand/icon-maskable.svg' },
  { size: 512, out: 'public/icons/app-maskable-512.png', svg: 'public/brand/icon-maskable.svg' },
]

async function generateIcons() {
  const browser = await chromium.launch({ executablePath: CHROMIUM })
  const page = await browser.newPage()

  for (const { size, out, svg: svgPath } of SIZES) {
    const svg = readFileSync(resolve(svgPath), 'utf-8')
    const svgB64 = Buffer.from(svg).toString('base64')
    const dataUrl = `data:image/svg+xml;base64,${svgB64}`
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

generateIcons().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
