-- Task 06: the tables in SPEC section 3.
--
-- Money and share counts are TEXT, not REAL. They are exact decimal strings end to end:
-- the M1 parser emits them as strings, the engine wraps them in Decimal, and rounding
-- happens only at display (CLAUDE.md). SQLite REAL is a float64 and would quietly round
-- a fractional share count or a cent, so it is never used for a number that is money.
--
-- Dates are TEXT 'YYYY-MM-DD' (sorts correctly as text). Timestamps are TEXT ISO-8601 UTC.

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_label TEXT NOT NULL,
  trade_date TEXT NOT NULL,
  ticker TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell', 'dividend', 'split', 'adjust')),
  shares TEXT,
  amount_usd TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('m1', 'manual')),
  source_row_hash TEXT NOT NULL UNIQUE,
  note TEXT,
  excluded INTEGER NOT NULL DEFAULT 0 CHECK (excluded IN (0, 1))
);

-- The engine always reads the whole ledger, so the hot path is a full ordered scan.
CREATE INDEX transactions_by_date ON transactions (trade_date, ticker);
-- Activity screen filters by ticker (SPEC 9.4).
CREATE INDEX transactions_by_ticker ON transactions (ticker, trade_date);

CREATE TABLE ticker_alias (
  from_ticker TEXT NOT NULL,
  to_ticker TEXT NOT NULL,
  effective_date TEXT NOT NULL,
  PRIMARY KEY (from_ticker, effective_date)
);

-- One row per ticker holding its whole daily history as JSON, per SPEC 2's D1 write budget.
CREATE TABLE price_history (
  ticker TEXT PRIMARY KEY,
  fetched_at TEXT NOT NULL,
  series_json TEXT NOT NULL,
  splits_json TEXT NOT NULL,
  dividends_json TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('yahoo', 'manual'))
);

-- Append-only (SPEC 3): editing an estimate inserts a new row, which is what makes the
-- fair-value history chart on the stock detail screen possible.
CREATE TABLE fair_value (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT NOT NULL,
  value_usd TEXT NOT NULL,
  effective_date TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX fair_value_by_ticker ON fair_value (ticker, effective_date);

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
