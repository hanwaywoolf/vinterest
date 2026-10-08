# Getting the Android app onto Google Play

`.github/workflows/play.yml` builds the Android app as a signed App Bundle (`.aab`) on every push
to `main` (or on demand: Actions → Google Play → Run workflow) and, once it's allowed to, uploads it
to Play's internal testing track. It does nothing until step 2 is done; until then the run says
what's missing.

Two keys are involved. Google keeps the **app signing key**, the one phones check (Play App
Signing, the default for new apps). You keep an **upload key**, which only proves to Google that an
upload came from you. If the upload key is ever lost or leaked, Play Console can reset it; the app
itself is unaffected.

## 1. Make the upload key (once, on your computer)

In Terminal (Mac or Linux; on Windows, Git Bash). `openssl` comes with macOS, nothing to install:

```sh
openssl req -x509 -newkey rsa:4096 -sha256 -days 10000 -nodes \
  -keyout upload-key.pem -out upload-cert.pem -subj "/CN=Vinterest upload key"
openssl pkcs12 -export -name upload -inkey upload-key.pem -in upload-cert.pem -out vinterest-upload.p12
```

The second command asks for a password twice: make up a long one and keep it in your password
manager. Then delete the two `.pem` files (`rm upload-key.pem upload-cert.pem`) and keep
`vinterest-upload.p12` somewhere safe (the password manager can hold the file too).

The key must be called `upload` (the `-name upload` above). If you'd rather use Android Studio
or `keytool`, that's fine too, as long as the alias is `upload` and the key and keystore share
one password.

Copy the file as text for GitHub:

```sh
base64 -i vinterest-upload.p12 | pbcopy        # Mac: now on the clipboard
base64 -w0 vinterest-upload.p12                # Linux / Git Bash: copy what it prints
```

## 2. Put it in GitHub (once)

Repository → Settings → Secrets and variables → Actions → New repository secret:

| Name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the text from `base64` above |
| `ANDROID_KEYSTORE_PASSWORD` | the password |

These go only into GitHub's secret box, never into the repo, a chat or an email.

Then Actions → Google Play → **Run workflow**. In about 10 minutes the run's page has a
`Vinterest-android-release` artifact: a zip holding `Vinterest.aab`.

## Android developer verification (registering the package)

Play Console → Android developer verification → Register package name: `app.vinterest`, then the
upload key's SHA-256 fingerprint:

```sh
openssl pkcs12 -in vinterest-upload.p12 -nokeys | openssl x509 -noout -fingerprint -sha256
```

(only the part after `=`). To prove you hold the key, Google shows a code and asks for an APK
signed with it that carries the code in `assets/adi-registration.properties`. Copy the code, then
Actions → Google Play → Run workflow → paste it into **verification code** → Run. About 10 minutes
later the run has a `Vinterest-verification-apk` artifact: unzip it and upload
`Vinterest-verification.apk` in Google's form. That run builds only this APK and uploads nothing
to Play.

## 3. The first upload, by hand (once your Play account is verified)

Google only accepts API uploads for an app that already has one bundle.

1. Play Console → **Create app**: name `Vinterest`, default language, App, Free, accept the
   declarations.
2. Testing → **Internal testing** → Create new release. When asked, keep **Play App Signing**
   (Google manages the app signing key).
3. Upload `Vinterest.aab` from the artifact zip. The package name becomes `app.vinterest` for good.
4. Save, review and **roll out** to internal testing. Testers tab: add a list of tester emails
   (up to 100) and copy the opt-in link for them.

Play Console will also ask for the store listing, privacy policy, data safety and content rating
before the app can go beyond testing; internal testing works without the full listing.

## 4. Automatic uploads (optional, once)

So every push to `main` reaches testers without the manual upload:

1. console.cloud.google.com → create a project (or use one) → APIs & Services → enable
   **Google Play Android Developer API**.
2. IAM & Admin → Service accounts → **Create**: name `github-play`, no roles needed here. Open it →
   Keys → Add key → JSON. A `.json` file downloads.
3. Play Console → **Users and permissions** → Invite new users → the service account's email
   (`github-play@….iam.gserviceaccount.com`) → App permissions: Vinterest, with **Release to
   testing tracks** (and Release apps to production later, if you want that automated too).
4. GitHub secret `PLAY_SERVICE_ACCOUNT_JSON`: the whole contents of the `.json` file. Then delete
   the downloaded file.

Uploads go to the internal track as **drafts** by default, because Google refuses anything else
until the app's first release has been rolled out by hand (step 3). Once it has, add the GitHub
**variable** (not secret) `PLAY_RELEASE_STATUS` = `completed`, and each build goes straight to
testers. `PLAY_TRACK` (variable) picks another track: `alpha` (closed testing), `beta` (open),
`production`.

## Version numbers

The version name is `package.json`'s `version`. The version code (Play's build number, which must
go up with every upload) is the workflow's run number × 10 + the attempt, so re-runs get new
numbers too.

## If a run fails

- *The keystore didn't open…*: the password secret doesn't match, the base64 text was cut short,
  or the key isn't called `upload`.
- *Google Play (403): The caller does not have permission*: the service account hasn't been
  invited in Play Console (step 4.3), or the invite has no permission for this app.
- *Package not found: app.vinterest*: the first bundle hasn't been uploaded by hand (step 3).
- *Only releases with status draft may be created on draft app*: leave `PLAY_RELEASE_STATUS`
  unset until the first release has been rolled out.
- *Version code N has already been used*: run the workflow again (the number goes up).
- *The Android App Bundle was signed with the wrong key*: the upload key in GitHub isn't the one
  Play has. Use the original, or reset the upload key in Play Console → Setup → App signing.
