# Task 10 - Dashboard
**Model:** Sonnet. **Read:** CLAUDE.md, SPEC sections 6, 7 (zones only), 9 item 1; `docs/DESIGN.md`; `docs/ENGINE_API.md`; `src/ui/` exports.

## Goal
Open the app and know within five seconds: am I beating VOO, and what looks cheap.

## Deliverables
- Headline: portfolio value, VOO-equivalent value, dollar gap, percent gap, IRR for both. The gap is the hero.
- History chart: both lines, shaded gap, range selector (1Y, 3Y, All), scrub to read values.
- Rebuy opportunities: holdings ranked by discount to fair value with the discount meter; "No estimate yet" group with a shortcut to add one.
- Holdings table per SPEC 9, sortable, cards on phone.
- Value creators and destroyers: every ticker ever owned by dollars added versus VOO, closed positions marked.
- Fair values read from the API; if none exist the section explains itself.

## Acceptance
- All numbers come from `analyze`; no arithmetic in components beyond formatting.
- Correct at 390px and 1280px, light and dark, with synthetic data including a negative bucket and a closed position. Screenshot and check. `npm run check` passes.

## Out of scope
Stock detail, fair-value editing UI beyond the shortcut link.
