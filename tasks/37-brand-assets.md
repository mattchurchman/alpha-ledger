# Task 37 - Wire in the logo, icons and sign-in screen

**Model:** Sonnet. **Effort:** low. **Context budget:** ~45k.
**Runs on:** anywhere.
**Read:** `docs/BRAND.md`, `scripts/gen-icon.ts`, `public/manifest.json`, `index.html` (head),
`src/ui/AppShell.tsx`, `src/AuthGate.tsx`.

## Steps
1. `scripts/gen-icon.ts`: source the PNGs from `public/brand/icon-maskable.svg` (home-screen,
   apple-touch, maskable) and `public/brand/icon.svg` (favicon 32). Run `npm run icons:gen`.
   Delete `public/icon.svg` and `public/icon-maskable.svg` once nothing references them (Grep).
2. `index.html`: favicon → `/brand/favicon.svg` with the 32px PNG fallback; `theme-color` meta and
   `manifest.json` `theme_color`/`background_color` per task 36's tokens (navy for theme if the
   header is navy). Manifest description: "Did my stock picks beat the S&P 500?"
3. AppShell header: `lockup.svg` / `lockup-reverse.svg` by theme as an `<img>` with alt "Alpha
   Ledger", replacing the text title. Keep the header height and safe-area inset unchanged.
4. AuthGate: stacked lockup centred above the token field.
5. Bump the service-worker cache version so installed apps pick up the icons; add a line to
   `docs/INSTALL_IPHONE.md` that iOS caches the icon - remove and re-add the home-screen app.

## Out of scope
Palette (36), layout (39). Do not edit the SVGs in `public/brand/` - they are generated from
Geist outlines; ask the owner if one looks wrong.

## Acceptance
`npm run check` and `npm run build` pass; screenshots of header (light/dark) and sign-in at 390px.

**Next:** tasks/38-sp500-wording.md on Haiku (effort low) - budget ~40k.
