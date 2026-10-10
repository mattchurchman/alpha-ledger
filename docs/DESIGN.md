# Alpha Ledger design system

The look, the tokens, and the chart kit. Written by task 07; later screens are meant to be
assembly work against this file. If a screen needs something this file does not have, add it
here first.

The method behind the chart decisions is the `dataviz` skill's: pick the form, assign color by
the job it does, **validate the palette with a script rather than by eye**, then apply fixed
mark specs. Every palette claim below was produced by
`node scripts/validate_palette.js … --surface <ours>` against _our_ surfaces, not the skill's
defaults. Section 4 records the runs.

---

## 1. Direction: ledger paper and ink

The product answers one question - _did my picks beat buying VOO with the same dollars?_ - so
the design puts **one number and one shape** in front of you and keeps everything else quiet.

- **Warm paper, not a dark glass dashboard.** The page plane is a warm off-white; cards are a
  lighter paper laid on it with a hairline rule, no drop shadows. Dark mode is a warm near-black
  with the same hairlines. This is the thing that keeps it from looking like every SaaS dashboard.
- **Numbers are the typography.** Every figure that sits in a column - table cells, axis ticks,
  tooltip values, the ledger-ish rows - is set in **Geist Mono**, which is where the "ledger"
  reading comes from. Prose and the hero figure are **Geist** (proportional).
- **Column headings behave like a ledger book's**: 11.5px, uppercase, `0.08em` tracking, muted
  ink. They label; they never compete.
- **The gap band is the signature.** On the history chart the area between your line and VOO's
  is filled - blue where you are ahead, red where you are behind. It is the product's one
  distinctive shape, and it is also the headline number drawn to scale. Nothing else in the app
  gets a large filled area.
- **Deliberately avoided:** gradient hero cards, glassmorphism, neon-on-charcoal, donut rings,
  big saturated KPI tiles, drop shadows, dashed gridlines, emoji as iconography.

Non-goals for this file: real data, real screens, API calls (task 08 onward).

---

## 2. Color tokens

Declared in `src/index.css` as `--al-*` custom properties, then exposed to Tailwind through
`@theme inline` so utilities (`bg-surface`, `text-ink-muted`, `fill-viz-you`) resolve per theme
with no `dark:` variants anywhere in component code.

Three scopes, in this order (the pattern the skill prescribes):

1. `:root` - the complete **light** palette.
2. `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }` - OS dark.
3. `:root[data-theme='dark']` - the in-app toggle, which must win both ways.

No color is ever defined _only_ inside a media query.

### 2.1 Surfaces and ink

| Token                 | Role                     | Light     | Dark      |
| --------------------- | ------------------------ | --------- | --------- |
| `--al-plane`          | page plane               | `#f3f1e9` | `#0f100e` |
| `--al-surface`        | card / chart surface     | `#fcfbf7` | `#1a1b19` |
| `--al-surface-sunken` | input wells, table zebra | `#efece2` | `#141512` |
| `--al-ink`            | primary text             | `#14140f` | `#f7f6f1` |
| `--al-ink-secondary`  | secondary text           | `#4f4e46` | `#c0bfb4` |
| `--al-ink-muted`      | labels, axis text        | `#837f73` | `#8b8a80` |
| `--al-rule`           | hairline border          | `#ddd9cb` | `#2a2b27` |
| `--al-grid`           | gridlines                | `#e6e3d8` | `#2a2b27` |
| `--al-axis`           | baseline / axis rule     | `#c7c3b4` | `#3a3b36` |
| `--al-focus`          | focus ring               | `#2a78d6` | `#3987e5` |

Contrast on the card surface: ink 17.8:1 light / 16.0:1 dark, secondary 8.1 / 9.4, muted 3.9 /
5.0. Grid and axis are intentionally recessive (1.2-1.7:1) - they are chrome, not marks.

### 2.2 The one pair that matters: beat VOO vs trailed VOO

**Blue ahead, red behind.** Not green/red.

| Token              | Meaning                                           | Light     | Dark      |
| ------------------ | ------------------------------------------------- | --------- | --------- |
| `--al-viz-ahead`   | beat VOO (positive value added, discount, gain)   | `#2a78d6` | `#3987e5` |
| `--al-viz-behind`  | trailed VOO (negative value added, premium, loss) | `#e34948` | `#e66767` |
| `--al-viz-neutral` | the zero midpoint of any diverging scale          | `#ece9e0` | `#2e2f2b` |

Why not green/red, the finance convention: red-green is exactly the pair that collapses for the
~8% of men with protanopia or deuteranopia. Measured at our surfaces, green↔red is
**ΔE 7.2 under protanopia** - inside the 6-8 warn band, i.e. only legal at all if something
else carries the sign. Blue↔red, the skill's diverging pair (two poles that read as opposite
with a neutral gray between them), measures **ΔE 21.6 light / 19.2 dark** on the same scale -
better than twice the ΔE 8 target.

Sign is **never** carried by color alone. Every signed number ships as
`glyph + sign + value`: `▲ +$12,480` / `▼ −$3,140`, with an `aria-label` that spells it out
("ahead of VOO by $12,480"). Colorblind, grayscale-printed, and screen-reader readings all
survive losing the hue.

### 2.3 Series identity

| Token               | Series                              | Light     | Dark      | Notes                                     |
| ------------------- | ----------------------------------- | --------- | --------- | ----------------------------------------- |
| `--al-viz-you`      | your portfolio                      | `#2a78d6` | `#3987e5` | slot 1; same hue as _ahead_, deliberately |
| `--al-viz-voo`      | the VOO shadow                      | `#78766d` | `#9b9a92` | graphite **reference mark**, see below    |
| `--al-viz-estimate` | your fair-value estimate            | `#008300` | `#008300` | a level, never a direction                |
| `--al-viz-dim`      | de-emphasised line (sparkline body) | `#86b6ef` | `#1c5cab` | blue ramp steps 250 / 550                 |

**Why VOO is graphite and not a categorical hue.** VOO is the benchmark - the thing you are
measured against, like a target line - so it is drawn as a _reference mark_ rather than a
competing series. This is a deliberate departure from the chroma floor (C ≥ 0.10), which exists
so a hue can do identity work; graphite does identity work here by being _the only achromatic
line on the chart_, and the alternative was worse: the obvious second hue is orange, and
orange↔red fails both the CVD floor (ΔE 5.6) and the normal-vision floor (ΔE 7.1), so an
orange VOO line would be confusable with the red "behind" fill it sits inside. Secondary
encoding is heavy here anyway: a legend is always present, both lines carry direct end labels,
the crosshair readout names both, and the table view lists both columns. Contrast against the
card surface is 4.4:1 light / 6.1:1 dark, well past the 3:1 mark floor.

**Why the fair-value line is green**, given §2.2 bans green for direction: of the skill's
remaining eight hues, green was the only one that clears every **all-pairs** gate in both modes
alongside blue and red - no FAIL anywhere, and its one warn (green↔red ΔE 7.2 protan, light
only) applies to a pair that never appears in the same chart. Violet collapses against blue in
dark mode (ΔE 1.9 protan), yellow and magenta fail the normal-vision floor against red, and
aqua sits in the warn band in _both_ modes. The confusion risk is real and is managed by
keeping the two apart:
green appears **only** on the fair-value chart and the fair-value editor, the ahead/behind pair
appears only where a comparison is drawn, and the green line is always direct-labelled
"Fair value". Green is never used for a delta, a gain, or an arrow.

### 2.4 Status

Reserved; never reused as a series color. Always shipped with an icon _and_ a word.

| Token                  | Role     | Hex (both modes) | Used for                               |
| ---------------------- | -------- | ---------------- | -------------------------------------- |
| `--al-status-good`     | good     | `#0ca30c`        | import succeeded, reconciliation clean |
| `--al-status-warning`  | warning  | `#fab219`        | prices stale, shadow-coverage gaps     |
| `--al-status-serious`  | serious  | `#ec835a`        | per-ticker fetch failures              |
| `--al-status-critical` | critical | `#d03b3b`        | share count mismatch, restore failure  |

On the light surface `warning` (1.8:1) and `serious` (2.6:1) are sub-3:1 by design - the icon +
label pairing is the mitigation, never hue alone.

### 2.5 The sequential blue ramp

For the one place magnitude is encoded by lightness (meter tracks, future heat cells). Steps
from the skill's documented blue ramp; nothing eyeballed.

`100 #cde2fb` · `150 #b7d3f6` · `200 #9ec5f4` · `250 #86b6ef` · `300 #6da7ec` ·
`350 #5598e7` · `400 #3987e5` · `450 #2a78d6` · `500 #256abf` · `550 #1c5cab` ·
`600 #184f95` · `650 #104281` · `700 #0d366b`

---

## 3. Type, space, motion

### 3.1 Typeface

**Geist** (UI, prose, hero figures) and **Geist Mono** (anything that sits in a column).
Both SIL OFL 1.1, installed as `@fontsource-variable/geist` / `-mono` and `@import`ed in
`src/index.css`, so Vite fingerprints the `.woff2` files into `dist/assets/`.
**Nothing is fetched from a font CDN at runtime** - SPEC 10. Fontsource ships one `@font-face`
per unicode subset, so a browser downloads the latin subset only (~27 KB per family).

Figures: proportional by default. `font-variant-numeric: tabular-nums` (the `.tnum` utility)
**only** where numbers must align vertically - table columns, axis ticks, the decision list.
Never on the hero figure, where equal-width digits make `121` look loose.

### 3.2 Type scale

| Token         | Size / line                   | Weight | Use                                |
| ------------- | ----------------------------- | ------ | ---------------------------------- |
| `text-hero`   | 44/1.0 → 56/1.0 at ≥768px     | 600    | the one headline number per screen |
| `text-figure` | 28/1.1                        | 600    | stat-tile values                   |
| `text-h1`     | 24/1.2                        | 600    | screen title                       |
| `text-h2`     | 19/1.3                        | 600    | card title                         |
| `text-h3`     | 16/1.4                        | 600    | subsection                         |
| `text-body`   | 15/1.5                        | 400    | prose, table cells                 |
| `text-small`  | 13/1.45                       | 400    | secondary rows, tooltip labels     |
| `text-micro`  | 11.5/1.3, `0.08em`, uppercase | 500    | column headings, axis ticks, chips |

One hero figure per screen. More than one and neither is the headline.

### 3.3 Space and shape

4px base unit. Card padding 16px on phone, 20px at ≥768px. Page gutter 16px, never less -
that is the one rule that keeps 390px honest. Vertical rhythm between cards 16px, between
sections 28px. Radius: 12px cards, 8px controls and chips, 4px data-ends, 999px pills.
Hairline borders only (1px `--al-rule`); no shadows except the bottom sheet's backdrop.

Touch targets ≥44px tall. Tab-bar items ≥56px including the safe-area inset.

### 3.4 Motion

| What                                | Duration | Curve                      |
| ----------------------------------- | -------- | -------------------------- |
| hover / press / color state         | 120ms    | `ease-out`                 |
| bottom sheet, toast                 | 220ms    | `cubic-bezier(.2,.8,.2,1)` |
| chart line draw-in (once per mount) | 420ms    | `ease-out`                 |
| crosshair / scrub readout           | **0ms**  | -                          |

Scrubbing is never animated: a lagging crosshair feels broken. Under
`prefers-reduced-motion: reduce` the draw-in and both slides are dropped to a 1-frame opacity
change; nothing moves.

---

## 4. Number formatting

One module, `src/ui/format.ts`, and screens must not hand-roll any of it.

| Function          | Rule                                                                     | Examples                                   |
| ----------------- | ------------------------------------------------------------------------ | ------------------------------------------ |
| `money(v)`        | `$` + thousands separators, cents only below $1,000                      | `$0.42`, `$184.20`, `$1,284`, `$2,480,133` |
| `moneyExact(v)`   | always 2 dp - tables, tooltips, the decision list                        | `$1,284.07`                                |
| `moneyCompact(v)` | ≥ 10,000 → one decimal + K/M/B - phone tiles, compact deltas             | `$12.9K`, `$4.2M`, `$1.3B`                 |
| `moneyAxis(v)`    | axis ticks: `$0` at the baseline, no cents from $1 up, compact from $10K | `$0`, `$250`, `$40K`                       |
| `percent(v)`      | one decimal, always a sign for deltas                                    | `+12.4%`, `−3.0%`, `0.0%`                  |
| `signed(v, fmt)`  | `▲`/`▼` + U+2212 minus + formatted magnitude                             | `▲ +$12,480`                               |
| `shares(v)`       | up to 6 dp, trailing zeros trimmed                                       | `12`, `3.5`, `0.004219`                    |
| `dateShort(d)`    | `Mon D` within this year, else `Mon D, YYYY`                             | `Oct 3`, `Dec 31, 2024`                    |
| `relativeTime(d)` | for "updated …"                                                          | `just now`, `2h ago`, `3d ago`             |

Hard rules:

- **A real minus sign** (U+2212 `−`) in display, never a hyphen. Hyphens read as list bullets
  at 11.5px and never align in a mono column.
- **`—` (em dash) means "not available", and it is muted.** SPEC 6 says IRR and the percent gap
  show a dash rather than a guess when there is no sign change or shadow value ≤ 0. `format`
  returns `—` for `null`, `undefined`, and non-finite numbers, so a missing value can never
  render as `$0` or `NaN`.
- **Negative money keeps the sign outside the `$`**: `−$3,140`, not `$−3,140`.
- Rounding is display-only. Every value arriving here is already a `number` the engine
  produced; the UI never recomputes (CLAUDE.md).

---

## 5. The chart kit

### 5.1 Library choice: none - hand-rolled SVG on a tested geometry module

`src/ui/charts/geometry.ts` is ~200 lines of pure functions (scales, nice ticks, line/step/area
path builders, min-max decimation, binary-search nearest-index, ahead/behind run splitting),
unit-tested in `geometry.test.ts`. Components render SVG directly.

Why not a chart library:

| Candidate    | Why it lost                                                                                                                                                                                                                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Recharts** | ~450 KB before gzip and one React element per data point - 1,500 points is 1,500 components per line, which is exactly the phone budget this task has to protect. Its defaults are also the generic dashboard look the brief rules out, so most of the work would be overriding it.                         |
| **visx**     | The right primitives, but it _is_ d3 wrapped in React - at which point the only thing it adds over `geometry.ts` is scales and shapes, for ~40 KB and a second idiom in the codebase.                                                                                                                       |
| **uPlot**    | Genuinely the fastest (canvas, ~45 KB) and the only candidate that would win at 50k points. At 1,500 it wins nothing, and canvas costs the thing this app needs more: no DOM nodes to make accessible, no CSS custom properties, so theme switching and the token system would have to be re-plumbed in JS. |
| **Chart.js** | Canvas, same accessibility and theming problem, and the shaded-gap-split-by-sign fill is a custom plugin either way.                                                                                                                                                                                        |

What hand-rolling buys, concretely: the gap band split at every crossing, a crosshair that
snaps on touch, a step line with annotated markers, and a diverging bar with a rounded data-end
only at the tip are each ~20 lines here and each a fight with a library. Every mark is a styled
DOM node, so the `--al-*` tokens drive the charts directly and the light/dark swap is free. The
whole kit adds **0 KB of runtime dependencies**.

Revisit if a screen ever needs >20k points or real-time streaming. Neither is on the roadmap -
market data is fetched only when you tap Update (SPEC 8).

### 5.2 Performance: 1,500 daily points on a phone

Three mechanisms, in order of effect:

1. **Min-max decimation.** `decimate(points, columns)` keeps the first, last, minimum and
   maximum point of each pixel column. At 390px wide that turns 1,566 trading days into ≲700
   points with the extremes preserved exactly - a line that is visually identical because two
   points inside one pixel column cannot both be seen. Sub-pixel noise is what makes SVG line
   charts slow, and this deletes it.
2. **Paths are memoised** on `(data, width, height)`, so scrubbing never rebuilds a `d`
   attribute. A scrub re-renders only the crosshair line, two dots and the readout.
3. **One path per line, one per fill run.** No per-point DOM. A 1,500-point series is 4-6 SVG
   nodes, not 1,500.

Width comes from a `ResizeObserver` (`useElementWidth`), so there is no resize-listener thrash
and the chart is correct inside the bottom sheet too.

### 5.3 Fixed mark specs

Taken from the skill and applied everywhere without exception:

- **Lines** 2px, round join and cap.
- **Markers / end dots** r = 4 (8px), filled with the series color, with a **2px ring in the
  surface color** so they stay legible where they cross another line. The ring is part of the
  hit target.
- **Bars** ≤ 24px thick - never fill the band, let the leftover be air. **4px rounded data-end
  at the tip, square at the baseline.** A ≥ 2px surface gap between adjacent bars, created by
  band padding, never by a stroke around the bar.
- **Area fills** the series hue at ~10% opacity. A wash, never a block.
- **Gridlines and axes** solid 1px hairlines in `--al-grid` / `--al-axis`. Never dashed.
- **Text never wears the series color.** Values and labels use ink tokens; identity comes from
  a colored dot or line-key beside the text. The one exception is a label _inside_ a filled
  mark, which picks white or ink by the fill's luminance.
- **Label selectively.** End labels, the extreme, the scrubbed point. Never a number on every
  point.
- **Text over the plot wears a halo.** The `.chart-label` utility sets `paint-order: stroke`
  with a 3px stroke in the surface colour, so a direct label stays readable where it crosses a
  line. That is what lets `You` and `VOO` sit next to their own line ends instead of being
  nudged away from the thing they label.
- **Axis labels are unambiguous.** Both ends of a time axis carry the year (`dateFull`); the
  middle label is dropped below a 320px plot, where it collides with the left one at 390px.

### 5.4 Interaction

- **Crosshair finds the X** on every time-series chart: a vertical hairline snaps to the
  nearest trading day, and **one readout lists every series** at that date, so the pointer
  never has to land on a line. Values lead, series names follow, each keyed by a short stroke
  of its color.
- **Touch scrubbing** is the primary input, not an afterthought: `pointerdown`/`pointermove`
  with `touch-action: none` on the plot only, so the page still scrolls vertically from
  anywhere else. A touch is offset-corrected so the readout is not under the thumb.
- **Keyboard**: the plot is `tabbable` with `role="application"`; ← → step one day, Home/End
  jump to the ends, Escape clears. Focus shows exactly what hover shows.
- **Bars and markers own their hit target**, ≥ 24px, with a hover lift. No crosshair there.
- **Tooltips enhance, never gate.** Every chart has a **table view** toggle rendering a real
  `<table>` of the same numbers - which is also the relief channel for any sub-3:1 fill, and
  the accessible twin of every chart in the kit.
- **Loading holds the frame**: a refetching chart keeps its previous render at 55% opacity with
  `aria-busy`. Skeletons appear only on a first load, never on a refresh.

### 5.5 The components

All in `src/ui/`, all demoed at `/kit` against synthetic data from `src/kit/synthetic.ts`.

| Component                                | Form                       | Encoding                                                                                                                                                           |
| ---------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `StatTile`                               | figure                     | label · value · optional `SignedDelta` · optional sparkline · footnote. `hero` variant for the one headline number.                                                |
| `SignedDelta`                            | figure                     | glyph + sign + value, `ahead`/`behind` hue, spelled-out `aria-label`. `goodWhenUp={false}` for the cases where down is good.                                       |
| `HistoryChart`                           | two lines + diverging area | you (blue) vs VOO (graphite); the gap filled blue where ahead, red where behind, **split at every crossing**. Crosshair, touch scrub, table view.                  |
| `DivergingBars`                          | diverging bars             | value creators and destroyers across every ticker ever held; blue right of zero, red left, neutral zero rule. Sorted by magnitude, top-N on phone with "Show all". |
| `DiscountMeter`                          | meter                      | discount vs your fair value. Neutral track, boundary ticks at −15 / 0 / +15%, fill from zero in the pole hue, zone name as text. `—` when there is no estimate.    |
| `StepLineChart`                          | line + step overlay        | price (blue) with the fair-value history as a **step-after** line (green) and a marker at each change carrying its note.                                           |
| `Sparkline`                              | line                       | 2px dim-blue line, accent end dot, no axes. Decorative only - the value is always beside it.                                                                       |
| `DataTable`                              | table                      | sortable (`aria-sort`), `tnum` columns, zebra rows. **Collapses to one card per row below 640px** - via CSS, not a resize listener.                                |
| `BottomSheet`                            | overlay                    | phone-first modal: `role="dialog"`, Escape, backdrop click, focus moved in and returned, safe-area padding. Centers as a card on desktop.                          |
| `Toast`                                  | overlay                    | `ToastProvider` + `useToast()`; `role="status"`, `aria-live="polite"`, auto-dismiss, stacked, status token + icon + word.                                          |
| `ChartFrame`                             | wrapper                    | title, subtitle, legend, table-view toggle, `busy` dimming, empty state. Every chart is wrapped in it so the chrome is identical.                                  |
| `EmptyState` / `Skeleton` / `StaleBadge` | states                     | one line of copy plus the one action that fixes it.                                                                                                                |

### 5.6 App shell

`src/ui/AppShell.tsx`.

- **Phone**: a bottom tab bar, `env(safe-area-inset-bottom)` honoured, 5 destinations
  (Dashboard · Fair values · Activity · Import · Settings). Stock detail is a pushed screen, so
  it is not a tab. Icons are inline 1.5px-stroke SVG - no icon package, nothing fetched.
- **Desktop ≥768px**: the tab bar becomes a 232px left side rail with the same destinations and
  the same active treatment (a 2px `--al-viz-you` edge and ink-weight change, never color
  alone).
- **Header** carries the screen title and the **"prices as of" slot**: `Prices as of Oct 3 ·
updated 2h ago`, in micro muted ink, with a `StaleBadge` (warning icon + the word "Stale")
  when the last close is more than 5 trading days old. Task 09 fills this from real metadata;
  the shell just owns the slot.
- **Help** (`/help`) sits in the header rather than becoming a sixth destination: six tab-bar
  items at 390px squeeze each one toward the 44px floor, and the five in `destinations.ts` are
  the ones you move between all day. Below 640px the link is the icon alone, like the theme
  toggle beside it (`aria-label` carries the name); from 640px it is icon + word. A screen that
  needs to send someone to the guide links to `/help` directly - Settings does.
- **Theme toggle** in the header cycles system → light → dark, persisted in `localStorage`
  under `al.theme` and applied as `data-theme` on `<html>`. It is the only thing in the app
  that writes to `localStorage`.
- `viewport-fit=cover` is set in `index.html` so the insets are real.

---

### 5.7 Checking it

`npm run build && npm run screenshots` writes four full-page PNGs of `/kit` to `screenshots/`
(gitignored) - 390px and 1280px, light and dark. The script starts and stops its own
`vite preview`, fails on any console error or failed request, and drives the Chromium already
on the machine through `playwright-core` rather than pulling Playwright's own ~150 MB browser
(`CHROMIUM=/path/to/chrome` overrides). Look at the four images before calling a change done -
the palette validator checks colour, not layout.

## 6. Accessibility checklist

Every screen built on this kit must keep all of these true:

- Signed values carry glyph + sign, so no meaning is hue-only.
- Two or more series ⇒ a legend is present, and lines are direct-labelled at their ends.
- Every chart has a table-view twin.
- Status colors ship with an icon and a word.
- Focus is visible everywhere (`--al-focus`, 2px offset ring), and the chart plot is focusable
  and arrow-scrubbable.
- Hit targets ≥ 44px for controls, ≥ 24px for marks.
- `prefers-reduced-motion` removes motion rather than shortening it.
- Dark mode is a **selected** palette validated against the dark surface, not an inverted
  light one.

## 7. Validator runs behind the palette

Script: `node scripts/validate_palette.js` from the `dataviz` skill, `--surface` set to ours.

| Run                                                                  | Result                                                                                  |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `#2a78d6,#008300,#e34948 --mode light --surface #fcfbf7 --pairs all` | ALL PASS - worst pair ΔE 7.2 CVD (warn band, secondary encoding shipped), 29.0 normal   |
| `#3987e5,#008300,#e66767 --mode dark --surface #1a1b19 --pairs all`  | ALL PASS - worst pair ΔE 8.6 CVD, 29.0 normal                                           |
| `#2a78d6,#eb6834,#e34948 --mode light` (orange VOO)                  | **FAIL** - orange↔red ΔE 5.6 CVD / 7.1 normal. Why VOO is graphite.                     |
| `#2a78d6,#4a3aa7,#e34948 --mode dark` (violet estimate)              | **FAIL** - violet↔blue ΔE 1.9 protan / 9.8 normal. Why the estimate line is not violet. |
| text contrast, all ink tokens on both surfaces                       | see §2.1; everything ≥ 3.9:1                                                            |

Re-run these before changing any color token. The claim is the script's, not anyone's eye.
