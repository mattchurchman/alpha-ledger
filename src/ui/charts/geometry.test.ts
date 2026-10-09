import { describe, expect, it } from 'vitest'
import {
  areaBetweenPath,
  clamp,
  decimate,
  extent,
  gapRuns,
  linePath,
  linearScale,
  nearestIndex,
  niceTicks,
  paddedDomain,
  pathLength,
  stepPath,
  thin,
  valueAt,
  type Point,
} from './geometry'

describe('linearScale', () => {
  it('maps the domain onto the range and back', () => {
    const scale = linearScale([0, 100], [0, 200])
    expect(scale(0)).toBe(0)
    expect(scale(50)).toBe(100)
    expect(scale(100)).toBe(200)
    expect(scale.invert(100)).toBe(50)
  })

  it('handles an inverted range, which is how every y axis is built', () => {
    const y = linearScale([0, 10], [100, 0])
    expect(y(0)).toBe(100)
    expect(y(10)).toBe(0)
    expect(y(5)).toBe(50)
    expect(y.invert(50)).toBe(5)
  })

  it('puts a flat domain in the middle of the range instead of dividing by zero', () => {
    const scale = linearScale([7, 7], [0, 100])
    expect(scale(7)).toBe(50)
    expect(Number.isFinite(scale(9))).toBe(true)
  })
})

describe('extent and paddedDomain', () => {
  it('ignores non-finite values', () => {
    expect(extent([3, NaN, 1, Infinity, 9])).toEqual([1, 9])
    expect(extent([])).toBeNull()
    expect(extent([NaN])).toBeNull()
  })

  it('adds headroom at both ends', () => {
    expect(paddedDomain([0, 100], { pad: 0.1 })).toEqual([-10, 110])
  })

  it('can stretch to zero for value charts', () => {
    expect(paddedDomain([40, 60], { pad: 0, includeZero: true })).toEqual([0, 60])
    expect(paddedDomain([40, 60], { pad: 0 })).toEqual([40, 60])
  })

  it('gives a flat series a band to live in', () => {
    const [low, high] = paddedDomain([50, 50, 50])
    expect(low).toBeLessThan(50)
    expect(high).toBeGreaterThan(50)
  })

  it('survives an all-zero series', () => {
    expect(paddedDomain([0, 0])).toEqual([-1, 1])
  })
})

describe('niceTicks', () => {
  it('steps by 1, 2 or 5 times a power of ten', () => {
    expect(niceTicks(0, 100, 4)).toEqual([0, 20, 40, 60, 80, 100])
    expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10])
    expect(niceTicks(0, 250_000, 4)).toEqual([0, 50_000, 100_000, 150_000, 200_000, 250_000])
  })

  it('still lands on round numbers below 1', () => {
    const ticks = niceTicks(0, 1, 4)
    expect(ticks).toHaveLength(6)
    ticks.forEach((tick, i) => expect(tick).toBeCloseTo(i * 0.2, 10))
  })

  it('stays inside the domain', () => {
    const ticks = niceTicks(37, 212, 4)
    expect(ticks[0]).toBeGreaterThanOrEqual(37)
    expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(212)
  })

  it('snaps a float-error zero to exactly zero', () => {
    expect(niceTicks(-100, 100, 4)).toContain(0)
    expect(niceTicks(-100, 100, 4).filter((t) => Object.is(t, -0))).toEqual([])
  })

  it('refuses to invent an axis for a degenerate domain', () => {
    expect(niceTicks(5, 5)).toEqual([5])
    expect(niceTicks(NaN, 10)).toEqual([])
  })
})

describe('path builders', () => {
  const points: Point[] = [
    { x: 0, y: 10 },
    { x: 10, y: 0 },
    { x: 20, y: 5 },
  ]

  it('builds a line', () => {
    expect(linePath(points)).toBe('M0 10L10 0L20 5')
    expect(linePath([])).toBe('')
  })

  it('rounds coordinates to two decimals', () => {
    expect(linePath([{ x: 1.23456, y: 9.87654 }])).toBe('M1.23 9.88')
  })

  it('builds a step-after line that holds each value until the next x', () => {
    expect(stepPath(points)).toBe('M0 10L10 10L10 0L20 0L20 5')
  })

  it('closes an area between two edges', () => {
    const top: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]
    const bottom: Point[] = [
      { x: 0, y: 10 },
      { x: 10, y: 10 },
    ]
    expect(areaBetweenPath(top, bottom)).toBe('M0 0L10 0L10 10L0 10Z')
  })

  it('measures length for the draw-in dash', () => {
    expect(
      pathLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ]),
    ).toBe(5)
  })
})

describe('decimate', () => {
  it('leaves short series alone', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]
    expect(decimate(points, 100)).toEqual(points)
  })

  it('cuts 1,500 points to roughly two per column', () => {
    const points: Point[] = Array.from({ length: 1500 }, (_, i) => ({
      x: i * 0.26,
      y: Math.sin(i / 7) * 50 + 100,
    }))
    const out = decimate(points, 390)
    expect(out.length).toBeLessThan(points.length / 1.9)
    expect(out.length).toBeLessThanOrEqual(390 * 2 + 2)
  })

  it('keeps the extremes exactly, which a uniform stride would not', () => {
    const points: Point[] = Array.from({ length: 400 }, (_, i) => ({ x: i, y: 0 }))
    // A spike on an index no stride of 10 would land on.
    points[137] = { x: 137, y: 999 }
    points[138] = { x: 138, y: -999 }
    const out = decimate(points, 40)
    expect(out).toContainEqual({ x: 137, y: 999 })
    expect(out).toContainEqual({ x: 138, y: -999 })
  })

  it('keeps both endpoints and stays sorted by x', () => {
    const points: Point[] = Array.from({ length: 900 }, (_, i) => ({ x: i, y: (i * 37) % 11 }))
    const out = decimate(points, 50)
    expect(out[0]).toEqual(points[0])
    expect(out[out.length - 1]).toEqual(points[points.length - 1])
    for (let i = 1; i < out.length; i += 1) expect(out[i].x).toBeGreaterThanOrEqual(out[i - 1].x)
  })
})

describe('nearestIndex', () => {
  const xs = [0, 10, 20, 30, 40]

  it('finds the closest x, not the one before it', () => {
    expect(nearestIndex(xs, 0)).toBe(0)
    expect(nearestIndex(xs, 14)).toBe(1)
    expect(nearestIndex(xs, 16)).toBe(2)
    expect(nearestIndex(xs, 40)).toBe(4)
  })

  it('clamps outside the range', () => {
    expect(nearestIndex(xs, -100)).toBe(0)
    expect(nearestIndex(xs, 1000)).toBe(4)
  })

  it('handles the empty and single cases', () => {
    expect(nearestIndex([], 5)).toBe(-1)
    expect(nearestIndex([7], 5)).toBe(0)
  })
})

describe('valueAt', () => {
  it('interpolates a fractional index', () => {
    expect(valueAt([0, 10], 0.5)).toBe(5)
    expect(valueAt([0, 10, 20], 1.25)).toBe(12.5)
  })

  it('clamps outside the series', () => {
    expect(valueAt([4, 8], -3)).toBe(4)
    expect(valueAt([4, 8], 9)).toBe(8)
  })
})

describe('gapRuns', () => {
  it('returns one run when the lines never cross', () => {
    const runs = gapRuns([2, 3, 4], [1, 1, 1])
    expect(runs).toHaveLength(1)
    expect(runs[0].sign).toBe(1)
    expect(runs[0].indices).toEqual([0, 1, 2])
  })

  it('shades nothing when the lines are identical', () => {
    expect(gapRuns([1, 2, 3], [1, 2, 3])).toEqual([])
  })

  it('splits at the interpolated crossing and shares the vertex', () => {
    // you - voo goes +1 then -1, so the crossing sits exactly halfway between index 0 and 1.
    const runs = gapRuns([2, 0], [1, 1])
    expect(runs).toHaveLength(2)
    expect(runs[0].sign).toBe(1)
    expect(runs[1].sign).toBe(-1)
    expect(runs[0].indices[runs[0].indices.length - 1]).toBeCloseTo(0.5, 10)
    expect(runs[1].indices[0]).toBeCloseTo(0.5, 10)
  })

  it('puts the crossing where the difference is actually zero, not at the midpoint', () => {
    // difference: +3 then -1 -> crossing three quarters of the way across.
    const runs = gapRuns([4, 0], [1, 1])
    expect(runs[0].indices[runs[0].indices.length - 1]).toBeCloseTo(0.75, 10)
  })

  it('crosses exactly at an index where the lines touch', () => {
    const runs = gapRuns([2, 1, 0], [1, 1, 1])
    expect(runs).toHaveLength(2)
    expect(runs[0].indices).toEqual([0, 1])
    expect(runs[1].indices).toEqual([1, 2])
  })

  it('treats a touch that does not flip the sign as one run', () => {
    const runs = gapRuns([2, 1, 3], [1, 1, 1])
    expect(runs).toHaveLength(1)
    expect(runs[0].indices).toEqual([0, 1, 2])
  })

  it('handles leading equality before the first separation', () => {
    const runs = gapRuns([1, 1, 0], [1, 1, 1])
    expect(runs).toHaveLength(1)
    expect(runs[0].sign).toBe(-1)
    expect(runs[0].indices[0]).toBe(0)
  })

  it('covers the whole series across many crossings', () => {
    const you = [1, -1, 1, -1, 1, -1]
    const voo = [0, 0, 0, 0, 0, 0]
    const runs = gapRuns(you, voo)
    expect(runs).toHaveLength(6)
    expect(runs[0].indices[0]).toBe(0)
    expect(runs[runs.length - 1].indices[runs[runs.length - 1].indices.length - 1]).toBe(5)
    // Each run hands its last index to the next one, so the band has no gaps.
    for (let i = 1; i < runs.length; i += 1) {
      const previous = runs[i - 1].indices
      expect(runs[i].indices[0]).toBeCloseTo(previous[previous.length - 1], 10)
    }
    // Signs alternate, starting positive.
    expect(runs.map((run) => run.sign)).toEqual([1, -1, 1, -1, 1, -1])
  })

  it('stops at the shorter series', () => {
    expect(gapRuns([1, 2, 3], [0, 0])).toEqual([{ sign: 1, indices: [0, 1] }])
  })

  it('shades nothing when there is no area to shade', () => {
    expect(gapRuns([], [])).toEqual([])
    // One overlapping point is a line, not a polygon.
    expect(gapRuns([1, 2, 3], [0])).toEqual([])
  })
})

describe('thin', () => {
  it('keeps both ends', () => {
    const out = thin([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 4)
    expect(out).toHaveLength(4)
    expect(out[0]).toBe(0)
    expect(out[3]).toBe(9)
  })

  it('leaves a short list alone', () => {
    expect(thin([1, 2, 3], 10)).toEqual([1, 2, 3])
  })

  it('never returns fewer than the two endpoints it was asked for', () => {
    expect(thin([0, 1, 2, 3], 2)).toEqual([0, 3])
  })
})

describe('clamp', () => {
  it('bounds both ways', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(50, 0, 10)).toBe(10)
  })
})
