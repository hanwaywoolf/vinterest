// Partner shops: links are tracked through Awin only when both IDs are set, a shop's own search is
// used only when it's switched on, the Price tab lists where the live search found the wine (real
// listings only), and every tracked link says "Partner". Nothing here moves a match.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { stubNetwork, makeDeterministic, seedLocalStorage } = require('./helpers');

const BASE = 'http://localhost:4173';
const ON = { awin: { publisherId: '12345' }, retailers: [
  { id: 'majestic', name: 'Majestic', country: 'gb', domains: ['majestic.co.uk'], awinMid: '999', search: 'https://www.majestic.co.uk/search?Ntt={q}', enabled: true },
  { id: 'off', name: 'Off Shop', country: 'gb', domains: ['off.example'], awinMid: '1', search: 'https://off.example/s?q={q}', enabled: false },
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

test('as shipped, nothing is tracked: Find it for me is a Google search, links stay plain', async ({ context, page }) => {
  await boot(context, page);
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate((w) => ({ t: FindOnline.target(w), label: FindOnline.label(w), link: Shops.link('https://www.majestic.co.uk/x', 'price') }), WINE);
  expect(out.t.url).toMatch(/^https:\/\/www\.google\.com\/search\?q=/);
  expect(out.t.partner).toBe(false);
  expect(out.label).toBe('Find it online');
  expect(out.link).toEqual({ url: 'https://www.majestic.co.uk/x', partner: false, name: 'Majestic' });
});

test('with Awin IDs and a shop switched on: its search, tracked, with where it was tapped', async ({ context, page }) => {
  await boot(context, page, ON);
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate((w) => ({ t: FindOnline.target(w, 'restock'), label: FindOnline.label(w, 'Restock'), other: Shops.link('https://indiecellar.example/a', 'listing'), off: Shops.forCountry('gb').map((r) => r.id) }), WINE);
  const u = new URL(out.t.url);
  expect(u.host).toBe('www.awin1.com');
  expect(Object.fromEntries(u.searchParams)).toMatchObject({ awinmid: '999', awinaffid: '12345', clickref: 'restock' });
  expect(u.searchParams.get('ued')).toBe('https://www.majestic.co.uk/search?Ntt=La%20Rioja%20Alta%20Vi%C3%B1a%20Ardanza%20Reserva%202016%20wine');
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
  expect(u.host).toBe('www.awin1.com');
  expect(u.searchParams.get('clickref')).toBe('listing');
  expect(u.searchParams.get('ued')).toBe('https://www.majestic.co.uk/wines/vina-ardanza-2016');
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
