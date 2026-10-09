/**
 * Synthetic data for the `/kit` demo route. Invented tickers, invented numbers, and a seeded
 * generator so every reload - and every screenshot - is identical.
 *
 * CLAUDE.md's privacy rule: nothing here may resemble a real holding. The tickers are made up,
 * the dates start on a round Monday, and the shapes are chosen to exercise the components
 * (several crossings, a negative bucket, a closed position, a missing estimate) rather than to
 * look like anyone's portfolio.
 */

/** Deterministic, so the screenshots in docs/ stay comparable. */
function lcg(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

/** Weekdays only, which is close enough to a trading calendar for a demo. */
function tradingDays(from: string, count: number): string[] {
  const days: string[] = []
  const cursor = new Date(`${from}T00:00:00Z`)
  while (days.length < count) {
    const weekday = cursor.getUTCDay()
    if (weekday !== 0 && weekday !== 6) days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

export const DEMO_DAYS = 1566 // six years of trading days: the number the kit has to stay smooth at

/**
 * The portfolio against its shadow. The shadow is a steady accumulating benchmark; the real
 * line rides a slow wave around it, so the pair crosses several times and the gap band has to
 * split - which is the thing worth looking at in the screenshots.
 */
function buildHistory() {
  const dates = tradingDays('2020-10-05', DEMO_DAYS)
  const random = lcg(20261008)
  const you: string[] = []
  const shadow: string[] = []

  let benchmark = 8_000
  for (let i = 0; i < dates.length; i += 1) {
    // Deposits plus drift, with enough noise to look like a market and not a spreadsheet.
    benchmark *= 1 + 0.00035 + (random() - 0.5) * 0.009
    benchmark += 14
    const wave = 0.19 * Math.sin(i / 190) + 0.05 * Math.sin(i / 37) + (random() - 0.5) * 0.012
    you.push((benchmark * (1 + wave)).toFixed(2))
    shadow.push(benchmark.toFixed(2))
  }
  return { dates, you, shadow }
}

export const history = buildHistory()

const lastValue = Number(history.you[history.you.length - 1])
const lastShadow = Number(history.shadow[history.shadow.length - 1])

export const headline = {
  portfolioValue: lastValue.toFixed(2),
  shadowValue: lastShadow.toFixed(2),
  valueAdded: (lastValue - lastShadow).toFixed(2),
  percentDifference: ((lastValue - lastShadow) / lastShadow).toFixed(6),
  irr: '0.1487',
  shadowIrr: '0.1162',
}

/** Every ticker ever held, including two closed positions and one negative bucket. */
export const creators = [
  { label: 'ACME', value: '18420.55' },
  { label: 'BRIK', value: '-9260.10' },
  { label: 'CNDL', value: '7310.00' },
  { label: 'DRFT', value: '-5125.75' },
  { label: 'EMBR', value: '4980.20' },
  { label: 'FLUX', value: '3120.45' },
  { label: 'GIRO', value: '-2890.00' },
  { label: 'HALO', value: '2240.60' },
  { label: 'IRIS', value: '1510.25' },
  { label: 'JOLT', value: '-1320.80' },
  { label: 'KELP', value: '940.00' },
  { label: 'LUMEN', value: '-610.35' },
  { label: 'MICA', value: '415.70' },
  { label: 'NOVA', value: '-280.15' },
]

export interface DemoHolding {
  ticker: string
  price: string
  value: string
  valueAdded: string
  irr: string | null
  fairValue: string | null
  discount: string | null
}

export const holdings: DemoHolding[] = [
  {
    ticker: 'ACME',
    price: '184.20',
    value: '42180.00',
    valueAdded: '18420.55',
    irr: '0.2140',
    fairValue: '240.00',
    discount: '0.2325',
  },
  {
    ticker: 'BRIK',
    price: '21.45',
    value: '12870.00',
    valueAdded: '-9260.10',
    irr: '-0.0820',
    fairValue: '19.00',
    discount: '-0.1289',
  },
  {
    ticker: 'CNDL',
    price: '96.10',
    value: '19220.00',
    valueAdded: '7310.00',
    irr: '0.1410',
    fairValue: '112.00',
    discount: '0.1420',
  },
  {
    ticker: 'DRFT',
    price: '7.82',
    value: '3128.00',
    valueAdded: '-5125.75',
    irr: '-0.2260',
    fairValue: '6.00',
    discount: '-0.3033',
  },
  {
    ticker: 'EMBR',
    price: '311.00',
    value: '15550.00',
    valueAdded: '4980.20',
    irr: '0.1890',
    fairValue: null,
    discount: null,
  },
  {
    // A closed position: no shares left, but value added is still a real number (SPEC 6).
    ticker: 'GIRO',
    price: '44.05',
    value: '0.00',
    valueAdded: '-2890.00',
    irr: null,
    fairValue: '58.00',
    discount: '0.2405',
  },
]

/** One ticker's price history with a handful of fair-value revisions over it. */
function buildStockDetail() {
  const dates = tradingDays('2024-01-02', 690)
  const random = lcg(4242)
  const price: string[] = []
  let close = 96
  for (let i = 0; i < dates.length; i += 1) {
    close *= 1 + 0.0007 + (random() - 0.5) * 0.026
    close += Math.sin(i / 64) * 0.05
    price.push(close.toFixed(2))
  }
  return { dates, price }
}

export const stockDetail = buildStockDetail()

export const estimates = [
  { date: '2024-02-15', value: '120.00', note: 'First pass, 12x forward earnings' },
  { date: '2024-09-03', value: '155.00', note: 'Raised after the margin guidance' },
  { date: '2025-04-21', value: '140.00', note: 'Trimmed: the buyback stopped' },
  { date: '2025-11-10', value: '205.00', note: 'New segment finally profitable' },
  { date: '2026-06-01', value: '240.00', note: null },
]

/** A short series for the sparkline, which is deliberately axis-less and value-less. */
export const sparkline = history.you.slice(-90).filter((_, i) => i % 3 === 0)
