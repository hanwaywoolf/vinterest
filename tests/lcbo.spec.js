// LCBO stock near an Ontario user (beta): the Worker's /lcbo against a fake LCBO.dev (off until
// LCBO_ENABLED, Pro, the city found from the LCBO's own stores, the right bottle picked, the
// nearest stores, cached, and a quiet answer when LCBO.dev fails), then the app: the city asked
// only in Ontario, and the Price tab's "At the LCBO".
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { stubNetwork, makeDeterministic, seedLocalStorage } = require('./helpers');

const BASE = 'http://localhost:4173';

async function loadWorker() {
  const copy = path.join(require('node:os').tmpdir(), `worker-lcbo-${process.pid}-${Date.now()}.mjs`);
  require('node:fs').copyFileSync(path.join(__dirname, '..', '_worker.js'), copy);
  return (await import(pathToFileURL(copy).href)).default;
}
const kv = () => { const m = new Map(); return { m, async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, v); } }; };

const STORES = [
  { externalId: '1', name: 'Rideau & King Edward', city: 'Ottawa', latitude: 45.43, longitude: -75.69 },
  { externalId: '2', name: 'Lansdowne', city: 'Ottawa', latitude: 45.40, longitude: -75.68 },
  { externalId: '3', name: 'Queen & Spadina', city: 'Toronto', latitude: 43.65, longitude: -79.40 },
];
const PRODUCTS = [
  { sku: '111', name: 'Muga Rosado', producerName: 'Bodegas Muga', priceInCents: 1895, unitVolumeMl: 750, isBuyable: true },
  { sku: '222', name: 'Muga Reserva', producerName: 'Bodegas Muga', priceInCents: 3195, unitVolumeMl: 750, isBuyable: true },
  { sku: '333', name: 'Campo Viejo Reserva', producerName: 'Campo Viejo', priceInCents: 1795, unitVolumeMl: 750, isBuyable: true },
];
const STOCK = [
  { quantity: 4, distanceKm: 3.21, updatedAt: '2026-10-06T08:00:00Z', store: { externalId: '2', name: 'Lansdowne', address: '1000 Bank St', city: 'Ottawa' } },
  { quantity: 12, distanceKm: 1.04, updatedAt: '2026-10-06T08:00:00Z', store: { externalId: '1', name: 'Rideau & King Edward', address: '275 Rideau St', city: 'Ottawa' } },
];

async function run(env, bodies, { fail = false, headers = {} } = {}) {
  const worker = await loadWorker();
  const calls = [], realFetch = global.fetch;
  global.fetch = async (url, init) => {
    const q = JSON.parse(init.body).query;
    calls.push({ url: String(url), q, vars: JSON.parse(init.body).variables });
    if (fail) return new Response(JSON.stringify({ errors: [{ message: 'Unexpected error.' }], data: null }), { status: 200 });
    const edges = (xs) => xs.map((node) => ({ node }));
    if (q.includes('stores(')) return new Response(JSON.stringify({ data: { stores: { edges: edges(STORES), pageInfo: { hasNextPage: false, endCursor: null } } } }));
    if (q.includes('products(')) return new Response(JSON.stringify({ data: { products: { edges: edges(PRODUCTS) } } }));
    if (q.includes('product(sku')) return new Response(JSON.stringify({ data: { product: { inventories: { edges: edges(STOCK) } } } }));
    return new Response('{}', { status: 500 });
  };
  const out = [];
  try {
    for (const b of bodies) {
      const r = await worker.fetch(new Request('https://vinterest.pages.dev/lcbo', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://vinterest.pages.dev', ...headers }, body: JSON.stringify(b) }), env);
      out.push({ status: r.status, json: await r.json() });
    }
  } finally { global.fetch = realFetch; }
  return { calls, out };
}
const ASK = { wine: { name: 'Muga Reserva 2019', producer: 'Bodegas Muga', vintage: 2019 }, city: 'Ottawa' };

test('off until LCBO_ENABLED is set: a quiet "off" and no call to LCBO.dev', async () => {
  const { calls, out } = await run({}, [ASK]);
  expect(out[0]).toEqual({ status: 200, json: { enabled: false } });
  expect(calls).toHaveLength(0);
});

test('the right bottle, the nearest stores in the city first, and the next ask from the cache', async () => {
  const PRICE_CACHE = kv();
  const { calls, out } = await run({ LCBO_ENABLED: '1', PRICE_CACHE }, [ASK, ASK]);
  const d = out[0].json;
  expect(d).toMatchObject({ enabled: true, available: true, cityFound: true, found: true, radiusKm: 25 });
  // Muga Reserva, not the Muga Rosado or another Reserva.
  expect(d.product).toMatchObject({ sku: '222', name: 'Muga Reserva', price: 31.95 });
  expect(d.product.url).toBe('https://www.lcbo.com/en/catalogsearch/result/?q=222');
  expect(d.stores.map((s) => [s.name, s.km, s.quantity])).toEqual([['Rideau & King Edward', 1, 12], ['Lansdowne', 3.2, 4]]);
  // The stock is looked for around the middle of Ottawa's stores, never Toronto's.
  const inv = calls.find((c) => c.q.includes('product(sku'));
  expect(inv.vars).toMatchObject({ sku: '222', r: 25 });
  expect(inv.vars.lat).toBeCloseTo(45.415, 3);
  expect(inv.vars.lng).toBeCloseTo(-75.685, 3);
  expect(calls.every((c) => c.url === 'https://api.lcbo.dev/graphql')).toBe(true);
  // The second ask is answered from the cache: no more calls to LCBO.dev.
  expect(calls.length).toBe(3);
  expect(out[1].json).toEqual(d);
});

test('a city with no LCBO store, a wine they don\'t carry, and LCBO.dev failing are all quiet answers', async () => {
  const town = await run({ LCBO_ENABLED: '1' }, [{ ...ASK, city: 'Atlantis' }]);
  expect(town.out[0].json).toMatchObject({ enabled: true, available: true, cityFound: false });
  // "Reserva" alone never makes two wines the same.
  const other = await run({ LCBO_ENABLED: '1' }, [{ wine: { name: 'Gran Reserva', producer: 'Bodega Lopez' }, city: 'ottawa' }]);
  expect(other.out[0].json).toMatchObject({ cityFound: true, found: false });
  const down = await run({ LCBO_ENABLED: '1' }, [ASK], { fail: true });
  expect(down.out[0]).toEqual({ status: 200, json: { enabled: true, available: false } });
});

test('Pro: signed out with accounts set up, it asks them to sign in', async () => {
  const { calls, out } = await run({ LCBO_ENABLED: '1', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'pk', SUPABASE_SECRET_KEY: 'sk' }, [ASK]);
  expect(out[0].status).toBe(402);
  expect(out[0].json).toMatchObject({ code: 'pro_required', signIn: true });
  expect(calls).toHaveLength(0);
});

// ── The app ──

async function boot(context, page, seed = {}, lcbo) {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_wineDNA_unlock_seen: '1', ...seed });
  await stubNetwork(context, { claudeText: () => '' });
  const asked = [];
  await context.route('**/lcbo', (route) => {
    asked.push(JSON.parse(route.request().postData() || '{}'));
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(lcbo || { enabled: false }) });
  });
  return asked;
}
const WINE = { name: 'Muga Reserva', producer: 'Bodegas Muga', vintage: 2019, region: 'Rioja', country: 'Spain', type: 'red', price_usd: 30, rating: 92, grapes: ['Tempranillo'] };
const ONTARIO = { vinterest_country: 'Canada', vinterest_state: 'Ontario', vinterest_city: 'Ottawa', vinterest_region: 'canada', vinterest_currency: 'CAD' };
async function openPrice(page) {
  await page.goto(`${BASE}/#home`);
  await page.evaluate((w) => { WineHistory.save([w]); sessionStorage.setItem('vinterest_scan_result', JSON.stringify({ wine: w })); }, WINE);
  await page.goto(`${BASE}/?d=1#detail`);
  await page.locator('#root').getByText('Price', { exact: true }).click();
}

test('Profile asks for a city only in Ontario, and keeps it with the location', async ({ context, page }) => {
  await boot(context, page, { vinterest_country: 'Canada', vinterest_state: 'Quebec', vinterest_region: 'canada' });
  await page.goto(`${BASE}/#account`);
  const root = page.locator('#root');
  const loc = root.locator('div', { hasText: /^Where You Buy Wine/ }).last();
  await loc.getByText('Edit', { exact: true }).click();
  await expect(root.getByTestId('loc-city')).toHaveCount(0);
  await root.getByPlaceholder('Province (optional)').fill('ON');
  await root.getByTestId('loc-city').fill('  Ottawa ');
  await root.getByText('Save', { exact: true }).click();
  await expect(root).toContainText('Ottawa, ON, Canada');
  await expect(root).toContainText('LCBO stores are shown near Ottawa.');
  expect(await page.evaluate(() => [UserPrefs.location().city, Lcbo.city(), Backup.SETTINGS_KEYS.includes('vinterest_city')])).toEqual(['Ottawa', 'Ottawa', true]);
  // Moving out of Ontario drops the city.
  await page.evaluate(() => UserPrefs.setLocation({ country: 'Canada', state: 'Quebec', city: 'Ottawa' }));
  expect(await page.evaluate(() => [UserPrefs.location().city, Lcbo.applies()])).toEqual(['', false]);
});

test('the Price tab shows the LCBO\'s price and the stores near them that have it', async ({ context, page }) => {
  const asked = await boot(context, page, { ...ONTARIO, vinterest_pro: '1' }, {
    enabled: true, available: true, cityFound: true, found: true, radiusKm: 25,
    product: { sku: '222', name: 'Muga Reserva', price: 31.95, volumeMl: 750, url: 'https://www.lcbo.com/en/catalogsearch/result/?q=222' },
    stores: [{ id: '1', name: 'Rideau & King Edward', address: '275 Rideau St', km: 1, quantity: 12, updatedAt: '2026-10-06T08:00:00Z' }],
  });
  await openPrice(page);
  const box = page.locator('#root').getByTestId('lcbo');
  await expect(box).toContainText('At the LCBO');
  await expect(box).toContainText('LCBO #222');
  await expect(box).toContainText('Rideau & King Edward');
  await expect(box).toContainText('12 in stock');
  await expect(box).toContainText('275 Rideau St · 1 km');
  expect(asked[0]).toMatchObject({ city: 'Ottawa', wine: { name: 'Muga Reserva', producer: 'Bodegas Muga' } });
  // The LCBO's page opens by way of /go, like every shop link.
  const opened = context.waitForEvent('page');
  await box.getByText('Muga Reserva', { exact: true }).click();
  const u = new URL((await opened).url());
  expect(u.pathname).toBe('/go');
  expect(u.searchParams.get('p')).toBe('lcbo');
  expect(u.searchParams.get('u')).toBe('https://www.lcbo.com/en/catalogsearch/result/?q=222');
});

test('switched off on the server: the bottle searched on lcbo.com and the city\'s stores on a map', async ({ context, page }) => {
  const asked = await boot(context, page, { ...ONTARIO, vinterest_pro: '1' });
  await openPrice(page);
  const box = page.locator('#root').getByTestId('lcbo');
  await expect(box).toContainText('Check store inventory');
  await expect.poll(() => asked.length).toBe(1);
  // lcbo.com's search, from the label (no vintage, each word once), by way of /go.
  let opened = context.waitForEvent('page');
  await box.getByText('Find it at the LCBO', { exact: true }).click();
  let u = new URL((await opened).url());
  expect(u.pathname).toBe('/go');
  expect(u.searchParams.get('p')).toBe('lcbo');
  expect(u.searchParams.get('u')).toBe('https://www.lcbo.com/en/catalogsearch/result/?q=Bodegas+Muga+Reserva');
  opened = context.waitForEvent('page');
  await box.getByText('LCBO stores in Ottawa', { exact: true }).click();
  u = new URL((await opened).url());
  expect(u.host).toBe('www.google.com');
  expect(u.searchParams.get('query')).toBe('LCBO, Ottawa, ON');
});

test('outside Ontario no card; in Ontario without a city or Pro, the links and no lookup', async ({ context, page }) => {
  const asked = await boot(context, page, { vinterest_country: 'Canada', vinterest_state: 'BC', vinterest_region: 'canada', vinterest_pro: '1' });
  await openPrice(page);
  await expect(page.locator('#root')).toContainText('Find it online');
  await expect(page.locator('#root').getByTestId('lcbo')).toHaveCount(0);
  // Ontario, no city: the search, and a way to add the city.
  await page.evaluate(() => Store.set('vinterest_state', 'Ontario'));
  await openPrice(page);
  const box = page.locator('#root').getByTestId('lcbo');
  await expect(box.getByText('Find it at the LCBO', { exact: true })).toBeVisible();
  await expect(box).toContainText('Add your city on Profile');
  // With a city on the free plan: both links, and no lookup.
  await page.evaluate(() => { Store.set('vinterest_city', 'Ottawa'); Store.remove('vinterest_pro'); });
  await openPrice(page);
  await expect(box.getByText('LCBO stores in Ottawa', { exact: true })).toBeVisible();
  expect(asked).toHaveLength(0);
});
