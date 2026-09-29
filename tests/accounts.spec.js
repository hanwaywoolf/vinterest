// Optional sign-in (step 5): the Worker checks the token, Pro and the weekly fair-use limits
// against Supabase; the app signs in with an emailed code, sends its token, and falls back to
// signed out when the server says the sign-in has expired. Supabase and Anthropic are stubbed.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';
const SB = 'https://proj.supabase.co';

// ---- The Worker, against a fake Supabase ----

async function loadWorker() {
  const copy = path.join(require('node:os').tmpdir(), `worker-accounts-${process.pid}.mjs`);
  require('node:fs').copyFileSync(path.join(__dirname, '..', '_worker.js'), copy);
  return (await import(pathToFileURL(copy).href)).default;
}

// A Supabase with two users (free and pro) that meters use_quota as the migration does.
function fakeSupabase({ down = false, adminDown = false } = {}) {
  const users = { 'tok-free': { id: 'u-free', email: 'free@example.com' }, 'tok-pro': { id: 'u-pro', email: 'pro@example.com' } };
  const counters = {}, calls = [], deleted = [];
  const res = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const fetch = async (url, init = {}) => {
    url = String(url);
    const h = new Headers(init.headers || {});
    if (url.startsWith('https://api.anthropic.com')) return res(200, { content: [{ type: 'text', text: 'ok' }] });
    calls.push({ url, apikey: h.get('apikey') });
    if (down) throw new Error('unreachable');
    if (url === `${SB}/auth/v1/user`) {
      const u = users[(h.get('authorization') || '').replace('Bearer ', '')];
      return u ? res(200, u) : res(401, { msg: 'bad jwt' });
    }
    if (url.startsWith(`${SB}/auth/v1/admin/users/`)) {
      calls.at(-1).method = init.method;
      if (adminDown) return res(500, { msg: 'down' });
      const id = url.split('/').pop();
      for (const [t, u] of Object.entries(users)) if (u.id === id) delete users[t];
      deleted.push('auth:' + id); return res(200, {});
    }
    if (init.method === 'DELETE' && url.startsWith(`${SB}/rest/v1/`)) {
      deleted.push(url.slice(`${SB}/rest/v1/`.length)); return res(204, null);
    }
    if (url.startsWith(`${SB}/rest/v1/entitlements`)) return res(200, url.includes('u-pro') ? [{ tier: 'pro', expires_at: null }] : []);
    if (url === `${SB}/rest/v1/rpc/use_quota`) {
      const { p_user, p_kind, p_cap } = JSON.parse(init.body);
      const k = p_user + ':' + p_kind, n = counters[k] || 0;
      if (p_cap <= 0 || n >= p_cap) return res(200, null);
      counters[k] = n + 1; return res(200, n + 1);
    }
    if (url.startsWith(`${SB}/rest/v1/usage_counters`)) {
      const who = /user_id=eq\.([^&]+)/.exec(url)[1];
      return res(200, Object.entries(counters).filter(([k]) => k.startsWith(who + ':')).map(([k, count]) => ({ kind: k.split(':')[1], count })));
    }
    return res(404, {});
  };
  return { fetch, calls, counters, deleted };
}

test.describe('Worker', () => {
  let worker, realFetch, ip = 0;
  const env = { ANTHROPIC_API_KEY: 'k', SUPABASE_URL: SB, SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x', SUPABASE_SECRET_KEY: 'sb_secret_x' };
  const req = (p, { token, body, method = 'POST' } = {}) => new Request('https://vinterest.pages.dev' + p, { method,
    headers: { 'content-type': 'application/json', origin: 'https://vinterest.pages.dev', 'cf-connecting-ip': '10.0.0.' + (++ip), ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: method === 'POST' ? JSON.stringify(body) : undefined });
  const scan = (purpose, token, e = env) => worker.fetch(req('/claude', { token, body: { purpose, messages: [{ role: 'user', content: 'x' }] } }), e);
  test.beforeAll(async () => { worker = await loadWorker(); realFetch = globalThis.fetch; });
  test.afterEach(() => { globalThis.fetch = realFetch; });

  test('signed out: works as before and never asks Supabase; Pro-only features ask them to sign in', async () => {
    const sb = fakeSupabase(); globalThis.fetch = sb.fetch;
    expect((await scan('label_scan')).status).toBe(200);
    expect(sb.calls).toEqual([]);
    const r = await scan('list_scan');
    expect(r.status).toBe(402);
    expect(await r.json()).toMatchObject({ code: 'pro_required', signIn: true });
    // Without Supabase configured, nothing changes at all.
    expect((await scan('list_scan', null, { ANTHROPIC_API_KEY: 'k' })).status).toBe(200);
  });

  test('a token Supabase rejects gets 401 auth_expired; the secret key never goes to the auth check', async () => {
    const sb = fakeSupabase(); globalThis.fetch = sb.fetch;
    const r = await scan('label_scan', 'tok-forged');
    expect(r.status).toBe(401);
    expect((await r.json()).code).toBe('auth_expired');
    expect(sb.calls[0]).toEqual({ url: `${SB}/auth/v1/user`, apikey: 'sb_publishable_x' });
  });

  test('Pro comes from the server: a free account is refused list scans, a Pro one is metered', async () => {
    const sb = fakeSupabase(); globalThis.fetch = sb.fetch;
    const free = await scan('list_scan', 'tok-free');
    expect(free.status).toBe(402);
    expect((await free.json()).signIn).toBeUndefined();
    expect((await scan('list_scan', 'tok-pro')).status).toBe(200);
    expect(sb.counters['u-pro:list_scan']).toBe(1);
    expect(sb.calls.filter((c) => c.url.includes('/rest/v1/')).every((c) => c.apikey === 'sb_secret_x')).toBe(true);
  });

  test('the weekly fair-use limit answers 429 once reached, and /me reports usage', async () => {
    const sb = fakeSupabase(); globalThis.fetch = sb.fetch;
    sb.counters['u-free:label_scan'] = 99; // the free cap is 100
    expect((await scan('label_scan', 'tok-free')).status).toBe(200);
    const r = await scan('label_scan', 'tok-free');
    expect(r.status).toBe(429);
    expect((await r.json()).code).toBe('fair_use');
    const me = await (await worker.fetch(req('/me', { token: 'tok-free', method: 'GET' }), env)).json();
    expect(me).toMatchObject({ signedIn: true, email: 'free@example.com', tier: 'free', usage: { label_scan: 100 }, caps: { label_scan: 100 } });
    const out = await (await worker.fetch(req('/me', { method: 'GET' }), env)).json();
    expect(out).toEqual({ signedIn: false, accounts: true, tier: 'free' });
  });

  test('/account/delete removes the auth user with the secret key, then every row of theirs', async () => {
    const sb = fakeSupabase(); globalThis.fetch = sb.fetch;
    const r = await worker.fetch(req('/account/delete', { token: 'tok-free' }), env);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ deleted: true });
    expect(sb.deleted[0]).toBe('auth:u-free');
    expect(sb.deleted.slice(1).sort()).toEqual(['entitlements', 'usage_counters', 'user_docs', 'wines'].map((t) => `${t}?user_id=eq.u-free`));
    const admin = sb.calls.find((c) => c.url.includes('/admin/users/'));
    expect(admin).toEqual({ url: `${SB}/auth/v1/admin/users/u-free`, apikey: 'sb_secret_x', method: 'DELETE' });
    // The old token no longer works, even from the Worker's own cache.
    expect((await scan('label_scan', 'tok-free')).status).toBe(401);
  });

  test('/account/delete: nothing is removed without a valid sign-in or when the auth delete fails', async () => {
    const sb = fakeSupabase(); globalThis.fetch = sb.fetch;
    expect((await worker.fetch(req('/account/delete'), env)).status).toBe(401);
    expect((await worker.fetch(req('/account/delete', { token: 'tok-forged' }), env)).status).toBe(401);
    expect((await worker.fetch(req('/account/delete', { token: 'tok-pro', method: 'GET' }), env)).status).toBe(405);
    expect(sb.deleted).toEqual([]);
    const down = fakeSupabase({ adminDown: true }); globalThis.fetch = down.fetch;
    const r = await worker.fetch(req('/account/delete', { token: 'tok-pro' }), env);
    expect(r.status).toBe(502);
    expect((await r.json()).code).toBe('delete_failed');
    expect(down.deleted).toEqual([]);
  });

  test('Supabase unreachable: scans still go through', async () => {
    globalThis.fetch = fakeSupabase({ down: true }).fetch;
    expect((await scan('label_scan', 'tok-free-down')).status).toBe(200);
  });
});

// ---- The app ----

async function app(context, page, { me = { signedIn: true, accounts: true, email: 'carey@example.com', tier: 'free', usage: {}, caps: { label_scan: 100 } }, claude } = {}) {
  const seen = { otp: [], verify: [], claudeAuth: [], me: 0 };
  await makeDeterministic(page);
  await page.addInitScript((sb) => { window.VINTEREST_SUPABASE = { url: sb, key: 'sb_publishable_test' }; }, SB);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk' });
  await stubNetwork(context);
  await context.route(`${SB}/auth/v1/**`, (route) => {
    const url = route.request().url(), body = JSON.parse(route.request().postData() || '{}');
    const reply = (status, b) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (url.endsWith('/otp')) { seen.otp.push(body); return reply(200, {}); }
    if (url.endsWith('/verify')) {
      seen.verify.push(body);
      return body.token === '123456' ? reply(200, { access_token: 'acc-1', refresh_token: 'ref-1', expires_in: 3600, user: { id: 'u1', email: body.email } }) : reply(403, { msg: 'Token has expired or is invalid' });
    }
    if (url.includes('/logout')) return reply(204, {});
    return reply(404, {});
  });
  await context.route('**/me', (route) => { seen.me++; return route.fulfill({ contentType: 'application/json', body: JSON.stringify(me) }); });
  await context.route('**/claude', (route) => {
    const auth = route.request().headers().authorization || null;
    seen.claudeAuth.push(auth);
    const r = claude ? claude(auth) : { status: 200, body: { text: '' } };
    return route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body) });
  });
  return seen;
}

test('sign in with an emailed code from Profile, then sign out', async ({ context, page }) => {
  const errors = collectErrors(page);
  const seen = await app(context, page);
  await page.goto(`${BASE}/#account`);
  const root = page.locator('#root');
  await root.getByText('Sign in with email').click();
  await page.getByLabel('Email address').fill('  Carey@Example.com ');
  await root.getByText('Email me a code').click();
  await expect(root).toContainText('We sent a code to');
  expect(seen.otp).toEqual([{ email: 'carey@example.com', create_user: true }]);
  await page.getByLabel('Sign-in code').fill('999999');
  await root.getByText('Sign in', { exact: true }).click();
  await expect(root).toContainText('That code didn\'t work');
  await page.getByLabel('Sign-in code').fill('123456');
  await root.getByText('Sign in', { exact: true }).click();
  await expect(root).toContainText('Your account');
  await expect(root).toContainText('carey@example.com');
  expect(seen.verify.at(-1)).toEqual({ type: 'email', email: 'carey@example.com', token: '123456' });
  expect(seen.me).toBe(1);
  // Device-only: the session is never part of a backup.
  const inBackup = await page.evaluate(() => JSON.stringify(Backup.exportData()).includes('acc-1'));
  expect(inBackup).toBe(false);
  await root.getByText('Sign out').click();
  await expect(root).toContainText('Sign in (optional)');
  expect(await page.evaluate(() => [Store.get('vinterest_session'), Store.get('vinterest_me')])).toEqual([null, null]);
  // The wrong code's 403 is logged by the browser itself; nothing else may be.
  expect(errors.filter((e) => !e.includes('status of 403'))).toEqual([]);
});

test('signed in, Pro is what the server says, not the device flag', async ({ context, page }) => {
  await app(context, page, { me: { signedIn: true, accounts: true, email: 'a@b.c', tier: 'pro', usage: {}, caps: {} } });
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate(async () => {
    const before = Entitlement.isPro();
    Store.setJSON('vinterest_session', { access_token: 'acc-1', refresh_token: 'ref-1', expires_at: Date.now() / 1000 + 3600, user: { email: 'a@b.c' } });
    await Account.refreshMe();
    const pro = Entitlement.isPro();
    Store.setJSON('vinterest_me', { tier: 'free' });
    Store.set('vinterest_pro', '1');
    return { before, pro, flagIgnored: Entitlement.isPro() };
  });
  expect(out).toEqual({ before: false, pro: true, flagIgnored: false });
});

test('requests carry the token; an expired sign-in signs out here and the request still goes through', async ({ context, page }) => {
  const seen = await app(context, page, { claude: (auth) => auth ? { status: 401, body: { error: 'Your sign-in has expired.', code: 'auth_expired' } } : { status: 200, body: { text: 'hello' } } });
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate(async () => {
    Store.setJSON('vinterest_session', { access_token: 'acc-1', refresh_token: 'ref-1', expires_at: Date.now() / 1000 + 3600, user: { email: 'a@b.c' } });
    const text = await window.claude.complete({ purpose: 'wine_qa', messages: [{ role: 'user', content: 'hi' }] });
    return { text, signedIn: Account.signedIn() };
  });
  expect(out).toEqual({ text: 'hello', signedIn: false });
  expect(seen.claudeAuth.slice(-2)).toEqual(['Bearer acc-1', null]);
});

test('a fair-use or Pro refusal reaches the screen in the server\'s words', async ({ context, page }) => {
  await app(context, page, { claude: () => ({ status: 429, body: { error: 'You\'ve reached this week\'s fair-use limit for this. It resets on Monday.', code: 'fair_use' } }) });
  await page.goto(`${BASE}/#home`);
  const err = await page.evaluate(() => window.claude.complete({ purpose: 'wine_qa', messages: [{ role: 'user', content: 'hi' }] }).catch((e) => ({ message: e.message, code: e.code })));
  expect(err).toEqual({ message: 'You\'ve reached this week\'s fair-use limit for this. It resets on Monday.', code: 'fair_use' });
});

test('signed out, Profile\'s Backup says it\'s off in red, and its button opens sign-in', async ({ context, page }) => {
  const errors = collectErrors(page);
  await app(context, page);
  await page.goto(`${BASE}/#account`);
  const root = page.locator('#root');
  const status = root.getByRole('status').filter({ hasText: 'Not backed up' });
  await expect(status).toBeVisible();
  await expect(status.locator('span').last()).toHaveCSS('color', 'rgb(176, 74, 58)');
  await expect(root).toContainText('Your wines are only on this phone');
  await root.getByText('Sign in to back up').click();
  await expect(page.getByLabel('Email address')).toBeFocused();
  expect(errors).toEqual([]);
});

test('without sign-in configured, no account card appears', async ({ context, page }) => {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
  await stubNetwork(context);
  await page.goto(`${BASE}/#account`);
  await expect(page.locator('#root')).toContainText('Travel Mode');
  await expect(page.locator('#root')).not.toContainText('Sign in (optional)');
  await expect(page.locator('#root')).not.toContainText('Not backed up');
});

test('delete the account from Profile: confirm, then the server deletes it and the phone starts again', async ({ context, page }) => {
  const errors = collectErrors(page);
  await app(context, page);
  const calls = [];
  let fail = true;
  await context.route('**/account/delete', (route) => {
    calls.push(route.request().headers().authorization);
    return fail ? route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'Your account couldn\'t be deleted just now. Nothing was removed. Try again in a minute.', code: 'delete_failed' }) })
      : route.fulfill({ contentType: 'application/json', body: JSON.stringify({ deleted: true }) });
  });
  await page.goto(`${BASE}/#home`);
  await page.evaluate(() => {
    Store.setJSON('vinterest_session', { access_token: 'acc-1', refresh_token: 'ref-1', expires_at: Date.now() / 1000 + 3600, user: { id: 'u1', email: 'carey@example.com' } });
    Store.setJSON('vinterest_wines', [{ name: 'Test Rioja', vintage: '2019', type: 'red', score: 90, date: new Date().toISOString() }]);
    Store.set('vinterest_something', 'x', { session: true });
    XPSystem.save({ ...XPSystem.fresh(), total: 120 });
  });
  await page.goto(`${BASE}/#account`);
  const root = page.locator('#root');
  await root.getByText('Delete account').click();
  const dialog = page.getByRole('dialog', { name: 'Delete your account' });
  await expect(dialog).toContainText('It can\'t be undone');
  await expect(dialog).toContainText('Save a backup file');
  // Keep my account backs out without calling the server.
  await dialog.getByText('Keep my account').click();
  await expect(dialog).toHaveCount(0);
  expect(calls).toEqual([]);
  // A failure says so and leaves everything on the phone.
  await root.getByText('Delete account').click();
  await dialog.getByText('Delete my account').click();
  await expect(dialog.getByRole('alert')).toContainText('Nothing was removed');
  expect(await page.evaluate(() => [Account.signedIn(), WineHistory.getAll().length])).toEqual([true, 1]);
  // Then it goes through: signed out, nothing of Vinterest left on the phone, back to the welcome.
  fail = false;
  await dialog.getByText('Delete my account').click();
  await expect(page.locator('#root')).toContainText('Scan a bottle. Know if it\'s for you.');
  expect(calls).toEqual(['Bearer acc-1', 'Bearer acc-1']);
  const left = await page.evaluate(() => [...Store.keys('vinterest_'), ...Store.keys('vinterest_', { session: true })]);
  // XP writes a fresh, empty record the moment the new start reads it; everything else is gone.
  expect(left.filter((k) => k !== 'vinterest_xp_v3')).toEqual([]);
  expect(await page.evaluate(() => [XPSystem.get().total, Account.signedIn()])).toEqual([0, false]);
  expect(errors.filter((e) => !e.includes('status of 502'))).toEqual([]);
});

test('the Worker takes requests from the app\'s own addresses (test.vinterest.app too) and refuses others', async () => {
  const worker = await loadWorker();
  const post = (origin) => worker.fetch(new Request('https://test.vinterest.app/claude', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ purpose: 'not_a_purpose', messages: [] }) }), { ANTHROPIC_API_KEY: 'test-key' }, { waitUntil() {} });
  const code = async (o) => (await (await post(o)).json()).code;
  // Allowed: past the origin check, stopped instead by the made-up purpose (no call is made).
  for (const o of ['https://vinterest.app', 'https://test.vinterest.app', 'https://vinterest.pages.dev', 'https://abc123.vinterest.pages.dev']) expect(await code(o), o).toBe('invalid_purpose');
  expect(await code('https://evil.example')).toBe('origin_denied');
});
