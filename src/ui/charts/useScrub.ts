import { useCallback, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { nearestIndex } from './geometry'

/**
 * Crosshair scrubbing, shared by every time-series chart in the kit.
 *
 * Three things it gets right that a naive `onMouseMove` does not:
 *
 * - **Touch is the primary input.** `pointerdown` captures the pointer, so a drag that strays
 *   outside the plot keeps scrubbing instead of stopping dead. `touch-action: none` goes on the
 *   overlay rect only, so the page still scrolls when you drag anywhere else.
 * - **Lifting a finger clears the readout** (it would otherwise be stuck on wherever you let
 *   go), while a mouse keeps its position until the pointer leaves - which is what each input
 *   expects.
 * - **The keyboard sees exactly what hover sees.** ← → step a day, Home/End jump to the ends,
 *   Escape clears. Charts are rendered at 1 user unit per CSS pixel precisely so this maths
 *   stays a subtraction.
 */
export function useScrub(xs: readonly number[]) {
  const [index, setIndex] = useState<number | null>(null)

  const pick = useCallback(
    (clientX: number, target: Element) => {
      const svg = (target as SVGGraphicsElement).ownerSVGElement ?? target
      const bounds = svg.getBoundingClientRect()
      if (xs.length > 0) setIndex(nearestIndex(xs, clientX - bounds.left))
    },
    [xs],
  )

  const handlers = useMemo(
    () => ({
      onPointerDown(event: PointerEvent<Element>) {
        event.currentTarget.setPointerCapture?.(event.pointerId)
        pick(event.clientX, event.currentTarget)
      },
      onPointerMove(event: PointerEvent<Element>) {
        pick(event.clientX, event.currentTarget)
      },
      onPointerUp(event: PointerEvent<Element>) {
        event.currentTarget.releasePointerCapture?.(event.pointerId)
        if (event.pointerType !== 'mouse') setIndex(null)
      },
      onPointerCancel() {
        setIndex(null)
      },
      onPointerLeave() {
        setIndex(null)
      },
      onBlur() {
        setIndex(null)
      },
      onKeyDown(event: KeyboardEvent<Element>) {
        if (xs.length === 0) return
        const last = xs.length - 1
        const current = index ?? last
        switch (event.key) {
          case 'ArrowLeft':
            setIndex(Math.max(0, current - 1))
            break
          case 'ArrowRight':
            setIndex(Math.min(last, current + 1))
            break
          case 'Home':
            setIndex(0)
            break
          case 'End':
            setIndex(last)
            break
          case 'Escape':
            setIndex(null)
            break
          default:
            return
        }
        event.preventDefault()
      },
    }),
    [index, pick, xs],
  )

  return { index, setIndex, handlers }
}
