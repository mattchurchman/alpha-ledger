# Task 13 - Installable app and iPhone icon
**Model:** Haiku. **Read:** CLAUDE.md, `docs/DESIGN.md` (colors only), `index.html`.

## Goal
A real-looking app icon on the iPhone home screen that opens full screen.

## Deliverables
- Web app manifest (name, short name, standalone display, theme and background colors), app icon set generated from one SVG including a 180px apple-touch-icon and maskable icons, iOS meta tags, status-bar style, splash/background color.
- Service worker that caches the app shell only. Never cache `/api/*` responses. If the login session has expired, the app must send the user to sign in rather than show a broken screen.
- `docs/INSTALL_IPHONE.md`: Safari, open the site, sign in, Share, "Add to Home Screen", plus what to do when asked to sign in again.

## Acceptance
- Lighthouse reports the app as installable. Icon files exist at the declared sizes. `npm run check` passes.

## Out of scope
Offline data, push notifications, native wrappers.

## You do
Add it to your home screen following the doc and confirm it opens without Safari's toolbar.
