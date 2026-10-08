// Uploads a signed Android App Bundle to a Google Play track (.github/workflows/play.yml).
//   PLAY_SERVICE_ACCOUNT_JSON='{…}' node scripts/play-upload.mjs app.aab
// Talks to the Google Play Developer API directly (an edit: upload the bundle, put it on the track,
// commit), so the service account key never passes through a third-party action. No dependencies:
// the OAuth token comes from a JWT signed here with the key (node:crypto).
//   PLAY_TRACK           internal (default), alpha, beta or production
//   PLAY_RELEASE_STATUS  draft (default) or completed. A new app accepts only drafts until its first
//                        release has been rolled out by hand in Play Console (docs/google-play.md).
import fs from 'node:fs';
import crypto from 'node:crypto';

const PACKAGE = JSON.parse(fs.readFileSync(new URL('../capacitor.config.json', import.meta.url), 'utf8')).appId;
const API = 'https://androidpublisher.googleapis.com';

const b64url = (b) => Buffer.from(b).toString('base64url');
/* A short-lived access token for the Android Publisher API, from the service account's key. */
export async function accessToken(account, fetchFn = fetch) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: account.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: account.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${claims}`), account.private_key).toString('base64url');
  const res = await fetchFn(account.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${sig}` }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`Google sign-in failed: ${body.error_description || body.error || res.status}`);
  return body.access_token;
}

/* One edit: upload the bundle, release it on the track, commit. Returns the uploaded versionCode. */
export async function upload({ account, bundle, track = 'internal', status = 'draft', fetchFn = fetch }) {
  const token = await accessToken(account, fetchFn);
  const call = async (method, url, body, type = 'application/json') => {
    const res = await fetchFn(url, { method, headers: { authorization: `Bearer ${token}`, 'content-type': type }, body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Google Play (${res.status}): ${(json.error && json.error.message) || 'no details'}`);
    return json;
  };
  const app = `${API}/androidpublisher/v3/applications/${PACKAGE}`;
  const edit = await call('POST', `${app}/edits`, '{}');
  const up = await call('POST', `${API}/upload/androidpublisher/v3/applications/${PACKAGE}/edits/${edit.id}/bundles?uploadType=media`,
    bundle, 'application/octet-stream');
  await call('PUT', `${app}/edits/${edit.id}/tracks/${track}`, JSON.stringify({
    track, releases: [{ versionCodes: [String(up.versionCode)], status }],
  }));
  await call('POST', `${app}/edits/${edit.id}:commit`, '{}');
  return up.versionCode;
}

if (process.argv[1] && new URL(import.meta.url).pathname === fs.realpathSync(process.argv[1])) {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) { console.error('Usage: node scripts/play-upload.mjs <bundle.aab>'); process.exit(1); }
  let account;
  try { account = JSON.parse(process.env.PLAY_SERVICE_ACCOUNT_JSON || ''); } catch (e) {
    console.error('PLAY_SERVICE_ACCOUNT_JSON is missing or not the JSON key file Google gave you.'); process.exit(1);
  }
  const track = process.env.PLAY_TRACK || 'internal', status = process.env.PLAY_RELEASE_STATUS || 'draft';
  try {
    const vc = await upload({ account, bundle: fs.readFileSync(file), track, status });
    console.log(`Uploaded ${PACKAGE} versionCode ${vc} to the ${track} track (${status}).`);
  } catch (e) {
    console.log(`::error title=Google Play upload::${e.message}`);
    process.exit(1);
  }
}
