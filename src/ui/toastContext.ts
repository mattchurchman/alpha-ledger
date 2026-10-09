import { createContext, useContext } from 'react'

/**
 * The toast context and its hook, split out of `Toast.tsx` so that file exports components
 * only - which is what keeps fast refresh working.
 */
export type ToastStatus = 'good' | 'warning' | 'critical'

export interface ToastOptions {
  status?: ToastStatus
  /** Milliseconds on screen. Pass 0 to require a dismiss. */
  duration?: number
}

export interface ToastApi {
  show: (message: string, options?: ToastOptions) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast must be used inside a ToastProvider')
  return api
}
