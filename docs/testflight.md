# Getting the iPhone app onto TestFlight

`.github/workflows/testflight.yml` builds the iPhone app on a GitHub Mac, signs it and uploads it to
TestFlight on every push to `main` (or on demand: Actions → TestFlight → Run workflow). No Mac of
your own and no certificate files: Xcode's automatic signing uses an App Store Connect API key, and
Apple creates and keeps the certificate and provisioning profile.

It does nothing until the steps below are done; until then the run says what's missing.

## Once, in Apple's websites

1. **Membership active.** developer.apple.com/account → Membership details shows your **Team ID**
   (10 characters). A new membership can take a day or two to activate.
2. **App ID.** Certificates, IDs & Profiles → Identifiers → **+** → App IDs → App.
   Description `Vinterest`, Bundle ID **Explicit** `app.vinterest` (must match
   `capacitor.config.json`). Leave the capabilities as they are.
3. **The app in App Store Connect.** appstoreconnect.apple.com → Apps → **+** → New App: iOS,
   name `Vinterest` (must be unique on the store), your primary language, Bundle ID
   `app.vinterest`, SKU `vinterest-ios`.
4. **API key.** App Store Connect → Users and Access → Integrations → App Store Connect API →
   Team Keys → **+**. Name `GitHub`, access **Admin** (automatic signing creates the distribution
   certificate, which needs Admin). Download the `.p8` file (Apple only lets you download it once)
   and note the **Key ID** and the **Issuer ID** at the top of the page.

## Once, in GitHub

Repository → Settings → Secrets and variables → Actions:

| Kind | Name | Value |
|---|---|---|
| Secret | `ASC_KEY_ID` | the Key ID |
| Secret | `ASC_ISSUER_ID` | the Issuer ID |
| Secret | `ASC_KEY_P8` | the whole contents of the `.p8` file (open it in a text editor) |
| Variable | `APPLE_TEAM_ID` | the Team ID |

The `.p8` is a secret: it goes only into GitHub's secret box, never into the repo, a chat or an
email.

## Then

Actions → TestFlight → **Run workflow**. About 15 minutes later the build appears in App Store
Connect → your app → TestFlight (Apple processes it for a few more minutes). The run also switches
**automatic distribution** on for every internal tester group (and makes one, "Internal testers",
if there is none), so the only thing left to do there is add people to that group: App Store
Connect → TestFlight → Internal Testing → the group → **+**. Each of them installs **TestFlight**
from the App Store on an iPhone, and every build shows up in it as soon as Apple has processed it.
External groups (people outside your team) still need Apple's review per build; the run leaves
those alone.

Each later push to `main` uploads a new build and testers get it by themselves. The version is
`package.json`'s `version`; the build number goes up by itself.

## If a run fails

- *No profiles for 'app.vinterest' were found* / *No Account for Team*: the App ID (step 2) or
  `APPLE_TEAM_ID` is missing or doesn't match.
- *Cloud signing permission error*: the API key needs **Admin** access (step 4).
- *Your team has no devices from which to generate a provisioning profile*: that's development
  signing, which needs a registered iPhone. The workflow archives unsigned and signs only for
  App Store distribution at upload, which needs no device; if this comes back, the archive step
  is signing again.
- *The bundle version must be higher*: a build with that number was already uploaded; run the
  workflow again (the number goes up).
- *Missing compliance*: shouldn't happen; `ITSAppUsesNonExemptEncryption` is set to false by
  `scripts/native.mjs` from `capacitor.config.json`.
