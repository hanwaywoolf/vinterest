# Signing in for App Review

Apple's and Google's reviewers can't read the emailed sign-in code, and Pro is bought by an account, so they need another way in.

1. Choose an address you control and can receive mail at, for example `review@vinterest.app` (a forwarding alias is fine). The app still asks Supabase to email a code to it when the reviewer taps "Email me a code", so it must be real.
2. Set two Cloudflare secrets (Pages project, Production): `REVIEWER_EMAIL` (that address) and `REVIEWER_CODE` (6 digits, so it fits the app's code box; not 123456).
3. Put both in the store's review notes: "Sign in with review@vinterest.app and the code 482915 (it works instead of the emailed code)."
4. The account is an ordinary free one, so the reviewer can reach the Pro sheet and buy in sandbox. If you want to show a Pro-only feature without a purchase, give that account Pro with a promo code from `promo_codes`.
5. After approval, delete the two secrets. `/reviewer/login` then answers 404 like any other path.

How it works: `POST /reviewer/login` (`handleReviewerLogin` in `_worker.js`) compares the address and code in constant time, asks Supabase for a one-time code for that address (admin `generate_link`) and spends it at once. The app tries it only after the emailed code has failed (`Account._reviewerLogin`). Tests: `tests/reviewer.spec.js`, against a fake Supabase; try it once on the real project before submitting.
