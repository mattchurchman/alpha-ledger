# Task 36 - Bring the brand palette into the design tokens

**Model:** Opus. **Effort:** medium. **Context budget:** ~70k.
**Runs on:** anywhere.
**Read:** `docs/BRAND.md`, `docs/DESIGN.md` sections 1, 2 and 7, `src/index.css` (token blocks
only), `src/ui/theme.ts`. The `dataviz` skill's `scripts/validate_palette.js` if available.

## Goal
The app looks like the brand: navy as the brand ink, royal blue as the accent - without breaking
any data rule DESIGN.md has validated.

## Steps
1. Candidate tokens: light `--al-accent` Royal `#1F4FD8`, a navy brand-surface token for the app
   header/hero, plane Paper `#F5F7FA`, rule Mist-derived; dark `--al-accent` from Sky `#7FA2FF`
   and a navy-tinted dark plane. Adjust hexes as needed to pass.
2. Run the validator for every row of DESIGN section 7 with the new values (ahead/behind,
   ahead/behind/benchmark, both modes) plus text contrast for every ink on every surface,
   including white-on-navy and accent-on-plane. Record each run in section 7. A failing pair
   changes the hex, not the rule.
3. Update DESIGN section 2 and add a short "Brand" pointer to `docs/BRAND.md`. Card style: one
   radius, one soft elevation token for raised cards (concept's white cards on a pale plane).
4. Check `/kit` renders in both modes at 390px and 1280px (`npm run screenshots`); send the shots
   to the owner.

## Out of scope
Logos/icons (task 37), wording (38), layout changes (39). Green for gains - rejected, DESIGN 7.

## Acceptance
`npm run check` passes; every validator row PASS and recorded; screenshots attached in handoff.

**Next:** tasks/37-brand-assets.md on Sonnet (effort low) - budget ~45k.
