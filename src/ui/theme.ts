import { useCallback, useEffect, useState } from 'react'

/**
 * Three states, matching the token scopes in `src/index.css`: `system` stamps nothing and lets
 * `prefers-color-scheme` decide, `light` and `dark` stamp `data-theme` on `<html>` so the
 * choice beats the OS in both directions.
 *
 * `index.html` runs the same read before first paint, so an explicit choice never flashes the
 * wrong palette. Keep the two in step.
 */
export type Theme = 'system' | 'light' | 'dark'

export const THEME_STORAGE_KEY = 'al.theme'

const ORDER: Theme[] = ['system', 'light', 'dark']

export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    // A private window can throw on access rather than return null.
    return 'system'
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === 'undefined' ? 'system' : readStoredTheme(),
  )

  useEffect(() => {
    applyTheme(theme)
    try {
      if (theme === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
      else localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Not being able to remember the choice is not a reason to not apply it.
    }
  }, [theme])

  const cycle = useCallback(() => {
    setTheme((current) => ORDER[(ORDER.indexOf(current) + 1) % ORDER.length])
  }, [])

  return { theme, setTheme, cycle }
}
