# Push notifications

Reminders to the phone when the app is closed, on iPhone (Apple's APNs) and Android (Google's FCM). The code is `pwa-push.js` (`Push`: permission, token, taps) in the app and, in `_worker.js`, `POST /push/register`, `/push/unregister`, `/push/test`, `/push/run` and the senders. The tables are `push_devices` and `push_sent` (`supabase/migrations/0007_push.sql`).

## What it sends

At most one a day and three a week, at about 6pm where the person is, only to people signed in who switched push on (Profile → Account → Notifications → Push notifications):

- a bottle they're drinking and haven't rated, a day after they scanned it ("Rate the Alter Ego 2019"; several become "3 bottles waiting for your rating"); it follows the Reminders switch.
- "N days since your last scan" after 14 days, once a month; also Reminders.
- "Your Pro access ends soon", three days before a promo's Pro ends (not for a subscription, which renews).
- "Your Pro payment didn't go through", straight away, when RevenueCat reports a failed renewal.

These are the same things the bell on Home collects. New articles, milestones and fading answers stay on the bell only: the server doesn't hold what they're built from.

## Your side, in this order

**1. Database.** Run `supabase/migrations/0007_push.sql` in Supabase (SQL editor → paste → Run). It makes two tables only the server can reach.

**2. Apple (iPhone).** Do this after your Apple account is the company's, because the key and the Team ID belong to the team.
- developer.apple.com → Certificates, Identifiers & Profiles → Keys → + → name it "Vinterest push" → tick Apple Push Notifications service (APNs) → Continue → Register → Download. You can download it once. Note the Key ID.
- Identifiers → `app.vinterest` → tick Push Notifications → Save.
- Keep the `.p8` file out of the repo and chat. It goes only into Cloudflare, below.

**3. Google (Android).**
- console.firebase.google.com → Add project ("Vinterest"; Google Analytics can stay off).
- In the project, add an Android app with the package name `app.vinterest`. Download `google-services.json`.
- Project settings → Service accounts → Generate new private key. That downloads a JSON file.
- Delete both downloads once they're stored below. (iPhone doesn't go through Firebase.)

**4. Cloudflare** (Pages → vinterest → Settings → Variables and Secrets, Production):
- `APNS_KEY_P8`: secret. The whole `.p8` text, including the BEGIN and END lines.
- `APNS_KEY_ID`: the Key ID. `APNS_TEAM_ID`: your Apple Team ID (the same as `APPLE_TEAM_ID` in GitHub).
- `FCM_SERVICE_ACCOUNT_JSON`: secret. The whole service-account JSON.
- `PUSH_CRON_SECRET`: secret. A long random string you make up.

**5. GitHub** (Settings → Secrets and variables → Actions):
- Secret `GOOGLE_SERVICES_JSON`: the whole text of `google-services.json`, pasted as it is (base64 also works). Android builds include push once this exists, and the build stops with a clear message if the file isn't for `app.vinterest`.
- Secret `PUSH_CRON_SECRET`: the same string as in Cloudflare.
- Variable `PUSH_ENABLED` = `1`: iPhone builds include push. Set it only after step 2, because it changes how the iPhone app is signed (the archive carries the push entitlement; a check step fails the build with a clear message if it doesn't). Unset it to go back to the plain build.

**6. Roll out, then try it.** Install the new TestFlight and Play builds, sign in, turn on Push notifications, tap "Send me a test". Then Actions → Push notifications → Run workflow with "Dry run" ticked to see how many people it would remind (the log prints counts only).

**7. App Store Connect → App Privacy.** The privacy notice now says push tokens are stored. Check Apple's current guidance on whether to declare a push token as a Device ID, and answer to match.

## Notes

- Pages has no cron, so `.github/workflows/push-run.yml` calls `/push/run` every hour. A run handles five people and says if there are more (`PUSH_BATCH`), and the workflow carries on; Cloudflare's free plan allows 50 requests per run.
- Turning push off, signing out on purpose, or deleting the account removes the token. A token Apple or Google says is dead is deleted when we next try it.
- Local time comes from the phone's time zone sent at registration; "6pm" is `PUSH_HOUR` in `_worker.js`.
- Tests: `tests/push.spec.js` checks the Worker against real APNs and FCM keys (the JWTs are verified) and the app against a fake plugin. The entitlement and background mode are in `tests/native.spec.js`. Nothing here has run against real Apple or Google servers yet: the first real test is step 6.
