import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { DESTINATIONS, titleFor } from './destinations'
import { DarkThemeIcon, HelpIcon, LightThemeIcon, RefreshIcon, SystemThemeIcon } from './icons'
import { PricesAsOfBadge, type PricesAsOf } from './States'
import { useTheme } from './theme'

/**
 * Bottom tab bar on a phone, side rail from 768px, one set of destinations (`destinations.ts`).
 *
 * The active state is a 2px accent edge **plus** an ink-weight change, never colour alone.
 */
const THEME_ICON = { system: SystemThemeIcon, light: LightThemeIcon, dark: DarkThemeIcon }
const THEME_NEXT = { system: 'light', light: 'dark', dark: 'system' } as const

function ThemeToggle() {
  const { theme, cycle } = useTheme()
  const Glyph = THEME_ICON[theme]
  return (
    <button
      type="button"
      onClick={cycle}
      className="inline-flex size-11 items-center justify-center rounded-control text-ink-secondary transition-colors duration-[120ms] hover:bg-sunken"
      aria-label={`Theme: ${theme}. Switch to ${THEME_NEXT[theme]}.`}
    >
      <Glyph />
    </button>
  )
}

/**
 * The guide at `/help`, reachable from every screen but deliberately **not** a tab: a sixth
 * tab-bar item at 390px drops each one near the 44px floor, and the five destinations in
 * `destinations.ts` are the ones you move between all day. Help is a place you go once and
 * come back from, so it lives in the header, where it is also beside the Update control it
 * explains.
 */
function HelpLink() {
  return (
    <NavLink
      to="/help"
      // The label is dropped below 640px: with it, the 390px header needed a third line for
      // the "prices as of" row and every screen lost that height. `aria-label` keeps the
      // accessible name identical either way, which is also how the theme toggle works.
      aria-label="Help"
      className={({ isActive }) =>
        `inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-control px-2 text-small transition-colors duration-[120ms] max-sm:size-11 max-sm:px-0 ${
          isActive ? 'bg-sunken font-semibold text-ink' : 'text-ink-secondary hover:bg-sunken'
        }`
      }
    >
      <HelpIcon className="size-5 shrink-0" />
      <span className="max-sm:hidden">Help</span>
    </NavLink>
  )
}

export interface AppShellProps {
  children: ReactNode
  pricesAsOf?: PricesAsOf
  /** Overrides the title derived from the route. */
  title?: string
  /** SPEC 8's action, also reachable from the shell - task 09. Omit to hide the control. */
  onUpdatePrices?: () => void
  updatingPrices?: boolean
}

export function AppShell({
  children,
  pricesAsOf,
  title,
  onUpdatePrices,
  updatingPrices,
}: AppShellProps) {
  const { pathname } = useLocation()
  const heading = title ?? titleFor(pathname)

  return (
    <div className="min-h-screen bg-plane md:flex">
      {/* Desktop: side rail. */}
      <nav
        aria-label="Sections"
        className="hidden shrink-0 border-r border-rule md:sticky md:top-0 md:block md:h-screen md:w-[232px]"
      >
        <div className="flex h-full flex-col p-4">
          <Link to="/" className="mb-6 flex flex-col gap-0.5 rounded-control px-2 py-1">
            <span className="text-h3 font-semibold">Alpha Ledger</span>
            <span className="label-micro">vs VOO</span>
          </Link>
          <ul className="flex flex-col gap-0.5">
            {DESTINATIONS.map(({ to, label, icon: Glyph }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-2.5 rounded-control border-l-2 px-2.5 text-body transition-colors duration-[120ms] ${
                      isActive
                        ? 'border-you bg-sunken font-semibold text-ink'
                        : 'border-transparent text-ink-secondary hover:bg-sunken'
                    }`
                  }
                >
                  <Glyph className="shrink-0" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex items-center pt-4">
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-rule bg-plane/95 backdrop-blur-sm">
          <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-h1 font-semibold">{heading}</h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {/* SPEC section 8's indicator. */}
                <PricesAsOfBadge value={pricesAsOf} />
                {onUpdatePrices && (
                  <button
                    type="button"
                    onClick={onUpdatePrices}
                    disabled={updatingPrices}
                    className="inline-flex items-center gap-1 rounded-control px-1 text-micro font-medium text-ink-secondary transition-colors duration-[120ms] hover:bg-sunken disabled:opacity-45"
                  >
                    <RefreshIcon
                      className={`size-3 shrink-0 ${updatingPrices ? 'animate-spin' : ''}`}
                    />
                    {updatingPrices ? 'Updating…' : 'Update'}
                  </button>
                )}
              </div>
            </div>
            <HelpLink />
            <div className="md:hidden">
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main
          className="mx-auto w-full max-w-4xl flex-1 px-4 py-4"
          // Clears the fixed tab bar and the home bar below it.
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 5.5rem)' }}
        >
          {children}
        </main>
      </div>

      {/* Phone: bottom tab bar. */}
      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-surface md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="mx-auto flex max-w-4xl">
          {DESTINATIONS.map(({ to, label, icon: Glyph }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-0.5 border-t-2 px-1 pt-1 text-center transition-colors duration-[120ms] ${
                    isActive
                      ? 'border-you font-semibold text-ink'
                      : 'border-transparent text-ink-muted'
                  }`
                }
              >
                <Glyph className="size-5 shrink-0" />
                <span className="text-[0.6875rem] leading-tight">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
