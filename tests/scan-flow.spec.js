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
  // The demo history scored its two Nebbiolos in the low 70s: a Barolo is probably not for them.
  expect(out.barolo[0]).toBe('miss');
  expect(out.barolo[2].join(' ')).toContain('Nebbiolo: you\'ve scored 2, averaging 73.');
  // Tempranillo averages 85 against reds averaging 87: middling for them, not a favourite.
  expect(out.rioja[0]).toBe('mixed');
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
  await expect(root).toContainText(/Likely (Outstanding|Very good|Average|Extraordinary) for you/);
  await expect(root).toContainText('Garnacha');
  await expect(root).toContainText('In shops');
  const saved = (await history(page)).find((w) => w.name === 'Clos Test Priorat');
  expect(saved).toBeTruthy();
  expect(saved.confidence).toBe('high');

  // Rate it, then the optional tasting details save straight away.
  await root.getByText('Rate it', { exact: true }).click();
  await root.getByText('90', { exact: true }).click();
  await root.getByText('Save rating').click();
  await expect(root).toContainText('Scored 90 · Outstanding');
  await root.getByText('Fuller', { exact: true }).click();
  await root.getByText('I\'d buy this again').click();
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
  await expect(root).toContainText(/Likely (Outstanding|Very good|Average|Extraordinary) for you/);
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
  expect(matches.map((w) => [w.name, w.times_consumed])).toEqual([['Clos Test Priorat', 1]]);

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
  await expect(root).toContainText('Probably not for you');
  await expect(root).toContainText('Could go either way');
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

test('every scan opens on the result, even for someone who usually opens the deck', async ({ context, page }) => {
  await setup(context, page, { label: PRIORAT, seed: { vinterest_scan_path: JSON.stringify({ deck: 5, quick: 0 }) } });
  await page.goto(`${BASE}/?demo=1#camera`);
  await page.getByTestId('scan-file').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
  const root = page.locator('#root');
  await expect(root).toContainText('Learn about it');
  await expect(root).not.toContainText('How we got this');
  await root.getByText('Learn about it', { exact: true }).click();
  await expect(root).toContainText('How we got this');
});

const LIST_ABROAD = { wines: [{ n: 'Pauillac Test', t: 'red', r: 'Bordeaux', c: 'France', v: 2016, p: 'BOTTLE:60', g: 'Cabernet Sauvignon', s: '885' }] };

test('Travel Mode: a list abroad is compared with the local shop price, in the local currency', async ({ context, page }) => {
  const travel = JSON.stringify({ active: true, country: 'France', sym: '€', code: 'EUR', until: '' });
  const requests = [];
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_wineDNA_unlock_seen: '1', vinterest_travel: travel });
  await stubNetwork(context, { claudeRequests: requests, claudeText: (b) => b.purpose === 'list_scan' ? JSON.stringify(LIST_ABROAD)
    : b.purpose === 'price' ? JSON.stringify({ low: 20, mid: 24, high: 30, currency: 'EUR', tier: 'premium', note: 'Test.' }) : '' });
  await page.goto(`${BASE}/?demo=1#camera`);
  await page.getByText('Wine List', { exact: true }).click();
  await expect(page.getByText('List prices in EUR')).toBeVisible();
  await page.getByTestId('scan-file').setInputFiles({ name: 'list.png', mimeType: 'image/png', buffer: PNG });
  const root = page.locator('#root');
  await root.getByText('Pauillac Test').click();
  // Local retail (asked for in EUR for France), list price unconverted: 60 / 24 = 2.5×.
  await expect(root).toContainText('In shops in France');
  await expect(root).toContainText('about €24');
  await expect(root).toContainText('€60');
  await expect(root).toContainText('2.5× shop');
  const price = requests.find((r) => r.purpose === 'price');
  expect(JSON.stringify(price)).toContain('(EUR)');
});

test('at home, a list priced in another currency is converted before comparing', async ({ context, page }) => {
  await setup(context, page, { list: LIST_ABROAD });
  await page.goto(`${BASE}/?demo=1#home`);
  const fx = await page.evaluate(() => ({ eur: USD_FX.EUR, gbp: USD_FX.GBP }));
  await page.goto(`${BASE}/?demo=1#camera`);
  await page.getByText('Wine List', { exact: true }).click();
  await page.getByText('List prices in GBP').click();
  await page.getByText('EUR', { exact: true }).click();
  await page.getByTestId('scan-file').setInputFiles({ name: 'list.png', mimeType: 'image/png', buffer: PNG });
  const root = page.locator('#root');
  await root.getByText('Pauillac Test').click();
  await expect(root).toContainText(`£${Math.round(60 / fx.eur * fx.gbp)}`);
});

test('rating a scanned wine does not count as a second scan', async ({ context, page }) => {
  await setup(context, page, { label: PRIORAT });
  await page.goto(`${BASE}/?demo=1#camera`);
  await page.getByTestId('scan-file').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
  const root = page.locator('#root');
  await root.getByText('Rate it', { exact: true }).click();
  await root.getByText('90', { exact: true }).click();
  await root.getByText('Save rating').click();
  await expect(root).toContainText('Scored 90');
  // Rating again from the detail page isn't a scan either.
  await page.evaluate(() => WineHistory.add({ name: 'Clos Test Priorat', vintage: 2019, producer: 'Clos Test', type: 'red' }, 92));
  const w = (await history(page)).find((x) => x.name === 'Clos Test Priorat');
  expect([w.times_consumed, w.rating]).toEqual([1, 92]);
});

test('blends are not grapes: phrases split into varieties, guessed grapes are never "new"', async ({ context, page }) => {
  await setup(context, page);
  await page.goto(`${BASE}/?demo=1#home`);
  const out = await page.evaluate(() => {
    const c = WineDNA.cleanGrapes(['Blend - likely Grenache, Syrah, or Cinsault']);
    const all = WineHistory.getAll();
    all.unshift({ name: 'Le Petit Chat Malin Rosé', type: 'rosé', country: 'France', region: 'France', grapes: ['Blend - likely Grenache, Syrah, or Cinsault'], body: 0.3, acidity: 0.6, sweetness: 0.1, rating: 0 });
    WineHistory.save(all);
    const saved = WineHistory.getAll()[0];
    const m = TasteMatch.assess({ name: 'Other rosé', type: 'rosé', grapes: ['Xinomavro', 'Syrah'], grapes_basis: 'typical', blend: true }, WineHistory.getAll());
    return { c, saved: [saved.grapes, saved.blend, saved.grapes_basis, WineDNA.grapeLine(saved)], reasons: m.reasons.map((r) => r.text),
      mixed: WineDNA.cleanGrapes(['Cabernet Sauvignon 60%', 'Merlot (40%)']).grapes, single: WineDNA.cleanWine({ grapes: ['Pinot Noir'] }).grapes };
  });
  expect(out.c).toEqual({ grapes: ['Grenache', 'Syrah', 'Cinsault'], blend: true, typical: true });
  expect(out.saved).toEqual([['Grenache', 'Syrah', 'Cinsault'], true, 'typical', 'Usually Grenache, Syrah and Cinsault']);
  expect(out.reasons.join(' ')).not.toContain('new grape');
  expect(out.mixed).toEqual(['Cabernet Sauvignon', 'Merlot']);
  expect(out.single).toEqual(['Pinot Noir']);
});

test('the deck: sliders move sliders, a flick turns the card, and it ends on rating with clear end actions', async ({ context, page }) => {
  await setup(context, page, { label: PRIORAT });
  await page.setViewportSize({ width: 400, height: 860 });
  await page.goto(`${BASE}/?demo=1#camera`);
  await page.getByTestId('scan-file').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
  const root = page.locator('#root');
  await root.getByText('Learn about it', { exact: true }).click();
  await expect(root).toContainText('1 / 9');
  const box = await root.getByText('How we got this').boundingBox();
  // A quick 90px flick is enough; no need to drag a third of the screen.
  await page.mouse.move(box.x + 200, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, box.y, { steps: 2 });
  await page.mouse.move(box.x + 110, box.y, { steps: 2 });
  await page.mouse.up();
  await expect(root).toContainText('2 / 9');
  // Jump to the tasting card and play Blind Call: dragging a slider changes the slider, not the card.
  await page.locator('#root div[style*="scaleX(-1)"]').click();
  await page.locator('#root div[style*="scaleX(-1)"]').click();
  await page.locator('#root div[style*="scaleX(-1)"]').click();
  await page.locator('#root div[style*="scaleX(-1)"]').click();
  await expect(root).toContainText('6 / 9');
  await root.getByText('Tasting it now? Play Blind Call').click();
  const slider = root.locator('input[type=range]').first();
  const s = await slider.boundingBox();
  await page.mouse.move(s.x + s.width * 0.5, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width * 0.9, s.y + s.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(root).toContainText('6 / 9');
  expect(Number(await slider.inputValue())).toBeGreaterThan(70);
  // Slider colour follows the wine type (red here).
  expect(await slider.evaluate((el) => getComputedStyle(el).accentColor)).toBe('rgb(139, 26, 47)');
  // Last card is the rating; after saving, the end actions sit apart.
  for (let i = 0; i < 3; i++) await page.locator('#root div[style*="scaleX(-1)"]').click();
  await expect(root).toContainText('9 / 9');
  await expect(root.getByText('Rate it', { exact: true })).toBeVisible();
  await root.getByText('90', { exact: true }).click();
  await root.getByText('Save rating').click();
  // The card's label follows the step.
  await expect(root.getByText('Your score', { exact: true })).toBeVisible();
  await root.getByText('Done: what\'s next?').click();
  await expect(root).toContainText('Keep learning');
  await expect(root.getByText('Rate it', { exact: true })).toHaveCount(0);
  await expect(root.getByText('Finish', { exact: true })).toBeVisible();
  await expect(root.getByText('See full wine details')).toBeVisible();
});

test('WineDNA "See all" opens My Wines on that type, sorted by score', async ({ context, page }) => {
  await setup(context, page);
  await page.goto(`${BASE}/?demo=1#profile`);
  const whiteName = await page.evaluate(() => WineHistory.getAll().find((w) => w.type === 'white').name);
  const root = page.locator('#root');
  await root.getByText('See all →').first().click();
  await expect(root).toContainText('My Wines');
  await expect(root).not.toContainText(whiteName);
});

test('the Learn shelf repairs saved cards and gives region pieces their own subtitles', async ({ context, page }) => {
  const stubs = [
    { id: 'ev_a', archetypeId: 'new_region_intro', readTime: '3 min', title: 'First Taste of Burgundy', subtitle: 'What makes Burgundy its own thing, not just "{{country}} wine"', slots: { region: 'Burgundy' } },
    { id: 'ev_b', archetypeId: 'palate_vs_textbook', readTime: '3 min', title: 'Your Palate in Rioja vs. the Textbook', subtitle: 'How the wines you actually picked line up with the classic style', slots: { region: 'Rioja' } },
  ];
  await setup(context, page, { seed: { vinterest_gen_stubs: JSON.stringify(stubs), vinterest_onramp_1_done: '1' } });
  await page.goto(`${BASE}/?demo=1#learn`);
  const root = page.locator('#root');
  await expect(root).toContainText('Rioja vs. the Textbook');
  await expect(root).toContainText('Textbook Rioja is Tempranillo and Garnacha');
  await root.getByText(/^Show \d+ more to read$/).click();
  await expect(root).toContainText('Home of Pinot Noir');
  await expect(root).not.toContainText('{{');
  await expect(root).toContainText(/your palate vs\. the textbook series/i);
});

test('wine detail: taste bars use WineDNA\'s scale, skip missing figures, and say what you tasted', async ({ context, page }) => {
  await setup(context, page);
  await page.goto(`${BASE}/?demo=1#home`);
  await page.evaluate(() => sessionStorage.setItem('vinterest_scan_result', JSON.stringify({ wine: {
    name: 'Detail Test', type: 'red', region: 'Rioja', country: 'Spain', grapes: ['Tempranillo'], body: 0.5, acidity: 0.8, tannins: null, sweetness: 0.05, tasted: { acidity: -1 } } })));
  await page.goto(`${BASE}/?demo=1#detail`);
  const root = page.locator('#root');
  await expect(root).toContainText('This wine is medium-bodied: present without being heavy');
  await expect(root).toContainText('You found it softer than the label suggested.');
  await expect(root).not.toContainText('tannins:');
  await expect(root).toContainText('Your 90+ reds');
});

// Real touch input (through the browser's own gesture handling, unlike a mouse): a gentle swipe
// turns the card either way, from anywhere on it, including back from the last card, and a
// touch-drag on a Blind Call slider moves the slider, not the card.
test.describe('the deck on a touch screen', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 400, height: 860 } });
  test('gentle swipes both ways, sliders stay sliders', async ({ context, page }) => {
    await setup(context, page, { label: PRIORAT });
    await page.goto(`${BASE}/?demo=1#camera`);
    await page.getByTestId('scan-file').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
    const root = page.locator('#root');
    await root.getByText('Learn about it', { exact: true }).click();
    await expect(root).toContainText('1 / 9');
    const cdp = await context.newCDPSession(page);
    const drag = async (x0, y, dx, ms) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
      for (let i = 1; i <= 8; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dx * i / 8, y: y + i }] });
        await page.waitForTimeout(ms / 8);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(400);
    };
    const y = (await root.getByText('How we got this').boundingBox()).y + 40;
    await drag(300, y, -100, 300);
    await expect(root).toContainText('2 / 9');
    await drag(100, y, 100, 300);
    await expect(root).toContainText('1 / 9');
    for (let i = 0; i < 5; i++) await drag(320, 400, -110, 250);
    await expect(root).toContainText('6 / 9');
    await root.getByText('Tasting it now? Play Blind Call').click();
    const slider = root.locator('input[type=range]').first();
    const s = await slider.boundingBox();
    await drag(s.x + s.width * 0.5, s.y + s.height / 2, s.width * 0.4, 300);
    await expect(root).toContainText('6 / 9');
    expect(Number(await slider.inputValue())).toBeGreaterThan(70);
    // From the Blind Call card on, swipe on the card heading (a swipe starting on a slider is the slider's).
    for (let i = 0; i < 3; i++) await drag(320, (await root.getByText(/^(While you taste|Sound clued-in|Price check)$/).first().boundingBox()).y + 5, -110, 250);
    await expect(root).toContainText('9 / 9');
    await drag(60, (await root.getByText('How was it?').boundingBox()).y + 5, 110, 250);
    await expect(root).toContainText('8 / 9');
  });
});

test('a rescan within a few hours is the same occasion; a suggestion is not a scan', async ({ context, page }) => {
  await setup(context, page, { label: PRIORAT });
  const scan = async () => {
    await page.goto(`${BASE}/?demo=1#camera`);
    await page.getByTestId('scan-file').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.locator('#root')).toContainText('Clos Test Priorat 2019');
  };
  // Started, left half-way, scanned again to finish: one bottle.
  await scan();
  await page.evaluate(() => sessionStorage.clear());
  await scan();
  expect((await history(page)).find((w) => w.name === 'Clos Test Priorat').times_consumed).toBe(1);
  // A day later it's another bottle.
  await page.evaluate(() => { const all = WineHistory.getAll(); all.find((w) => w.name === 'Clos Test Priorat').last_scanned = new Date(Date.now() - 86400000).toISOString(); WineHistory.save(all); sessionStorage.clear(); });
  await scan();
  expect((await history(page)).find((w) => w.name === 'Clos Test Priorat').times_consumed).toBe(2);

  // Opening a suggested wine saves nothing until the user acts on it.
  await page.goto(`${BASE}/?demo=1#home`);
  await page.evaluate(() => sessionStorage.setItem('vinterest_scan_result', JSON.stringify({ source: 'suggestion',
    wine: { name: 'Suggested Test', type: 'red', region: 'Priorat', country: 'Spain', grapes: ['Garnacha'], confidence: 'high' } })));
  await page.goto(`${BASE}/?demo=1#identified`);
  await expect(page.locator('#root')).toContainText('Suggested Test');
  expect((await history(page)).some((w) => w.name === 'Suggested Test')).toBe(false);
  await page.locator('#root').getByText('Save for later', { exact: true }).click();
  const s = (await history(page)).find((w) => w.name === 'Suggested Test');
  expect([s.scan_intent, s.body]).toEqual(['checking', undefined]);
});

test('a non-vintage wine (vintage 0) shows no stray "0"', async ({ context, page }) => {
  await setup(context, page);
  await page.goto(`${BASE}/?demo=1#home`);
  await page.evaluate(() => { const all = WineHistory.getAll(); all.unshift({ name: 'NV Test Brut', type: 'sparkling', region: 'Champagne', country: 'France', grapes: ['Pinot Noir', 'Chardonnay'], vintage: 0, rating: 84, times_consumed: 1, scanned_at: new Date().toISOString() }); WineHistory.save(all);
    sessionStorage.setItem('vinterest_scan_result', JSON.stringify({ wine: WineHistory.getAll()[0] })); });
  await page.goto(`${BASE}/?demo=1#mywines`);
  const card = page.locator('#root .mw-row', { hasText: 'NV Test Brut' });
  expect((await card.innerText()).split('\n').map((l) => l.trim())).not.toContain('0');
  await page.goto(`${BASE}/?demo=1#detail`);
  expect((await page.locator('#root').innerText()).split('\n').map((l) => l.trim())).not.toContain('0');
});

test('duplicate entries for one bottle merge into one, and a stray "Save for later" gives way to tasting', async ({ context, page }) => {
  await setup(context, page);
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate(() => {
    const base = { name: 'Brunello di Montalcino', vintage: 2017, region: 'Brunello di Montalcino', country: 'Italy', type: 'red', grapes: ['Sangiovese'] };
    localStorage.setItem(WineHistory.KEY, JSON.stringify([
      { ...base, producer: 'BiondiSanti', scan_intent: 'checking', times_consumed: 1, scanned_at: '2026-09-24T21:00:00Z', last_scanned: '2026-09-24T22:00:00Z', price_usd: 300 },
      { ...base, producer: 'Biondi-Santi', scan_intent: 'tasting', times_consumed: 2, scanned_at: '2026-09-20T20:00:00Z', last_scanned: '2026-09-20T20:00:00Z', rating: 0 },
      { ...base, producer: 'Soldera', name: 'Brunello di Montalcino' },
    ]));
    const all = WineHistory.getAll();
    return { n: all.length, stored: JSON.parse(localStorage.getItem(WineHistory.KEY)).length, first: all[0], rescan: WineHistory.same({ ...base, producer: 'Biondi Santi' }, all[0]) };
  });
  expect(out.n).toBe(2); // Soldera's Brunello is a different wine
  expect(out.stored).toBe(2);
  expect(out.first).toMatchObject({ scan_intent: 'tasting', times_consumed: 2, scanned_at: '2026-09-20T20:00:00Z', last_scanned: '2026-09-24T22:00:00Z', price_usd: 300 });
  expect(out.rescan).toBe(true);
});

test('a scan that missed the vintage is the same bottle as the one saved with it', async ({ context, page }) => {
  await setup(context, page);
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate(() => {
    const base = { name: 'Brunello di Montalcino', producer: 'Biondi-Santi', region: 'Brunello di Montalcino', country: 'Italy', type: 'red', grapes: ['Sangiovese'] };
    localStorage.setItem(WineHistory.KEY, JSON.stringify([
      { ...base, vintage: 0, times_consumed: 1, scanned_at: '2026-09-24T22:00:00Z', last_scanned: '2026-09-24T22:00:00Z' },
      { ...base, vintage: 2017, times_consumed: 1, scanned_at: '2026-09-24T21:00:00Z', last_scanned: '2026-09-24T21:00:00Z', price_usd: 300 },
      { ...base, producer: 'Soldera', vintage: 2016, rating: 94 },
    ]));
    const healed = WineHistory.getAll().map((w) => w.vintage);
    // Two dated bottles: a vintage-less scan can't pick one, so it isn't merged.
    localStorage.setItem(WineHistory.KEY, JSON.stringify([{ ...base, vintage: 'NV' }, { ...base, vintage: 2017 }, { ...base, vintage: 2016 }]));
    const ambiguous = WineHistory.getAll().length;
    localStorage.setItem(WineHistory.KEY, JSON.stringify([{ ...base, vintage: 2017 }]));
    const rescan = ScanFlow.resolve({ ...base, vintage: null }).wine.vintage;
    return { healed, ambiguous, rescan, twoYears: WineHistory.same({ ...base, vintage: 2016 }, { ...base, vintage: 2017 }) };
  });
  expect(out.healed).toEqual([2017, 2016]);
  expect(out.ambiguous).toBe(3);
  expect(out.rescan).toBe(2017);
  expect(out.twoYears).toBe(false);
});

test('TasteMatch is relative to how they score: a generous scorer isn\'t told everything is a favourite', async ({ context, page }) => {
  await setup(context, page);
  await page.goto(`${BASE}/?demo=1#home`);
  const out = await page.evaluate(() => {
    const mk = (i, rating, body) => ({ name: `Red ${i}`, type: 'red', rating, body, tannins: body, acidity: 0.5, grapes: [], scan_date: Date.now() - i * 864e5 });
    // Scores everything 88–92, loves the full-bodied ones most.
    const all = [mk(1, 88, 0.2), mk(2, 89, 0.25), mk(3, 88, 0.3), mk(4, 90, 0.5), mk(5, 89, 0.45), mk(6, 92, 0.85), mk(7, 92, 0.9), mk(8, 91, 0.8)];
    const light = TasteMatch.assess({ name: 'Light', type: 'red', body: 0.25, tannins: 0.25, acidity: 0.5 }, all);
    const full = TasteMatch.assess({ name: 'Full', type: 'red', body: 0.85, tannins: 0.85, acidity: 0.5 }, all);
    return { light: [light.expected, light.verdict, light.pct], full: [full.expected, full.verdict, full.pct] };
  });
  // They'd still rate the light one well, but only the full one is among their favourites.
  expect(out.light[0]).toBeGreaterThanOrEqual(80);
  expect(out.light[1]).not.toBe('hit');
  expect(out.full[1]).toBe('hit');
  expect(out.full[2] - out.light[2]).toBeGreaterThan(30);
});

test('TasteMatch counts the same region by the knowledge base: a Brunello draws on their Chianti and Bolgheri', async ({ context, page }) => {
  await setup(context, page);
  await page.goto(`${BASE}/?demo=1#home`);
  const out = await page.evaluate(() => {
    const mk = (name, rating, region, sub_region, grapes) => ({ name, type: 'red', rating, region, sub_region, grapes, body: 0.85, tannins: 0.8, acidity: 0.7 });
    const all = [mk('Chianti Classico Riserva', 96, 'Chianti Classico', '', ['Sangiovese']), mk('Sassicaia', 100, 'Tuscany', 'Bolgheri', ['Cabernet Sauvignon']),
      mk('Le Difese', 97, 'Toscana', '', ['Cabernet Sauvignon', 'Sangiovese']), mk('Barolo', 80, 'Piedmont', '', ['Nebbiolo']), mk('Rioja', 82, 'Rioja', '', ['Tempranillo']),
      mk('Côtes du Rhône', 80, 'Rhône Valley', '', ['Grenache'])];
    const m = TasteMatch.assess({ name: 'Brunello di Montalcino', type: 'red', region: 'Brunello di Montalcino', country: 'Italy', grapes: ['Sangiovese Grosso'], body: 0.85, tannins: 0.8, acidity: 0.72 }, all);
    return { verdict: m.verdict, reasons: m.reasons.map((r) => r.text).join(' ') };
  });
  expect(out.reasons).toContain('Tuscany: you\'ve scored 3, averaging 98.');
  expect(out.verdict).toBe('hit');
});

test('"Why N%?" shows the wines the prediction is built from, and their points add up to it', async ({ context, page }) => {
  await setup(context, page);
  await page.goto(`${BASE}/?demo=1#home`);
  const out = await page.evaluate(() => {
    const mk = (name, rating, body, grapes) => ({ name, type: 'red', rating, region: 'Tuscany', grapes, body, tannins: body, acidity: 0.7 });
    const all = [mk('Close A', 95, 0.85, ['Sangiovese']), mk('Close B', 93, 0.86, ['Sangiovese']), mk('Close C', 99, 0.84, ['Sangiovese']),
      mk('Far 1', 80, 0.3, ['Merlot']), mk('Far 2', 80, 0.35, ['Gamay']), mk('Far 3', 100, 0.4, ['Pinot Noir']), mk('Far 4', 80, 0.3, ['Gamay'])];
    const m = TasteMatch.assess({ name: 'Brunello', type: 'red', region: 'Brunello di Montalcino', grapes: ['Sangiovese Grosso'], body: 0.85, tannins: 0.85, acidity: 0.72 }, all);
    const b = m.breakdown;
    return { pct: m.pct, verdict: m.verdict, sum: b.avg + b.items.reduce((s, i) => s + i.pts, 0), predicted: b.predicted, names: b.items.filter((i) => i.kind === 'wine').map((i) => i.name).sort(), why: b.pctWhy };
  });
  expect(out.sum).toBe(out.predicted);
  expect(out.names).toEqual(['Close A', 'Close B', 'Close C']);
  // Close matches that agree make a surer call than the user's wide overall range alone.
  expect(out.why).toContain('agree closely (93–99)');
  expect(out.verdict).toBe('hit');
  expect(out.pct).toBeGreaterThanOrEqual(85);
});

test('a wine far above their usual spend is called out, and the match doesn\'t change', async ({ context, page }) => {
  await setup(context, page);
  await page.goto(`${BASE}/?demo=1#home`);
  const out = await page.evaluate(() => {
    const us = { code: 'USD', base: '$' };
    const mk = (name, rating, price_usd) => ({ name, type: 'red', rating, price_usd, grapes: ['Merlot'], body: 0.7, tannins: 0.6, acidity: 0.6 });
    const all = [mk('A', 90, 18), mk('B', 88, 22), mk('C', 92, 25), mk('D', 85, 30), mk('E', 91, 20)];
    const cheap = { name: 'Cheap', type: 'red', grapes: ['Merlot'], body: 0.7, tannins: 0.6, acidity: 0.6, price_usd: 25 };
    const dear = { ...cheap, name: 'Dear', price_usd: 250 };
    return { cheapNote: TasteMatch.priceNote(cheap, 25, all, us), dearNote: TasteMatch.priceNote(dear, 250, all, us),
      samePct: TasteMatch.assess(cheap, all).pct === TasteMatch.assess(dear, all).pct };
  });
  expect(out.cheapNote).toBeNull();
  expect(out.dearNote.text).toContain('well above the $20–$25 you usually spend on reds');
  expect(out.dearNote.text).toContain('more than any of the reds you\'ve had (the most was $30)');
  expect(out.samePct).toBe(true);
});
