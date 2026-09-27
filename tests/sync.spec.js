// Sync (pwa-sync.js): two phones signed in to one account, against a fake Supabase that stamps
// rows with its own clock like 0003_sync_times.sql. Each merge rule gets a two-phone scenario:
// first sign-in, a new phone, offline edits on both, deletes, XP on both, favourites and settings,
// and changes waiting while offline. The clock runs for real here: sync compares change times.
const { test, expect } = require('@playwright/test');
const { stubNetwork, seedLocalStorage } = require('./helpers');

const BASE = 'http://localhost:4173';
const SB = 'https://proj.supabase.co';
const USER = '11111111-2222-3333-4444-555555555555';

function fakeSupabase() {
  const db = { wines: new Map(), user_docs: new Map() };
  const state = { db, down: false, posts: 0, last: 0 };
  const stamp = () => { state.last = Math.max(Date.now(), state.last + 1); return new Date(state.last).toISOString(); };
  state.route = async (route) => {
    const req = route.request();
    if (state.down) return route.fulfill({ status: 503, body: '{}' });
    if ((req.headers().authorization || '') !== 'Bearer tok') return route.fulfill({ status: 401, body: '{}' });
    const url = new URL(req.url());
    const table = url.pathname.split('/').pop();
    const rows = db[table];
    const keyOf = (r) => (table === 'wines' ? r.wine_key : r.doc_key);
    if (req.method() === 'GET') {
      let out = [...rows.values()];
      const gte = url.searchParams.get('updated_at');
      if (gte) out = out.filter((r) => r.updated_at >= gte.replace(/^gte\./, ''));
      out.sort((a, b) => (a.updated_at < b.updated_at ? -1 : 1));
      const offset = +(url.searchParams.get('offset') || 0), limit = +(url.searchParams.get('limit') || 1e9);
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(out.slice(offset, offset + limit)) });
    }
    state.posts++;
    for (const r of JSON.parse(req.postData() || '[]')) {
      if (r.user_id !== USER) return route.fulfill({ status: 403, body: '{}' });
      rows.set(keyOf(r), { ...r, updated_at: stamp() });
    }
    return route.fulfill({ status: 201, body: '' });
  };
  return state;
}

// One phone: its own browser storage, signed in to the shared account.
async function phone(browser, server, { demo = false, signedIn = true } = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript((sb) => { window.VINTEREST_SUPABASE = { url: sb, key: 'sb_publishable_test' }; }, SB);
  const seed = { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk' };
  if (signedIn) seed.vinterest_session = JSON.stringify({ access_token: 'tok', refresh_token: 'r', expires_at: Date.now() / 1000 + 86400, user: { id: USER, email: 'c@example.com' } });
  await seedLocalStorage(page, seed);
  await stubNetwork(context);
  await context.route(`${SB}/rest/v1/**`, server.route);
  await context.route('**/me', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ signedIn: true, tier: 'free', usage: {}, caps: {} }) }));
  await page.goto(`${BASE}/${demo ? '?demo=1' : ''}#home`);
  await page.waitForFunction(() => typeof Sync !== 'undefined');
  return page;
}
// Runs one sync to completion (after any already running).
const sync = (page) => page.evaluate(async () => { while (Sync._running) await Sync._running; return Sync.syncNow(); });
const wines = (page) => page.evaluate(() => WineHistory.getAll());
const tick = (page) => page.waitForTimeout(5);

test.describe.configure({ mode: 'serial' });

test('first sign-in: everything goes up, and a copy of the phone is kept first', async ({ browser }) => {
  const server = fakeSupabase();
  const a = await phone(browser, server, { demo: true });
  const r = await sync(a);
  expect(r.ok).toBe(true);
  const mine = await wines(a);
  expect(mine.length).toBeGreaterThan(10);
  expect(server.db.wines.size).toBe(mine.length);
  expect([...server.db.user_docs.keys()].sort()).toEqual(['progress', 'settings', 'xp']);
  expect(server.db.user_docs.get('xp').data.total).toBe(await a.evaluate(() => XPSystem.get().total));
  const snap = await a.evaluate(() => JSON.parse(localStorage.getItem('vinterest_premigration_backup')));
  expect(snap.format).toBe('vinterest-backup');
  expect(snap.wines.length).toBe(mine.length);
  // Nothing left waiting, and the card says so.
  expect(await a.evaluate(() => [Sync.status().pending, Sync.line()])).toEqual([0, expect.stringContaining('backed up to your account')]);
});

test('a new phone gets the wines, XP and settings', async ({ browser }) => {
  const server = fakeSupabase();
  const a = await phone(browser, server, { demo: true });
  await a.evaluate(() => Settings.setScriptLength('short'));
  await sync(a);
  // B starts empty and syncs by itself as soon as it opens, signed in.
  const b = await phone(browser, server);
  await expect.poll(async () => (await wines(b)).length, { timeout: 10000 }).toBe((await wines(a)).length);
  await sync(b);
  expect((await wines(b)).map((w) => w.name).sort()).toEqual((await wines(a)).map((w) => w.name).sort());
  expect(await b.evaluate(() => XPSystem.get().total)).toBe(await a.evaluate(() => XPSystem.get().total));
  expect(await b.evaluate(() => Settings.scriptLength())).toBe('short');
  // B had nothing to send, so nothing of A's was overwritten.
  expect(await a.evaluate(() => { const w = WineHistory.getAll()[0]; return !!w.name; })).toBe(true);
});

test('offline edits on both phones: each keeps the other\'s, and a bottle changed on both is merged', async ({ browser }) => {
  const server = fakeSupabase();
  const a = await phone(browser, server, { demo: true });
  await sync(a);
  const b = await phone(browser, server);
  await sync(b);
  const [first, second] = await wines(a);
  // Offline: A scores the first; B adds a new bottle, and both change the second.
  await a.evaluate((w) => WineHistory.rate(w.name, w.vintage, 97), first);
  await b.evaluate(() => WineHistory.track({ name: 'Sync Test Albariño', producer: 'Test', vintage: 2023, type: 'white' }));
  await a.evaluate((w) => WineHistory.rate(w.name, w.vintage, 93), second);
  await b.evaluate((w) => WineHistory.setTasting(w.name, w.vintage, { buy_again: true }), second);
  await tick(a);
  await sync(a); await sync(b); await sync(a);
  for (const p of [a, b]) {
    const all = await wines(p);
    const find = (w) => all.find((x) => x.name === w.name && String(x.vintage) === String(w.vintage));
    expect(find(first).rating).toBe(97);
    expect(!!all.find((x) => x.name === 'Sync Test Albariño')).toBe(true);
    expect(find(second)).toMatchObject({ rating: 93, buy_again: true });
  }
  expect((await wines(a)).length).toBe((await wines(b)).length);
});

test('a delete reaches the other phone; an edit made after a delete brings the bottle back', async ({ browser }) => {
  const server = fakeSupabase();
  const a = await phone(browser, server, { demo: true });
  await sync(a);
  const b = await phone(browser, server);
  await sync(b);
  const [gone, contested] = await wines(a);
  await a.evaluate((w) => WineHistory.remove(w.name, w.vintage), gone);
  await sync(a); await sync(b);
  expect((await wines(b)).some((w) => w.name === gone.name && String(w.vintage) === String(gone.vintage))).toBe(false);
  expect(server.db.wines.get(await a.evaluate((w) => Sync.key(w), gone)).deleted_at).toBeTruthy();
  // B deletes the other, then A (not yet synced) scores it: the later edit wins.
  await b.evaluate((w) => WineHistory.remove(w.name, w.vintage), contested);
  await tick(b);
  await a.evaluate((w) => WineHistory.rate(w.name, w.vintage, 91), contested);
  await sync(b); await sync(a); await sync(b);
  for (const p of [a, b]) {
    const w = (await wines(p)).find((x) => x.name === contested.name && String(x.vintage) === String(contested.vintage));
    expect(w && w.rating).toBe(91);
  }  // The other way round: A scores a third bottle, then B deletes it later. The later delete wins.
  const third = (await wines(a))[3];
  await a.evaluate((w) => WineHistory.rate(w.name, w.vintage, 85), third);
  await tick(a);
  await b.evaluate((w) => WineHistory.remove(w.name, w.vintage), third);
  await sync(b); await sync(a); await sync(b);
  for (const p of [a, b]) expect((await wines(p)).some((x) => x.name === third.name && String(x.vintage) === String(third.vintage))).toBe(false);
});

test('XP earned on both phones: never lower than either, every event kept', async ({ browser }) => {
  const server = fakeSupabase();
  const a = await phone(browser, server, { demo: true });
  await sync(a);
  const b = await phone(browser, server);
  await sync(b);
  const base = await a.evaluate(() => XPSystem.get().total);
  await a.evaluate(() => { const x = XPSystem.get(); XPSystem.save({ ...x, total: x.total + 120, events: [...x.events, 'only_on_a'] }); });
  await b.evaluate(() => { const x = XPSystem.get(); XPSystem.save({ ...x, total: x.total + 40, events: [...x.events, 'only_on_b'] }); });
  await sync(a); await sync(b); await sync(a);
  for (const p of [a, b]) {
    const x = await p.evaluate(() => XPSystem.get());
    expect(x.total).toBe(base + 120);
    expect(x.events).toEqual(expect.arrayContaining(['only_on_a', 'only_on_b']));
  }
});

test('a favourite removed on one phone stays removed; the latest setting wins; unlocks combine', async ({ browser }) => {
  const server = fakeSupabase();
  const a = await phone(browser, server, { demo: true });
  const w = (await wines(a))[0];
  await a.evaluate((w) => Favorites.toggle(w), w);
  await sync(a);
  const b = await phone(browser, server);
  await sync(b);
  expect(await b.evaluate((w) => Favorites.has(w), w)).toBe(true);
  await tick(b);
  await b.evaluate((w) => { Favorites.toggle(w); Settings.setScriptLength('short'); }, w);
  await a.evaluate(() => localStorage.setItem('vinterest_grape_unlocks_v1', JSON.stringify({ version: 1, accounts: { local: { unlocked: { Nebbiolo: 1 } } } })));
  await b.evaluate(() => localStorage.setItem('vinterest_grape_unlocks_v1', JSON.stringify({ version: 1, accounts: { local: { unlocked: { Sangiovese: 1 } } } })));
  await sync(b); await sync(a); await sync(b);
  for (const p of [a, b]) {
    expect(await p.evaluate((w) => Favorites.has(w), w)).toBe(false);
    expect(await p.evaluate(() => Settings.scriptLength())).toBe('short');
    expect(await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('vinterest_grape_unlocks_v1')).accounts.local.unlocked).sort())).toEqual(['Nebbiolo', 'Sangiovese']);
  }
});

test('offline: changes wait, the card says so, and they go up once the account is reachable', async ({ browser }) => {
  const server = fakeSupabase();
  const a = await phone(browser, server, { demo: true });
  await sync(a);
  const w = (await wines(a))[0];
  server.down = true;
  await a.evaluate((w) => WineHistory.rate(w.name, w.vintage, 88), w);
  const r = await sync(a);
  expect(r.ok).toBe(false);
  expect(await a.evaluate(() => [Sync.status().pending, Sync.line()])).toEqual([1, expect.stringContaining('1 change waiting to back up')]);
  server.down = false;
  expect((await sync(a)).ok).toBe(true);
  expect(await a.evaluate(() => Sync.status().pending)).toBe(0);
  expect(server.db.wines.get(await a.evaluate((w) => Sync.key(w), w)).data.rating).toBe(88);
});

test('a change goes up by itself a few seconds later, without anyone pressing anything', async ({ browser }) => {
  const server = fakeSupabase();
  const a = await phone(browser, server, { demo: true });
  await sync(a);
  const w = (await wines(a))[0];
  await a.evaluate((w) => WineHistory.rate(w.name, w.vintage, 99), w);
  const key = await a.evaluate((w) => Sync.key(w), w);
  await expect.poll(() => server.db.wines.get(key).data.rating, { timeout: 10000 }).toBe(99);
});

test('Home offers a backup once there are a few wines, and not to someone signed in', async ({ browser }) => {
  const server = fakeSupabase();
  const out = await phone(browser, server, { demo: true, signedIn: false });
  const root = out.locator('#root');
  await expect(root).toContainText(/Keep your \d+ wines safe/);
  await root.getByText('Not now').click();
  await expect(root).not.toContainText(/Keep your \d+ wines safe/);
  const signedIn = await phone(browser, server, { demo: true });
  await expect(signedIn.locator('#root')).toContainText('Recently scanned');
  await expect(signedIn.locator('#root')).not.toContainText(/Keep your \d+ wines safe/);
  // Signed out, nothing is sent anywhere.
  expect(await out.evaluate(() => Sync.status().enabled)).toBe(false);
});
