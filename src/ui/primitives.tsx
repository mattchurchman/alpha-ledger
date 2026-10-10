import {
  useId,
  type InputHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'

/**
 * The surfaces and controls everything else is built from. Hairlines and warm paper, no
 * shadows - docs/DESIGN.md section 1.
 */

/**
 * Defaults to a `div`. A card is a visual container, not automatically a landmark - a page of
 * twelve `<section>`s with no headings between them is worse for a screen reader than one with
 * none. Pass `as="section"` where the card genuinely is its own labelled region.
 */
export function Card({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article'
}) {
  return (
    <Tag className={`rounded-card border border-rule bg-surface p-4 md:p-5 ${className}`.trimEnd()}>
      {children}
    </Tag>
  )
}

/** The ledger-book column heading. Labels; never competes with the number beside it. */
export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`label-micro ${className}`.trimEnd()}>{children}</span>
}

/**
 * A section heading with the 2px accent edge that the active nav item also uses - the one
 * recurring piece of chrome that carries the brand colour.
 */
export function SectionHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="flex items-center gap-2.5 text-h2 font-semibold">
        <span aria-hidden="true" className="h-[1.1em] w-[2px] shrink-0 rounded-full bg-you" />
        {children}
      </h2>
      {action}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-you text-white border-transparent hover:opacity-90',
  secondary: 'bg-surface text-ink border-rule hover:bg-sunken',
  ghost: 'bg-transparent text-ink-secondary border-transparent hover:bg-sunken',
}

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      // min-h-11 is the 44px touch target docs/DESIGN.md section 3.3 requires.
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-control border px-3.5 text-small font-medium transition-[background-color,opacity,color] duration-[120ms] ease-out disabled:opacity-45 ${BUTTON_STYLES[variant]} ${className}`.trimEnd()}
      {...props}
    />
  )
}

/** A compact control for chart chrome, where a 44px button would dominate the card. */
export function MiniButton({
  className = '',
  pressed,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-control border px-2.5 text-micro font-medium uppercase transition-colors duration-[120ms] ease-out ${
        pressed
          ? 'border-rule bg-sunken text-ink'
          : 'border-transparent text-ink-muted hover:bg-sunken'
      } ${className}`.trimEnd()}
      {...props}
    />
  )
}

/**
 * Identity key for a legend row: a short stroke for a line series, a rect for a fill. Mirrors
 * the mark, which is what makes the legend readable without colour-matching guesswork.
 */
export function SeriesKey({
  tone,
  shape = 'line',
}: {
  tone: 'you' | 'voo' | 'estimate' | 'ahead' | 'behind' | 'dim'
  shape?: 'line' | 'rect'
}) {
  const background = {
    you: 'bg-you',
    voo: 'bg-voo',
    estimate: 'bg-estimate',
    ahead: 'bg-ahead',
    behind: 'bg-behind',
    dim: 'bg-dim',
  }[tone]
  return shape === 'line' ? (
    <span aria-hidden="true" className={`inline-block h-[2px] w-3.5 rounded-full ${background}`} />
  ) : (
    <span
      aria-hidden="true"
      className={`inline-block h-2.5 w-2.5 rounded-[2px] opacity-30 ${background}`}
    />
  )
}

const FIELD_STYLES =
  'min-h-11 w-full rounded-control border border-rule bg-surface px-2.5 text-small text-ink placeholder:text-ink-muted disabled:opacity-45'

/** A labelled text/date/number input. `hint` and `error` are mutually exclusive - an error wins. */
export function TextField({
  label,
  hint,
  error,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = useId()
  return (
    <div className={`flex flex-col gap-1 ${className}`.trimEnd()}>
      <label htmlFor={id} className="label-micro">
        {label}
      </label>
      <input id={id} className={FIELD_STYLES} {...props} />
      {error ? (
        <span className="text-micro text-critical">{error}</span>
      ) : hint ? (
        <span className="text-micro text-ink-muted">{hint}</span>
      ) : null}
    </div>
  )
}

export interface SelectOption {
  value: string
  label: string
}

export function Select({
  label,
  options,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: readonly SelectOption[] }) {
  const id = useId()
  return (
    <div className={`flex flex-col gap-1 ${className}`.trimEnd()}>
      <label htmlFor={id} className="label-micro">
        {label}
      </label>
      <select id={id} className={FIELD_STYLES} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function Checkbox({
  label,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className={`flex min-h-11 items-center gap-2.5 text-small text-ink ${className}`.trimEnd()}
    >
      <input
        id={id}
        type="checkbox"
        className="size-4 shrink-0 rounded-[4px] border border-rule accent-you"
        {...props}
      />
      {label}
    </label>
  )
}

export function Legend({
  items,
}: {
  items: readonly {
    label: string
    tone: 'you' | 'voo' | 'estimate' | 'ahead' | 'behind' | 'dim'
    shape?: 'line' | 'rect'
  }[]
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-small text-ink-secondary">
          <SeriesKey tone={item.tone} shape={item.shape} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
