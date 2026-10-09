import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { CloseIcon, CriticalIcon, GoodIcon, WarningIcon } from './icons'
import { ToastContext, type ToastOptions } from './toastContext'

/**
 * Transient confirmations - "imported 42 transactions", "3 tickers failed to fetch".
 *
 * The host is an `aria-live="polite"` region, so a toast is announced without stealing focus,
 * and each one carries a status icon **and** its text: the colour is never the message
 * (docs/DESIGN.md section 2.4). A toast is never the only place something is said - a failed
 * market-data fetch also lists its failures on the screen that asked for it (SPEC section 8).
 */
interface Toast extends ToastOptions {
  id: number
  message: string
}

const ICONS = { good: GoodIcon, warning: WarningIcon, critical: CriticalIcon }
const TONES = { good: 'text-good', warning: 'text-warning', critical: 'text-critical' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = nextId.current
      nextId.current += 1
      const duration = options.duration ?? 4000
      setToasts((current) => [...current, { id, message, ...options }])
      if (duration > 0) window.setTimeout(() => dismiss(id), duration)
    },
    [dismiss],
  )

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/*
        Sits above the bottom tab bar on a phone, so a toast never covers the navigation.
        `pointer-events-none` on the stack and `auto` on each toast keeps the gap clickable.
      */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-40 flex flex-col items-center gap-2 px-4"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 4.75rem)' }}
      >
        {toasts.map((toast) => {
          const status = toast.status ?? 'good'
          const Glyph = ICONS[status]
          return (
            <div
              key={toast.id}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-control border border-rule bg-surface px-3 py-2.5 text-small [animation:al-rise_220ms_cubic-bezier(.2,.8,.2,1)]"
            >
              <Glyph className={`${TONES[status]} mt-px size-[1.15em] shrink-0`} />
              <p className="flex-1">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss"
                className="-m-1 inline-flex size-7 shrink-0 items-center justify-center rounded text-ink-muted hover:text-ink"
              >
                <CloseIcon className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
