# Telling the team there's something to look at

`.github/workflows/notify.yml` emails the people in the `NOTIFY_TO` variable through Resend
(`scripts/notify.mjs`). The email is one or two sentences and a button to the link, by default the
internal page (https://internal.vinterest.team/).

## Sending one

- **By hand.** GitHub → Actions → Notify → Run workflow. Give a subject, what to look at, and the link.
  Claude can run it too when asked ("email Martin that Seller is on the internal page").
- **With a merge.** Put `[notify]` in a pull request's title or description. When it merges to `main` the
  email goes out, named by the pull request's title. Cloudflare takes about a minute to deploy, so the email
  can arrive a moment before the page changes.
- **On every push to main.** Set the `NOTIFY_ON_MAIN` variable to `1`. Off by default: `main` takes several
  merges a day.

## Set up once

Repository Settings → Secrets and variables → Actions:

| Kind | Name | Value |
|---|---|---|
| Secret | `RESEND_API_KEY` | The Resend key (the same account the sites' sign-up emails use) |
| Variable | `NOTIFY_TO` | Who gets it: one address, or several separated by commas |
| Variable | `NOTIFY_REPLY_TO` | Optional: where a reply goes |
| Variable | `RESEND_FROM` | Optional: the sender, default `Vinterest <hello@vinterest.app>` |
| Variable | `NOTIFY_ON_MAIN` | Optional: `1` to email on every push to main |

Until the key and `NOTIFY_TO` are set the workflow runs, sends nothing and says which is missing.
Addresses stay in GitHub's settings, never in the repo.
