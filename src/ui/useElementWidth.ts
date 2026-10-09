import { useEffect, useRef, useState } from 'react'

/**
 * Measures an element with a `ResizeObserver` rather than a window resize listener, so a chart
 * is also correct inside a bottom sheet or a side rail that changes width without the window
 * doing anything.
 *
 * The comparison is done inside the state updater, not against a captured `width`, so the
 * effect can stay mounted once with no dependency on the value it sets.
 */
export function useElementWidth<T extends Element>(fallback = 320) {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(fallback)

  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width
      if (!measured) return
      // Sub-pixel jitter would otherwise rebuild every memoised path on every frame.
      setWidth((previous) => (Math.abs(previous - measured) >= 1 ? measured : previous))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, width] as const
}
