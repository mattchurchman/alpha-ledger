import { useEffect, useRef, useState, type RefObject } from 'react'
import { discountFrom } from '../engine/fairValue'
import { BottomSheet } from './BottomSheet'
import { money, percent, toNumber, type Numeric } from './format'
import { Button, TextField } from './primitives'
import { zoneFor } from './zones'

/**
 * Task 21's fast-entry form, shared by every place a fair value gets set: a rebuy row's edit
 * control, a "No estimate yet" pill, the whole row on Fair values, and stock detail. One sheet,
 * one draft shape, one save path - `FairValues.tsx` used to own a private copy of all of this.
 *
 * Stays data-layer free like the rest of `src/ui/` (CLAUDE.md): `onSave` is the only place that
 * touches the API, so a screen wires it to `api.fairValues.create` and `/kit` wires it to a
 * no-op that just shows a toast.
 */

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

interface Draft {
  value_usd: string
  effective_date: string
  note: string
}

function blankDraft(): Draft {
  return { value_usd: '', effective_date: todayDate(), note: '' }
}

export interface FairValueSheetInput {
  value_usd: string
  effective_date: string
  note: string | null
}

export interface FairValueSheetProps {
  /** The ticker to set a value for; `null` keeps the sheet shut. */
  ticker: string | null
  /** `ticker`'s latest stored close, for the live discount preview. Ignored if `priceFor` is given. */
  price?: Numeric
  /** Looks up any ticker's price - required for "Save and next" to preview each one it walks to. */
  priceFor?: (ticker: string) => Numeric
  /**
   * Tickers with no estimate yet, in the order "Save and next" should walk. Leave empty (the
   * default) to hide that control - a single-ticker caller like stock detail has no queue to
   * walk.
   */
  queue?: readonly string[]
  onClose: () => void
  /** Saves one estimate. Throw to show the message in the sheet instead of closing. */
  onSave: (ticker: string, input: FairValueSheetInput) => Promise<void>
}

/**
 * Owns which ticker is open within one session of the sheet - `ticker` only tells it where to
 * start. "Save and next" advances `current` without closing the sheet; reopening for a
 * different ticker (`ticker` changing while the sheet was shut) resets it.
 */
export function FairValueSheet({
  ticker,
  price,
  priceFor,
  queue = [],
  onClose,
  onSave,
}: FairValueSheetProps) {
  const [current, setCurrent] = useState(ticker)
  // Shared with the form below: the sheet focuses it on the very first open (overriding
  // BottomSheet's own default of focusing the panel); the form refocuses it itself on every
  // "Save and next" step after that, since BottomSheet's open-effect does not re-run then.
  const fieldRef = useRef<HTMLInputElement>(null)

  // "Adjusting state when a prop changes" (react.dev): reset `current` to the newly opened
  // ticker during render, without an effect - `current` otherwise needs to keep drifting away
  // from `ticker` as "Save and next" advances it.
  const [previousTicker, setPreviousTicker] = useState(ticker)
  if (ticker !== previousTicker) {
    setPreviousTicker(ticker)
    if (ticker !== null) setCurrent(ticker)
  }

  // `priceFor` wins whenever it is given, so a multi-ticker caller (Dashboard, Fair values)
  // gets the right price on every step, "Save and next" included - `price` alone only covers
  // the single ticker a caller like stock detail ever opens the sheet for.
  const currentPrice = priceFor ? priceFor(current ?? '') : price
  const next = current === null ? undefined : queue.find((t) => t !== current)

  return (
    <BottomSheet
      open={ticker !== null}
      onClose={onClose}
      title={current ? `Set ${current}'s fair value` : 'Set fair value'}
      initialFocus={fieldRef}
    >
      {ticker !== null && current !== null && (
        <FairValueForm
          key={current}
          ticker={current}
          price={currentPrice}
          next={next}
          fieldRef={fieldRef}
          onClose={onClose}
          onSave={onSave}
          onNext={setCurrent}
        />
      )}
    </BottomSheet>
  )
}

function FairValueForm({
  ticker,
  price,
  next,
  fieldRef,
  onClose,
  onSave,
  onNext,
}: {
  ticker: string
  price?: Numeric
  next?: string
  fieldRef: RefObject<HTMLInputElement | null>
  onClose: () => void
  onSave: (ticker: string, input: FairValueSheetInput) => Promise<void>
  onNext: (ticker: string) => void
}) {
  const [draft, setDraft] = useState<Draft>(blankDraft())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'save' | 'next' | null>(null)

  // Handles every mount after the first (a "Save and next" step): BottomSheet's own open-effect
  // does not re-run then, since `open` never changes, so this is the thing putting focus back
  // in the field for the next ticker.
  useEffect(() => {
    fieldRef.current?.focus()
  }, [fieldRef])

  const priceNumber = toNumber(price)
  const draftValue = toNumber(draft.value_usd)
  const discount =
    priceNumber !== null && draftValue !== null && draftValue > 0
      ? discountFrom(priceNumber, draftValue)
      : null
  const zone = zoneFor(discount)

  async function save(advance: boolean) {
    if (draft.value_usd.trim() === '') return setError('A value is required.')
    if (draftValue === null) return setError('Value must be a number.')
    if (draft.effective_date.trim() === '') return setError('A date is required.')

    setBusy(advance ? 'next' : 'save')
    try {
      await onSave(ticker, {
        value_usd: draft.value_usd.trim(),
        effective_date: draft.effective_date,
        note: draft.note.trim() === '' ? null : draft.note.trim(),
      })
      setError(null)
      if (advance && next) onNext(next)
      else onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save(false)
      }}
      className="flex flex-col gap-3"
    >
      <TextField
        ref={fieldRef}
        label="Fair value (USD)"
        inputMode="decimal"
        value={draft.value_usd}
        onChange={(e) => setDraft((d) => ({ ...d, value_usd: e.target.value }))}
        placeholder="0.00"
      />
      <TextField
        label="Date"
        type="date"
        value={draft.effective_date}
        onChange={(e) => setDraft((d) => ({ ...d, effective_date: e.target.value }))}
      />
      <TextField
        label="Note"
        value={draft.note}
        onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
        placeholder="Optional - why this number"
      />

      {error && <p className="text-small text-critical">{error}</p>}

      <p className="text-small text-ink-secondary">
        {priceNumber === null ? (
          'No stored price yet for this ticker, so there is no discount preview.'
        ) : discount === null ? (
          <>Current price {money(priceNumber)}.</>
        ) : (
          <>
            Current price {money(priceNumber)} ·{' '}
            <span className={zone?.tone === 'ahead' ? 'text-ahead' : 'text-behind'}>
              {percent(discount, { sign: false })} {zone?.label}
            </span>
          </>
        )}
      </p>

      <p className="text-small text-ink-muted">
        This always adds a new entry. Past estimates are kept, never overwritten - see this
        ticker&rsquo;s detail screen for the full history.
      </p>

      <div className="mt-1 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy !== null}>
          Cancel
        </Button>
        {next && (
          <Button variant="secondary" onClick={() => void save(true)} disabled={busy !== null}>
            {busy === 'next' ? 'Saving…' : `Save and next (${next})`}
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={busy !== null}>
          {busy === 'save' ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
