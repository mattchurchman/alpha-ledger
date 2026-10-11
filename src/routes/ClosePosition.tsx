import { useMemo, useState } from 'react'
import { api, ApiError, NotAuthenticatedError } from '../api/client'
import { usePortfolioData } from '../data/usePortfolioData'
import { closeOutPlan, exchangePlan, isClosedPosition, type CashBasis } from '../engine'
import {
  BottomSheet,
  Button,
  money,
  Select,
  shares as formatShares,
  TextField,
  useToast,
} from '../ui'

/**
 * Task 18's one affordance for a company that is gone. Opened from the Dashboard's delisted
 * prompt, a holdings row, and the stock detail screen - all three hand it a ticker and get out
 * of the way.
 *
 * The important thing it is *not*: a delete. A bought-out holding still shows shares because
 * the ledger never recorded the exit - M1 pays a buyout out as cash, and the parser drops cash
 * rows - so the fix is to **write the exit down**, after which the ticker leaves Holdings,
 * Rebuy and Fair values on its own and keeps its place in the history as Closed. Hiding is the
 * separate, weaker option for when the user just wants it out of sight; it changes no number.
 */

type Mode = 'cash' | 'exchange' | 'hide'

const MODE_OPTIONS = [
  { value: 'cash', label: 'Bought out for cash' },
  { value: 'exchange', label: 'Became another ticker' },
  { value: 'hide', label: 'Just hide it' },
]

const BASIS_OPTIONS = [
  { value: 'total', label: 'Total cash received' },
  { value: 'perShare', label: 'Cash per share' },
]

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export interface ClosePositionSheetProps {
  /** The ticker to act on; `null` keeps the sheet shut. */
  ticker: string | null
  onClose: () => void
}

/**
 * The sheet itself holds no form state. `BottomSheet` unmounts its children when it closes
 * and the form is keyed by ticker, so every opening starts blank - a half-filled buyout date
 * left over from the last one is exactly the kind of thing that writes a wrong transaction.
 */
export function ClosePositionSheet({ ticker, onClose }: ClosePositionSheetProps) {
  return (
    <BottomSheet
      open={ticker !== null}
      onClose={onClose}
      title={ticker ? `${ticker}: close or hide` : 'Close or hide'}
    >
      {ticker !== null && <CloseForm key={ticker} ticker={ticker} onClose={onClose} />}
    </BottomSheet>
  )
}

function CloseForm({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const toast = useToast()
  const { transactions, prices, aliases, result, hiddenTickers, reload, setTickerHidden } =
    usePortfolioData()

  const [mode, setMode] = useState<Mode>('cash')
  const [account, setAccount] = useState('')
  const [date, setDate] = useState(todayDate())
  const [cash, setCash] = useState('')
  const [cashBasis, setCashBasis] = useState<CashBasis>('total')
  const [toTicker, setToTicker] = useState('')
  const [ratio, setRatio] = useState('1')
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const analysis = useMemo(
    () => result?.byTicker.find((t) => t.ticker === ticker) ?? null,
    [result, ticker],
  )
  const accounts = analysis?.accounts ?? []
  const hidden = hiddenTickers.includes(ticker)
  /**
   * The account the sell is booked to. Basis is pooled across accounts (SPEC section 4), so
   * the engine reads one sell for the whole position whichever label it carries; the label is
   * bookkeeping, and defaulting to the first means a single-account position never asks.
   */
  const chosenAccount = accounts.includes(account) ? account : (accounts[0] ?? '')

  /** The sell the cash path would write, recomputed as the form is typed into. */
  const plan = useMemo(() => {
    if (mode !== 'cash') return null
    return closeOutPlan({ transactions, prices, aliases, ticker, date, cash, cashBasis })
  }, [ticker, mode, transactions, prices, aliases, date, cash, cashBasis])

  /** The alias the exchange path would write, and the share correction it needs with it. */
  const exchange = useMemo(() => {
    if (mode !== 'exchange' || !result) return null
    return exchangePlan({
      transactions,
      prices,
      aliases,
      from: ticker,
      to: toTicker,
      effectiveDate: date,
      ratio,
      asOf: result.asOf,
    })
  }, [mode, result, transactions, prices, aliases, ticker, toTicker, date, ratio])

  function report(err: unknown) {
    if (err instanceof NotAuthenticatedError) toast.show(err.message, { status: 'critical' })
    else if (err instanceof ApiError) setFormError(err.message)
    else toast.show(err instanceof Error ? err.message : String(err), { status: 'critical' })
  }

  async function closeForCash() {
    if (plan === null || !plan.ok) {
      setFormError(plan?.reason ?? 'Enter the date and the cash received.')
      return
    }
    if (chosenAccount === '') {
      setFormError('Pick the account the cash landed in.')
      return
    }

    setBusy(true)
    try {
      await api.transactions.create({
        account_label: chosenAccount,
        trade_date: plan.sell.trade_date,
        ticker: plan.sell.ticker,
        type: 'sell',
        shares: plan.sell.shares,
        amount_usd: plan.sell.amount_usd,
        source: 'manual',
        source_row_hash: `manual-${crypto.randomUUID()}`,
        note: `Closed out: bought out for cash at ${money(plan.sell.perShare)} per share`,
      })
      await reload()
      toast.show(`${ticker} closed out for ${money(plan.sell.amount_usd)}.`, { status: 'good' })
      onClose()
    } catch (err) {
      report(err)
    } finally {
      setBusy(false)
    }
  }

  async function closeForExchange() {
    if (exchange === null || !exchange.ok) {
      setFormError(exchange?.reason ?? 'Enter the ticker it became.')
      return
    }
    const { alias, adjust } = exchange.plan

    setBusy(true)
    try {
      await api.aliases.create(alias)
      // The alias alone only moves the history under the new symbol; a share count that does
      // not survive the move needs correcting too (SPEC Decision log, 2026-10-11).
      if (adjust) {
        await api.transactions.create({
          account_label: chosenAccount || 'manual',
          trade_date: adjust.trade_date,
          ticker: adjust.ticker,
          type: 'adjust',
          shares: adjust.shares,
          amount_usd: '0',
          source: 'manual',
          source_row_hash: `manual-${crypto.randomUUID()}`,
          note: `Exchange ratio ${ratio} on ${ticker} becoming ${adjust.ticker}`,
        })
      }
      await reload()
      toast.show(`${ticker} now resolves to ${alias.to_ticker}.`, { status: 'good' })
      onClose()
    } catch (err) {
      report(err)
    } finally {
      setBusy(false)
    }
  }

  async function hideIt() {
    setBusy(true)
    try {
      await setTickerHidden(ticker, true)
      toast.show(`${ticker} hidden. Your totals are unchanged.`, { status: 'good' })
      onClose()
    } catch (err) {
      report(err)
    } finally {
      setBusy(false)
    }
  }

  const submit = () => {
    if (mode === 'cash') return void closeForCash()
    if (mode === 'exchange') return void closeForExchange()
    return void hideIt()
  }

  const submitLabel =
    mode === 'cash' ? 'Record the buyout' : mode === 'exchange' ? 'Record the change' : 'Hide it'

  return (
    <div className="flex flex-col gap-3">
      {analysis && isClosedPosition(analysis) ? (
        <p className="max-w-prose text-small text-ink-secondary">
          {ticker} is already closed - it holds no shares, so it is out of Holdings, Rebuy and Fair
          values already and keeps its place in the history.
        </p>
      ) : (
        <>
          <p className="max-w-prose text-small text-ink-secondary">
            {analysis ? (
              <>
                You hold{' '}
                <strong className="font-medium text-ink">{formatShares(analysis.shares)}</strong>{' '}
                shares of {ticker}
                {accounts.length > 0 && ` in ${accounts.join(', ')}`}. Recording the exit is what
                takes it out of the lists; hiding only takes it out of sight.
              </>
            ) : (
              <>This ticker has no position in your ledger.</>
            )}
          </p>

          <Select
            label="What happened"
            options={MODE_OPTIONS}
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as Mode)
              setFormError(null)
            }}
          />

          {mode === 'cash' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Date it settled"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                <TextField
                  label="Cash received"
                  inputMode="decimal"
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <Select
                label="That figure is"
                options={BASIS_OPTIONS}
                value={cashBasis}
                onChange={(e) => setCashBasis(e.target.value as CashBasis)}
              />
              {accounts.length > 1 && (
                <Select
                  label="Account"
                  options={accounts.map((a) => ({ value: a, label: a }))}
                  value={chosenAccount}
                  onChange={(e) => setAccount(e.target.value)}
                />
              )}
              <div className="rounded-control bg-sunken p-3 text-small">
                {plan?.ok ? (
                  <p className="max-w-prose text-ink-secondary">
                    Writes one sell of{' '}
                    <strong className="font-medium text-ink">
                      {formatShares(plan.sell.shares)}
                    </strong>{' '}
                    shares on {plan.sell.trade_date} for{' '}
                    <strong className="font-medium text-ink">{money(plan.sell.amount_usd)}</strong>{' '}
                    - {money(plan.sell.perShare)} per share. Shares then go to zero and {ticker}{' '}
                    reads as Closed.
                  </p>
                ) : (
                  <p className="max-w-prose text-ink-muted">
                    {cash.trim() === ''
                      ? 'Enter the cash received and this says exactly what it will write.'
                      : plan?.reason}
                  </p>
                )}
              </div>
            </>
          )}

          {mode === 'exchange' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="It became"
                  value={toTicker}
                  onChange={(e) => setToTicker(e.target.value.toUpperCase())}
                  placeholder="NEW"
                />
                <TextField
                  label="Effective date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <TextField
                label="Exchange ratio"
                inputMode="decimal"
                value={ratio}
                onChange={(e) => setRatio(e.target.value)}
                hint="New shares per old share. 1 for a straight rename."
              />
              <div className="rounded-control bg-sunken p-3 text-small">
                {exchange?.ok ? (
                  <p className="max-w-prose text-ink-secondary">
                    Records the alias, so every {ticker} row dated on or before that date resolves
                    under {exchange.plan.alias.to_ticker}. Your{' '}
                    <strong className="font-medium text-ink">
                      {formatShares(exchange.plan.sharesHeld)}
                    </strong>{' '}
                    shares become{' '}
                    <strong className="font-medium text-ink">
                      {formatShares(exchange.plan.targetShares)}
                    </strong>
                    .
                    {exchange.plan.adjust ? (
                      <>
                        {' '}
                        The alias on its own would leave{' '}
                        {formatShares(exchange.plan.sharesFromAliasAlone)}, so it also writes an
                        adjustment of{' '}
                        <strong className="font-medium text-ink">
                          {formatShares(exchange.plan.adjust.shares)}
                        </strong>{' '}
                        shares on that date to make up the difference.
                      </>
                    ) : (
                      ' The alias alone gets that right, so nothing else is written.'
                    )}
                  </p>
                ) : (
                  <p className="max-w-prose text-ink-muted">
                    {toTicker.trim() === ''
                      ? 'Enter the ticker it became and this says exactly what it will write.'
                      : exchange?.reason}
                  </p>
                )}
                <p className="mt-2 max-w-prose text-ink-muted">
                  Check the share count again after the next price update. A rename usually brings
                  the old split history with it on the new symbol, which moves the count - the fix
                  for that is reconciliation on Import.
                </p>
              </div>
            </>
          )}

          {mode === 'hide' && (
            <div className="rounded-control bg-sunken p-3 text-small">
              <p className="max-w-prose text-ink-secondary">
                Takes {ticker} out of Holdings, Rebuy opportunities and Fair values.{' '}
                <strong className="font-medium text-ink">Hiding never changes a total</strong> -
                portfolio value, value added and every chart still count it in full. Unhide it any
                time in Settings.
              </p>
            </div>
          )}
        </>
      )}

      {formError && <p className="text-small text-critical">{formError}</p>}

      <div className="mt-1 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          {analysis && isClosedPosition(analysis) ? 'Close' : 'Cancel'}
        </Button>
        {analysis && !isClosedPosition(analysis) && (
          <Button variant="primary" onClick={submit} disabled={busy || (mode === 'hide' && hidden)}>
            {busy ? 'Saving…' : mode === 'hide' && hidden ? 'Already hidden' : submitLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
