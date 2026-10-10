// The Capacitor app (step 8): the same app.js, run from inside the app. Here the page is made to
// look like the iOS app the way Capacitor's own bridge does (window.Capacitor before anything
// loads), and the native-project edits are checked on sample files.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { stubNetwork, makeDeterministic, seedLocalStorage } = require('./helpers');

const BASE = 'http://localhost:4173';
const LIVE = 'https://vinterest.pages.dev';

async function asApp(page) {
  await page.addInitScript(() => {
    window.CapacitorCustomPlatform = { name: 'ios' };
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
  });
}

test('on the web nothing changes: relative routes, the service worker, the install card', async ({ context, page }) => {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
  await stubNetwork(context);
  await page.goto(`${BASE}/#home`);
  expect(await page.evaluate(() => [Platform.native(), Platform.name(), Platform.api('/claude')])).toEqual([false, 'web', '/claude']);
});

test('in the app: Claude, /me and account deletion go to the live site; no service worker; no install card', async ({ context, page }) => {
  await asApp(page);
  await makeDeterministic(page);
  await page.addInitScript((sb) => { window.VINTEREST_SUPABASE = { url: sb, key: 'k' }; }, 'https://proj.supabase.co');
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk',
    vinterest_session: JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Date.now() / 1000 + 3600, user: { id: 'u', email: 'a@b.c' } }) });
  await stubNetwork(context);
  const hits = [];
  await context.route(`${LIVE}/**`, (r) => { hits.push(new URL(r.request().url()).pathname); return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ text: 'hello', tier: 'free' }) }); });
  await page.goto(`${BASE}/#home`);
  expect(await page.evaluate(() => [Platform.native(), Platform.name(), Platform.api('/claude')])).toEqual([true, 'ios', `${'https://vinterest.pages.dev'}/claude`]);
  expect(await page.evaluate(() => window.claude.complete({ purpose: 'wine_qa', messages: [{ role: 'user', content: 'hi' }] }))).toBe('hello');
  await expect.poll(() => hits).toEqual(expect.arrayContaining(['/me', '/claude']));
  expect(await page.evaluate(async () => !!(navigator.serviceWorker && await navigator.serviceWorker.getRegistration()))).toBe(false);
  expect(await page.evaluate(() => InstallApp.status())).toBe('running');
  await page.goto(`${BASE}/#account`);
  await expect(page.locator('#root')).toContainText('Travel Mode');
  await expect(page.locator('#root')).not.toContainText('Put Vinterest on your home screen');
});

test('in the app, a backup file goes to the share sheet instead of a download', async ({ context, page }) => {
  await asApp(page);
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
  await stubNetwork(context);
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate(async () => {
    const calls = [];
    window.VinterestNative = {
      Filesystem: { writeFile: async (o) => { calls.push(['write', o.path, o.directory, o.encoding, JSON.parse(o.data).format]); return { uri: 'file:///cache/' + o.path }; } },
      Share: { share: async (o) => { calls.push(['share', o.files[0]]); } },
    };
    const r = await Platform.saveFile(Backup.fileName(), JSON.stringify(Backup.exportData()));
    window.VinterestNative.Share.share = async () => { throw new Error('Share canceled'); };
    const cancelled = await Platform.saveFile('x.json', '{}');
    return { r, cancelled, calls };
  });
  expect(out.r).toBe('shared');
  expect(out.cancelled).toBe('cancelled');
  expect(out.calls[0]).toEqual(['write', expect.stringMatching(/^vinterest-backup-.*\.json$/), 'CACHE', 'utf8', 'vinterest-backup']);
  expect(out.calls[1][0]).toBe('share');
});

test('the native projects get the camera wording and export compliance (iOS) and permission (Android), once', async () => {
  const { patchInfoPlist, patchManifest } = await import(pathToFileURL(path.join(__dirname, '..', 'scripts/native-config.mjs')).href);
  const cfg = require('../capacitor.config.json').vinterestNative;
  const plist = '<?xml version="1.0"?>\n<plist version="1.0">\n<dict>\n\t<key>CFBundleName</key>\n\t<string>App</string>\n</dict>\n</plist>\n';
  const p1 = patchInfoPlist(plist, cfg.ios.infoPlist), p2 = patchInfoPlist(p1, cfg.ios.infoPlist);
  expect(p2).toBe(p1);
  expect(p1).toContain('<key>NSCameraUsageDescription</key>');
  expect(p1).toContain('wine labels and wine lists');
  // Export compliance as a real plist boolean, so App Store Connect doesn't ask on every upload.
  expect(p1).toContain('<key>ITSAppUsesNonExemptEncryption</key>\n\t<false/>');
  expect(p1).toMatch(/<\/dict>\n<\/plist>\n$/);
  const manifest = '<?xml version="1.0"?>\n<manifest>\n    <application/>\n    <uses-permission android:name="android.permission.INTERNET" />\n</manifest>\n';
  const m1 = patchManifest(manifest, cfg.android), m2 = patchManifest(m1, cfg.android);
  expect(m2).toBe(m1);
  expect(m1).toContain('<uses-permission android:name="android.permission.CAMERA" />');
  expect(m1).toContain('<uses-feature android:name="android.hardware.camera" android:required="false" />');
});

test('in the app, the WebView zoom goes back to 100% and text starts at Standard, whatever the phone\'s font size', async ({ context, page }) => {
  await asApp(page);
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
  await stubNetwork(context);
  await page.goto(`${BASE}/#home`);
  const run = () => page.evaluate(async () => {
    const sets = [];
    window.VinterestNative.TextZoom = { getPreferred: async () => ({ value: 1.3 }), set: async (o) => { sets.push(o.value); } };
    await Platform.start();
    return { sets, size: TextSize.get().id };
  });
  expect(await run()).toEqual({ sets: [1], size: 'standard' });
  await page.evaluate(() => TextSize.set('large')); // the reader's own choice stands
  expect(await run()).toEqual({ sets: [1], size: 'large' });
});

test('an app build without sign-in settings gets them from the live site, and Sign in appears', async ({ context, page }) => {
  await asApp(page);
  await makeDeterministic(page);
  await stubNetwork(context);
  await context.route(`${LIVE}/config`, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ supabase: { url: 'https://proj.supabase.co/', key: 'sb_publishable_live' } }) }));
  await page.goto(`${BASE}/`);
  await expect(page.locator('#root')).toContainText('Already have an account?');
  expect(await page.evaluate(() => Account.config())).toEqual({ url: 'https://proj.supabase.co', key: 'sb_publishable_live' });
});

test('the Worker\'s /config gives the public sign-in settings, or null without them', async () => {
  const copy = path.join(require('node:os').tmpdir(), `worker-config-${process.pid}.mjs`);
  require('node:fs').copyFileSync(path.join(__dirname, '..', '_worker.js'), copy);
  const worker = (await import(pathToFileURL(copy).href)).default;
  const get = (env) => worker.fetch(new Request('https://vinterest.pages.dev/config'), env).then((r) => r.json());
  expect(await get({ SUPABASE_URL: 'https://p.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x', SUPABASE_SECRET_KEY: 'never' }))
    .toEqual({ supabase: { url: 'https://p.supabase.co', key: 'sb_publishable_x' } });
  expect(await get({})).toEqual({ supabase: null });
});

test('the iOS icon is 1024×1024 with no alpha channel (the App Store rejects one), and the launch screen is 2732 square', async () => {
  const fs = require('node:fs');
  const png = (f) => { const b = fs.readFileSync(path.join(__dirname, '..', f)); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colourType: b[25], sig: b.subarray(1, 4).toString() }; };
  expect(png('assets/ios/AppIcon-1024.png')).toEqual({ w: 1024, h: 1024, colourType: 2, sig: 'PNG' }); // 2 = RGB, no alpha
  const splash = png('assets/ios/splash-2732.png');
  expect([splash.w, splash.h]).toEqual([2732, 2732]);
  // The renderer's own PNG writer: RGBA in, RGB out.
  const { rgbPng } = await import(pathToFileURL(path.join(__dirname, '..', 'scripts/app-icons.mjs')).href);
  const out = rgbPng(2, 1, Uint8Array.from([255, 0, 0, 255, 0, 0, 255, 128]));
  expect(out.readUInt32BE(16)).toBe(2);
  expect(out[25]).toBe(2);
  const idat = out.subarray(out.indexOf('IDAT') + 4);
  expect([...require('node:zlib').inflateSync(idat.subarray(0, out.readUInt32BE(out.indexOf('IDAT') - 4)))]).toEqual([0, 255, 0, 0, 0, 0, 255]);
});

test('Android: versionName from package.json, versionCode from the build, debug builds as app.vinterest.dev, the icon background crimson', async () => {
  const { patchAppGradle, patchIconBackground } = await import(pathToFileURL(path.join(__dirname, '..', 'scripts/native-config.mjs')).href);
  const gradle = 'defaultConfig {\n        applicationId "app.vinterest"\n        versionCode 1\n        versionName "1.0"\n    }\n    buildTypes {\n        release {\n            minifyEnabled false\n        }\n    }';
  const g = patchAppGradle(gradle, { versionName: '1.3.0', versionCode: '231' });
  expect(g).toContain('versionCode 231');
  expect(g).toContain('versionName "1.3.0"');
  // The PR test app installs beside the Play app; the release keeps app.vinterest.
  expect(g).toMatch(/debug \{\s*applicationIdSuffix "\.dev"\s*\}\s*release \{/);
  expect(patchAppGradle(g, { versionName: '1.3.0', versionCode: '231' })).toBe(g);
  expect(() => patchAppGradle(gradle, { versionCode: 'abc' })).toThrow(/whole number/);
  expect(patchIconBackground('<resources>\n    <color name="ic_launcher_background">#FFFFFF</color>\n</resources>', '#8B1A2F'))
    .toContain('<color name="ic_launcher_background">#8B1A2F</color>');
});

test('Android icons and launch screens are rendered for every density (not Capacitor\'s placeholder logo)', async () => {
  const fs = require('node:fs');
  const { ANDROID_DENSITIES, ANDROID_SPLASH } = await import(pathToFileURL(path.join(__dirname, '..', 'scripts/app-icons.mjs')).href);
  const size = (f) => { const b = fs.readFileSync(path.join(__dirname, '..', 'assets/android', f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  for (const [d, x] of Object.entries(ANDROID_DENSITIES)) {
    expect(size(`ic_launcher-${d}.png`)).toEqual([48 * x, 48 * x]);
    expect(size(`ic_launcher_round-${d}.png`)).toEqual([48 * x, 48 * x]);
    expect(size(`ic_launcher_foreground-${d}.png`)).toEqual([108 * x, 108 * x]);
    expect(size(`splash-port-${d}.png`)).toEqual(ANDROID_SPLASH[d]);
    expect(size(`splash-land-${d}.png`)).toEqual([...ANDROID_SPLASH[d]].reverse());
  }
  expect(size('play-icon-512.png')).toEqual([512, 512]);
  expect(fs.readFileSync(path.join(__dirname, '..', 'assets/android/play-icon-512.png'))[25]).toBe(6); // 32-bit, as Play asks
});

test('after a TestFlight upload, every internal group gets automatic distribution, and one is made if there is none', async () => {
  const { ensureInternalGroups, token } = await import(pathToFileURL(path.join(__dirname, '..', 'scripts/testflight-groups.mjs')).href);
  const { privateKey } = require('node:crypto').generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const p8 = privateKey.export({ type: 'pkcs8', format: 'pem' });
  // The token is an ES256 JWT for App Store Connect, signed with the key.
  const jwt = token({ keyId: 'K1', issuerId: 'I1', p8, now: 1000 });
  const [h, c] = jwt.split('.').slice(0, 2).map((s) => JSON.parse(Buffer.from(s, 'base64url').toString()));
  expect(h).toEqual({ alg: 'ES256', kid: 'K1', typ: 'JWT' });
  expect(c).toEqual({ iss: 'I1', iat: 1000, exp: 1600, aud: 'appstoreconnect-v1' });
  const calls = [];
  const json = (status, body) => ({ ok: status < 300, status, text: async () => JSON.stringify(body) });
  const fetchFn = async (url, opts = {}) => {
    calls.push([opts.method, url, opts.body ? JSON.parse(opts.body) : null]);
    expect(opts.headers.Authorization).toMatch(/^Bearer ey/);
    if (url.includes('/apps?')) return json(200, { data: [{ id: 'A1' }] });
    if (url.includes('/betaGroups?')) return json(200, { data: [
      { id: 'G1', attributes: { name: 'Team', isInternalGroup: true, hasAccessToAllBuilds: false } },
      { id: 'G2', attributes: { name: 'Friends', isInternalGroup: true, hasAccessToAllBuilds: true } }] });
    return json(200, { data: {} });
  };
  const out = await ensureInternalGroups({ keyId: 'K1', issuerId: 'I1', p8, fetchFn });
  expect(out).toEqual({ app: 'A1', created: false, groups: [{ name: 'Team', changed: true }, { name: 'Friends', changed: false }] });
  // Only the group without it is patched; the one that has it is left alone.
  expect(calls.filter((c) => c[0] === 'PATCH')).toEqual([['PATCH', 'https://api.appstoreconnect.apple.com/v1/betaGroups/G1', { data: { type: 'betaGroups', id: 'G1', attributes: { hasAccessToAllBuilds: true } } }]]);
  // No internal group at all: one is made with automatic distribution on.
  calls.length = 0;
  const none = async (url, opts = {}) => { calls.push([opts.method, url, opts.body ? JSON.parse(opts.body) : null]);
    return url.includes('/apps?') ? json(200, { data: [{ id: 'A1' }] }) : url.includes('/betaGroups?') ? json(200, { data: [] }) : json(201, { data: { id: 'G9' } }); };
  expect(await ensureInternalGroups({ keyId: 'K1', issuerId: 'I1', p8, fetchFn: none })).toEqual({ app: 'A1', created: true, groups: [{ name: 'Internal testers', changed: true }] });
  expect(calls[2]).toEqual(['POST', 'https://api.appstoreconnect.apple.com/v1/betaGroups', { data: { type: 'betaGroups', attributes: { name: 'Internal testers', isInternalGroup: true, hasAccessToAllBuilds: true }, relationships: { app: { data: { type: 'apps', id: 'A1' } } } } }]);
  // Apple's own words come through when it refuses.
  const refuse = async () => json(403, { errors: [{ title: 'FORBIDDEN', detail: 'The API key does not have permission' }] });
  await expect(ensureInternalGroups({ keyId: 'K1', issuerId: 'I1', p8, fetchFn: refuse })).rejects.toThrow('App Store Connect (403): The API key does not have permission');
});

test('the Google Play upload signs in with the service account and makes one edit: bundle, track, commit', async () => {
  const crypto = require('node:crypto');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const account = { client_email: 'ci@vinterest.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://oauth2.googleapis.com/token' };
  const { upload } = await import(pathToFileURL(path.join(__dirname, '..', 'scripts/play-upload.mjs')).href);
  const calls = [];
  const json = (status, body) => ({ ok: status < 300, status, json: async () => body });
  const fetchFn = async (url, opts) => {
    calls.push([opts.method, url.replace('https://androidpublisher.googleapis.com', ''), opts.headers.authorization || null]);
    if (url.startsWith('https://oauth2')) {
      const [h, c, s] = new URLSearchParams(opts.body).get('assertion').split('.');
      const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${c}`), publicKey, Buffer.from(s, 'base64url'));
      const claims = JSON.parse(Buffer.from(c, 'base64url'));
      return ok && claims.iss === account.client_email && claims.scope.endsWith('/androidpublisher') ? json(200, { access_token: 'tok' }) : json(400, { error: 'invalid_grant' });
    }
    if (url.includes('/tracks/')) { calls[calls.length - 1].push(JSON.parse(opts.body)); return json(200, {}); }
    if (url.endsWith('/edits')) return json(200, { id: 'E1' });
    if (url.includes('/bundles')) return json(200, { versionCode: 231 });
    if (url.endsWith(':commit')) return json(200, { id: 'E1' });
    return json(404, { error: { message: 'unexpected' } });
  };
  expect(await upload({ account, bundle: Buffer.from('aab'), fetchFn })).toBe(231);
  const app = '/androidpublisher/v3/applications/app.vinterest';
  expect(calls.map((c) => c.slice(0, 2))).toEqual([
    ['POST', 'https://oauth2.googleapis.com/token'],
    ['POST', `${app}/edits`],
    ['POST', '/upload/androidpublisher/v3/applications/app.vinterest/edits/E1/bundles?uploadType=media'],
    ['PUT', `${app}/edits/E1/tracks/internal`],
    ['POST', `${app}/edits/E1:commit`],
  ]);
  expect(calls[1][2]).toBe('Bearer tok');
  expect(calls[3][3]).toEqual({ track: 'internal', releases: [{ versionCodes: ['231'], status: 'completed' }] }); // straight to testers by default
  // Google's own words come through when it refuses.
  const refuse = async (url, opts) => url.startsWith('https://oauth2') ? json(200, { access_token: 't' }) : json(403, { error: { message: 'The caller does not have permission' } });
  await expect(upload({ account, bundle: Buffer.from('x'), fetchFn: refuse })).rejects.toThrow('Google Play (403): The caller does not have permission');
});
