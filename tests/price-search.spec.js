// Premium wines get a real search of current shop listings, shared between users by the Worker;
// everyday wines keep the ordinary estimate. Both halves are tested here: the app (which wines
// search, what it sends, how it's labelled) and the Worker (one search, then the shared cache).
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { stubNetwork, makeDeterministic, seedLocalStorage } = require('./helpers');

const BASE = 'http://localhost:4173';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const TIGNANELLO = { name: 'Tignanello', producer: 'Antinori', confidence: 'high', vintage: 2021, region: 'Tuscany', country: 'Italy', type: 'red',
  grapes: ['Sangiovese', 'Cabernet Sauvignon'], body: 0.7, tannins: 0.7, acidity: 0.65, sweetness: 0.05, price_usd: 95 };
const FOUND = { low: 125, mid: 139, high: 160, currency: 'GBP', tier: 'luxury', note: 'UK merchants list the 2021 at £125–£160.', source: 'search' };

async function scanAs(context, page, label, requests) {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk', vinterest_wineDNA_unlock_seen: '1' });
  await stubNetwork(context, { claudeRequests: requests, claudeText: (b) => b.purpose === 'label_scan' ? JSON.stringify(label)
    : b.purpose === 'price_search' ? JSON.stringify(FOUND)
    : b.purpose === 'price' ? JSON.stringify({ low: 10, mid: 14, high: 18, currency: 'GBP', tier: 'everyday', note: 'Estimate.' }) : '' });
  await page.goto(`${BASE}/#camera`);
  await page.getByTestId('scan-file').setInputFiles({ name: 'l.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('#root')).toContainText('Learn about it');
}

test('a premium wine is priced from current listings; the search carries the wine and market', async ({ context, page }) => {
  const requests = [];
  await scanAs(context, page, TIGNANELLO, requests);
  const root = page.locator('#root');
  await expect(root).toContainText('about £139');
  await expect(root).toContainText('in shops now');
  const search = requests.find((r) => r.purpose === 'price_search');
  expect(search.wine).toMatchObject({ name: 'Tignanello', producer: 'Antinori', vintage: 2021 });
  expect(search.market).toEqual({ code: 'GBP', label: 'United Kingdom', country: 'GB' });
  expect(search.messages).toBeUndefined(); // the Worker writes the prompt, not the app
  expect(requests.filter((r) => r.purpose === 'price')).toHaveLength(0);
});

test('an everyday wine keeps the ordinary estimate, with no search', async ({ context, page }) => {
  const requests = [];
  await scanAs(context, page, { ...TIGNANELLO, name: 'House Chianti', producer: 'Test', price_usd: 12 }, requests);
  await expect(page.locator('#root')).toContainText('about £14');
  await expect(page.locator('#root')).toContainText('est.');
  expect(requests.filter((r) => r.purpose === 'price_search')).toHaveLength(0);
  const estimate = requests.find((r) => r.purpose === 'price').messages[0].content;
  expect(estimate).toContain('Your memory of prices may be a year or more old');
});

test('a premium wine estimated before the search existed is looked up again', async ({ context, page }) => {
  const requests = [];
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
  await stubNetwork(context, { claudeRequests: requests, claudeText: (b) => (b.purpose === 'price_search' ? JSON.stringify(FOUND) : '') });
  await page.goto(`${BASE}/#home`);
  const d = await page.evaluate(async (w) => {
    const curr = Regional.current();
    localStorage.setItem(retailPriceCacheKey(w, curr.code), JSON.stringify({ low: 55, mid: 75, high: 110, tier: 'premium' }));
    return fetchRetailEstimate(w, curr);
  }, TIGNANELLO);
  expect(d.mid).toBe(139);
  expect(requests.filter((r) => r.purpose === 'price_search')).toHaveLength(1);
});

test('the Worker searches once, then serves every user from the shared cache', async () => {
  // _worker.js is an ES module in a CommonJS package: load a .mjs copy of it.
  const copy = path.join(require('node:os').tmpdir(), `worker-${process.pid}.mjs`);
  require('node:fs').copyFileSync(path.join(__dirname, '..', '_worker.js'), copy);
  const worker = (await import(pathToFileURL(copy).href)).default;
  const kv = new Map();
  const env = { ANTHROPIC_API_KEY: 'test', PRICE_CACHE: { get: async (k) => kv.get(k) ?? null, put: async (k, v, o) => { kv.set(k, v); kv.ttl = o.expirationTtl; } } };
  const upstream = [];
  const realFetch = global.fetch;
  global.fetch = async (url, init) => {
    upstream.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ stop_reason: 'end_turn', content: [
      { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'Tignanello 2021 price' } },
      { type: 'text', text: 'Here you go: {"low":125,"mid":139,"high":160,"currency":"GBP","tier":"luxury","note":"UK merchants list the 2021 at £125–£160.","found":true}' },
    ] }), { status: 200 });
  };
  const ask = (body) => worker.fetch(new Request('https://vinterest.pages.dev/claude', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://vinterest.pages.dev' }, body: JSON.stringify(body) }), env);
  try {
    const body = { purpose: 'price_search', wine: { name: 'Tignanello', producer: 'Antinori', vintage: 2021, country: 'Italy' }, market: { code: 'GBP', label: 'United Kingdom', country: 'GB' } };
    const first = await (await ask(body)).json();
    const second = await (await ask(body)).json();
    expect(JSON.parse(first.text)).toMatchObject({ mid: 139, source: 'search' });
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(upstream).toHaveLength(1);
    expect(kv.ttl).toBe(30 * 24 * 3600);
    const tool = upstream[0].tools[0];
    expect(tool).toEqual({ type: 'web_search_20250305', name: 'web_search', max_uses: 2, user_location: { type: 'approximate', country: 'GB' } });
    expect(upstream[0].messages[0].content).toContain('Antinori Tignanello 2021');

    // A bad market is refused; nothing found isn't cached.
    const bad = await ask({ ...body, market: { code: 'pounds' } });
    expect(bad.status).toBe(400);
    global.fetch = async () => new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"found":false}' }] }), { status: 200 });
    const none = await (await ask({ ...body, wine: { ...body.wine, name: 'Unknown Cuvée' } })).json();
    expect(none.text).toBe('');
    expect([...kv.keys()].some((k) => k.includes('unknown-cuvee'))).toBe(false);
  } finally {
    global.fetch = realFetch;
  }
});

test('a search still running shows the estimate now and tries again next time; a miss waits a week', async ({ context, page }) => {
  const calls = [];
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
  await stubNetwork(context);
  let reply = { text: '', pending: true };
  await context.route('**/claude', (route) => {
    const b = JSON.parse(route.request().postData() || '{}');
    calls.push(b.purpose);
    const body = b.purpose === 'price_search' ? reply : { text: JSON.stringify({ low: 60, mid: 80, high: 100, currency: 'GBP', tier: 'luxury', note: 'Estimate.' }) };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`${BASE}/#home`);
  const run = () => page.evaluate((w) => fetchRetailEstimate(w, Regional.current()).then((d) => d.mid), TIGNANELLO);
  expect(await run()).toBe(80);            // still running: estimate for now
  reply = { text: JSON.stringify(FOUND) };
  expect(await run()).toBe(139);           // next open: the saved search answer
  expect(calls.filter((c) => c === 'price_search')).toHaveLength(2);

  const other = { ...TIGNANELLO, name: 'Solaia' };
  reply = { text: '' };                    // nothing found
  const runOther = () => page.evaluate((w) => fetchRetailEstimate(w, Regional.current()).then((d) => d.mid), other);
  expect(await runOther()).toBe(80);
  expect(await runOther()).toBe(80);
  expect(calls.filter((c) => c === 'price_search')).toHaveLength(3); // not searched again this week
});
