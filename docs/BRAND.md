# Alpha Ledger brand

Rev 3, from the owner's Concept 2 ("Ledger - real performance, no guesswork"). Review sheet:
`docs/brand/brand-sheet.png`. Assets: `public/brand/`.

## The mark

Two rising bars, then an **L**, then a small square above it: the **alpha tick**. The bars are
the portfolio growing; the L is the ledger; the tick is the bit above the benchmark - the one
number this app exists to measure. It is drawn on a 512 grid from rectangles only, so it stays
crisp at 16px.

## Files (`public/brand/`)

| File | Use |
|---|---|
| `icon.svg` | Favicon and in-app icon. Navy rounded tile; reads on light and dark browser chrome. `favicon.svg` is the same file. |
| `icon-maskable.svg` | Source for every PNG home-screen icon and the apple-touch icon. Full-bleed, mark inside the 80% safe zone. |
| `mark.svg` / `mark-reverse.svg` | Mark alone, for light / dark surfaces. |
| `wordmark.svg` / `wordmark-reverse.svg` | "AlphaLedger" alone. |
| `lockup.svg` / `lockup-reverse.svg` | Mark + wordmark, horizontal. App header. |
| `lockup-stacked*.svg` | With the tagline. Sign-in screen, splash, README. |

All text is outlined from **Geist** (SIL OFL 1.1, already bundled by the app), so the files need
no font. "Alpha" is weight 700, "Ledger" 500, tracking -2.5%. Tagline: Geist 500, caps, +22%.
In the app, set type in Geist as usual; use the SVG only for the logo itself.

## Colour

| Name | Hex | Role |
|---|---|---|
| Navy | `#0B1B3D` | Brand ink: "Alpha", the L, icon tile, app header in light mode |
| Royal | `#1F4FD8` | Brand accent: "Ledger", bars, tick; candidate for `--al-accent` |
| Sky | `#7FA2FF` | Royal's stand-in on navy and in dark mode |
| Mist | `#DCE3EC` | Rules, quiet fills |
| Paper | `#F5F7FA` | Light plane |
| Slate | `#5B6678` | Tagline, secondary ink |

These are **brand** colours. Whether Royal and Sky replace the in-app `--al-accent` pair
(`#0b67d9` / `#4e90f0`) is task 36's call, and only after the palette validator passes them
against the ahead/behind/benchmark set (DESIGN.md section 7). The brand never overrides the data
rules: ahead is blue, behind is red, the benchmark is graphite - not green, not orange.

## Don't

- Recolour the mark outside the pairs above, or put the light mark on navy.
- Stretch it, add gradients or shadows, or rebuild the wordmark from live text.
- Use the tagline smaller than 10px - drop it instead.
