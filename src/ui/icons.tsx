/**
 * Every icon in the app, hand-written. No icon package: SPEC 10 forbids anything fetched at
 * runtime, and a 20-line file beats 300 KB of glyphs we would use eight of.
 *
 * All of them are 20x20, 1.5px stroke, `currentColor`, and purely decorative - each one sits
 * beside a word, never alone (docs/DESIGN.md section 6).
 */
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
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

/** Dashboard: the gap band, which is the product's one shape. */
export function DashboardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 13.5 6 8l4 3 7.5-8.5" />
      <path d="M2.5 17.5 6 12l4 3 7.5-8.5" />
    </Icon>
  )
}

/** Fair values: a price tag. */
export function FairValueIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10.6 2.5H16a1.5 1.5 0 0 1 1.5 1.5v5.4a1.5 1.5 0 0 1-.44 1.06l-6.1 6.1a1.5 1.5 0 0 1-2.12 0l-5.4-5.4a1.5 1.5 0 0 1 0-2.12l6.1-6.1a1.5 1.5 0 0 1 1.06-.44Z" />
      <circle cx="13.5" cy="6.5" r="1.25" />
    </Icon>
  )
}

/** Activity: ledger rows. */
export function ActivityIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 5.5h14M3 10h14M3 14.5h9" />
    </Icon>
  )
}

/** Import: a file going into a tray. */
export function ImportIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 2.5v8" />
      <path d="M6.75 7.25 10 10.5l3.25-3.25" />
      <path d="M3 13v3.5h14V13" />
    </Icon>
  )
}

export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 6h7M14 6h3M3 14h3M10 14h7" />
      <circle cx="12" cy="6" r="2" />
      <circle cx="8" cy="14" r="2" />
    </Icon>
  )
}

/** Status: warning / stale. Always beside the word. */
export function WarningIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 3.5 2.8 16h14.4L10 3.5Z" />
      <path d="M10 8v3.5" />
      <path d="M10 14h.01" />
    </Icon>
  )
}

export function GoodIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="7" />
      <path d="M6.75 10.25 9 12.5l4.25-4.5" />
    </Icon>
  )
}

export function CriticalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.5v4.25" />
      <path d="M10 13.5h.01" />
    </Icon>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </Icon>
  )
}

export function TableIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="14" height="12" rx="1.5" />
      <path d="M3 8h14M8.5 8v8" />
    </Icon>
  )
}

export function ChartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 16.5V9M8.33 16.5V4.5M13.67 16.5v-5M19 16.5v-9" />
    </Icon>
  )
}

/** Theme toggle: system / light / dark, one glyph each. */
export function SystemThemeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="4" width="15" height="10" rx="1.5" />
      <path d="M7 17h6" />
    </Icon>
  )
}

export function LightThemeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2.5v1.75M10 15.75v1.75M2.5 10h1.75M15.75 10h1.75M4.7 4.7l1.25 1.25M14.05 14.05l1.25 1.25M15.3 4.7l-1.25 1.25M5.95 14.05 4.7 15.3" />
    </Icon>
  )
}

export function DarkThemeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15.5 12.4A6.5 6.5 0 0 1 7.6 4.5a6.5 6.5 0 1 0 7.9 7.9Z" />
    </Icon>
  )
}

export function SortIcon({ direction, ...props }: IconProps & { direction?: 'asc' | 'desc' }) {
  return (
    <Icon {...props} width="12" height="12" viewBox="0 0 12 12">
      {direction === 'asc' ? (
        <path d="M6 9.5V2.5M3 5.5 6 2.5l3 3" />
      ) : direction === 'desc' ? (
        <path d="M6 2.5v7M3 6.5 6 9.5l3-3" />
      ) : (
        <path d="M4 4.75 6 2.75l2 2M4 7.25 6 9.25l2-2" />
      )}
    </Icon>
  )
}
