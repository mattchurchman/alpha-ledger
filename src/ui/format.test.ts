import { describe, expect, it } from 'vitest'
import {
  MINUS,
  NA,
  dateFull,
  dateShort,
  money,
  moneyAxis,
  moneyCompact,
  moneyExact,
  percent,
  relativeTime,
  shares,
  signGlyph,
  signedMoney,
  signedPercent,
  toNumber,
} from './format'

describe('toNumber', () => {
  it('accepts the exact decimal strings the engine produces', () => {
    expect(toNumber('1284.0700000')).toBe(1284.07)
    expect(toNumber('-0.5')).toBe(-0.5)
    expect(toNumber(42)).toBe(42)
  })

  it('treats anything unusable as missing rather than zero', () => {
    expect(toNumber(null)).toBeNull()
    expect(toNumber(undefined)).toBeNull()
    expect(toNumber('')).toBeNull()
    expect(toNumber('   ')).toBeNull()
    expect(toNumber('abc')).toBeNull()
    expect(toNumber(NaN)).toBeNull()
    expect(toNumber(Infinity)).toBeNull()
  })
})

describe('money', () => {
  it('shows cents below $1,000 and drops them above', () => {
    expect(money('0.42')).toBe('$0.42')
    expect(money('184.2')).toBe('$184.20')
    expect(money('1284.07')).toBe('$1,284')
    expect(money('2480133.19')).toBe('$2,480,133')
  })

  it('puts the minus outside the dollar sign, as a real minus', () => {
    expect(money(-3140)).toBe(`${MINUS}$3,140`)
    expect(money(-12.5)).toBe(`${MINUS}$12.50`)
    expect(money(-3140)).not.toContain('-')
  })

  it('renders a missing value as a dash, never as $0', () => {
    expect(money(null)).toBe(NA)
    expect(money(undefined)).toBe(NA)
    expect(money('')).toBe(NA)
  })

  it('still prints a genuine zero', () => {
    expect(money(0)).toBe('$0.00')
  })
})

describe('moneyExact', () => {
  it('always carries two decimals so columns line up', () => {
    expect(moneyExact('1284.07')).toBe('$1,284.07')
    expect(moneyExact(1284)).toBe('$1,284.00')
    expect(moneyExact('-1284.5')).toBe(`${MINUS}$1,284.50`)
  })
})

describe('moneyCompact', () => {
  it('abbreviates from $10,000 up', () => {
    expect(moneyCompact(12_900)).toBe('$12.9K')
    expect(moneyCompact(4_200_000)).toBe('$4.2M')
    expect(moneyCompact(1_300_000_000)).toBe('$1.3B')
  })

  it('trims a pointless trailing .0', () => {
    expect(moneyCompact(12_000)).toBe('$12K')
  })

  it('keeps full precision below the threshold, where it still carries information', () => {
    expect(moneyCompact(9872)).toBe('$9,872')
    expect(moneyCompact(42.5)).toBe('$42.50')
  })

  it('abbreviates negatives the same way', () => {
    expect(moneyCompact(-55_500)).toBe(`${MINUS}$55.5K`)
  })
})

describe('moneyAxis', () => {
  it('labels the baseline $0 rather than $0.00', () => {
    expect(moneyAxis(0)).toBe('$0')
  })

  it('drops cents a tick can never have', () => {
    expect(moneyAxis(250)).toBe('$250')
    expect(moneyAxis(5000)).toBe('$5,000')
    expect(moneyAxis(-5000)).toBe(`${MINUS}$5,000`)
  })

  it('abbreviates from $10,000 and keeps cents below $1', () => {
    expect(moneyAxis(40_000)).toBe('$40K')
    expect(moneyAxis(0.25)).toBe('$0.25')
    expect(moneyAxis(null)).toBe(NA)
  })
})

describe('percent', () => {
  it('takes a decimal fraction, the way the engine reports it', () => {
    expect(percent(0.124)).toBe('+12.4%')
    expect(percent('0.123456')).toBe('+12.3%')
    expect(percent(-0.03)).toBe(`${MINUS}3.0%`)
    expect(percent(0)).toBe('0.0%')
  })

  it('can drop the plus where the value is not a delta', () => {
    expect(percent(0.124, { sign: false })).toBe('12.4%')
    expect(percent(-0.124, { sign: false })).toBe(`${MINUS}12.4%`)
  })

  it('abbreviates an annualized figure instead of clamping it', () => {
    // ENGINE_API warns that a large gain over a few days is a genuine millions-of-percent IRR.
    expect(percent(12.3456)).toBe('+1.2K%')
    expect(percent(50_000)).toBe('+5M%')
  })

  it('dashes a null IRR rather than guessing a rate', () => {
    expect(percent(null)).toBe(NA)
  })
})

describe('signs', () => {
  it('points the glyph the right way and drops it at zero', () => {
    expect(signGlyph(1)).toBe('▲')
    expect(signGlyph(-1)).toBe('▼')
    expect(signGlyph(0)).toBe('')
    expect(signGlyph(null)).toBe('')
  })

  it('composes glyph, sign and magnitude so hue is never the only cue', () => {
    expect(signedMoney(12_480)).toBe('▲ +$12,480')
    expect(signedMoney(-3140)).toBe(`▼ ${MINUS}$3,140`)
    expect(signedMoney(12_480, true)).toBe('▲ +$12.5K')
    expect(signedMoney(0)).toBe('$0.00')
    expect(signedMoney(null)).toBe(NA)
  })

  it('does the same for percentages', () => {
    expect(signedPercent(0.124)).toBe('▲ +12.4%')
    expect(signedPercent(-0.03)).toBe(`▼ ${MINUS}3.0%`)
    expect(signedPercent(0)).toBe('0.0%')
    expect(signedPercent(null)).toBe(NA)
  })
})

describe('shares', () => {
  it('trims trailing zeros but keeps fractional shares', () => {
    expect(shares('12.000000')).toBe('12')
    expect(shares('3.5')).toBe('3.5')
    expect(shares('0.004219')).toBe('0.004219')
    expect(shares(null)).toBe(NA)
  })
})

describe('dates', () => {
  const now = new Date('2026-10-08T12:00:00Z')

  it('drops the year inside the reference year and keeps it outside', () => {
    expect(dateShort('2026-10-03', now)).toBe('Oct 3')
    expect(dateShort('2024-12-31', now)).toBe('Dec 31, 2024')
  })

  it('reads the date as written rather than shifting it a day west of Greenwich', () => {
    // `new Date('2026-01-01')` is UTC midnight, which is Dec 31 in every US timezone.
    expect(dateShort('2026-01-01', now)).toBe('Jan 1')
  })

  it('always carries the year in the long form', () => {
    expect(dateFull('2026-10-03')).toBe('Oct 3, 2026')
  })

  it('dashes anything that is not a date', () => {
    expect(dateShort(null)).toBe(NA)
    expect(dateShort('not-a-date')).toBe(NA)
    expect(dateShort('2026-13-01')).toBe(NA)
    expect(dateFull(undefined)).toBe(NA)
  })
})

describe('relativeTime', () => {
  const now = new Date('2026-10-08T12:00:00Z')

  it('counts up through minutes, hours and days', () => {
    expect(relativeTime('2026-10-08T11:59:30Z', now)).toBe('just now')
    expect(relativeTime('2026-10-08T11:30:00Z', now)).toBe('30m ago')
    expect(relativeTime('2026-10-08T10:00:00Z', now)).toBe('2h ago')
    expect(relativeTime('2026-10-05T12:00:00Z', now)).toBe('3d ago')
  })

  it('falls back to a date past a week', () => {
    expect(relativeTime('2026-09-01T12:00:00Z', now)).toBe('Sep 1')
  })

  it('handles a clock skewed into the future and a missing timestamp', () => {
    expect(relativeTime('2026-10-08T12:05:00Z', now)).toBe('just now')
    expect(relativeTime(null, now)).toBe(NA)
    expect(relativeTime('nonsense', now)).toBe(NA)
  })
})
