# Selling Pro with RevenueCat

How Pro is sold in the iPhone and Android apps. The code is `pwa-billing.js` (`Billing`), `pwa-probuy.jsx` (the Pro sheet's buying part) and, in `_worker.js`, `POST /billing/sync`, `POST /revenuecat` and `GET /config`. The web build sells nothing.

## How it fits together

- RevenueCat's app user id is the Supabase user id, so the app asks for sign-in before it sells. Pro belongs to the account and follows it to a new phone.
- RevenueCat is the record of what was bought. The app never trusts it directly: after a purchase or a restore the Worker asks RevenueCat's REST API for the customer and copies the answer into `entitlements`, and RevenueCat's webhook does the same for renewals, cancellations, refunds and expiry. The app reads Pro from `/me`, as before.
- Promo codes keep working: a code's Pro (source `promo`) is never shortened by a subscription or by one lapsing, and a subscription never pulls a promo's end in. The later end wins.
- Delete account also deletes the RevenueCat customer record. It cannot cancel the store subscription; the delete screen says so.

## One-off setup

1. **App Store Connect**: an auto-renewable subscription group with the monthly (and yearly) product; the paid-apps agreement and banking signed; a screenshot of the Pro sheet and review notes for the subscription.
2. **Play Console**: the same products, as subscriptions with a base plan, on the app's Play listing.
3. **RevenueCat**: add the iOS and Android apps (bundle id `app.vinterest`), import the products, make one entitlement called `pro` containing them, and one offering marked current with the packages (Monthly and Annual types show as "Monthly" and "Yearly").
4. **Cloudflare variables** (Pages project, Production and Preview):
   - `REVENUECAT_IOS_KEY` and `REVENUECAT_ANDROID_KEY`: the public SDK keys (`appl_…`, `goog_…`). Public, so ordinary variables. The `test_…` key from RevenueCat's quick start only works with its Test Store.
   - `REVENUECAT_SECRET_KEY` (secret): a v1 secret API key from RevenueCat with read access to customers.
   - `REVENUECAT_WEBHOOK_AUTH` (secret): any long random string.
   - `REVENUECAT_ENTITLEMENT` only if the entitlement isn't called `pro`.
5. **RevenueCat → Integrations → Webhooks**: URL `https://vinterest.pages.dev/revenuecat`, Authorization header value = `REVENUECAT_WEBHOOK_AUTH`.

The keys come to the app from `GET /config`, so changing them needs a web deploy, not an app update.

## Everyone-is-Pro testing switch

It ships off: Pro comes only from a subscription or a promo code, and list scanning and LCBO stock need Pro. The switch is still there for a test build: `Entitlement.ALL_PRO_FOR_TESTING` and the Worker's `ALL_PRO_FOR_TESTING` (both `false`) open everything for signed-in accounts when set to `true`.

## Testing a purchase

- iOS: a sandbox Apple ID (App Store Connect → Users and Access → Sandbox) on a TestFlight build. Subscriptions renew every few minutes in sandbox.
- Android: add the tester as a licence tester in Play Console and install from the internal track.
- Check RevenueCat's customer page shows the app user id as the Supabase uuid, then `entitlements` has a row with source `revenuecat`.

Tests: `tests/billing.spec.js` (the Worker against fakes, the Pro sheet against a fake store plugin).
