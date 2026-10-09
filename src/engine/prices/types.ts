export interface PriceSplitEvent {
  date: string
  numerator: number
  denominator: number
}

export interface PriceDividendEvent {
  date: string
  amount: string
}

/** Normalized shape returned by `GET /api/prices/:ticker`. */
export interface PriceHistory {
  dates: string[]
  close: string[]
  adjClose: string[]
  splits: PriceSplitEvent[]
  dividends: PriceDividendEvent[]
  asOf: string
}
