// Buying Pro through RevenueCat: the Worker copies RevenueCat's answer into `entitlements` (the
// webhook and /billing/sync) without ever shortening a promo's Pro, /config hands the app the
// public keys, and the Pro sheet in the app buys, cancels, restores and asks for sign-in first.
// Supabase and RevenueCat are fakes; so is the store plugin.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { stubNetwork, makeDeterministic, seedLocalStorage } = require('./helpers');

const BASE = 'http://localhost:4173';
const LIVE = 'https://vinterest.pages.dev';
const SB = 'https://proj.supabase.co';
const RC = 'https://api.revenuecat.com/v1/subscribers/';
const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const DAY = 86400000;
const iso = (ms) => new Date(Date.now() + ms).toISOString();

async function loadWorker() {
  const copy = path.join(require('node:os').tmpdir(), `worker-billing-${process.pid}.mjs`);
  require('node:fs').copyFileSync(path.join(__dirname, '..', '_worker.js'), copy);
  return (await import(pathToFileURL(copy).href)).default;
}

// Supabase (auth + an entitlements table that upserts as PostgREST does) and RevenueCat, in memory.
function fakes({ rcDown = false } = {}) {
  const users = { 'tok-1': { id: U1, email: 'a@example.com' }, 'tok-2': { id: U2, email: 'b@example.com' } };
  const ent = {}, subs = {}, rcDeleted = [], rcCalls = [];
  const res = (status, body) => new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const fetch = async (url, init = {}) => {
    url = String(url); const h = new Headers(init.headers || {});
    if (url === `${SB}/auth/v1/user`) { const u = users[(h.get('authorization') || '').replace('Bearer ', '')]; return u ? res(200, u) : res(401, {}); }
    if (url.startsWith(RC)) {
      const id = decodeURIComponent(url.slice(RC.length));
      rcCalls.push({ id, method: init.method || 'GET', auth: h.get('authorization') });
      if (rcDown) return res(500, {});
      if (init.method === 'DELETE') { rcDeleted.push(id); return res(200, {}); }
      return res(200, { subscriber: { entitlements: subs[id] || {} } });
    }
    if (url.startsWith(`${SB}/rest/v1/entitlements`)) {
      if (init.method === 'POST') { const b = JSON.parse(init.body); ent[b.user_id] = b; return res(201, null); }
      if (init.method === 'DELETE') return res(204, null);
      const id = /user_id=eq\.([^&]+)/.exec(url)[1]; return res(200, ent[id] ? [ent[id]] : []);
    }
    if (url.startsWith(`${SB}/auth/v1/admin/users/`)) return res(200, {});
    return res(404, {});
  };
  return { fetch, ent, subs, rcDeleted, rcCalls };
}

test.describe('Worker', () => {
  let worker, realFetch, ip = 0;
  const env = { ANTHROPIC_API_KEY: 'k', SUPABASE_URL: SB, SUPABASE_PUBLISHABLE_KEY: 'pub', SUPABASE_SECRET_KEY: 'sec', REVENUECAT_SECRET_KEY: 'sk_rc', REVENUECAT_WEBHOOK_AUTH: 'hook-secret', ALL_PRO: '0' };
  const post = (p, { token, body, auth } = {}) => new Request('https://vinterest.pages.dev' + p, { method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://vinterest.pages.dev', 'cf-connecting-ip': '10.1.0.' + (++ip), ...(token ? { authorization: 'Bearer ' + token } : {}), ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(body || {}) });
  const hook = (event, auth = 'hook-secret') => worker.fetch(post('/revenuecat', { auth, body: { event } }), env);
  test.beforeAll(async () => { worker = await loadWorker(); realFetch = globalThis.fetch; });
  test.afterEach(() => { globalThis.fetch = realFetch; });

  test('/config carries the public store keys and whether everyone is Pro', async () => {
    const get = (e) => worker.fetch(new Request('https://vinterest.pages.dev/config'), e).then((r) => r.json());
    expect(await get({ ...env, REVENUECAT_IOS_KEY: 'appl_x', REVENUECAT_ANDROID_KEY: 'goog_x' })).toMatchObject({ billing: { ios: 'appl_x', android: 'goog_x' }, allPro: false });
    expect(await get({})).toMatchObject({ billing: null, allPro: false });
  });

  test('the webhook refuses anyone without the shared secret, and applies nothing', async () => {
    const f = fakes(); globalThis.fetch = f.fetch;
    expect((await hook({ app_user_id: U1 }, 'wrong')).status).toBe(401);
    expect((await worker.fetch(post('/revenuecat', { body: { event: { app_user_id: U1 } } }), env)).status).toBe(401);
    expect((await hook({ app_user_id: U1 }, 'hook-secret')).status).toBe(200);
    expect((await worker.fetch(post('/revenuecat', { auth: 'x', body: {} }), { ...env, REVENUECAT_WEBHOOK_AUTH: '' })).status).toBe(401);
    expect(f.rcCalls.filter((c) => c.id !== U1)).toEqual([]);
  });

  test('a purchase makes them Pro until the subscription ends; the key is RevenueCat\'s secret, never the user\'s', async () => {
    const f = fakes(); globalThis.fetch = f.fetch;
    const end = iso(30 * DAY);
    f.subs[U1] = { pro: { expires_date: end } };
    expect((await hook({ type: 'INITIAL_PURCHASE', app_user_id: U1 })).status).toBe(200);
    expect(f.ent[U1]).toMatchObject({ tier: 'pro', source: 'revenuecat', expires_at: end });
    expect(f.rcCalls[0]).toEqual({ id: U1, method: 'GET', auth: 'Bearer sk_rc' });
    const me = await worker.fetch(new Request('https://vinterest.pages.dev/me', { headers: { authorization: 'Bearer tok-1', origin: 'https://vinterest.pages.dev' } }), env).then((r) => r.json());
    expect(me).toMatchObject({ tier: 'pro', source: 'revenuecat', expires_at: end });
  });

  test('it expires and refunds: Pro goes away; an anonymous RevenueCat id is ignored', async () => {
    const f = fakes(); globalThis.fetch = f.fetch;
    f.subs[U1] = { pro: { expires_date: iso(10 * DAY) } };
    await hook({ type: 'RENEWAL', app_user_id: U1 });
    f.subs[U1] = { pro: { expires_date: iso(-DAY) } };
    await hook({ type: 'EXPIRATION', app_user_id: U1 });
    expect(f.ent[U1]).toMatchObject({ tier: 'free', source: 'revenuecat' });
    const before = f.rcCalls.length;
    await hook({ type: 'INITIAL_PURCHASE', app_user_id: '$RCAnonymousID:abc' });
    expect(f.rcCalls.length).toBe(before);
    // A transfer to another account updates both.
    f.subs[U2] = { pro: { expires_date: iso(5 * DAY) } };
    await hook({ type: 'TRANSFER', transferred_from: [U1], transferred_to: [U2] });
    expect(f.ent[U2]).toMatchObject({ tier: 'pro', source: 'revenuecat' });
  });

  test('a promo\'s Pro is never shortened by a subscription or by one lapsing; the later end wins', async () => {
    const f = fakes(); globalThis.fetch = f.fetch;
    const promoEnd = iso(90 * DAY);
    f.ent[U1] = { user_id: U1, tier: 'pro', source: 'promo', expires_at: promoEnd };
    // Their subscription lapses: the promo stays.
    f.subs[U1] = { pro: { expires_date: iso(-DAY) } };
    await hook({ type: 'EXPIRATION', app_user_id: U1 });
    expect(f.ent[U1]).toMatchObject({ tier: 'pro', source: 'promo', expires_at: promoEnd });
    // A shorter subscription doesn't pull the end in.
    f.subs[U1] = { pro: { expires_date: iso(30 * DAY) } };
    await hook({ type: 'INITIAL_PURCHASE', app_user_id: U1 });
    expect(f.ent[U1]).toMatchObject({ tier: 'pro', expires_at: promoEnd });
    // A longer one does.
    const longer = iso(200 * DAY);
    f.subs[U1] = { pro: { expires_date: longer } };
    await hook({ type: 'RENEWAL', app_user_id: U1 });
    expect(f.ent[U1]).toMatchObject({ tier: 'pro', source: 'revenuecat', expires_at: longer });
  });

  test('a failure reading RevenueCat makes RevenueCat retry (500) and changes nothing', async () => {
    const f = fakes({ rcDown: true }); globalThis.fetch = f.fetch;
    expect((await hook({ type: 'RENEWAL', app_user_id: U1 })).status).toBe(500);
    expect(f.ent).toEqual({});
  });

  test('/billing/sync: signed out is refused; signed in copies RevenueCat\'s answer and says it', async () => {
    const f = fakes(); globalThis.fetch = f.fetch;
    expect((await worker.fetch(post('/billing/sync'), env)).status).toBe(401);
    f.subs[U2] = { pro: { expires_date: null } };
    const r = await worker.fetch(post('/billing/sync', { token: 'tok-2' }), env);
    expect(await r.json()).toEqual({ tier: 'pro', expires_at: null });
    expect(f.ent[U2]).toMatchObject({ tier: 'pro', source: 'revenuecat', expires_at: null });
    // Someone with nothing to restore stays free, and the row isn't invented.
    const none = await worker.fetch(post('/billing/sync', { token: 'tok-1' }), env);
    expect(await none.json()).toMatchObject({ tier: 'free' });
    expect(f.ent[U1]).toBeUndefined();
    // Without the RevenueCat key the Worker says purchases aren't set up.
    expect((await worker.fetch(post('/billing/sync', { token: 'tok-1' }), { ...env, REVENUECAT_SECRET_KEY: '' })).status).toBe(503);
  });

  test('deleting an account also deletes their RevenueCat customer record', async () => {
    const f = fakes(); globalThis.fetch = f.fetch;
    const r = await worker.fetch(post('/account/delete', { token: 'tok-1' }), env);
    expect(r.status).toBe(200);
    expect(f.rcDeleted).toEqual([U1]);
  });
});

// ---- The app: the Pro sheet with a fake store plugin ----

async function asIosApp(page, { purchase = 'ok', restore = 'pro', offer = 'grant', platform = 'ios' } = {}) {
  await page.addInitScript(({ purchase, restore, offer, platform }) => {
    window.CapacitorCustomPlatform = { name: platform };
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => platform };
    const calls = (window.__rc = []);
    const fake = {
      configure: async (o) => { calls.push(['configure', o.apiKey, o.appUserID || null]); },
      logIn: async (o) => { calls.push(['logIn', o.appUserID]); },
      logOut: async () => { calls.push(['logOut']); },
      getOfferings: async () => ({ current: { availablePackages: [
        { identifier: '$rc_monthly', packageType: 'MONTHLY', product: { priceString: '£4.99', title: 'Vinterest Pro' } },
        { identifier: '$rc_annual', packageType: 'ANNUAL', product: { priceString: '£39.99', title: 'Vinterest Pro' } },
      ] } }),
      purchasePackage: async (o) => {
        calls.push(['purchase', o.aPackage.identifier]);
        if (purchase === 'cancel') throw Object.assign(new Error('cancelled'), { userCancelled: true });
        if (purchase === 'fail') throw new Error('store down');
        window.__bought = true;
      },
      restorePurchases: async () => { calls.push(['restore']); if (restore === 'pro') window.__bought = true; },
      showManageSubscriptions: async () => { calls.push(['manage']); },
      presentCodeRedemptionSheet: async () => { calls.push(['offer']); if (offer === 'grant') window.__bought = true; },
    };
    let native;
    Object.defineProperty(window, 'VinterestNative', { configurable: true, get: () => native, set: (v) => { native = { ...v, Purchases: fake }; } });
  }, { purchase, restore, offer, platform });
}
async function setup(context, page, { signedIn = true, source = null } = {}) {
  await makeDeterministic(page);
  await page.addInitScript((sb) => { window.VINTEREST_SUPABASE = { url: sb, key: 'k' }; }, SB);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk',
    ...(signedIn ? { vinterest_session: JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Date.now() / 1000 + 3600, user: { id: U1, email: 'a@example.com' } }) } : {}) });
  await stubNetwork(context);
  const hits = [];
  await context.route(`${LIVE}/**`, (route) => {
    const p = new URL(route.request().url()).pathname;
    hits.push(p);
    const body = (o) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(o) });
    return page.evaluate(() => !!window.__bought).catch(() => false).then((bought) => {
      if (p === '/config') return body({ supabase: null, billing: { ios: 'appl_test', android: 'goog_test' }, allPro: false });
      if (p === '/billing/sync') return body({ tier: bought ? 'pro' : 'free', expires_at: null });
      if (p === '/me') return body({ signedIn: true, accounts: true, email: 'a@example.com', tier: bought ? 'pro' : 'free', source: bought ? (source || 'revenuecat') : null, expires_at: null, usage: {}, caps: {} });
      return body({ text: '' });
    });
  });
  return hits;
}
const openSheet = async (page) => {
  await page.goto(`${BASE}/#account`);
  await page.getByRole('button', { name: 'Upgrade' }).click();
  await expect(page.locator('[data-sheet="pro"]')).toBeVisible();
};

test.describe('the Pro sheet in the app', () => {
  test('signed in: prices come from the store, buying makes them Pro and the sheet closes', async ({ context, page }) => {
    await asIosApp(page);
    const hits = await setup(context, page);
    await openSheet(page);
    const sheet = page.locator('[data-sheet="pro"]');
    await expect(sheet.getByTestId('pro-offer')).toHaveCount(2);
    await expect(sheet.getByTestId('pro-offer').first()).toContainText('£4.99 / month');
    await expect(sheet.getByTestId('pro-offer').nth(1)).toContainText('£39.99 / year');
    await expect(sheet).toContainText('Payment is charged to your Apple ID');
    await expect(sheet).toContainText('renews automatically');
    expect(await page.evaluate(() => window.__rc.find((c) => c[0] === 'configure'))).toEqual(['configure', 'appl_test', U1]);
    await sheet.getByTestId('pro-offer').first().click();
    await expect(sheet).toHaveCount(0);
    expect(await page.evaluate(() => window.__rc.filter((c) => c[0] === 'purchase'))).toEqual([['purchase', '$rc_monthly']]);
    expect(hits).toContain('/billing/sync');
    await expect(page.getByTestId('manage-subscription')).toBeVisible();
    expect(await page.evaluate(() => Account.tier())).toBe('pro');
  });

  test('closing the store sheet is not an error and nobody is charged or made Pro', async ({ context, page }) => {
    await asIosApp(page, { purchase: 'cancel' });
    const hits = await setup(context, page);
    await openSheet(page);
    const syncs = () => hits.filter((h) => h === '/billing/sync').length, before = syncs();
    await page.locator('[data-sheet="pro"]').getByTestId('pro-offer').first().click();
    await expect(page.locator('[data-sheet="pro"]')).toBeVisible();
    await expect(page.getByTestId('pro-msg')).toHaveCount(0);
    expect(syncs()).toBe(before);
    expect(await page.evaluate(() => Account.tier())).toBe('free');
  });

  test('a store failure says so in words and leaves them free', async ({ context, page }) => {
    await asIosApp(page, { purchase: 'fail' });
    await setup(context, page);
    await openSheet(page);
    await page.locator('[data-sheet="pro"]').getByTestId('pro-offer').first().click();
    await expect(page.getByTestId('pro-msg')).toContainText("you haven't been charged");
    expect(await page.evaluate(() => Account.tier())).toBe('free');
  });

  test('Restore purchases brings Pro back; with nothing to restore it says so', async ({ context, page }) => {
    await asIosApp(page);
    await setup(context, page);
    await openSheet(page);
    await page.locator('[data-sheet="pro"]').getByTestId('pro-restore').click();
    await expect(page.locator('[data-sheet="pro"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.__rc.some((c) => c[0] === 'restore'))).toBe(true);
    expect(await page.evaluate(() => Account.tier())).toBe('pro');
  });
  test('Restore with nothing to restore', async ({ context, page }) => {
    await asIosApp(page, { restore: 'none' });
    await setup(context, page);
    await openSheet(page);
    await page.locator('[data-sheet="pro"]').getByTestId('pro-restore').click();
    await expect(page.getByTestId('pro-msg')).toContainText('no Pro subscription');
    expect(await page.evaluate(() => Account.tier())).toBe('free');
  });

  test('signed out: the sheet asks for sign-in first and offers nothing to buy', async ({ context, page }) => {
    await asIosApp(page);
    await setup(context, page, { signedIn: false });
    await page.goto(`${BASE}/#learn`);
    await page.getByTestId('learn-mastery-link').click();
    const sheet = page.locator('[data-sheet="pro"]');
    await expect(sheet).toContainText('Pro belongs to your account');
    await expect(sheet.getByTestId('pro-offer')).toHaveCount(0);
    expect(await page.evaluate(() => (window.__rc || []).filter((c) => c[0] === 'purchase'))).toEqual([]);
    await sheet.getByRole('button', { name: 'Sign in to go Pro' }).click();
    await expect(page.locator('#root')).toContainText('Sign in to go Pro');
    await expect(page.locator('#root')).toContainText('then tap Upgrade');
  });

  test('the delete screen warns that a store subscription must be cancelled in Settings', async ({ context, page }) => {
    await asIosApp(page);
    await setup(context, page);
    await page.addInitScript(() => { window.__bought = true; });
    await page.goto(`${BASE}/#account`);
    await expect(page.getByTestId('manage-subscription')).toBeVisible();
    await page.getByText('Delete account').click();
    await expect(page.getByRole('dialog', { name: 'Delete your account' })).toContainText("isn't cancelled by deleting your account");
  });

  test.describe('promo codes on iPhone are Apple offer codes', () => {
  const quick = (page) => page.evaluate(() => { Billing.OFFER_WAITS = [0, 50]; });

  test('"Have a promo code?" opens Apple\'s redeem sheet, not a field of ours, and Pro shows once it is redeemed', async ({ context, page }) => {
    await asIosApp(page);
    const hits = await setup(context, page);
    await page.goto(`${BASE}/#account`);
    await quick(page);
    await page.getByText('Have a promo code?').click();
    await expect(page.getByTestId('promo-done')).toContainText('Your code worked');
    await expect(page.getByLabel('Promo code')).toHaveCount(0);
    expect(await page.evaluate(() => window.__rc.filter((c) => c[0] === 'offer').length)).toBe(1);
    expect(hits).not.toContain('/promo');
    expect(await page.evaluate(() => Account.tier())).toBe('pro');
  });

  test('if nothing was redeemed it says so gently and they stay free', async ({ context, page }) => {
    await asIosApp(page, { offer: 'none' });
    await setup(context, page);
    await page.goto(`${BASE}/#account`);
    await quick(page);
    await page.getByText('Have a promo code?').click();
    await expect(page.getByTestId('promo-done')).toContainText('If your code worked');
    expect(await page.evaluate(() => Account.tier())).toBe('free');
  });

  test('the Pro sheet\'s link goes straight to Apple\'s sheet when signed in', async ({ context, page }) => {
    await asIosApp(page);
    await setup(context, page);
    await openSheet(page);
    await quick(page);
    await page.locator('[data-sheet="pro"]').getByText('Have a promo code?').click();
    await expect(page.getByTestId('promo-done')).toContainText('Your code worked');
    expect(await page.evaluate(() => window.__rc.filter((c) => c[0] === 'offer').length)).toBe(1);
  });

  test('Android keeps the typed code field and never opens Apple\'s sheet', async ({ context, page }) => {
    await asIosApp(page, { platform: 'android' });
    await setup(context, page);
    await page.goto(`${BASE}/#account`);
    await page.getByText('Have a promo code?').click();
    await expect(page.getByLabel('Promo code')).toBeVisible();
    expect(await page.evaluate(() => [Billing.offerCodes(), window.__rc.some((c) => c[0] === 'offer')])).toEqual([false, false]);
  });
});

test('on the web nothing is sold: no store plugin, no billing', async ({ context, page }) => {
    await makeDeterministic(page);
    await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
    await stubNetwork(context);
    await page.goto(`${BASE}/#home`);
    expect(await page.evaluate(() => [Billing.available(), Billing.sdk()])).toEqual([false, null]);
  });

  test('the testing switch follows the Worker and ships off', async ({ context, page }) => {
    await makeDeterministic(page);
    await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk', vinterest_billing_config: JSON.stringify({ allPro: false }) });
    await context.addInitScript(() => { window.VINTEREST_REAL_PLANS = false; });
    await page.goto(`${BASE}/#home`);
    expect(await page.evaluate(() => [Entitlement.allPro(), Billing.allPro()])).toEqual([false, false]);
    await page.evaluate(() => localStorage.removeItem('vinterest_billing_config'));
    expect(await page.evaluate(() => Entitlement.allPro())).toBe(false);
  });
});
