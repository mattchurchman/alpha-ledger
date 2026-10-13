/**
 * Every icon in the app, hand-written. No icon package: SPEC 10 forbids anything fetched at
 * runtime, and one file beats 300 KB of glyphs we would use eighteen of.
 *
 * One family, drawn to one set of rules (docs/DESIGN.md section 1):
 *
 * - **24-unit grid, 1.75px stroke, round caps and joins.** The grid is the modern-icon default,
 *   and it is what lets these shapes keep a 2-unit margin and still have room for detail. The
 *   rendered size is unchanged (`width`/`height` default to 20), so every existing `size-*`
 *   caller is untouched.
 * - **`currentColor` only**, never a token - an icon takes the colour of the text it sits beside.
 * - **A duotone active state.** The five navigation glyphs accept `active`, which fills their one
 *   enclosing shape with `currentColor` at 22%. That is a *shape* change, not a colour change, so
 *   the tab bar's selected item survives being read in grayscale (DESIGN section 6).
 *
 * Everything else here is decorative and sits beside a word.
 */
import type { SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement>
/** The navigation glyphs: `active` is the tab bar's selected state. */
export type NavIconProps = IconProps & { active?: boolean }

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

/** The plate a duotone icon fills when it is the active destination. */
const plate = (active: boolean) => ({
  fill: active ? 'currentColor' : 'none',
  fillOpacity: active ? 0.22 : 0,
  stroke: 'none' as const,
})

/** Dashboard: the gap band between your line and VOO's, which is the product's one shape. */
export function DashboardIcon({ active = false, ...props }: NavIconProps) {
  return (
    <Icon {...props}>
      <path d="M3 15.5 8.6 9.8l4.5 3.3L21 4.8V11l-7.9 8.3L8.6 16 3 21.7Z" {...plate(active)} />
      <path d="M3 15.5 8.6 9.8l4.5 3.3L21 4.8" />
      <path d="M3 21.7 8.6 16l4.5 3.3L21 11" />
    </Icon>
  )
}

/** Fair values: a price tag - a level you set, hung on the holding. */
export function FairValueIcon({ active = false, ...props }: NavIconProps) {
  const tag =
    'M12.6 3h6.3A2.1 2.1 0 0 1 21 5.1v6.3a2.1 2.1 0 0 1-.62 1.49l-7.5 7.5a2.1 2.1 0 0 1-2.97 0l-6.3-6.3a2.1 2.1 0 0 1 0-2.97l7.5-7.5A2.1 2.1 0 0 1 12.6 3Z'
  return (
    <Icon {...props}>
      <path d={tag} {...plate(active)} />
      <path d={tag} />
      <circle cx="16.4" cy="7.6" r="1.5" />
    </Icon>
  )
}

/** Activity: the ledger itself - a sheet of rows. */
export function ActivityIcon({ active = false, ...props }: NavIconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2.5" {...plate(active)} />
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <path d="M8 8.5h8M8 12.5h8M8 16.5h4.5" />
    </Icon>
  )
}

/** Import: a statement dropping into a tray. */
export function ImportIcon({ active = false, ...props }: NavIconProps) {
  const tray =
    'M3.25 14.5h4.4l1.3 2.1h6.1l1.3-2.1h4.4v3.9A2.1 2.1 0 0 1 18.65 20.5H5.35A2.1 2.1 0 0 1 3.25 18.4Z'
  return (
    <Icon {...props}>
      <path d={tray} {...plate(active)} />
      <path d={tray} />
      <path d="M12 3.5v8.2" />
      <path d="M8.6 8.3 12 11.7l3.4-3.4" />
    </Icon>
  )
}

/** Settings: two sliders, because everything here is a preference with a position. */
export function SettingsIcon({ active = false, ...props }: NavIconProps) {
  return (
    <Icon {...props}>
      <circle cx="9.5" cy="8" r="2.4" {...plate(active)} />
      <circle cx="15.5" cy="16" r="2.4" {...plate(active)} />
      <path d="M3.5 8h3.6M11.9 8h8.6" />
      <path d="M3.5 16h9.6M17.9 16h2.6" />
      <circle cx="9.5" cy="8" r="2.4" />
      <circle cx="15.5" cy="16" r="2.4" />
    </Icon>
  )
}

/** Help: a question mark in a circle. */
export function HelpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M9.6 9.6a2.45 2.45 0 1 1 3.55 2.27c-.73.43-1.22.98-1.22 1.83v.3" />
      <path d="M11.93 17.1h.01" />
    </Icon>
  )
}

/** Update market data: a refresh arc. */
export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20.3 12a8.3 8.3 0 0 1-14.4 5.6" />
      <path d="M3.7 12a8.3 8.3 0 0 1 14.4-5.6" />
      <path d="M4 19.5V15h4.5" />
      <path d="M20 4.5V9h-4.5" />
    </Icon>
  )
}

/** Status: warning / stale. Always beside the word. */
export function WarningIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10.65 4.15a1.55 1.55 0 0 1 2.7 0l7.5 13.4a1.55 1.55 0 0 1-1.35 2.3H4.5a1.55 1.55 0 0 1-1.35-2.3Z" />
      <path d="M12 9.5v4.2" />
      <path d="M12 16.9h.01" />
    </Icon>
  )
}

export function GoodIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M8.1 12.3 10.8 15l5.1-5.4" />
    </Icon>
  )
}

export function CriticalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.7v5.1" />
      <path d="M12 16.3h.01" />
    </Icon>
  )
}

export function BackIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.8 4.8 7.6 12l7.2 7.2" />
    </Icon>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.6 6.6l10.8 10.8M17.4 6.6 6.6 17.4" />
    </Icon>
  )
}

export function TableIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2.5" />
      <path d="M3.4 9.6h17.2M10.2 9.6v9.8" />
    </Icon>
  )
}

export function ChartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 19.8V11.4M9.3 19.8V5.2M14.7 19.8v-6.2M20 19.8V8.6" />
    </Icon>
  )
}

/** Theme toggle: system / light / dark, one glyph each. */
export function SystemThemeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.8" y="4.4" width="18.4" height="12.2" rx="2.4" />
      <path d="M8.6 20.2h6.8" />
    </Icon>
  )
}

export function LightThemeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5l1.5 1.5M17 17l1.5 1.5M18.5 5.5 17 7M7 17l-1.5 1.5" />
    </Icon>
  )
}

export function DarkThemeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 15.1A7.9 7.9 0 0 1 8.9 5a8.1 8.1 0 1 0 10.1 10.1Z" />
    </Icon>
  )
}

export function SortIcon({ direction, ...props }: IconProps & { direction?: 'asc' | 'desc' }) {
  return (
    <Icon {...props} width="12" height="12" viewBox="0 0 24 24">
      {direction === 'asc' ? (
        <path d="M12 19.5V5.4M6.2 11.2 12 5.4l5.8 5.8" />
      ) : direction === 'desc' ? (
        <path d="M12 4.5v14.1M6.2 12.8 12 18.6l5.8-5.8" />
      ) : (
        <path d="M7.2 9.8 12 5l4.8 4.8M7.2 14.2 12 19l4.8-4.8" />
      )}
    </Icon>
  )
}
