// Partner shops: links are tracked through Awin only when both IDs are set, a shop's own search is
// used only when it's switched on, the Price tab lists where the live search found the wine (real
// listings only), and every tracked link says "Partner". Nothing here moves a match.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { stubNetwork, makeDeterministic, seedLocalStorage } = require('./helpers');

const BASE = 'http://localhost:4173';
const ON = { awin: { publisherId: '12345' }, retailers: [
  { id: 'majestic', name: 'Majestic', country: 'gb', domains: ['majestic.co.uk'], awinMid: '999', joined: true, search: 'https://www.majestic.co.uk/search?Ntt={q}', enabled: true },
  { id: 'off', name: 'Off Shop', country: 'gb', domains: ['off.example'], awinMid: '1', joined: true, search: 'https://off.example/s?q={q}', enabled: false },
] };
const WINE = { name: 'Viña Ardanza Reserva', producer: 'La Rioja Alta', vintage: 2016, region: 'Rioja', country: 'Spain', type: 'red', price_usd: 45, buy_again: true, rating: 93, grapes: ['Tempranillo'] };
const FOUND = { low: 25, mid: 28, high: 32, currency: 'GBP', tier: 'premium', note: 'UK merchants list the 2016.', source: 'search',
  shops: [{ name: 'Majestic', url: 'https://www.majestic.co.uk/wines/vina-ardanza-2016', price: 27 }, { name: 'Indie Cellar', url: 'https://indiecellar.example/ardanza', price: 29 }] };

async function boot(context, page, retailers) {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk', vinterest_wineDNA_unlock_seen: '1' });
  if (retailers) await page.addInitScript((r) => { window.VINTEREST_RETAILERS = r; }, retailers);
  await stubNetwork(context, { claudeText: (b) => b.purpose === 'price_search' ? JSON.stringify(FOUND) : '' });
}

test('as shipped: Find it for me in the UK is Winebuyers\' search, through Awin; a shop that hasn\'t approved us stays plain', async ({ context, page }) => {
  await boot(context, page);
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate((w) => ({ t: FindOnline.target(w), label: FindOnline.label(w), link: Shops.link('https://www.majestic.co.uk/x', 'price'), wb: Shops._track('https://winebuyers.com/en_GB/x', 'find') }), WINE);
  // Every tap goes by way of the Worker's /go, which follows the list as deployed today.
  const t = new URL(out.t.url, BASE);
  expect(t.pathname).toBe('/go');
  expect(Object.fromEntries(t.searchParams)).toMatchObject({ c: 'gb', p: 'find' });
  expect(t.searchParams.get('w')).toBe('La Rioja Alta Viña Ardanza Reserva 2016 wine buy');
  expect(out.t.partner).toBe(true);
  expect(out.label).toBe('Find it at Winebuyers');
  expect(new URL(out.wb.url).searchParams.get('awinmid')).toBe('121644');
  expect(out.link).toEqual({ url: '/go?u=' + encodeURIComponent('https://www.majestic.co.uk/x') + '&p=price', partner: false, name: 'Majestic' });
});

test('with Awin IDs and a shop switched on: its search, tracked, with where it was tapped', async ({ context, page }) => {
  await boot(context, page, ON);
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate((w) => ({ t: FindOnline.target(w, 'restock'), label: FindOnline.label(w, 'Restock'), other: Shops.link('https://indiecellar.example/a', 'listing'), off: Shops.forCountry('gb').map((r) => r.id) }), WINE);
  const u = new URL(out.t.url, BASE);
  expect(u.pathname).toBe('/go');
  expect(u.searchParams.get('p')).toBe('restock');
  expect(out.t.partner).toBe(true);
  expect(out.label).toBe('Restock at Majestic');
  expect(out.other.partner).toBe(false); // not a partner: the plain link
  expect(out.off).toEqual(['majestic']); // switched-off shops are never used
});

test('the Price tab lists where the search found it, labels the partner, and Restock goes to the partner', async ({ context, page }) => {
  await boot(context, page, ON);
  await page.goto(`${BASE}/#home`);
  await page.evaluate((w) => { WineHistory.save([w]); sessionStorage.setItem('vinterest_scan_result', JSON.stringify({ wine: w })); }, WINE);
  await page.goto(`${BASE}/?d=1#detail`);
  const root = page.locator('#root');
  await root.getByText('Price', { exact: true }).click();
  await expect(root).toContainText('In shops now');
  await expect(root).toContainText('Indie Cellar');
  await expect(root.getByText('Partner', { exact: true })).toHaveCount(2); // Majestic's row and the button
  await expect(root.getByText('Restock at Majestic', { exact: true })).toBeVisible();
  const opened = context.waitForEvent('page');
  await root.getByText('Majestic', { exact: true }).click();
  const tab = await opened;
  const u = new URL(tab.url());
  expect(u.pathname).toBe('/go');
  expect(u.searchParams.get('p')).toBe('listing');
  expect(u.searchParams.get('u')).toBe('https://www.majestic.co.uk/wines/vina-ardanza-2016');
  // and it says so in words, not only in a tooltip
  await expect(root.getByTestId('shop-disclosure')).toContainText('We may earn a commission');
});

test('Skimlinks, when switched on, tracks the shops Awin doesn\'t cover', async ({ context, page }) => {
  await boot(context, page, { ...ON, skimlinks: { id: '123X456', enabled: true } });
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate(() => ({ indie: Shops.link('https://indiecellar.example/a', 'listing'), signed: Shops.link('https://indiecellar.example/a', 'listing', 'abc') }));
  const u = new URL(out.indie.url);
  expect(u.host).toBe('go.skimresources.com');
  expect(Object.fromEntries(u.searchParams)).toMatchObject({ id: '123X456', xcust: 'listing', sref: 'https://vinterest.app/', url: 'https://indiecellar.example/a' });
  expect(out.indie.partner).toBe(true);
  expect(out.signed.url).toBe('/go?u=' + encodeURIComponent('https://indiecellar.example/a') + '&p=listing&s=abc'); // a link the Worker signed goes by way of /go
});

test('the Worker\'s /go: the deployed list picks the shop and the tracking, and never redirects to just anywhere', async () => {
  const copy = path.join(require('node:os').tmpdir(), `worker-go-${process.pid}.mjs`);
  require('node:fs').copyFileSync(path.join(__dirname, '..', '_worker.js'), copy);
  const worker = (await import(pathToFileURL(copy).href + '?go')).default;
  const LIST = { ...ON, skimlinks: { id: '123X456', enabled: true } };
  const env = { GO_SECRET: 'secret', ASSETS: { fetch: async (r) => new URL(r.url).pathname === '/data/retailers.json' ? new Response(JSON.stringify(LIST)) : new Response('', { status: 404 }) } };
  const go = async (qs) => { const r = await worker.fetch(new Request('https://vinterest.pages.dev/go?' + qs), env); return { status: r.status, to: r.headers.get('location') }; };
  // Find it for me: the switched-on shop for the country, through Awin.
  let r = await go('w=' + encodeURIComponent('Vina Ardanza 2016 wine buy') + '&c=gb&p=restock');
  expect(r.status).toBe(302);
  let u = new URL(r.to);
  expect(u.host).toBe('www.awin1.com');
  expect(Object.fromEntries(u.searchParams)).toMatchObject({ awinmid: '999', awinaffid: '12345', clickref: 'restock', ued: 'https://www.majestic.co.uk/search?Ntt=Vina%20Ardanza' });
  // A shop's search gets the producer and name only: no vintage, "wine" or "buy".
  // No shop for the country: a Google search, never wrapped.
  r = await go('w=ardanza&c=us&p=find');
  expect(r.to).toBe('https://www.google.com/search?q=ardanza&gl=us');
  // A known shop's page.
  r = await go('u=' + encodeURIComponent('https://www.majestic.co.uk/wines/x') + '&p=listing');
  expect(new URL(r.to).searchParams.get('ued')).toBe('https://www.majestic.co.uk/wines/x');
  // Anywhere else only with the Worker's own signature: then Skimlinks.
  r = await go('u=' + encodeURIComponent('https://evil.example/') + '&p=listing');
  expect(r.status).toBe(400);
  r = await go('u=' + encodeURIComponent('https://indiecellar.example/a') + '&p=listing&s=forged');
  expect(r.status).toBe(400);
  // The price search signs what it lists.
  const realFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({ stop_reason: 'end_turn', content: [
    { type: 'web_search_tool_result', tool_use_id: 's1', content: [{ type: 'web_search_result', url: 'https://indiecellar.example/a', title: 'x' }] },
    { type: 'text', text: JSON.stringify({ shops: [{ name: 'Indie', url: 'https://indiecellar.example/a', price: 29 }], low: 25, mid: 28, high: 32, currency: 'GBP', found: true }) },
  ] }), { status: 200 });
  let sig;
  try {
    const p = await worker.fetch(new Request('https://vinterest.pages.dev/claude', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://vinterest.pages.dev' },
      body: JSON.stringify({ purpose: 'price_search', wine: { name: 'Indie Test', producer: 'X', vintage: 2019, country: 'Spain' }, market: { code: 'GBP', label: 'United Kingdom', country: 'GB' } }) }), { ...env, ANTHROPIC_API_KEY: 'k' });
    sig = JSON.parse((await p.json()).text).shops[0].sig;
  } finally { global.fetch = realFetch; }
  expect(sig).toMatch(/^[0-9a-f]{24}$/);
  r = await go('u=' + encodeURIComponent('https://indiecellar.example/a') + '&p=listing&s=' + sig);
  u = new URL(r.to);
  expect(u.host).toBe('go.skimresources.com');
  expect(Object.fromEntries(u.searchParams)).toMatchObject({ id: '123X456', xcust: 'listing', sref: 'https://vinterest.app/', url: 'https://indiecellar.example/a' });
});

test('the Worker keeps a shop only if the search really returned its page; never a search engine', async () => {
  const copy = path.join(require('node:os').tmpdir(), `worker-shops-${process.pid}.mjs`);
  require('node:fs').copyFileSync(path.join(__dirname, '..', '_worker.js'), copy);
  const worker = (await import(pathToFileURL(copy).href)).default;
  const realFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({ stop_reason: 'end_turn', content: [
    { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'Vina Ardanza 2016 price' } },
    { type: 'web_search_tool_result', tool_use_id: 's1', content: [
      { type: 'web_search_result', url: 'https://www.majestic.co.uk/wines/vina-ardanza-2016', title: 'Viña Ardanza' },
      { type: 'web_search_result', url: 'https://www.google.com/search?q=ardanza', title: 'Google' },
    ] },
    { type: 'text', text: JSON.stringify({ shops: [
      { name: 'Majestic', url: 'https://www.majestic.co.uk/wines/vina-ardanza-2016', price: 27 },
      { name: 'Made Up Wines', url: 'https://madeup.example/ardanza', price: 12 },
      { name: 'Google', url: 'https://www.google.com/search?q=ardanza' },
      { name: 'Majestic again', url: 'https://www.majestic.co.uk/other' },
    ], low: 25, mid: 28, high: 32, currency: 'GBP', tier: 'premium', note: 'x', found: true }) },
  ] }), { status: 200 });
  try {
    const r = await worker.fetch(new Request('https://vinterest.pages.dev/claude', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://vinterest.pages.dev' },
      body: JSON.stringify({ purpose: 'price_search', wine: { name: 'Vina Ardanza', producer: 'La Rioja Alta', vintage: 2016, country: 'Spain' }, market: { code: 'GBP', label: 'United Kingdom', country: 'GB' } }) }), { ANTHROPIC_API_KEY: 'k' });
    const out = JSON.parse((await r.json()).text);
    expect(out.shops).toEqual([{ name: 'Majestic', url: 'https://www.majestic.co.uk/wines/vina-ardanza-2016', price: 27 }]);
  } finally { global.fetch = realFetch; }
});

test('Awin only for a shop that has approved us (joined): one that hasn\'t gets a plain link, not Awin\'s error page', async ({ context, page }) => {
  const LIST = { ...ON, retailers: ON.retailers.map((r) => (r.id === 'off' ? { ...r, joined: false } : r)) };
  const copy = path.join(require('node:os').tmpdir(), `worker-joined-${process.pid}.mjs`);
  require('node:fs').copyFileSync(path.join(__dirname, '..', '_worker.js'), copy);
  const worker = (await import(pathToFileURL(copy).href + '?joined')).default;
  const env = { ASSETS: { fetch: async (r) => new URL(r.url).pathname === '/data/retailers.json' ? new Response(JSON.stringify(LIST)) : new Response('', { status: 404 }) } };
  const go = async (u) => (await worker.fetch(new Request('https://vinterest.pages.dev/go?u=' + encodeURIComponent(u) + '&p=listing'), env)).headers.get('location');
  expect(await go('https://off.example/wine')).toBe('https://off.example/wine');
  expect(new URL(await go('https://www.majestic.co.uk/wines/x')).host).toBe('www.awin1.com');
  // The app's own copy of the rule, which decides the Partner label.
  await boot(context, page, LIST);
  await page.goto(`${BASE}/#home`);
  await page.waitForFunction(() => typeof Shops !== 'undefined');
  const out = await page.evaluate(() => [Shops._track('https://off.example/wine', 'listing'), Shops._track('https://www.majestic.co.uk/wines/x', 'listing').partner]);
  expect(out[0]).toEqual({ url: 'https://off.example/wine', partner: false });
  expect(out[1]).toBe(true);
});
