import type { ComponentType } from 'react'
import { ActivityIcon, DashboardIcon, FairValueIcon, ImportIcon, SettingsIcon } from './icons'

/**
 * The five tab-bar / side-rail destinations, in one place so the shell and any later
 * navigation (a "go to Import" button, say) agree on the list.
 *
 * Stock detail is deliberately absent: it is a screen you push into from the dashboard or the
 * holdings table, so a tab for it would have nothing to show (SPEC section 9).
 *
 * In its own file rather than in `AppShell.tsx` so that module exports components only, which
 * is what keeps fast refresh working.
 */
export interface Destination {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
}

export const DESTINATIONS: Destination[] = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon },
  { to: '/fair-values', label: 'Fair values', icon: FairValueIcon },
  { to: '/activity', label: 'Activity', icon: ActivityIcon },
  { to: '/import', label: 'Import', icon: ImportIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

/** Titles for the screens that are not tabs. */
export const EXTRA_TITLES: { prefix: string; title: string }[] = [
  { prefix: '/stocks/', title: 'Stock detail' },
  { prefix: '/kit', title: 'Component kit' },
  { prefix: '/debug', title: 'Debug' },
]

export function titleFor(pathname: string): string {
  const exact = DESTINATIONS.find((destination) => destination.to === pathname)
  if (exact) return exact.label
  const nested = DESTINATIONS.find(
    (destination) => destination.to !== '/' && pathname.startsWith(destination.to),
  )
  if (nested) return nested.label
  return EXTRA_TITLES.find((extra) => pathname.startsWith(extra.prefix))?.title ?? 'Alpha Ledger'
}
