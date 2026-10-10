// After the TestFlight workflow uploads a build (.github/workflows/testflight.yml), make sure every
// internal tester group gets it without a console step: App Store Connect gives a build to an
// internal group only when the group has automatic distribution ("hasAccessToAllBuilds") or
// someone adds the build by hand. This switches automatic distribution on for every internal
// group of the app, and makes one ("Internal testers") if there is none yet, so the only thing
// left to do in App Store Connect is to add people to it. External groups are never touched:
// those need Apple's review per build.
//
// Signs in with the same App Store Connect API key as the upload (ES256 JWT, node:crypto):
//   ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 (the key file's text), APP_BUNDLE_ID (default
//   app.vinterest). Runs with: node scripts/testflight-groups.mjs
import crypto from 'node:crypto';

const API = 'https://api.appstoreconnect.apple.com/v1';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

/* A short-lived App Store Connect token from the API key. */
export function token({ keyId, issuerId, p8, now = Math.floor(Date.now() / 1000) }) {
  const head = b64({ alg: 'ES256', kid: keyId, typ: 'JWT' });
  const claims = b64({ iss: issuerId, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' });
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${claims}`), { key: p8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${head}.${claims}.${sig}`;
}

/* Switches automatic distribution on for the app's internal groups. Returns what it did:
   { app, groups: [{ name, changed }], created }. */
export async function ensureInternalGroups({ keyId, issuerId, p8, bundleId = 'app.vinterest', fetchFn = fetch, log = () => {} }) {
  const jwt = token({ keyId, issuerId, p8 });
  const call = async (method, path, body) => {
    const res = await fetchFn(`${API}${path}`, { method, headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let json = {}; try { json = text ? JSON.parse(text) : {}; } catch (e) { json = {}; }
    if (!res.ok) { const err = (json.errors || [])[0] || {}; throw new Error(`App Store Connect (${res.status}): ${err.detail || err.title || text.slice(0, 200)}`); }
    return json;
  };
  const apps = await call('GET', `/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&limit=1`);
  const app = (apps.data || [])[0];
  if (!app) throw new Error(`No app with bundle id ${bundleId} in App Store Connect yet (upload a build first).`);
  const groups = await call('GET', `/betaGroups?filter[app]=${app.id}&filter[isInternalGroup]=true&limit=200`);
  const out = { app: app.id, groups: [], created: false };
  for (const g of groups.data || []) {
    const name = g.attributes.name, has = !!g.attributes.hasAccessToAllBuilds;
    if (!has) { await call('PATCH', `/betaGroups/${g.id}`, { data: { type: 'betaGroups', id: g.id, attributes: { hasAccessToAllBuilds: true } } }); }
    log(`${name}: automatic distribution ${has ? 'already on' : 'switched on'}`);
    out.groups.push({ name, changed: !has });
  }
  if (!out.groups.length) {
    await call('POST', '/betaGroups', { data: { type: 'betaGroups', attributes: { name: 'Internal testers', isInternalGroup: true, hasAccessToAllBuilds: true },
      relationships: { app: { data: { type: 'apps', id: app.id } } } } });
    out.created = true; out.groups.push({ name: 'Internal testers', changed: true });
    log('No internal group yet: made "Internal testers" with automatic distribution on. Add people to it in App Store Connect → TestFlight.');
  }
  return out;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*\//, '/'))) {
  const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8, APP_BUNDLE_ID } = process.env;
  if (!ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_KEY_P8) { console.error('ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_P8 are needed'); process.exit(1); }
  ensureInternalGroups({ keyId: ASC_KEY_ID, issuerId: ASC_ISSUER_ID, p8: ASC_KEY_P8, bundleId: APP_BUNDLE_ID || 'app.vinterest', log: console.log })
    .then((r) => console.log(`Internal groups ready: ${r.groups.map((g) => g.name).join(', ')}`))
    .catch((e) => { console.error(`::error title=TestFlight testers::${e.message}`); process.exit(1); });
}
