# Task 27 - Keyboard access for desktop table rows

**Model:** Sonnet. **Read:** `src/ui/DataTable.tsx` (lines ~153 and ~215), `docs/DESIGN.md`
section 3.3, task 27 in `docs/REMAINING_WORK.md`.

Confirmed still present. When `onRowSelect` is passed, the phone layout renders a real
`<button>` (line 153) but the desktop layout puts `onClick` on a bare `<tr>` (line 218) with no
`tabIndex` and no `onKeyDown`. A mouse can select a row; a keyboard cannot. Pre-existing since
task 10, noted as out of scope by task 11, and now used by Dashboard holdings, the decision list
and the per-account strip - so it is the one interaction pattern in the app that is mouse-only.

## Do

- Fix it in `DataTable` so every caller benefits: either make the first cell's content a real
  button, or give the row `tabIndex={0}` plus Enter/Space handling and an appropriate role.
  Whichever way, the focus ring must be visible on the new accent-wash hover background.
- Check the `rowAction` cell still swallows its own click (the comment at line ~233) and that
  tabbing reaches the action without first selecting the row.

## Out of scope

Any other interaction pattern, the phone layout (already a real button), redesigning `DataTable`.

## Acceptance

`npm run check` passes; keyboard-only walkthrough of the Dashboard holdings table and one
`rowAction` footer, recorded in the handoff entry.

**Next:** tasks/28-kit-code-split.md on Sonnet.
