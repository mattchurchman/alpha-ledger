import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ApiError, NotAuthenticatedError, api } from './api/client'

/**
 * Wraps the app: asks the Worker whether this device has a session, and shows the unlock
 * screen until it does.
 *
 * The token is never kept by the page - not in state beyond the keystroke, not in
 * `localStorage`. It is exchanged once for an HttpOnly cookie the page itself cannot read,
 * which is the whole point: script on this origin cannot steal what it cannot see.
 */
type Status = 'checking' | 'locked' | 'unlocked'

export default function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking')
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Sets state only from the resolved promise, never synchronously in the effect body.
  useEffect(() => {
    let cancelled = false
    api.session.check().then(
      () => {
        if (!cancelled) setStatus('unlocked')
      },
      (err: unknown) => {
        if (cancelled) return
        if (err instanceof NotAuthenticatedError) setStatus('locked')
        else {
          // A 403 `auth-not-configured` means the deploy has no AUTH_TOKEN set. Saying so
          // beats an unlock box that cannot possibly accept anything.
          setStatus('locked')
          setError(err instanceof ApiError ? err.message : 'Could not reach the server.')
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const unlock = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      setBusy(true)
      setError(null)
      try {
        await api.session.unlock(token)
        setToken('')
        setStatus('unlocked')
      } catch (err) {
        setError(
          err instanceof ApiError && err.message === 'invalid-token'
            ? 'That token is not right.'
            : err instanceof ApiError
              ? err.message
              : 'Could not reach the server.',
        )
      } finally {
        setBusy(false)
      }
    },
    [token],
  )

  if (status === 'checking') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-plane p-6">
        <p className="text-small text-ink-muted">Checking…</p>
      </main>
    )
  }

  if (status === 'locked') {
    return (
      <main className="flex min-h-screen items-start justify-center bg-plane p-6 sm:items-center">
        <form onSubmit={unlock} className="w-full max-w-sm">
          <h1 className="text-h1 font-semibold">Alpha Ledger</h1>
          <p className="label-micro mt-1">vs VOO</p>
          <label htmlFor="token" className="mt-6 block text-small font-medium">
            Access token
          </label>
          <input
            id="token"
            // `password` so it is masked and so password managers offer to fill it.
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="current-password"
            autoFocus
            spellCheck={false}
            className="mt-1 min-h-11 w-full rounded-control border border-rule bg-surface px-3 font-mono text-base"
          />
          <button
            type="submit"
            disabled={busy || token.trim() === ''}
            className="mt-4 min-h-11 w-full rounded-control bg-you px-3 font-medium text-white transition-opacity duration-[120ms] hover:opacity-90 disabled:opacity-45"
          >
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>
          {error && (
            <p role="alert" className="mt-3 text-small text-behind">
              {error}
            </p>
          )}
          <p className="mt-6 text-micro text-ink-muted">
            Unlocking stores a sign-in cookie on this device for a year. Nothing else is kept.
          </p>
        </form>
      </main>
    )
  }

  return <>{children}</>
}
