# Installing Alpha Ledger on iPhone

Alpha Ledger is a web app installable on any device with a modern browser. On iOS, it runs from the home screen as a full-screen app, just like a native app.

## Install Steps

1. **Open Safari** (or another iOS browser like Chrome; Safari is recommended).

2. **Navigate to Alpha Ledger** at `https://alpha-ledger.alpha-ledger.workers.dev` (or your self-hosted URL).

3. **Sign in** with your authentication token.

4. **Open the Share menu**: Tap the **Share** button (the square with an arrow).

5. **Add to Home Screen**: Scroll down and tap **Add to Home Screen**.

6. **Confirm the name and icon**: You'll see "Ledger" (the short name) and the app icon. Tap **Add** in the top-right.

7. **Open from home screen**: The app now appears on your home screen as "Ledger". Tap it to open the app.

## What to Expect

- The app opens **full screen** without Safari's address bar or toolbar.
- The status bar at the top (time, battery, signal) is visible.
- Everything works exactly like the web version, including offline support for the last visited screens.

## Sign In Again

If your login session expires and you see "Please sign in again," just sign in - the app will resume where you left off. The session cookie is good for one year, so you shouldn't see this often.

## Troubleshooting

**"Add to Home Screen" is greyed out**
- Make sure you signed in first. Unsigned apps can't be installed on iOS.
- Try a different browser (Safari is recommended).

**The app doesn't open full screen**
- Make sure you added it to the home screen, not just bookmarked the page.
- Delete it from the home screen and try the install steps again.

**The app looks zoomed in or weird**
- Close the app fully (swipe up from the bottom) and reopen it.
- If problems persist, delete it and reinstall.

## Updating the App

Alpha Ledger updates automatically via its service worker:
- The first time you open it each day, it checks for new versions.
- Any updates download silently in the background.
- The next time you open the app, you'll get the latest version.

### Force Refreshing the App

If you see an old version of the app after a deployment and the automatic update hasn't kicked in yet, you can force a refresh:

1. **Close the app fully**: Swipe up from the bottom of the screen to close it.
2. **Wait a few seconds**, then tap the app icon to reopen it.

If the app still shows the old version or the old icon on your home screen:

3. **Delete the app from your home screen**: Long-press the "Ledger" icon and select **Remove App** → **Remove from Home Screen**.
4. **Clear Safari cache** (optional, but recommended):
   - Go to Settings > Safari
   - Scroll down and tap **Clear History and Website Data**
   - Choose **All time**
5. **Reinstall the app**:
   - Open Safari and navigate to `https://alpha-ledger.alpha-ledger.workers.dev`
   - Sign in again
   - Tap Share > Add to Home Screen (same as initial install)
   - Confirm the name and icon, then tap **Add**

The app should now display the latest version and icon.
