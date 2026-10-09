/**
 * The whole chart library. Pure functions, no React, no DOM - docs/DESIGN.md section 5.1
 * records why there is no chart package behind this.
 *
 * Nothing here is financial math; it is pixel math on numbers the engine already computed
 * (CLAUDE.md keeps the money in `src/engine/`). Coordinates are SVG user units with y
 * growing downward, which is why the y scale's range is normally given bottom-first.
 */

export interface Point {
  x: number
  y: number
}

export interface Scale {
  (value: number): number
  invert(position: number): number
  readonly domain: readonly [number, number]
  readonly range: readonly [number, number]
}

export function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value
}

/** A degenerate domain maps everything to the middle of the range rather than dividing by 0. */
export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): Scale {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = d1 - d0
  const mid = (r0 + r1) / 2
  const scale = ((value: number) =>
    span === 0 ? mid : r0 + ((value - d0) / span) * (r1 - r0)) as {
    (value: number): number
    invert(position: number): number
    domain: readonly [number, number]
    range: readonly [number, number]
  }
  scale.invert = (position: number) =>
    r1 - r0 === 0 ? d0 : d0 + ((position - r0) / (r1 - r0)) * span
  scale.domain = domain
  scale.range = range
  return scale
}

/** `null` for an empty list or one with no finite value in it. */
export function extent(values: readonly number[]): [number, number] | null {
  let min = Infinity
  let max = -Infinity
  for (const value of values) {
    if (!Number.isFinite(value)) continue
    if (value < min) min = value
    if (value > max) max = value
  }
  return min === Infinity ? null : [min, max]
}

export interface DomainOptions {
  /** Headroom added to each end, as a fraction of the span. */
  pad?: number
  /** Stretch the domain to reach zero - right for value charts, wrong for price charts. */
  includeZero?: boolean
}

/**
 * Turns a raw extent into a plottable domain. A flat series (every value equal) would
 * otherwise collapse to a zero-height band, so it gets 10% of its own magnitude either side.
 */
export function paddedDomain(
  values: readonly number[],
  { pad = 0.08, includeZero = false }: DomainOptions = {},
): [number, number] {
  const found = extent(values)
  if (!found) return [0, 1]
  let [min, max] = found
  if (includeZero) {
    min = Math.min(min, 0)
    max = Math.max(max, 0)
  }
  if (min === max) {
    const nudge = Math.abs(min) * 0.1 || 1
    return [min - nudge, max + nudge]
  }
  const headroom = (max - min) * pad
  return [min - headroom, max + headroom]
}

/**
 * Round tick values inside the domain, stepping by 1, 2 or 5 times a power of ten - so an
 * axis reads 0 / 50K / 100K and never 0 / 47.3K / 94.6K.
 */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || count < 1) {
    return Number.isFinite(min) ? [min] : []
  }
  const rough = (max - min) / count
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalised = rough / magnitude
  const step = (normalised >= 5 ? 5 : normalised >= 2 ? 2 : 1) * magnitude
  const ticks: number[] = []
  // A hair of tolerance so a tick landing exactly on the domain edge is not lost to float error.
  const tolerance = step * 1e-9
  for (let tick = Math.ceil(min / step) * step; tick <= max + tolerance; tick += step) {
    ticks.push(Math.abs(tick) < tolerance ? 0 : tick)
  }
  return ticks
}

/** Two decimals is sub-pixel at any size we render and shortens the `d` string a lot. */
function round(value: number): number {
  return Math.round(value * 100) / 100
}

export function linePath(points: readonly Point[]): string {
  if (points.length === 0) return ''
  let path = `M${round(points[0].x)} ${round(points[0].y)}`
  for (let i = 1; i < points.length; i += 1) {
    path += `L${round(points[i].x)} ${round(points[i].y)}`
  }
  return path
}

/**
 * Step-after: hold the previous value until the next point's x, then jump. Correct for a
 * fair-value estimate, which is a level that stays put until you change it - a sloped line
 * between two estimates would claim a gradual revision that never happened.
 */
export function stepPath(points: readonly Point[]): string {
  if (points.length === 0) return ''
  let path = `M${round(points[0].x)} ${round(points[0].y)}`
  for (let i = 1; i < points.length; i += 1) {
    path += `L${round(points[i].x)} ${round(points[i - 1].y)}`
    path += `L${round(points[i].x)} ${round(points[i].y)}`
  }
  return path
}

/** A closed polygon between two same-length edges: along `top`, back along `bottom`. */
export function areaBetweenPath(top: readonly Point[], bottom: readonly Point[]): string {
  if (top.length === 0 || bottom.length === 0) return ''
  let path = linePath(top)
  for (let i = bottom.length - 1; i >= 0; i -= 1) {
    path += `L${round(bottom[i].x)} ${round(bottom[i].y)}`
  }
  return `${path}Z`
}

/** Total straight-line length, which is what the draw-in animation's dash offset needs. */
export function pathLength(points: readonly Point[]): number {
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  return total
}

/**
 * Min-max decimation: keep the lowest and highest point of each pixel column, plus the two
 * endpoints. Two points inside one column cannot both be seen, so the result is visually
 * identical to the input while being several times smaller - this is what keeps 1,500 daily
 * points smooth at 390px (docs/DESIGN.md section 5.2). Extremes survive exactly, which a
 * uniform stride would not guarantee.
 */
export function decimate(points: readonly Point[], columns: number): Point[] {
  if (columns < 1 || points.length <= 2 || points.length <= columns) return [...points]

  const first = points[0]
  const last = points[points.length - 1]
  const span = last.x - first.x || 1
  const out: Point[] = []

  const push = (point: Point) => {
    const previous = out[out.length - 1]
    if (!previous || previous.x !== point.x || previous.y !== point.y) out.push(point)
  }

  let bucket = -1
  let low: Point = first
  let high: Point = first
  const flush = () => {
    if (bucket < 0) return
    if (low.x <= high.x) {
      push(low)
      push(high)
    } else {
      push(high)
      push(low)
    }
  }

  for (const point of points) {
    const index = clamp(Math.floor(((point.x - first.x) / span) * columns), 0, columns - 1)
    if (index !== bucket) {
      flush()
      bucket = index
      low = point
      high = point
    } else {
      if (point.y < high.y) high = point
      if (point.y > low.y) low = point
    }
  }
  flush()

  // The endpoints anchor the line even if their column's extremes sat elsewhere.
  if (out.length > 0 && (out[0].x !== first.x || out[0].y !== first.y)) out.unshift(first)
  push(last)
  return out
}

/** Nearest by x in an ascending list. Binary search, so scrubbing stays O(log n) per frame. */
export function nearestIndex(xs: readonly number[], x: number): number {
  if (xs.length === 0) return -1
  let low = 0
  let high = xs.length - 1
  while (high - low > 1) {
    const mid = (low + high) >> 1
    if (xs[mid] > x) high = mid
    else low = mid
  }
  return x - xs[low] <= xs[high] - x ? low : high
}

/** Value at a fractional index, linearly interpolated. Used to meet a crossing exactly. */
export function valueAt(values: readonly number[], index: number): number {
  if (values.length === 0) return NaN
  const clamped = clamp(index, 0, values.length - 1)
  const lower = Math.floor(clamped)
  const upper = Math.min(lower + 1, values.length - 1)
  const fraction = clamped - lower
  return values[lower] + (values[upper] - values[lower]) * fraction
}

export interface GapRun {
  /** 1 where the first series is above the second (ahead), -1 where it is below. */
  sign: 1 | -1
  /** Ascending indices into both series. The first and last may be fractional crossings. */
  indices: number[]
}

function sign(value: number): -1 | 0 | 1 {
  return value > 0 ? 1 : value < 0 ? -1 : 0
}

/**
 * Splits two series into contiguous runs of constant sign, **interpolating the exact crossing
 * index** at every sign change. That is what lets the history chart's gap band be blue on one
 * side of a crossing and red on the other with no sliver of the wrong color at the join - the
 * two polygons share a vertex where the lines actually meet.
 *
 * Returns `[]` when the series never separate: there is no gap to shade.
 */
export function gapRuns(a: readonly number[], b: readonly number[]): GapRun[] {
  const length = Math.min(a.length, b.length)
  if (length === 0) return []

  const difference: number[] = new Array(length)
  for (let i = 0; i < length; i += 1) difference[i] = a[i] - b[i]

  let opening: -1 | 0 | 1 = 0
  for (let i = 0; i < length && opening === 0; i += 1) opening = sign(difference[i])
  if (opening === 0) return []

  const runs: GapRun[] = []
  let current: GapRun = { sign: opening, indices: [0] }

  for (let i = 0; i < length - 1; i += 1) {
    const next = sign(difference[i + 1])
    if (next !== 0 && next !== current.sign) {
      const crossing =
        difference[i] === 0 ? i : i + difference[i] / (difference[i] - difference[i + 1])
      if (current.indices[current.indices.length - 1] !== crossing) current.indices.push(crossing)
      runs.push(current)
      current = { sign: next, indices: [crossing, i + 1] }
    } else {
      current.indices.push(i + 1)
    }
  }
  runs.push(current)
  return runs.filter((run) => run.indices.length >= 2)
}

/**
 * Keeps the first and last index and an evenly spaced subset between them. Used on a gap run's
 * interior, where the crossings at the ends must stay exact but a 10%-opacity wash does not
 * need every point in the middle.
 */
export function thin(indices: readonly number[], max: number): number[] {
  if (max < 2 || indices.length <= max) return [...indices]
  const step = (indices.length - 1) / (max - 1)
  const out: number[] = []
  for (let i = 0; i < max - 1; i += 1) out.push(indices[Math.round(i * step)])
  out.push(indices[indices.length - 1])
  return out
}
