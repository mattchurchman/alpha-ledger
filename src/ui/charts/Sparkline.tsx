import { useMemo } from 'react'
import { toNumber, type Numeric } from '../format'
import { decimate, linePath, linearScale, paddedDomain, type Point } from './geometry'

/**
 * A bare trend line: no axes, no interaction, no tooltip. It is the one chart in the kit that
 * deliberately shows no values, which is legal only because the number it accompanies is
 * always printed beside it (docs/DESIGN.md section 5.5).
 *
 * The body is the dim blue step and the end dot is the accent, so the eye lands on "now".
 */
export interface SparklineProps {
  values: readonly Numeric[]
  width?: number
  height?: number
  /** Describes the trend in words, since the shape itself is not readable by a screen reader. */
  label: string
}

export function Sparkline({ values, width = 76, height = 24, label }: SparklineProps) {
  const path = useMemo(() => {
    const numbers = values.map(toNumber).filter((value): value is number => value !== null)
    if (numbers.length < 2) return null

    const inset = 3 // room for the end dot's 2px surface ring
    const x = linearScale([0, numbers.length - 1], [inset, width - inset])
    const y = linearScale(paddedDomain(numbers, { pad: 0.12 }), [height - inset, inset])
    const points: Point[] = numbers.map((value, index) => ({ x: x(index), y: y(value) }))
    const thinned = decimate(points, Math.round(width))
    return { d: linePath(thinned), end: thinned[thinned.length - 1] }
  }, [values, width, height])

  if (!path) return null

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className="overflow-visible"
    >
      <path
        d={path.d}
        className="stroke-dim"
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={path.end.x}
        cy={path.end.y}
        r={3}
        className="fill-you stroke-surface"
        strokeWidth={2}
      />
    </svg>
  )
}
