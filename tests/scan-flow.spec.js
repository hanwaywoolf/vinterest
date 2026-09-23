// The label-scan flow: one match engine (TasteMatch) for scan, list and detail; no fake scans or
// scores; an "Is this it?" check on hard-to-read labels; the result screen; the rating step's
// tasting details; loose duplicate matching; shelf checks kept out of WineDNA; Home reminders.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';
// A 1x1 PNG: enough for the photo-library path to decode, resize and send.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const PRIORAT = {
  name: 'Clos Test Priorat', confidence: 'high', alternative: '', producer: 'Clos Test', vintage: 2019, region: 'Priorat', sub_region: '',
  country: 'Spain', type: 'red', grapes: ['Garnacha'], body: 0.9, tannins: 0.75, acidity: 0.5, sweetness: 0.05, texture: null,
  effervescence: null, abv: 14.5, tasting_notes: ['Black cherry'], food_pairings: ['Lamb'], price_usd: 40, description: 'A test wine.',
};

async function setup(context, page, { label, list, seed = {} } = {}) {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_wineDNA_unlock_seen: '1', ...seed });
  await stubNetwork(context, {
    claudeText: (body) => (body.purpose === 'label_scan' && label ? JSON.stringify(label)
      : body.purpose === 'list_scan' && list ? JSON.stringify(list) : ''),
  });
}
const history = (page) => page.evaluate(() => WineHistory.getAll());

test('TasteMatch: list wines are told apart, dislikes count, and thin history says "too early"', async ({ context, page }) => {
  await setup(context, page);
  await page.goto(`${BASE}/?demo=1#home`);
  const out = await page.evaluate(() => {
    const all = WineHistory.getAll();
    const list = (name, grape, region, style) => TasteMatch.assess(TasteMatch.fromListEntry({ name, type: 'red', grape, region, style }), all);
    const barolo = list('Barolo', 'Nebbiolo', 'Piedmont', '899');
    const rioja = list('Rioja Reserva', 'Tempranillo', 'Rioja', '766');
    const bare = TasteMatch.assess({ name: 'Mystery red', type: 'red' }, all);
    const white = TasteMatch.assess({ name: 'Chablis', type: 'white', grapes: ['Chardonnay'], body: 0.4, acidity: 0.85, texture: 0.2 }, all);
    return { barolo: [barolo.verdict, barolo.pct, barolo.reasons.map((r) => r.text)], rioja: [rioja.verdict, rioja.pct],
      bare: [bare.verdict, bare.pct], white: [white.verdict, white.pct, calcMatchScore({ type: 'white', body: 0.4 }, all)] };
  });
  // The demo history scored its two Nebbiolos in the low 70s: a Barolo is no "solid match".
  expect(out.barolo[0]).toBe('mixed');
  expect(out.barolo[2].join(' ')).toContain('Nebbiolo: you\'ve scored 2, averaging 73.');
  expect(out.rioja[0]).toBe('good');
  expect(out.rioja[1]).toBeGreaterThan(out.barolo[1]);
  // Nothing to go on: no made-up number.
  expect(out.bare).toEqual(['unknown', null]);
  // One scored white: too early to call, everywhere.
  expect(out.white).toEqual(['early', null, null]);
});

test('WineHistory matches a rescan under a slightly different name, but not a different cuvée or producer', async ({ context, page }) => {
  await setup(context, page);
  await page.goto(`${BASE}/?demo=1#home`);
  const out = await page.evaluate(() => {
    const a = { name: 'Muga Reserva', producer: 'Bodegas Muga', vintage: 2019, region: 'Rioja', country: 'Spain', type: 'red' };
    return [
      WineHistory.same(a, { name: 'Muga Rioja Reserva', producer: 'Muga', vintage: 2019, region: 'Rioja', type: 'red' }),
      WineHistory.same(a, { name: 'Muga Gran Reserva', producer: 'Bodegas Muga', vintage: 2019, region: 'Rioja', type: 'red' }),
      WineHistory.same(a, { name: 'Muga Reserva', producer: 'Bodegas Muga', vintage: 2020, region: 'Rioja', type: 'red' }),
      WineHistory.same({ name: 'Barolo', producer: 'Giacomo Conterno', vintage: 2018 }, { name: 'Barolo', producer: 'Vietti', vintage: 2018 }),
    ];
  });
  expect(out).toEqual([true, false, false, false]);
});

test('WineDNA leaves out shelf checks, uses tasting taps and what the user paid', async ({ context, page }) => {
  await setup(context, page);
  await page.goto(`${BASE}/?demo=1#home`);
  const out = await page.evaluate(() => {
    const base = WineHistory.getAll();
    const before = WineDNA.profile('red', base, 'Reds').avg.body;
    const check = { name: 'Shelf check', type: 'red', body: 0.05, tannins: 0.05, acidity: 0.05, rating: 0, scan_intent: 'checking' };
    const withCheck = WineDNA.profile('red', [...base, check], 'Reds').avg.body;
    const bought = WineDNA.profile('red', [...base, { ...check, bought: true }], 'Reds').avg.body;
    const w = { body: 0.5, tasted: { body: 1 } };
    const rc = { code: 'GBP', base: '£' };
    return { same: before === withCheck, boughtCounts: bought < before, tasted: WineDNA.axisValue(w, 'body'),
      paid: WineDNA.priceOf({ price_usd: 100, price_paid: { amount: 12, code: 'GBP' } }, rc) };
  });
  expect(out.same).toBe(true);
  expect(out.boughtCounts).toBe(true);
  expect(out.tasted).toBeCloseTo(0.65);
  expect(out.paid).toBe(12);
});

test('no camera: the shutter never saves a sample wine, and a library photo scans for real', async ({ context, page }) => {
  const errors = collectErrors(page);
  await setup(context, page, { label: PRIORAT });
  await page.goto(`${BASE}/?demo=1#camera`);
  const before = (await history(page)).length;
  await expect(page.getByText('Camera unavailable')).toBeVisible();
  await page.getByLabel('Take photo').click();
  await page.waitForTimeout(300);
  expect((await history(page)).length).toBe(before);

  await page.getByTestId('scan-file').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
  const root = page.locator('#root');
  await expect(root).toContainText('Clos Test Priorat 2019');
  await expect(root).toContainText('Expect about');
  await expect(root).toContainText('Garnacha');
  await expect(root).toContainText('In shops');
  const saved = (await history(page)).find((w) => w.name === 'Clos Test Priorat');
  expect(saved).toBeTruthy();
  expect(saved.confidence).toBe('high');

  // Rate it, then the optional tasting details save straight away.
  await root.getByText('I\'ve tasted it: rate it').click();
  await root.getByText('90', { exact: true }).click();
  await root.getByText('Save rating').click();
  await expect(root).toContainText('Scored 90 · Outstanding');
  await root.getByText('Fuller', { exact: true }).click();
  await root.getByText('Yes', { exact: true }).click();
  await root.getByLabel('What you paid').fill('32');
  await root.getByLabel('What you paid').blur();
  const rated = (await history(page)).find((w) => w.name === 'Clos Test Priorat');
  expect(rated.rating).toBe(90);
  expect(rated.scan_intent).toBe('tasted');
  expect(rated.tasted.body).toBe(1);
  expect(rated.buy_again).toBe(true);
  expect(rated.price_paid.amount).toBe(32);
  expect(errors).toEqual([]);
});

test('a hard-to-read label asks "Is this it?" before anything is saved', async ({ context, page }) => {
  await setup(context, page, { label: { ...PRIORAT, name: 'Clos Tst Priorat', confidence: 'low', alternative: 'Clos Test Priorat' } });
  await page.goto(`${BASE}/?demo=1#camera`);
  await page.getByTestId('scan-file').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
  const root = page.locator('#root');
  await expect(root).toContainText('Is this the right wine?');
  expect((await history(page)).some((w) => /Clos T/.test(w.name))).toBe(false);
  await root.getByText('It\'s Clos Test Priorat').click();
  await expect(root).toContainText('Expect about');
  const names = (await history(page)).filter((w) => /Clos T/.test(w.name)).map((w) => w.name);
  expect(names).toEqual(['Clos Test Priorat']);
});

test('a rescan under a new name lands on the saved entry, and Save for later is a shelf check', async ({ context, page }) => {
  await setup(context, page, { label: { ...PRIORAT, name: 'Clos Test Priorat Garnacha' } });
  await page.goto(`${BASE}/?demo=1#home`);
  await page.evaluate((w) => WineHistory.add(w, 92), PRIORAT);
  await page.goto(`${BASE}/?demo=1#camera`);
  await page.getByTestId('scan-file').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
  const root = page.locator('#root');
  await expect(root).toContainText('You scored it 92');
  const matches = (await history(page)).filter((w) => /Clos Test/.test(w.name));
  expect(matches.map((w) => [w.name, w.times_consumed])).toEqual([['Clos Test Priorat', 2]]);

  await page.evaluate(() => WineHistory.remove('Clos Test Priorat', 2019));
  await page.goto(`${BASE}/?demo=1#camera`);
  await page.getByTestId('scan-file').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
  await root.getByText('Save for later', { exact: true }).click();
  await expect(root).toContainText('won\'t count towards your WineDNA');
  const w = (await history(page)).find((x) => x.name === 'Clos Test Priorat Garnacha');
  expect(w.scan_intent).toBe('checking');
});

test('wine list: real match results per wine, and a tapped wine is saved as a shelf check', async ({ context, page }) => {
  const list = { wines: [
    { n: 'Barolo Test', t: 'red', r: 'Piedmont', c: 'Italy', v: 2018, p: '120', g: 'Nebbiolo', s: '899' },
    { n: 'Rioja Test Reserva', t: 'red', r: 'Rioja', c: 'Spain', v: 2019, p: 'GLASS:12 / BOTTLE:48', g: 'Tempranillo', s: '766' },
    { n: 'Loire Test', t: 'white', r: 'Loire', c: 'France', v: 2022, p: '40', g: 'Chenin Blanc', s: '508' },
  ] };
  await setup(context, page, { list });
  await page.goto(`${BASE}/?demo=1#camera`);
  await page.getByText('Wine List', { exact: true }).click();
  await page.getByTestId('scan-file').setInputFiles({ name: 'list.png', mimeType: 'image/png', buffer: PNG });
  const root = page.locator('#root');
  await expect(root).toContainText('Wine List Results');
  await expect(root).toContainText('Could go either way');
  await expect(root).toContainText('A good bet');
  await expect(root).toContainText('Too early');
  await root.getByText('Rioja Test Reserva').click();
  await expect(root).toContainText('On this list');
  const w = (await history(page)).find((x) => x.name === 'Rioja Test Reserva');
  expect(w.scan_intent).toBe('checking');
  expect(w.body).toBeCloseTo(0.75);
});

test('Home asks about old shelf checks and lists unscored bottles', async ({ context, page }) => {
  const old = new Date('2026-06-14T09:00:00Z').toISOString();
  await setup(context, page);
  await page.goto(`${BASE}/?demo=1#home`);
  await page.evaluate(([o, w]) => {
    const all = WineHistory.getAll();
    all.unshift({ ...w, rating: 0, scan_intent: 'checking', last_scanned: o, scanned_at: o });
    all.unshift({ ...w, name: 'Tasted Test', rating: 0, scan_intent: 'tasted', last_scanned: o, scanned_at: o });
    WineHistory.save(all);
  }, [old, PRIORAT]);
  await page.reload();
  const root = page.locator('#root');
  await expect(root).toContainText('Waiting on you');
  await expect(root).toContainText('Did you buy the Clos Test Priorat');
  await root.getByText('Yes, I bought it').click();
  await expect(root).not.toContainText('Did you buy the');
  expect((await history(page)).find((w) => w.name === 'Clos Test Priorat').bought).toBe(true);
  await root.getByText('Tasted Test').click();
  await expect(root).toContainText('How was it?');
});

test('after a couple of deck visits the deck opens straight after a scan', async ({ context, page }) => {
  await setup(context, page, { label: PRIORAT, seed: { vinterest_scan_path: JSON.stringify({ deck: 2, quick: 0 }) } });
  await page.goto(`${BASE}/?demo=1#camera`);
  await page.getByTestId('scan-file').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
  const root = page.locator('#root');
  await expect(root).toContainText('How we got this');
  // Back from the deck goes to the one-screen result.
  await page.locator('#root div[style*="border-radius: 17px"]').first().click();
  await expect(root).toContainText('Tell me about it');
});
