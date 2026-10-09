import { useCallback, useEffect, useState } from 'react'
import { AccessExpiredError, ApiError, api } from '../api/client'
import type { TransactionRow } from '../api/types'

/**
 * Temporary. Task 06's only UI, and the task's "Out of scope" line allows exactly this much.
 *
 * It exists so the sync acceptance check in `docs/SETUP.md` can be done on a phone: writing
 * a row from a browser console is fine on a laptop and painful on iOS. Delete it once the
 * real Activity screen can create and delete transactions.
 */
export default function Debug() {
  const [rows, setRows] = useState<TransactionRow[] | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const report = useCallback((err: unknown) => {
    if (err instanceof AccessExpiredError) setStatus(`${err.message} (reload)`)
    else if (err instanceof ApiError) setStatus(`API error ${err.status}: ${err.message}`)
    else setStatus(String(err))
  }, [])

  const load = useCallback(async () => {
    setBusy(true)
    try {
      setRows(await api.transactions.list())
      setStatus('')
    } catch (err) {
      report(err)
    } finally {
      setBusy(false)
    }
  }, [report])

  // The first load sets state only from the resolved promise, never synchronously in the
  // effect body - the latter is what `react-hooks/set-state-in-effect` is there to stop.
  useEffect(() => {
    let cancelled = false
    api.transactions.list().then(
      (fetched) => {
        if (!cancelled) setRows(fetched)
      },
      (err: unknown) => {
        if (!cancelled) report(err)
      },
    )
    return () => {
      cancelled = true
    }
  }, [report])

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(true)
    try {
      await action()
      setStatus(label)
      setRows(await api.transactions.list())
    } catch (err) {
      report(err)
    } finally {
      setBusy(false)
    }
  }

  const addRow = () =>
    run('Added a row.', () =>
      api.transactions.create({
        account_label: 'debug',
        trade_date: new Date().toISOString().slice(0, 10),
        ticker: 'ACME',
        type: 'buy',
        shares: '1',
        amount_usd: '100.00',
        source: 'manual',
        // Unique per tap, so repeated taps are new rows rather than hash collisions.
        source_row_hash: `debug-${Date.now()}`,
      }),
    )

  return (
    <section className="max-w-prose">
      <h1 className="text-lg font-semibold">Debug: API and sync</h1>
      <p className="mt-1 text-sm text-gray-600">
        Temporary page for the task 06 acceptance checks. Add a row here, then open this page
        on another device signed in to the same account - the row should already be there.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addRow}
          disabled={busy}
          className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          Add a test row
        </button>
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
        >
          Reload from server
        </button>
        <button
          type="button"
          onClick={() =>
            run('Removed the debug rows.', async () => {
              const all = await api.transactions.list({ account: 'debug' })
              for (const row of all) await api.transactions.remove(row.id)
            })
          }
          disabled={busy}
          className="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
        >
          Delete debug rows
        </button>
      </div>

      {status && <p className="mt-3 text-sm text-gray-700">{status}</p>}

      <table className="mt-4 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-1 pr-2">id</th>
            <th className="py-1 pr-2">date</th>
            <th className="py-1 pr-2">ticker</th>
            <th className="py-1 pr-2">type</th>
            <th className="py-1 pr-2 text-right">amount</th>
          </tr>
        </thead>
        <tbody>
          {rows?.map((row) => (
            <tr key={row.id} className="border-b border-gray-100">
              <td className="py-1 pr-2">{row.id}</td>
              <td className="py-1 pr-2">{row.trade_date}</td>
              <td className="py-1 pr-2">{row.ticker}</td>
              <td className="py-1 pr-2">{row.type}</td>
              <td className="py-1 pr-2 text-right">{row.amount_usd}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows?.length === 0 && <p className="mt-2 text-sm text-gray-500">No transactions yet.</p>}
      {rows === null && <p className="mt-2 text-sm text-gray-500">Loading…</p>}
    </section>
  )
}
