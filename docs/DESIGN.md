# Alpha Ledger design system

The look, the tokens, and the chart kit. Written by task 07; later screens are meant to be
assembly work against this file. If a screen needs something this file does not have, add it
here first.

The method behind the chart decisions is the `dataviz` skill's: pick the form, assign color by
the job it does, **validate the palette with a script rather than by eye**, then apply fixed
mark specs. Section 7 records the current validator, thresholds, surfaces and runs.

---

## 1. Direction: calm, confident, current

The product answers one question - _did my picks beat buying VOO with the same dollars?_ - so
the design puts **one number and one shape** in front of you and keeps everything else quiet.
The approved Rev 3 identity is documented in [`BRAND.md`](BRAND.md); these UI tokens translate
its Navy, Royal, Sky, Mist, Paper and Slate into accessible app surfaces and data marks.

- **Paper and Navy surfaces, lifted with one soft card elevation.** The light page plane is brand
  Paper; cards are true white. Dark mode uses a deep navy-tinted plane and card rather than a
  neutral charcoal. Every card uses the same 16px radius and `--al-shadow-card` plus a Mist-derived
  hairline. `--al-brand-surface` reserves brand Navy for the header and hero treatments.
- **One confident accent.** Royal in light mode and Sky in dark mode, via `--al-accent` (the same
  blue as "ahead of VOO"), does double duty
  as the interactive color - primary buttons, the active tab, focus rings, links - so the app
  has one color that means "this is alive," rather than every surface competing for attention.
  A 10%-mix wash of it (`--al-accent-wash`) marks an active control's background.
- **Numbers still align in columns.** Every figure that sits in a column - table cells, axis
  ticks, tooltip values - stays in **Geist Mono**; the "ledger" alignment discipline survives
  even though the paper-and-ink surface it was named for did not. Prose and the hero figure stay
  **Geist** (proportional).
- **The gap band is still the signature.** On the history chart the area between your line and
  VOO's is filled - blue where you are ahead, red where you are behind. It is the product's one
  distinctive shape and the headline number drawn to scale. Nothing else in the app gets a large
  filled area.
- **Deliberately avoided:** gradient hero cards, glassmorphism, neon-on-charcoal, donut rings,
  big saturated KPI tiles, dashed gridlines, emoji as iconography, a second accent hue.

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

| Token                    | Role                                                | Light     | Dark      |
| ------------------------ | --------------------------------------------------- | --------- | --------- |
| `--al-plane`             | page plane                                          | `#f5f7fa` | `#081225` |
| `--al-surface`           | card / chart surface                                | `#ffffff` | `#111c2e` |
| `--al-surface-sunken`    | input wells, table zebra                            | `#edf1f6` | `#0c1626` |
| `--al-brand-surface`     | app header / hero                                   | `#0b1b3d` | `#0b1b3d` |
| `--al-brand-surface-ink` | text on brand surface                               | `#ffffff` | `#ffffff` |
| `--al-ink`               | primary text                                        | `#0b1b3d` | `#f5f7fa` |
| `--al-ink-secondary`     | secondary text                                      | `#5b6678` | `#b7c1cf` |
| `--al-ink-muted`         | labels, axis text                                   | `#626d80` | `#8794a8` |
| `--al-rule`              | hairline border                                     | `#dce3ec` | `#2d3a50` |
| `--al-grid`              | gridlines                                           | `#e7ebf1` | `#223048` |
| `--al-axis`              | baseline / axis rule                                | `#c8d0db` | `#485975` |
| `--al-focus`             | focus ring                                          | `#1f4fd8` | `#7fa2ff` |
| `--al-accent`            | the one interactive hue                             | `#1f4fd8` | `#7fa2ff` |
| `--al-accent-ink`        | text/icon on `--al-accent`                          | `#ffffff` | `#0b1b3d` |
| `--al-accent-wash`       | active-control background (`color-mix`, 10% accent) | -         | -         |

Contrast on the card surface: ink 17.0:1 light / 15.9:1 dark, secondary 5.8 / 9.4, muted 5.2 /
5.6. Across plane, card and sunken surfaces, the weakest text pair is 4.61:1. White on Navy is
17.0:1. Grid and axis are intentionally recessive - they are chrome, not marks. Cards use the
single soft `--al-shadow-card`; the raised and sheet shadows remain interaction/overlay states,
not competing card styles. Hairlines stay where shadows do not communicate structure (table
rows and dividers).

### 2.2 The one pair that matters: beat VOO vs trailed VOO

**Blue ahead, red behind.** Not green/red.

| Token              | Meaning                                           | Light     | Dark      |
| ------------------ | ------------------------------------------------- | --------- | --------- |
| `--al-viz-ahead`   | beat VOO (positive value added, discount, gain)   | `#1f4fd8` | `#7fa2ff` |
| `--al-viz-behind`  | trailed VOO (negative value added, premium, loss) | `#d7393b` | `#e4605b` |
| `--al-viz-neutral` | the zero midpoint of any diverging scale          | `#e3e8ef` | `#1c2940` |

Why not green/red, the finance convention: red-green is exactly the pair that collapses for the
~8% of men with protanopia or deuteranopia. Royal/Sky versus red remains the diverging pair (two
poles that read as opposite with a neutral gray between them). The task 36 fallback validator
measures the pair at **ΔE00 48.07 light / 42.47 dark** in the worst full CVD simulation and
**43.39 / 41.49** unsimulated, well above its ΔE00 8 CVD and 15 normal floors.

Sign is **never** carried by color alone. Every signed number ships as
`glyph + sign + value`: `▲ +$12,480` / `▼ −$3,140`, with an `aria-label` that spells it out
("ahead of VOO by $12,480"). Colorblind, grayscale-printed, and screen-reader readings all
survive losing the hue.

### 2.3 Series identity

| Token               | Series                              | Light     | Dark      | Notes                                                                |
| ------------------- | ----------------------------------- | --------- | --------- | -------------------------------------------------------------------- |
| `--al-viz-you`      | your portfolio                      | `#1f4fd8` | `#7fa2ff` | slot 1; same hue as _ahead_, deliberately; same hue as `--al-accent` |
| `--al-viz-voo`      | the VOO shadow                      | `#71767e` | `#969ca4` | graphite **reference mark**, see below                               |
| `--al-viz-estimate` | your fair-value estimate            | `#008b74` | `#00ab92` | a level, never a direction                                           |
| `--al-viz-dim`      | de-emphasised line (sparkline body) | `#73a3eb` | `#1d60bc` | blue ramp steps 2 / 2 (light) and 2 (dark), see 2.5                  |

**Why VOO is graphite and not a categorical hue.** VOO is the benchmark - the thing you are
measured against, like a target line - so it is drawn as a _reference mark_ rather than a
competing series. This is a deliberate departure from the chroma floor (C ≥ 0.10), which exists
so a hue can do identity work; graphite does identity work here by being _the only achromatic
line on the chart_. A categorical hue would compete with the directional blue/red pair, while
graphite stays visibly separate from both in the task 36 checks. Secondary encoding is heavy
here anyway: a legend is always present, both lines carry
direct end labels, the crosshair readout names both, and the table view lists both columns.
Contrast against the card surface is 4.57:1 light / 6.17:1 dark, past the 3:1 mark floor. In the
ahead/behind/benchmark triples, the weakest separation is ΔE00 22.43 normal / 16.24 CVD in light
and 17.55 / 17.62 in dark, so graphite remains distinct without pretending to be a categorical hue.

**Why the fair-value line is a teal-green, not pure green**, given §2.2 bans green for direction:
`#008b74` / `#00ab92` reads less like a status-good color while keeping the same job - a level,
not a direction. Re-run against the Royal/Sky ahead/behind pair, the worst CVD separation is
ΔE00 15.98 light / 10.34 dark and the worst normal separation is 42.61 / 36.39. Green is still never
used for a delta, a gain, or an arrow - only this one level.

### 2.4 Status

Reserved; never reused as a series color. Always shipped with an icon _and_ a word. Status now
has its own light/dark values rather than one hex for both modes, so each clears 3:1 on its own
surface without the icon-only mitigation the old warm palette needed.

| Token                  | Role     | Light     | Dark      | Used for                               |
| ---------------------- | -------- | --------- | --------- | -------------------------------------- |
| `--al-status-good`     | good     | `#119245` | `#54b66e` | import succeeded, reconciliation clean |
| `--al-status-warning`  | warning  | `#a7760f` | `#ddb049` | prices stale, shadow-coverage gaps     |
| `--al-status-serious`  | serious  | `#cd570f` | `#ef8448` | per-ticker fetch failures              |
| `--al-status-critical` | critical | `#cc2823` | `#ea6b5e` | share count mismatch, restore failure  |

Contrast vs the card surface: good 4.02:1 / 6.75:1, warning 4.01:1 / 8.44:1, serious 4.23:1 /
6.56:1, critical 5.39:1 / 5.50:1 - all at or above the 3:1 mark floor in both modes. The icon + word
pairing stays mandatory regardless; it is what carries status to a colorblind or grayscale
reading, not what fixes contrast.

### 2.5 The sequential blue ramp

For the one place magnitude is encoded by lightness (`DiscountMap`'s tiles, meter tracks). Seven
steps, one hue, each mode its own selected ramp (dark is not light inverted - see DESIGN 6) with
the ink that clears 4.5:1 shipped per step so a label on a tile never has to guess:

Light: `1 #97b8e8` (ink `#0b1b3d`) · `2 #73a3eb` (`#0b1b3d`) · `3 #4d8eee` (`#0b1b3d`) ·
`4 #1069da` (`#ffffff`) · `5 #0c58b9` (`#ffffff`) · `6 #094798` (`#ffffff`) ·
`7 #04377a` (`#ffffff`)

Dark: `1 #074da5` (`#f5f7fa`) · `2 #1d60bc` (`#f5f7fa`) · `3 #5f89c7` (`#0b1b3d`) ·
`4 #749dd9` (`#0b1b3d`) · `5 #88b1ee` (`#0b1b3d`) · `6 #a1c6fd` (`#0b1b3d`) ·
`7 #c4dbfc` (`#0b1b3d`)

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
sections 28px. Radius: 16px cards, 10px controls and chips, 8px tiles, 4px data-ends, 999px
pills. Cards sit on a soft shadow (`--al-shadow-card`, `-raised` on hover/press, `-sheet` under
the bottom sheet) plus a 1px `--al-rule` hairline, rather than the hairline alone.

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
- **Axis labels are unambiguous, and adapt to the window.** `HistoryChart` picks the format from
  the selected range (`src/ui/charts/chartRange.ts`): 6 months or less shows day and month
  (`monthDay`) - close enough together that the year is never in question - and past that it
  shows month and year (`monthYear`) instead, since a day is too fine to read at that scale and
  the year is what actually tells the two ends apart. The middle label is dropped below a 320px
  plot, where it collides with the left one at 390px.

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

| Component                                | Form                       | Encoding                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StatTile`                               | figure                     | label · value · optional `SignedDelta` · optional sparkline · footnote. `hero` variant for the one headline number.                                                                                                                                                                                                                                                                                                    |
| `SignedDelta`                            | figure                     | glyph + sign + value, `ahead`/`behind` hue, spelled-out `aria-label`. `goodWhenUp={false}` for the cases where down is good.                                                                                                                                                                                                                                                                                           |
| `HistoryChart`                           | two lines + diverging area | you (blue) vs VOO (graphite); the gap filled blue where ahead, red where behind, **split at every crossing**. Crosshair, touch scrub, table view.                                                                                                                                                                                                                                                                      |
| `RangeSelector`                          | segmented control          | 1W/1M/3M/6M/YTD/1Y/3Y/All for `HistoryChart`'s window; horizontally scrollable at 44px targets rather than shrinking below the floor at 390px.                                                                                                                                                                                                                                                                         |
| `AccountSwitcher`                        | segmented control          | "All accounts" plus one stop per `account_label`, same form and 44px scrolling row as `RangeSelector`. Renders **nothing** below two accounts - there is no view to switch to.                                                                                                                                                                                                                                         |
| `AccountStrip`                           | list of rows               | one tappable line per account carrying two figures - value + `SignedDelta` on the Dashboard, shares + value on stock detail. 44px targets, long names truncate, the second column fixed-width so it lines up. `selected` marks the view you are in (`aria-current`).                                                                                                                                                   |
| `DivergingBars`                          | diverging bars             | value creators and destroyers across every ticker ever held; blue right of zero, red left, neutral zero rule. Sorted by magnitude, top-N on phone with "Show all".                                                                                                                                                                                                                                                     |
| `DiscountMeter`                          | meter                      | discount vs your fair value. Neutral track, boundary ticks at −15 / 0 / +15%, fill from zero in the pole hue, zone name as text. `—` when there is no estimate.                                                                                                                                                                                                                                                        |
| `RebuyBars`                              | diverging bars, compact    | task 21's thirty-tickers-at-a-glance read of Rebuy opportunities: one `min-h-11` row per ticker, a two-sided bar from a fair-value centre line (`divergingSpan`, `geometry.ts`), clamped at `range` with a marker past it. Sorted by discount, top-8 on phone with "Show all". Row tap opens stock detail; a sibling Edit control (never nested in the row's own button) opens `FairValueSheet`.                       |
| `DiscountMap`                            | sized tiles                | the same ranked tickers as `RebuyBars`, toggled to tiles sized by position value (`tileSizes`, `geometry.ts` - area, not side length, proportional to value) and shaded by discount on the DESIGN 2.5 blue ramp (`rampStepFor`) rather than a second, red-tinted one. A watched ticker gets the fixed small outlined tile - it has no position to size by.                                                             |
| `AllocationStrip`                        | stacked bar                | current value by holding, one segment each, width proportional to share. No categorical palette (DESIGN 2.3 defines series by role, not by ticker) - every segment is `--al-viz-you`; identity comes from a direct label on a wide-enough segment, the hairline gap between segments, and the table twin. No donuts (DESIGN section 1).                                                                                |
| `FairValueSheet`                         | overlay (form)             | task 21's shared fast-entry sheet: decimal-keypad field focused on open, Enter (native form submit) saves, a live discount preview from `discountFrom`, "Save and next" walking a caller-supplied queue of no-estimate tickers. Opened from a rebuy row's Edit control, a "No estimate yet" pill, the whole row on Fair values, and stock detail's Set value. Holds no API call itself - `onSave` is wired per screen. |
| `StepLineChart`                          | line + step overlay        | price (blue) with the fair-value history as a **step-after** line (green) and a marker at each change carrying its note.                                                                                                                                                                                                                                                                                               |
| `Sparkline`                              | line                       | 2px dim-blue line, accent end dot, no axes. Decorative only - the value is always beside it.                                                                                                                                                                                                                                                                                                                           |
| `DataTable`                              | table                      | sortable (`aria-sort`), `tnum` columns, zebra rows. **Collapses to one card per row below 640px** - via CSS, not a resize listener. An optional `rowAction` renders one control per row _outside_ the select target - its own cell in the table, a footer under the card on a phone - because the whole card is a `<button>` when rows are selectable and a control inside it would be unreachable.                    |
| `BottomSheet`                            | overlay                    | phone-first modal: `role="dialog"`, Escape, backdrop click, focus moved in and returned, safe-area padding. Centers as a card on desktop. An optional `initialFocus` ref sends focus straight to a form field instead of the panel - `FairValueSheet` uses it.                                                                                                                                                         |
| `Toast`                                  | overlay                    | `ToastProvider` + `useToast()`; `role="status"`, `aria-live="polite"`, auto-dismiss, stacked, status token + icon + word.                                                                                                                                                                                                                                                                                              |
| `ChartFrame`                             | wrapper                    | title, subtitle, legend, table-view toggle, `busy` dimming, empty state. Every chart is wrapped in it so the chrome is identical.                                                                                                                                                                                                                                                                                      |
| `EmptyState` / `Skeleton` / `StaleBadge` | states                     | one line of copy plus the one action that fixes it.                                                                                                                                                                                                                                                                                                                                                                    |

### 5.6 App shell

`src/ui/AppShell.tsx`.

- **Phone**: a bottom tab bar, `env(safe-area-inset-bottom)` honoured, 5 destinations
  (Dashboard · Fair values · Activity · Import · Settings). Stock detail is a pushed screen, so
  it is not a tab. Icons (`src/ui/icons.tsx`, task 22) are inline 1.5px-stroke SVG with a
  **duotone active state** - the same glyph gains a filled variant - no icon package, nothing
  fetched.
- **Desktop ≥768px**: the tab bar becomes a 248px left side rail with the same destinations.
  Task 22 replaced the left-edge border active treatment with an `--al-accent-wash` background
  behind the active row, the glyph's filled duotone variant, and an ink-weight change on the
  label - still never color alone, since the glyph shape itself changes.
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
- The app has **one** interactive accent (`--al-accent`); a screen that needs a new colored
  control uses it, not a second hue.

## 7. Validator runs behind the palette

Script: **`npm run palette`** (`scripts/validate_palette.mjs`). It reads the hexes straight out
of `src/index.css`, so this table can never drift from what ships, and it exits non-zero if any
row fails. The `dataviz` skill's own validator is not installed on this machine; this is its
allowed fallback, using WCAG 2 relative luminance for contrast and CIEDE2000 after
full-severity protan, deutan and tritan simulation for pair separation. Floors: 4.5:1 text,
3:1 non-text marks, ΔE00 15 normal and 8 CVD for any pair that must read as distinct. Standard,
reproducible math - but its ΔE numbers are not comparable to the rows this table carried before
task 36, so task 36 replaced rather than mixed the result sets.

| Run                                                              | Result                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Royal / red / teal on `#ffffff`                                  | **PASS** - worst pair ΔE00 42.61 normal / 15.98 CVD; weakest mark contrast 4.25:1 |
| Sky / red / teal on `#111c2e`                                    | **PASS** - worst pair ΔE00 36.39 normal / 10.34 CVD; weakest mark contrast 4.98:1 |
| Royal / red / graphite on `#ffffff`                              | **PASS** - worst pair ΔE00 22.43 normal / 16.24 CVD; graphite contrast 4.57:1     |
| Sky / red / graphite on `#111c2e`                                | **PASS** - worst pair ΔE00 17.55 normal / 17.62 CVD; graphite contrast 6.17:1     |
| Royal / red alone on `#ffffff`                                   | **PASS** - ΔE00 43.39 normal / 48.07 CVD; both marks ≥ 4.63:1                     |
| Sky / red alone on `#111c2e`                                     | **PASS** - ΔE00 41.49 normal / 42.47 CVD; both marks ≥ 4.98:1                     |
| Light ink / secondary / muted on plane, card and sunken surfaces | **PASS** - all nine pairs ≥ 4.61:1                                              |
| Dark ink / secondary / muted on plane, card and sunken surfaces  | **PASS** - all nine pairs ≥ 5.56:1                                              |
| White on Navy; accent on plane; accent ink on accent, both modes | **PASS** - weakest pair 6.18:1                                                  |
| Status colors on their card surface, both modes                  | **PASS** - weakest mark 4.01:1 light / 5.50:1 dark                              |
| Seven ramp inks on their steps, both modes                       | **PASS** - weakest label 5.18:1 light / 4.76:1 dark                             |

Run `npm run palette` before changing any color token, and again after. The claim is the
calculation, not anyone's eye; visual screenshot review remains a separate acceptance check.
The validator also re-checks the green/red convention section 2.2 rejects, and still measures it
as a CVD failure (ΔE00 6.11 light / 5.21 dark, under the 8 floor) - that row is expected to fail
and is reported as such.
