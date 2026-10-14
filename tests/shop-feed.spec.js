// The bottle itself at a partner shop: the nightly feed job's reading of Winebuyers' listings
// (scripts/shop-feeds.mjs), the Worker's /shop-match picking the right one (real listing names
// from the feed, a fake Supabase), and the Price tab's "Buy at Winebuyers".
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { stubNetwork, makeDeterministic, seedLocalStorage } = require('./helpers');

const BASE = 'http://localhost:4173';
const ROOT = path.join(__dirname, '..');
const feeds = () => import(pathToFileURL(path.join(ROOT, 'scripts/shop-feeds.mjs')).href);

// Listings as they appear in Winebuyers' feed (names copied from it).
const FEED = [
  ['1', '2021 Antinori, Tignanello, IGT', 159, 'Winebuyers'],
  ['2', '2022 Antinori, Tignanello, IGT', 150, 'Winebuyers'],
  ['3', '2023 Antinori, Tignanello, IGT', 160, 'Winebuyers'],
  ['4', 'Marchese Antinori Chianti Classico Riserva Tignanello (case of 3)', 135.75, 'Marchese Antinori Chianti Classico'],
  ['5', 'Marchesi Antinori Tignanello Vintage 2017', 130, 'Marchesi Antinori Tignanello'],
  ['6', '2020 Muga Reserva', 25.94, 'Winebuyers'],
  ['7', '2024 Muga Rosado', 16.99, 'Winebuyers'],
  ['8', '2016 Muga, Prado Enea Gran Reserva, Rioja', 74.99, 'Winebuyers'],
  ['13', '2012 - rioja - muga - white wine - spain', 39, 'Winebuyers'],
  ['14', 'Muga Reserva Rioja 2021 | Cheers Wine Merchants (1x75cl)', 23.95, 'Cheers Wine Merchants'],
  ['15', '2012 - rioja - muga | Je Veux Ce Vin (1x75cl)', 39.94, 'Je Veux Ce Vin'],
  ['9', 'La Rioja Alta Viña Ardanza Reserva 2019 Half Bottle 37.5cl | La Rioja Alta Vina', 22.95, 'La Rioja Alta Vina'],
  ['10', '2019 La Rioja Alta, Vina Ardanza Reserva, Rioja', 39.5, 'Winebuyers'],
  ['11', 'La Rioja Alta, Vina Ardanza Reserva, Rioja Alta, 2010 | Perfect Bottle (1x75cl)', 59, 'Perfect Bottle'],
  ['12', 'Chateau de Beaucastel 2019 Chateauneuf-du-Pape 75cl - 12 x 75cl Bottles (10% Off) | (1x75cl)', 810, 'Chateau De Beaucastel'],
].map(([id, name, price, brand]) => ({ aw_product_id: id, product_name: name, search_price: String(price), currency: 'GBP', merchant_category: 'Wine > Red Wine', brand_name: brand, merchant_deep_link: `https://winebuyers.com/en_GB/products/p${id}`, aw_image_url: `https://images2.productserve.com/?url=p${id}.jpg` }));

test('the feed job reads vintages, cases, half bottles and marketplace sellers, and skips what isn\'t wine', async () => {
  const { toRow, parseCsv } = await feeds();
  const rows = Object.fromEntries(FEED.map((x) => [x.aw_product_id, toRow('winebuyers', x, 't')]));
  expect(rows['1']).toMatchObject({ name: '2021 Antinori, Tignanello, IGT', vintage: 2021, pack: 1, size_ml: 750, price: 159, url: 'https://winebuyers.com/en_GB/products/p1', seller: null });
  expect(rows['4']).toMatchObject({ vintage: null, pack: 3 });
  expect(rows['9']).toMatchObject({ name: 'La Rioja Alta Viña Ardanza Reserva 2019 Half Bottle 37.5cl', vintage: 2019, size_ml: 375, seller: null });
  expect(rows['11']).toMatchObject({ vintage: 2010, seller: 'Perfect Bottle', name: 'La Rioja Alta, Vina Ardanza Reserva, Rioja Alta, 2010' });
  expect(rows['12']).toMatchObject({ vintage: 2019, pack: 12 });
  expect(rows['9'].words).toEqual(expect.arrayContaining(['vina', 'ardanza', 'reserva']));
  expect(toRow('winebuyers', { aw_product_id: 'g', product_name: 'Da Mhile Seaweed Gin 35cl', merchant_category: 'Spirits > Gin', search_price: '22' }, 't')).toBeNull();
  expect(parseCsv('a,b\n"x, ""y""",2\n')).toEqual([{ a: 'x, "y"', b: '2' }]);
});

async function match(bodies, env = {}) {
  const { toRow } = await feeds();
  const table = FEED.map((x) => toRow('winebuyers', x, 't'));
  const copy = path.join(require('node:os').tmpdir(), `worker-shop-${process.pid}-${Date.now()}.mjs`);
  fs.copyFileSync(path.join(ROOT, '_worker.js'), copy);
  const worker = (await import(pathToFileURL(copy).href)).default;
  const calls = [], realFetch = global.fetch;
  // A stand-in for shop_candidates (migration 0005): listings sharing any word, most shared first.
  global.fetch = async (url, init) => {
    calls.push(String(url));
    const { p_shop, p_words, p_limit } = JSON.parse(init.body);
    const n = (r) => r.words.filter((w) => p_words.includes(w)).length;
    return new Response(JSON.stringify(table.filter((r) => r.shop === p_shop && n(r)).sort((a, b) => n(b) - n(a)).slice(0, p_limit)));
  };
  const ENV = { SUPABASE_URL: 'https://db.example', SUPABASE_PUBLISHABLE_KEY: 'pk', SUPABASE_SECRET_KEY: 'sk', ASSETS: { fetch: async () => new Response(fs.readFileSync(path.join(ROOT, 'data/retailers.json'))) }, ...env };
  const out = [];
  try {
    for (const b of bodies) {
      const r = await worker.fetch(new Request('https://vinterest.pages.dev/shop-match', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://vinterest.pages.dev' }, body: JSON.stringify({ country: 'gb', ...b }) }), ENV);
      out.push(await r.json());
    }
  } finally { global.fetch = realFetch; }
  return { out, calls };
}
const TIG = { name: 'Tignanello', producer: 'Marchesi Antinori', region: 'Tuscany', country: 'Italy', type: 'red', grapes: ['Sangiovese', 'Cabernet Sauvignon'] };

test('the scanned vintage as a single bottle, then the nearest other vintages; never the case or another wine', async () => {
  const { out } = await match([{ wine: { ...TIG, vintage: 2021 } }, { wine: { ...TIG, vintage: 2019 } }]);
  expect(out[0].shop).toEqual({ id: 'winebuyers', name: 'Winebuyers' });
  expect(out[0].exact).toMatchObject({ name: '2021 Antinori, Tignanello, IGT', vintage: 2021, price: 159, pack: 1, url: 'https://winebuyers.com/en_GB/products/p1' });
  expect(out[0].others.map((x) => x.vintage)).toEqual([2022, 2023, 2017]);
  // No 2019: no exact, the closest vintages instead.
  expect(out[1].exact).toBeNull();
  expect(out[1].others.map((x) => x.vintage).sort()).toEqual([2017, 2021, 2022]);
  expect(out[1].items.some((x) => x.pack > 1)).toBe(false);
});

test('Muga Reserva is never its Rosado, Prado Enea or a white Muga; Viña Ardanza prefers the 75cl bottle over the half', async () => {
  const { out } = await match([
    { wine: { name: 'Muga Reserva', producer: 'Bodegas Muga', vintage: 2020, region: 'Rioja', country: 'Spain', type: 'red', grapes: ['Tempranillo'] } },
    { wine: { name: 'Muga Reserva', producer: 'Bodegas Muga', vintage: 2018, region: 'Rioja', country: 'Spain', type: 'red' } },
    { wine: { name: 'Viña Ardanza Reserva', producer: 'La Rioja Alta', vintage: 2019, region: 'Rioja', country: 'Spain' } },
    { wine: { name: 'Sassicaia', producer: 'Tenuta San Guido', vintage: 2019 } },
  ]);
  expect(out[0].exact).toMatchObject({ name: '2020 Muga Reserva', price: 25.94 });
  // The 2021 from a marketplace seller, never the white 2012 or a Muga that doesn't say it's the Reserva.
  expect(out[0].others.map((x) => [x.name, x.seller])).toEqual([['Muga Reserva Rioja 2021', 'Cheers Wine Merchants']]);
  expect(out[1].exact).toBeNull();
  expect(out[1].others.map((x) => x.vintage)).toEqual([2020, 2021]);
  expect(out[2].exact).toMatchObject({ name: '2019 La Rioja Alta, Vina Ardanza Reserva, Rioja', sizeMl: 750, price: 39.5 });
  expect(out[2].others.map((x) => x.vintage)).toEqual([2010]);
  expect(out[2].others[0].seller).toBe('Perfect Bottle');
  expect(out[3].items).toEqual([]);
});

test('no feed shop for the country, or no database: nothing, and no lookup', async () => {
  const us = await match([{ country: 'us', wine: { ...TIG, vintage: 2021 } }]);
  expect(us.out[0]).toEqual({ items: [] });
  expect(us.calls).toHaveLength(0);
  const off = await match([{ wine: { ...TIG, vintage: 2021 } }], { SUPABASE_URL: '' });
  expect(off.out[0]).toEqual({ items: [] });
});

// ── The Price tab ──
const FOUND = { shop: { id: 'winebuyers', name: 'Winebuyers' }, vintage: 2019, exact: null,
  others: [{ id: '1', name: '2021 Antinori, Tignanello, IGT', vintage: 2021, price: 159, pack: 1, sizeMl: 750, perBottle: 159, currency: 'GBP', url: 'https://winebuyers.com/en_GB/products/p1', image: null, seller: null },
    { id: '2', name: '2022 Antinori, Tignanello, IGT', vintage: 2022, price: 150, pack: 1, sizeMl: 750, perBottle: 150, currency: 'GBP', url: 'https://winebuyers.com/en_GB/products/p2', image: null, seller: null }] };
FOUND.items = FOUND.others;

test('the Price tab shows the bottle at Winebuyers with Buy, through /go with Awin tracking', async ({ context, page }) => {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk', vinterest_wineDNA_unlock_seen: '1' });
  await stubNetwork(context, { claudeText: () => '' });
  const asked = [];
  await context.route('**/shop-match', (route) => { asked.push(JSON.parse(route.request().postData())); return route.fulfill({ contentType: 'application/json', body: JSON.stringify(FOUND) }); });
  const wine = { ...TIG, vintage: 2019, rating: 94 };
  await page.goto(`${BASE}/#home`);
  await page.evaluate((w) => { WineHistory.save([w]); sessionStorage.setItem('vinterest_scan_result', JSON.stringify({ wine: w })); }, wine);
  await page.goto(`${BASE}/?d=1#detail`);
  const root = page.locator('#root');
  await root.getByText('Price', { exact: true }).click();
  const card = root.getByTestId('shop-bottle');
  await expect(card).toContainText('At Winebuyers');
  await expect(card).toContainText("Winebuyers doesn't list the 2019 right now");
  await expect(card).toContainText('2021 Antinori, Tignanello, IGT');
  await expect(card).toContainText('£159');
  await expect(card).toContainText('£150');
  await expect(card.getByText('Partner', { exact: true })).toBeVisible();
  // The partner's bottle leads the tab, and the shops the price search found aren't listed beside it.
  await expect(root).not.toContainText('In shops now');
  // With the bottle found at Winebuyers, a second button to Winebuyers' search would only repeat it.
  await expect(root.getByText('Find it at Winebuyers', { exact: true })).toHaveCount(0);
  await expect(root.getByText('Partner', { exact: true })).toHaveCount(1);
  expect(asked[0]).toMatchObject({ country: 'gb', wine: { name: 'Tignanello', producer: 'Marchesi Antinori', vintage: 2019 } });
  const opened = context.waitForEvent('page');
  await card.getByText('Buy at Winebuyers', { exact: true }).click();
  const u = new URL((await opened).url());
  expect(u.pathname).toBe('/go');
  expect(u.searchParams.get('p')).toBe('buy');
  expect(u.searchParams.get('u')).toBe('https://winebuyers.com/en_GB/products/p1');
});
