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
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-gray-500">Checking…</p>
      </main>
    )
  }

  if (status === 'locked') {
    return (
      <main className="flex min-h-screen items-start justify-center p-6 sm:items-center">
        <form onSubmit={unlock} className="w-full max-w-sm">
          <h1 className="text-xl font-semibold">Alpha Ledger</h1>
          <label htmlFor="token" className="mt-6 block text-sm font-medium">
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
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-base"
          />
          <button
            type="submit"
            disabled={busy || token.trim() === ''}
            className="mt-4 w-full rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
          >
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <p className="mt-6 text-xs text-gray-500">
            Unlocking stores a sign-in cookie on this device for a year. Nothing else is kept.
          </p>
        </form>
      </main>
    )
  }

  return <>{children}</>
}
