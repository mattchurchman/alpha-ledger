import Decimal from 'decimal.js'
import type { SplitAdjustedTransaction } from './holdings'

/**
 * The headline measures of SPEC section 6: value added against the benchmark, the percent
 * difference rule, and money-weighted return (IRR) by bisection.
 *
 * Every "show a dash" rule in the spec is a `null` return here. The engine never guesses a
 * rate: if the flows do not bracket a root, or there is nothing to annualize over, the
 * answer is `null` and the UI shows a dash.
 */

/** One cash flow from the investor's point of view: money out is negative, money in positive. */
export interface IrrFlow {
  date: string
  amount: string
}

const DAYS_PER_YEAR = 365

/** Rates at or below -100% are meaningless, and NPV diverges as the rate approaches it. */
const MIN_RATE = -0.9999
const MAX_RATE = 1e9
const BISECTION_STEPS = 200

/**
 * Investor-perspective cash flows for the real side: a buy is money out, a sell or a cash
 * dividend is money in. `split` and `adjust` rows move no money. The caller appends the
 * closing value (current value on the real side, bucket value on the shadow side) as the
 * final flow - both sides share these flows, which is the whole premise of the comparison.
 */
export function cashFlows(
  adjusted: SplitAdjustedTransaction[],
  upTo: string,
  ticker?: string,
): IrrFlow[] {
  const flows: IrrFlow[] = []

  for (const txn of adjusted) {
    if (txn.trade_date > upTo) continue
    if (ticker !== undefined && txn.ticker !== ticker) continue

    const amount = new Decimal(txn.amount_usd).abs()
    if (amount.isZero()) continue

    if (txn.type === 'buy') flows.push({ date: txn.trade_date, amount: amount.neg().toFixed() })
    else if (txn.type === 'sell' || txn.type === 'dividend')
      flows.push({ date: txn.trade_date, amount: amount.toFixed() })
  }

  return flows.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Annualized money-weighted return, as a decimal fraction (`"0.1234"` is 12.34%), found by
 * bisection on `NPV(r) = sum(amount / (1 + r) ^ (days / 365)) = 0`.
 *
 * Null - a dash in the UI - when there is nothing to solve: fewer than two non-zero flows,
 * no sign change among them (money only ever went one way, so there is no rate), every
 * flow on one day (no time to annualize over), or no root inside `(-99.99%, 1e9]`.
 *
 * This is the one place the engine computes in `number` rather than `Decimal`. A rate is
 * not money: the search needs fractional powers thousands of times over, `Decimal.pow`
 * would make the dashboard crawl, and float64 carries ~15 significant digits into a figure
 * displayed to four. The flows themselves stay exact everywhere else.
 */
export function annualizedIrr(flows: IrrFlow[]): string | null {
  const points = flows.flatMap((flow) => {
    const day = dayNumber(flow.date)
    const amount = Number(flow.amount)
    if (day === null || amount === 0 || !Number.isFinite(amount)) return []
    return [{ day, amount }]
  })

  if (points.length < 2) return null
  if (!points.some((p) => p.amount > 0) || !points.some((p) => p.amount < 0)) return null

  const first = Math.min(...points.map((p) => p.day))
  const years = points.map((p) => ({
    t: (p.day - first) / DAYS_PER_YEAR,
    amount: p.amount,
  }))
  if (years.every((p) => p.t === years[0].t)) return null

  const npv = (rate: number): number => {
    let total = 0
    for (const point of years) total += point.amount / Math.pow(1 + rate, point.t)
    return total
  }

  let lo = MIN_RATE
  let hi = 1
  let atLo = npv(lo)
  let atHi = npv(hi)
  if (!Number.isFinite(atLo) || !Number.isFinite(atHi)) return null

  while (atLo * atHi > 0 && hi < MAX_RATE) {
    hi *= 4
    atHi = npv(hi)
    if (!Number.isFinite(atHi)) return null
  }
  if (atLo * atHi > 0) return null

  for (let step = 0; step < BISECTION_STEPS; step++) {
    const mid = (lo + hi) / 2
    const atMid = npv(mid)
    if (atMid === 0) return new Decimal(mid).toFixed(6)
    if (atLo * atMid < 0) {
      hi = mid
    } else {
      lo = mid
      atLo = atMid
    }
    if (hi - lo < 1e-12) break
  }

  return new Decimal((lo + hi) / 2).toFixed(6)
}

/**
 * IRR of one side of the comparison: the shared cash flows plus the closing value as the
 * final flow. A zero closing value (a fully closed position) is simply not appended - it
 * changes no NPV term, and appending a zero would not create the sign change the bisection
 * needs anyway.
 */
export function irrWithFinalValue(
  flows: IrrFlow[],
  finalValue: string,
  finalDate: string,
): string | null {
  const value = new Decimal(finalValue)
  const all = value.isZero() ? flows : [...flows, { date: finalDate, amount: value.toFixed() }]
  return annualizedIrr(all)
}

/**
 * Shadow-side IRR. Identical to the real side except for SPEC section 6's extra rule: a
 * bucket that is not positive gets a dash rather than a rate. A negative bucket is a
 * meaningful dollar figure (the stock returned more cash than VOO would have been worth),
 * but there is no sensible rate of return on it.
 */
export function shadowIrr(flows: IrrFlow[], shadowValue: string, finalDate: string): string | null {
  if (new Decimal(shadowValue).lte(0)) return null
  return irrWithFinalValue(flows, shadowValue, finalDate)
}

/** The headline number (SPEC section 6). Valid for closed positions, where current value is 0. */
export function valueAdded(currentValue: string, shadowValue: string): string {
  return new Decimal(currentValue).minus(shadowValue).toFixed()
}

/**
 * Value added as a fraction of what the benchmark would have been worth. Null when the
 * bucket is zero or negative: dividing by it would turn "beat the benchmark" into a
 * negative percentage, which reads as the opposite of the truth.
 */
export function percentDifference(currentValue: string, shadowValue: string): string | null {
  const shadow = new Decimal(shadowValue)
  if (shadow.lte(0)) return null
  return new Decimal(currentValue).minus(shadow).div(shadow).toFixed()
}

/** Days since the epoch for a `YYYY-MM-DD` date, or null if it will not parse. */
function dayNumber(date: string): number | null {
  const parsed = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed)) return null
  return Math.round(parsed / 86_400_000)
}
