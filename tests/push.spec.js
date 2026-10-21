// Push notifications: the Worker registers phones, sends through APNs and FCM (checked against
// real keys: the JWTs are verified), and its hourly job picks who to remind and what to say; the
// app asks for permission only when asked to, registers, and opens the right place on a tap.
// Supabase, APNs, FCM and the phone's plugin are fakes.
const { test, expect } = require('@playwright/test');
const crypto = require('node:crypto');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { stubNetwork, makeDeterministic, seedLocalStorage } = require('./helpers');

const BASE = 'http://localhost:4173';
const LIVE = 'https://vinterest.pages.dev';
const SB = 'https://proj.supabase.co';
const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const HOUR = 3600 * 1000, DAY = 24 * HOUR;
const TOKEN_IOS = 'a'.repeat(64), TOKEN_AND = 'fcm:' + 'b'.repeat(60);

async function loadWorker() {
  const copy = path.join(require('node:os').tmpdir(), `worker-push-${process.pid}.mjs`);
  require('node:fs').copyFileSync(path.join(__dirname, '..', '_worker.js'), copy);
  return (await import(pathToFileURL(copy).href)).default;
}
const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = (k) => k.export({ type: 'pkcs8', format: 'pem' });
const decodeJwt = (jwt) => { const [h, c, s] = jwt.split('.'); const j = (x) => JSON.parse(Buffer.from(x, 'base64url').toString()); return { header: j(h), claims: j(c), data: h + '.' + c, sig: Buffer.from(s, 'base64url') }; };

// A tiny PostgREST: tables as arrays, eq. / gte. / in. filters, order, offset, upsert, delete.
function fakes({ apnsStatus = 200, apnsReason = '', fcmStatus = 200, fcmError = null } = {}) {
  const users = { 'tok-1': { id: U1, email: 'a@example.com' }, 'tok-2': { id: U2, email: 'b@example.com' } };
  const t = { push_devices: [], push_sent: [], entitlements: [], user_docs: [], wines: [] };
  const apns = [], fcm = [], oauth = [];
  const res = (status, body) => new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const filter = (rows, q) => {
    for (const [k, v] of q) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k)) continue;
      if (v.startsWith('eq.')) rows = rows.filter((r) => String(r[k]) === v.slice(3));
      else if (v.startsWith('gte.')) rows = rows.filter((r) => r[k] >= v.slice(4));
      else if (v.startsWith('is.null')) rows = rows.filter((r) => r[k] == null);
      else if (v.startsWith('in.(')) { const set = v.slice(4, -1).split(',').map((x) => x.replace(/"/g, '')); rows = rows.filter((r) => set.includes(r[k])); }
    }
    return rows;
  };
  const fetch = async (url, init = {}) => {
    url = String(url); const h = new Headers(init.headers || {});
    if (url === `${SB}/auth/v1/user`) { const u = users[(h.get('authorization') || '').replace('Bearer ', '')]; return u ? res(200, u) : res(401, {}); }
    if (url.startsWith('https://api.push.apple.com/3/device/')) {
      apns.push({ token: url.split('/').pop(), headers: Object.fromEntries(h.entries()), body: JSON.parse(init.body) });
      return apnsStatus === 200 ? res(200, null) : res(apnsStatus, { reason: apnsReason });
    }
    if (url === 'https://oauth2.googleapis.com/token') { oauth.push(String(init.body)); return res(200, { access_token: 'ya29.fake', expires_in: 3600 }); }
    if (url.startsWith('https://fcm.googleapis.com/v1/projects/')) {
      fcm.push({ url, auth: h.get('authorization'), body: JSON.parse(init.body) });
      return fcmStatus === 200 ? res(200, { name: 'ok' }) : res(fcmStatus, { error: fcmError || {} });
    }
    const m = url.match(new RegExp('^' + SB.replace(/[.]/g, '\\.') + '/rest/v1/([a-z_]+)\\?(.*)$'));
    if (!m) return res(404, {});
    const [, table, qs] = m; const q = [...new URLSearchParams(qs)];
    const rows = t[table]; if (!rows) return res(404, {});
    const method = init.method || 'GET';
    if (method === 'GET') {
      let out = filter(rows.slice(), q);
      const order = q.find(([k]) => k === 'order'); if (order) { const [f, d] = order[1].split('.'); out.sort((a, b) => (a[f] < b[f] ? 1 : -1) * (d === 'desc' ? 1 : -1)); }
      const off = q.find(([k]) => k === 'offset'); if (off) out = out.slice(parseInt(off[1], 10));
      return res(200, out);
    }
    if (method === 'POST') {
      const body = [].concat(JSON.parse(init.body)); const keys = { push_devices: ['token'], push_sent: ['user_id', 'kind', 'key'] }[table] || [];
      for (const b of body) { const i = rows.findIndex((r) => keys.every((k) => r[k] === b[k])); if (i >= 0) rows[i] = { ...rows[i], ...b }; else rows.push({ created_at: new Date().toISOString(), ...b }); }
      return res(201, null);
    }
    if (method === 'DELETE') { const gone = new Set(filter(rows, q)); t[table] = rows.filter((r) => !gone.has(r)); return res(204, null); }
    return res(405, {});
  };
  return { fetch, t, apns, fcm, oauth };
}

test.describe('Worker', () => {
  let worker, realFetch, ip = 0;
  const env = { ANTHROPIC_API_KEY: 'k', SUPABASE_URL: SB, SUPABASE_PUBLISHABLE_KEY: 'pub', SUPABASE_SECRET_KEY: 'sec', ALL_PRO: '0',
    APNS_KEY_P8: pem(ec.privateKey), APNS_KEY_ID: 'KEY1234567', APNS_TEAM_ID: 'TEAM123456',
    FCM_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'vinterest-test', client_email: 'svc@vinterest-test.iam.gserviceaccount.com', private_key: pem(rsa.privateKey) }),
    PUSH_CRON_SECRET: 'cron-secret' };
  const post = (p, { token, body, auth } = {}, e = env) => worker.fetch(new Request('https://vinterest.pages.dev' + p, { method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://vinterest.pages.dev', 'cf-connecting-ip': '10.3.0.' + (++ip), ...(token ? { authorization: 'Bearer ' + token } : {}), ...(auth ? { authorization: 'Bearer ' + auth } : {}) },
    body: JSON.stringify(body || {}) }), e);
  const reg = (token = 'tok-1', over = {}) => post('/push/register', { token, body: { token: TOKEN_IOS, platform: 'ios', tz: 'Europe/London', app_version: '1.7.0', ...over } });
  test.beforeAll(async () => { worker = await loadWorker(); realFetch = globalThis.fetch; });
  test.afterEach(() => { globalThis.fetch = realFetch; });

  test('/config says whether the server can send', async () => {
    const get = (e) => worker.fetch(new Request('https://vinterest.pages.dev/config'), e).then((r) => r.json());
    expect((await get(env)).push).toBe(true);
    expect((await get({ ...env, APNS_KEY_P8: '', FCM_SERVICE_ACCOUNT_JSON: '' })).push).toBe(false);
    expect((await get({ ...env, APNS_KEY_P8: '' })).push).toBe(true); // FCM alone is enough to start
  });

  test('register: signed in only; a phone token is stored with its platform and time zone; a bad one is refused', async () => {
    const f = fakes(); globalThis.fetch = f.fetch;
    expect((await post('/push/register', { body: { token: TOKEN_IOS, platform: 'ios' } })).status).toBe(401);
    expect((await reg('tok-1', { token: 'short' })).status).toBe(400);
    expect((await reg('tok-1', { platform: 'windows' })).status).toBe(400);
    expect((await reg('tok-1', { token: 'has spaces in it and is long enough to pass the length' })).status).toBe(400);
    expect((await post('/push/register', { token: 'tok-1', body: { token: TOKEN_IOS, platform: 'ios' } }, { ...env, APNS_KEY_P8: '', FCM_SERVICE_ACCOUNT_JSON: '' })).status).toBe(503);
    expect(f.t.push_devices).toEqual([]);
    expect((await reg()).status).toBe(200);
    expect(f.t.push_devices).toHaveLength(1);
    expect(f.t.push_devices[0]).toMatchObject({ token: TOKEN_IOS, user_id: U1, platform: 'ios', tz: 'Europe/London', app_version: '1.7.0' });
    // A time zone that isn't one is dropped, not stored.
    await reg('tok-1', { tz: 'x; drop table' });
    expect(f.t.push_devices[0].tz).toBeNull();
    // The same phone signing in as someone else moves to them.
    await reg('tok-2');
    expect(f.t.push_devices).toHaveLength(1);
    expect(f.t.push_devices[0].user_id).toBe(U2);
  });

  test('a user keeps their newest ten phones', async () => {
    const f = fakes(); globalThis.fetch = f.fetch;
    for (let i = 0; i < 12; i++) { await reg('tok-1', { token: String(i).padStart(2, '0') + 'c'.repeat(40) }); f.t.push_devices.at(-1).last_seen = new Date(Date.now() + i * 1000).toISOString(); }
    await reg('tok-1', { token: '99' + 'c'.repeat(40) });
    expect(f.t.push_devices.length).toBeLessThanOrEqual(10);
  });

  test('unregister removes the token, only for its owner', async () => {
    const f = fakes(); globalThis.fetch = f.fetch;
    await reg('tok-1');
    await post('/push/unregister', { token: 'tok-2', body: { token: TOKEN_IOS } });
    expect(f.t.push_devices).toHaveLength(1);
    expect((await post('/push/unregister', { token: 'tok-1', body: { token: TOKEN_IOS } })).status).toBe(200);
    expect(f.t.push_devices).toEqual([]);
  });

  test('a test notification goes to APNs with a real ES256 token, the topic and the link; three an hour', async () => {
    const f = fakes(); globalThis.fetch = f.fetch;
    await reg('tok-1');
    const r = await post('/push/test', { token: 'tok-1' });
    expect(r.status).toBe(200);
    const sent = f.apns[0];
    expect(sent.token).toBe(TOKEN_IOS);
    expect(sent.headers).toMatchObject({ 'apns-topic': 'app.vinterest', 'apns-push-type': 'alert', 'apns-priority': '10' });
    expect(sent.body).toEqual({ aps: { alert: { title: 'Vinterest notifications are on', body: 'This is how a reminder will look.' }, sound: 'default' }, link: { screen: 'home' } });
    const jwt = decodeJwt(sent.headers.authorization.replace(/^bearer /i, ''));
    expect(jwt.header).toEqual({ alg: 'ES256', kid: 'KEY1234567' });
    expect(jwt.claims.iss).toBe('TEAM123456');
    expect(crypto.verify('sha256', Buffer.from(jwt.data), { key: ec.publicKey, dsaEncoding: 'ieee-p1363' }, jwt.sig)).toBe(true);
    await post('/push/test', { token: 'tok-1' }); await post('/push/test', { token: 'tok-1' });
    expect((await post('/push/test', { token: 'tok-1' })).status).toBe(429);
  });

  test('Android goes through FCM v1 with an access token made from the service account, the link in data', async () => {
    const f = fakes(); globalThis.fetch = f.fetch;
    await reg('tok-1', { token: TOKEN_AND, platform: 'android' });
    expect((await post('/push/test', { token: 'tok-1' })).status).toBe(200);
    const grant = new URLSearchParams(f.oauth[0]);
    expect(grant.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    const jwt = decodeJwt(grant.get('assertion'));
    expect(jwt.claims).toMatchObject({ iss: 'svc@vinterest-test.iam.gserviceaccount.com', scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token' });
    expect(crypto.verify('sha256', Buffer.from(jwt.data), rsa.publicKey, jwt.sig)).toBe(true);
    expect(f.fcm[0].url).toBe('https://fcm.googleapis.com/v1/projects/vinterest-test/messages:send');
    expect(f.fcm[0].auth).toBe('Bearer ya29.fake');
    expect(f.fcm[0].body.message).toMatchObject({ token: TOKEN_AND, notification: { title: 'Vinterest notifications are on' }, data: { link: '{"screen":"home"}' }, android: { priority: 'HIGH' } });
  });

  test('a token Apple or Google says is gone is deleted, and the person is told in words', async () => {
    let f = fakes({ apnsStatus: 410, apnsReason: 'Unregistered' }); globalThis.fetch = f.fetch;
    await reg('tok-1');
    const r = await post('/push/test', { token: 'tok-1' });
    expect(r.status).toBe(502);
    expect((await r.json()).error).toMatch(/expired/);
    expect(f.t.push_devices).toEqual([]);
    f = fakes({ fcmStatus: 404, fcmError: { code: 404, status: 'NOT_FOUND' } }); globalThis.fetch = f.fetch;
    await reg('tok-1', { token: TOKEN_AND, platform: 'android' });
    await post('/push/test', { token: 'tok-1' });
    expect(f.t.push_devices).toEqual([]);
    // A temporary failure keeps the token.
    f = fakes({ apnsStatus: 500, apnsReason: 'InternalServerError' }); globalThis.fetch = f.fetch;
    await reg('tok-1');
    await post('/push/test', { token: 'tok-1' });
    expect(f.t.push_devices).toHaveLength(1);
  });

  // ---- the hourly job ----
  const NOW = Date.parse('2026-10-20T17:30:00Z'); // 18:30 in London (BST), so the 18:00 hour
  const wine = (o) => ({ user_id: U1, wine_key: (o.name + '|' + (o.vintage || 'nv')).toLowerCase(), rating: null, last_scanned: new Date(NOW - 2 * DAY).toISOString(), deleted_at: null,
    data: { name: o.name, vintage: o.vintage, scan_intent: 'tasting', ...(o.data || {}) }, ...(o.row || {}) });
  const run = (body = {}, e = env) => worker.fetch(new Request('https://vinterest.pages.dev/push/run', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer cron-secret' }, body: JSON.stringify({ now: NOW, ...body }) }), e);
  async function ready(f, extra = (x) => x) {
    await reg('tok-1'); f.apns.length = 0;
    extra(f.t);
  }

  test('the job needs its secret, and Push set up', async () => {
    const f = fakes(); globalThis.fetch = f.fetch;
    expect((await worker.fetch(new Request('https://vinterest.pages.dev/push/run', { method: 'POST', body: '{}' }), env)).status).toBe(401);
    expect((await worker.fetch(new Request('https://vinterest.pages.dev/push/run', { method: 'POST', headers: { authorization: 'Bearer nope' }, body: '{}' }), env)).status).toBe(401);
    expect((await run({}, { ...env, APNS_KEY_P8: '', FCM_SERVICE_ACCOUNT_JSON: '' })).status).toBe(503);
    expect((await run({}, { ...env, PUSH_CRON_SECRET: '' })).status).toBe(401);
  });

  test('a bottle they\'re drinking and haven\'t rated, a day later, at 6pm their time: one reminder that opens that bottle', async () => {
    const f = fakes(); globalThis.fetch = f.fetch;
    await ready(f, (t) => t.wines.push(wine({ name: 'Alter Ego de Palmer', vintage: 2019 })));
    const out = await (await run()).json();
    expect(out).toMatchObject({ users: 1, skipped: 0 });
    expect(out.sent).toEqual([{ user: U1, kind: 'rate' }]);
    expect(f.apns[0].body.aps.alert).toEqual({ title: 'Rate the Alter Ego de Palmer 2019', body: 'Every rating sharpens your matches.' });
    expect(f.apns[0].body.link).toEqual({ wine: { name: 'Alter Ego de Palmer', vintage: 2019 } });
    // Told once: the same run again sends nothing, and it's recorded.
    expect(f.t.push_sent.map((s) => [s.kind, s.key])).toEqual([['rate', 'alter ego de palmer|2019']]);
    f.apns.length = 0;
    expect((await (await run({ now: NOW + DAY })).json()).sent).toEqual([]); // the next evening, nothing new to say
  });

  test('several waiting: one push that opens My Wines', async () => {
    const f = fakes(); globalThis.fetch = f.fetch;
    await ready(f, (t) => t.wines.push(wine({ name: 'Barolo', vintage: 2016 }), wine({ name: 'Rioja', vintage: 2018 }), wine({ name: 'Chablis', vintage: 2020, row: { rating: 91 } })));
    await run();
    expect(f.apns[0].body.aps.alert.title).toBe('2 bottles waiting for your rating');
    expect(f.apns[0].body.link).toEqual({ screen: 'mywines' });
  });

  test('it only speaks at their evening, and not about wines saved for later, rated, deleted or scanned today', async () => {
    const f = fakes(); globalThis.fetch = f.fetch;
    await ready(f, (t) => t.wines.push(
      wine({ name: 'Saved', vintage: 2019, data: { scan_intent: 'checking' } }),
      wine({ name: 'Rated', vintage: 2019, row: { rating: 90 } }),
      wine({ name: 'Gone', vintage: 2019, row: { deleted_at: '2026-10-01T00:00:00Z' } }),
      wine({ name: 'Today', vintage: 2019, row: { last_scanned: new Date(NOW - 2 * HOUR).toISOString() } })));
    expect((await (await run()).json()).sent).toEqual([]);
    f.t.wines.push(wine({ name: 'Bought', vintage: 2019, data: { scan_intent: 'checking', bought: true } }));
    expect((await (await run({ hour: 9 })).json()).users).toBe(0); // not their morning
    expect((await (await run()).json()).sent).toHaveLength(1);
  });

  test('Reminders switched off in their settings means no reminder', async () => {
    const f = fakes(); globalThis.fetch = f.fetch;
    await ready(f, (t) => { t.wines.push(wine({ name: 'Barolo', vintage: 2016 })); t.user_docs.push({ user_id: U1, doc_key: 'settings', data: { values: { vinterest_notify: JSON.stringify({ reminder: false }) }, times: {} } }); });
    expect((await (await run()).json()).sent).toEqual([]);
  });

  test('at most one a day and three a week; a long gap since the last scan is said once a month', async () => {
    const f = fakes(); globalThis.fetch = f.fetch;
    await ready(f, (t) => t.wines.push(wine({ name: 'Barolo', vintage: 2016 })));
    const ago = (h) => new Date(NOW - h * HOUR).toISOString();
    f.t.push_sent.push({ user_id: U1, kind: 'rate', key: 'other|1', sent_at: ago(5) });
    expect((await (await run()).json()).sent).toEqual([]); // one today already
    f.t.push_sent.length = 0;
    f.t.push_sent.push(...[30, 80, 120].map((h, i) => ({ user_id: U1, kind: 'lapse', key: 'k' + i, sent_at: ago(h) })));
    expect((await (await run()).json()).sent).toEqual([]); // three this week
    f.t.push_sent.length = 0; f.t.wines.length = 0;
    f.t.wines.push(wine({ name: 'Old', vintage: 2015, data: { scan_intent: 'checking' }, row: { last_scanned: new Date(NOW - 20 * DAY).toISOString() } }));
    const out = await (await run()).json();
    expect(out.sent).toEqual([{ user: U1, kind: 'lapse' }]);
    expect(f.apns.at(-1).body.aps.alert.title).toBe('20 days since your last scan');
    expect(f.apns.at(-1).body.link).toEqual({ screen: 'camera' });
    // Not again within a month.
    f.t.push_sent.forEach((s) => { s.sent_at = ago(30); });
    const again = await (await run({ now: NOW + 2 * DAY })).json();
    expect(again.sent).toEqual([]);
  });

  test('promo Pro ending within three days is said once, whatever the reminder setting', async () => {
    const f = fakes(); globalThis.fetch = f.fetch;
    await ready(f, (t) => { t.entitlements.push({ user_id: U1, tier: 'pro', source: 'promo', expires_at: new Date(NOW + 2 * DAY).toISOString() }); t.user_docs.push({ user_id: U1, doc_key: 'settings', data: { values: { vinterest_notify: '{"reminder":false}' } } }); });
    const out = await (await run()).json();
    expect(out.sent).toEqual([{ user: U1, kind: 'pro_ending' }]);
    expect(f.apns[0].body.aps.alert.title).toBe('Your Pro access ends soon');
    expect(f.apns[0].body.link).toEqual({ screen: 'profile' });
    f.t.push_sent.forEach((s) => { s.sent_at = new Date(NOW - 30 * HOUR).toISOString(); });
    expect((await (await run({ now: NOW + 5 * HOUR })).json()).sent).toEqual([]);
    // A subscription renewing isn't "ending".
    const g = fakes(); globalThis.fetch = g.fetch; await ready(g, (t) => t.entitlements.push({ user_id: U1, tier: 'pro', source: 'revenuecat', expires_at: new Date(NOW + 2 * DAY).toISOString() }));
    expect((await (await run()).json()).sent).toEqual([]);
  });

  test('a run handles a few people and says where to carry on, so a busy hour never runs out of requests', async () => {
    const f = fakes(); globalThis.fetch = f.fetch;
    for (let i = 0; i < 7; i++) f.t.push_devices.push({ token: String(i).padStart(2, '0') + 'd'.repeat(40), user_id: `00000000-0000-4000-8000-00000000000${i}`, platform: 'ios', tz: 'Europe/London' });
    const a = await (await run({ dry: true })).json();
    expect(a).toMatchObject({ users: 7, more: true, next: 5 });
    const b = await (await run({ dry: true, offset: a.next })).json();
    expect(b).toMatchObject({ users: 7, more: false });
    expect(b.skipped).toBe(2);
  });

  test('a dry run says what would go and sends nothing', async () => {
    const f = fakes(); globalThis.fetch = f.fetch;
    await ready(f, (t) => t.wines.push(wine({ name: 'Barolo', vintage: 2016 })));
    const out = await (await run({ dry: true })).json();
    expect(out.sent).toEqual([{ user: U1, kind: 'rate', title: 'Rate the Barolo 2016' }]);
    expect(f.apns).toEqual([]);
    expect(f.t.push_sent).toEqual([]);
  });

  test('a failed renewal payment pushes once, from the RevenueCat webhook', async () => {
    const f = fakes(); globalThis.fetch = (url, init) => (String(url).startsWith('https://api.revenuecat.com') ? Promise.resolve(new Response(JSON.stringify({ subscriber: { entitlements: {} } }), { status: 200 })) : f.fetch(url, init));
    await reg('tok-1'); f.apns.length = 0;
    const e = { ...env, REVENUECAT_SECRET_KEY: 'sk', REVENUECAT_WEBHOOK_AUTH: 'hook' };
    const hook = () => worker.fetch(new Request('https://vinterest.pages.dev/revenuecat', { method: 'POST', headers: { authorization: 'hook', 'content-type': 'application/json' }, body: JSON.stringify({ event: { type: 'BILLING_ISSUE', id: 'evt-1', app_user_id: U1 } }) }), e);
    expect((await hook()).status).toBe(200);
    expect(f.apns[0].body.aps.alert.title).toBe("Your Pro payment didn't go through");
    await hook();
    expect(f.apns).toHaveLength(1);
  });
});

// ---- The app ----

async function boot(context, page, { native = true, built = true, signedIn = true, perm = 'prompt', serverPush = true, tap = null } = {}) {
  await page.addInitScript(({ native, built, perm }) => {
    if (native) { window.CapacitorCustomPlatform = { name: 'ios' }; window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' }; }
    if (built) window.VINTEREST_PUSH = true;
    const calls = (window.__push = []), listeners = {};
    let state = perm;
    const fake = {
      checkPermissions: async () => ({ receive: state }),
      requestPermissions: async () => { calls.push(['request']); if (state === 'prompt') state = window.__grant === false ? 'denied' : 'granted'; return { receive: state }; },
      register: async () => { calls.push(['register']); setTimeout(() => (listeners.registration || []).forEach((f) => f({ value: 'tok-device-' + 'x'.repeat(40) })), 0); },
      unregister: async () => { calls.push(['unregister']); },
      addListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); return Promise.resolve({ remove() {} }); },
    };
    window.__emitPush = (n, d) => (listeners[n] || []).forEach((f) => f(d));
    let nat; Object.defineProperty(window, 'VinterestNative', { configurable: true, get: () => nat, set: (v) => { nat = { ...v, PushNotifications: fake }; } });
  }, { native, built, perm });
  await makeDeterministic(page);
  await page.addInitScript((sb) => { window.VINTEREST_SUPABASE = { url: sb, key: 'k' }; }, SB);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk', vinterest_wines: '[]',
    ...(signedIn ? { vinterest_session: JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Date.now() / 1000 + 3600, user: { id: U1, email: 'a@example.com' } }) } : {}) });
  await stubNetwork(context);
  const seen = { register: [], unregister: [], test: 0 };
  const handler = (route) => {
    const p = new URL(route.request().url()).pathname, body = route.request().postData() ? JSON.parse(route.request().postData()) : null;
    const ok = (o) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(o) });
    if (p === '/config') return ok({ supabase: null, billing: null, allPro: false, push: serverPush });
    if (p === '/push/register') { seen.register.push(body); return ok({ ok: true }); }
    if (p === '/push/unregister') { seen.unregister.push(body); return ok({ ok: true }); }
    if (p === '/push/test') { seen.test++; return ok({ ok: true }); }
    if (p === '/me') return ok({ signedIn: true, accounts: true, tier: 'free', usage: {}, caps: {} });
    return ok({ text: '' });
  };
  await context.route(`${LIVE}/**`, handler);
  await context.route('**/push/**', (r) => handler(r));
  return seen;
}
const control = (page) => page.getByTestId('push-control');

test.describe('in the app', () => {
  test('Profile offers the switch; turning it on asks the phone, registers the token with the platform and time zone, and says it is on', async ({ context, page }) => {
    const seen = await boot(context, page);
    await page.goto(`${BASE}/#account`);
    await expect(control(page)).toContainText('Push notifications');
    expect(await page.evaluate(() => window.__push)).toEqual([]); // nothing asked on opening
    await control(page).getByRole('switch').click();
    await expect.poll(() => seen.register.length).toBe(1);
    expect(seen.register[0]).toMatchObject({ platform: 'ios', token: expect.stringContaining('tok-device-') });
    expect(typeof seen.register[0].tz === 'string' || seen.register[0].tz === null).toBe(true);
    expect(await page.evaluate(() => window.__push.map((c) => c[0]))).toEqual(['request', 'register']);
    await expect(control(page).getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('push-test').click();
    await expect.poll(() => seen.test).toBe(1);
    await expect(page.getByTestId('push-msg')).toContainText('Sent');
  });

  test('turning it off tells the server to forget this phone and the phone to stop', async ({ context, page }) => {
    const seen = await boot(context, page);
    await page.goto(`${BASE}/#account`);
    const sw = control(page).getByRole('switch');
    await sw.click(); await expect.poll(() => seen.register.length).toBe(1);
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await sw.click();
    await expect.poll(() => seen.unregister.length).toBe(1);
    expect(seen.unregister[0].token).toContain('tok-device-');
    await expect.poll(() => page.evaluate(() => window.__push.some((c) => c[0] === 'unregister'))).toBe(true);
    await expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  test('if they say no to the phone\'s question, it says where to change it and registers nothing', async ({ context, page }) => {
    const seen = await boot(context, page);
    await page.addInitScript(() => { window.__grant = false; });
    await page.goto(`${BASE}/#account`);
    await control(page).getByRole('switch').click();
    await expect(control(page)).toContainText("phone's settings");
    expect(seen.register).toEqual([]);
  });

  test('already blocked in the phone\'s settings: no switch, just the way back', async ({ context, page }) => {
    await boot(context, page, { perm: 'denied' });
    await page.goto(`${BASE}/#account`);
    await expect(control(page)).toContainText("Turned off in your phone's settings");
    await expect(control(page).getByRole('switch')).toHaveCount(0);
  });

  test('signed out it asks them to sign in, because the reminders are about their wines', async ({ context, page }) => {
    await boot(context, page, { signedIn: false });
    await page.goto(`${BASE}/#account`);
    await expect(control(page)).toContainText('Sign in to get reminders');
    await expect(control(page).getByRole('switch')).toHaveCount(0);
  });

  test('not shown on the web, in a build without push, or before the server can send', async ({ context, page, browser }) => {
    await boot(context, page, { native: false });
    await page.goto(`${BASE}/#account`);
    await expect(page.getByTestId('notify-control')).toBeVisible();
    await expect(control(page)).toHaveCount(0);
    const c2 = await browser.newContext(); const p2 = await c2.newPage();
    await boot(c2, p2, { built: false });
    await p2.goto(`${BASE}/#account`);
    await expect(p2.getByTestId('notify-control')).toBeVisible();
    await expect(control(p2)).toHaveCount(0);
    const c3 = await browser.newContext(); const p3 = await c3.newPage();
    await boot(c3, p3, { serverPush: false });
    await p3.goto(`${BASE}/#account`);
    await expect(p3.getByTestId('notify-control')).toBeVisible();
    await expect(control(p3)).toHaveCount(0);
    await c2.close(); await c3.close();
  });

  test('a tap on a notification opens where it points; a place the app doesn\'t have goes Home', async ({ context, page }) => {
    await boot(context, page);
    await page.goto(`${BASE}/#account`);
    await expect(control(page)).toBeVisible(); // the plugin's listeners are in by now
    const tap = (link) => page.evaluate((l) => window.__emitPush('pushNotificationActionPerformed', { notification: { data: { link: l } } }), link);
    await tap('{"screen":"mywines"}');
    await expect(page).toHaveURL(/#mywines$/);
    await tap({ screen: 'camera' });
    await expect(page).toHaveURL(/#camera$/);
    await page.goto(`${BASE}/#account`);
    await tap('{"screen":"javascript:alert(1)"}');
    await expect(page).toHaveURL(/#home$/);
    await page.goto(`${BASE}/#account`);
    await tap('not json');
    await expect(page).toHaveURL(/#home$/);
  });

  test('signing out on purpose unlinks this phone', async ({ context, page }) => {
    const seen = await boot(context, page);
    await page.goto(`${BASE}/#account`);
    const sw = control(page).getByRole('switch');
    await sw.click(); await expect.poll(() => seen.register.length).toBe(1);
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await page.evaluate(() => Account.signOut());
    await expect.poll(() => seen.unregister.length).toBe(1);
  });
});
