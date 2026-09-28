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

test('the native projects get the camera wording (iOS) and permission (Android), once', async () => {
  const { patchInfoPlist, patchManifest } = await import(pathToFileURL(path.join(__dirname, '..', 'scripts/native-config.mjs')).href);
  const cfg = require('../capacitor.config.json').vinterestNative;
  const plist = '<?xml version="1.0"?>\n<plist version="1.0">\n<dict>\n\t<key>CFBundleName</key>\n\t<string>App</string>\n</dict>\n</plist>\n';
  const p1 = patchInfoPlist(plist, cfg.ios.infoPlist), p2 = patchInfoPlist(p1, cfg.ios.infoPlist);
  expect(p2).toBe(p1);
  expect(p1).toContain('<key>NSCameraUsageDescription</key>');
  expect(p1).toContain('wine labels and wine lists');
  expect(p1).toMatch(/<\/dict>\n<\/plist>\n$/);
  const manifest = '<?xml version="1.0"?>\n<manifest>\n    <application/>\n    <uses-permission android:name="android.permission.INTERNET" />\n</manifest>\n';
  const m1 = patchManifest(manifest, cfg.android), m2 = patchManifest(m1, cfg.android);
  expect(m2).toBe(m1);
  expect(m1).toContain('<uses-permission android:name="android.permission.CAMERA" />');
  expect(m1).toContain('<uses-feature android:name="android.hardware.camera" android:required="false" />');
});
