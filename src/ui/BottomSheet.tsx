import { useEffect, useId, useRef, type ReactNode } from 'react'
import { CloseIcon } from './icons'

/**
 * The phone-first overlay: rises from the bottom edge, honours the home-bar inset, and becomes
 * a centred card on a wide screen.
 *
 * Focus handling is the part worth reading. On open it remembers what had focus, moves focus
 * into the panel, and on close puts it back - otherwise dismissing a sheet drops you at the top
 * of the document, which on a phone means scrolling back to where you were. Escape and a
 * backdrop press both close it, and the backdrop is a sibling rather than a parent so a press
 * inside the panel cannot bubble out and dismiss it.
 */
export interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

export function BottomSheet({ open, onClose, title, children, footer }: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    restoreRef.current = document.activeElement as HTMLElement | null
    panelRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    // The page behind must not scroll under the sheet.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      restoreRef.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        // Decorative: the dialog's own Escape and close button are the accessible affordances.
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-[color-mix(in_oklab,black_45%,transparent)] [animation:al-fade_220ms_cubic-bezier(.2,.8,.2,1)]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-[16px] border border-rule bg-surface p-4 [animation:al-rise_220ms_cubic-bezier(.2,.8,.2,1)] sm:max-w-lg sm:rounded-card"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        {/* The grab handle: a phone affordance, meaningless to a pointer, so it is decorative. */}
        <span
          aria-hidden="true"
          className="mx-auto mb-3 block h-1 w-10 rounded-full bg-rule sm:hidden"
        />
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-h2 font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-2 inline-flex size-11 items-center justify-center rounded-control text-ink-secondary hover:bg-sunken"
          >
            <CloseIcon />
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-4 flex gap-2 border-t border-rule pt-3">{footer}</div>}
      </div>
    </div>
  )
}
