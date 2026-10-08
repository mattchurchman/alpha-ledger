# Task 11 - Stock detail and decisions
**Model:** Sonnet. **Read:** CLAUDE.md, SPEC sections 5 (negative bucket), 6, 9 item 2; `docs/DESIGN.md`; `docs/ENGINE_API.md`.

## Goal
For one stock: did owning it beat VOO, and which individual buys were good.

## Deliverables
- Route `/stock/:ticker`, reachable from every ticker in the app, for current and closed positions.
- Measures: invested, current value, realized, unrealized, dividends, total return, IRR, shadow value, value added versus VOO.
- Chart: position value versus its VOO bucket over time with buy and sell markers.
- Decision list: each buy with date, dollars, outcome, the VOO outcome for the same dollars, and the difference.
- Negative-bucket tooltip text from SPEC 9. "How this is calculated" sheet in Settings covering SPEC 5 and 6 in plain language, including what is ignored.
- A placeholder slot where task 12 adds the fair-value chart.

## Acceptance
- Works for a closed position and a negative bucket. 390px and 1280px checked by screenshot. `npm run check` passes.

## Out of scope
Fair value.
