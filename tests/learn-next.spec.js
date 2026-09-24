// After a scan: grapes and regions unlock on the first scan (5 free each, then Pro), the budget
// comes from the user's own priced wines, the tasting questions explain themselves, "buy again"
// is used, and "Keep learning" offers the next thing to learn about the wine in hand.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const GRAN_RESERVA = { name: 'Gran Reserva 904', confidence: 'high', producer: 'La Rioja Alta S.A.', vintage: 2015, region: 'Rioja Alta', country: 'Spain',
  type: 'red', grapes: ['Tempranillo', 'Graciano'], blend: true, grapes_basis: 'label', body: 0.7, tannins: 0.65, acidity: 0.6, sweetness: 0.05, price_usd: 88 };

// A new user in the UK who said "£12–£25" at onboarding and hasn't scanned anything.
async function newUser(context, page, { label = GRAN_RESERVA, seed = {} } = {}) {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk', vinterest_country: 'United Kingdom',
    vinterest_prefs: JSON.stringify({ types: ['red'], budget: 'mid', experience: 'casual' }), ...seed });
  await stubNetwork(context, { claudeText: (b) => (b.purpose === 'label_scan' ? JSON.stringify(label) : '') });
}
async function scan(page) {
  await page.goto(`${BASE}/#camera`);
  await page.getByTestId('scan-file').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('#root')).toContainText(/Likely|Too early/);
}

test('regions resolve through aliases; grapes through synonyms', async ({ context, page }) => {
  await newUser(context, page);
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate(() => ({
    regions: [
      { region: 'Rioja Alta' }, { region: 'Southern Rhône', name: 'Châteauneuf-du-Pape' }, { region: 'Beaujolais', name: 'Côte du Py Morgon' },
      { region: 'Sta. Rita Hills' }, { region: 'Mendoza' }, { region: 'Somewhere Unknown' },
    ].map((w) => Regions.resolve(w)),
    grapes: ['Shiraz', 'Pinot Gris', 'Garnacha', 'Tempranillo', 'Plavac Mali'].map((g) => GrapeUnlocks.key(g)),
    regionCount: Object.keys(KNOWLEDGE.regions).length,
  }));
  expect(out.regions).toEqual(['Rioja', 'Rhône Valley', 'Beaujolais', 'Central Coast', 'Mendoza', null]);
  expect(out.grapes).toEqual(['Syrah', 'Pinot Grigio', 'Grenache', 'Tempranillo', null]);
  expect(out.regionCount).toBeGreaterThanOrEqual(50);
});

test('the 904 bug: first scan opens Rioja and Tempranillo; paying £90 sets the budget; Keep learning', async ({ context, page }) => {
  const errors = collectErrors(page);
  await newUser(context, page);
  await scan(page);
  const root = page.locator('#root');
  // Scanning alone opens the region and the grape, before any rating.
  expect(await page.evaluate(() => [RegionUnlocks.isUnlocked('Rioja'), GrapeUnlocks.isUnlocked('Tempranillo')])).toEqual([true, true]);
  await root.getByText('Rate it', { exact: true }).click();
  await root.getByText('95', { exact: true }).click();
  await root.getByText('Save rating').click();
  // The tasting questions teach the words.
  await expect(root).toContainText('How heavy the wine feels in your mouth.');
  await expect(root).toContainText('The drying, grippy feel on your gums and teeth');
  await expect(root).toContainText('The label suggests full-bodied. How did it feel to you?');
  await root.getByLabel('What you paid').fill('90');
  await root.getByLabel('What you paid').blur();
  await root.getByText('I\'d buy this again').click();
  // One priced red, scored 95, at £90: that's the budget now, not the onboarding answer.
  expect(await page.evaluate(() => SommelierScript.budget(WineHistory.getAll().filter((w) => w.type === 'red'), Regional.current()))).toBe('around £90 GBP');
  await root.getByText('Done: what\'s next?').click();
  await expect(root).toContainText('Keep learning');
  for (const t of ['Red Grapes: the basics', 'Rioja quiz', 'Tempranillo quiz']) await expect(root).toContainText(t);
  await expect(root).toContainText('Tempranillo leads this blend');
  await root.getByText('Rioja quiz').click();
  await expect(root).toContainText('Your Rioja Knowledge');
  expect(errors).toEqual([]);
});

test('the sixth grape and region are offered with Pro', async ({ context, page }) => {
  const at = Date.now();
  const grapes = Object.fromEntries(['Merlot', 'Pinot Noir', 'Malbec', 'Nebbiolo', 'Sangiovese'].map((g) => [g, { via: 'rated', at }]));
  const regions = Object.fromEntries(['Bordeaux', 'Burgundy', 'Piedmont', 'Tuscany', 'Mendoza'].map((r) => [r, { at }]));
  await newUser(context, page, { label: { ...GRAN_RESERVA, name: 'Barossa Test Shiraz', producer: 'Test', region: 'Barossa Valley', country: 'Australia', grapes: ['Shiraz'], blend: false },
    seed: { vinterest_grape_unlocks_v1: JSON.stringify({ version: 1, accounts: { local: { unlocked: grapes } } }),
      vinterest_region_unlocks_v1: JSON.stringify({ version: 1, accounts: { local: { unlocked: regions } } }) } });
  await scan(page);
  const root = page.locator('#root');
  await root.getByText('Save for later', { exact: true }).click();
  // Shopping, not tasting: the learning is offered straight away.
  await expect(root).toContainText('Shopping? Learn a little about it before you decide.');
  await expect(root.locator('div[role=button]', { hasText: 'Barossa Valley' })).toContainText('Unlock with Pro');
  await expect(root.locator('div[role=button]', { hasText: 'Syrah' })).toContainText('Unlock with Pro');
  await root.locator('div[role=button]', { hasText: 'Syrah' }).click();
  await expect(root).toContainText('Every Grape');
});

test('every wine type has its own basics; beginners see the tasting questions folded away', async ({ context, page }) => {
  const rose = { ...GRAN_RESERVA, name: 'Test Provence Rosé', producer: 'Test', region: 'Côtes de Provence', country: 'France', type: 'rosé', grapes: ['Grenache', 'Cinsault'], tannins: null, body: 0.3 };
  await newUser(context, page, { label: rose, seed: { vinterest_prefs: JSON.stringify({ types: ['rose'], budget: 'mid', experience: 'novice' }) } });
  await scan(page);
  const root = page.locator('#root');
  expect(await page.evaluate(() => ['red', 'white', 'rose', 'sparkling', 'orange', 'dessert', 'fortified'].map((t) => !!QUIZ_TOPICS.find((x) => x.id === LearnNext.TYPE_TOPIC[t])))).toEqual(Array(7).fill(true));
  await root.getByText('Rate it', { exact: true }).click();
  await root.getByText('90', { exact: true }).click();
  await root.getByText('Save rating').click();
  await expect(root).not.toContainText('What did you notice?');
  await root.getByText('Want to go further? Tell us what you noticed →').click();
  await expect(root).toContainText('What did you notice?');
  await root.getByText('Done: what\'s next?').click();
  await expect(root).toContainText('Rosé: the basics');
  await expect(root).toContainText('Provence quiz');
});

test('"buy again" is used: WineDNA shortlist, the match reasons and the sommelier script', async ({ context, page }) => {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_wineDNA_unlock_seen: '1' });
  const prompts = [];
  await stubNetwork(context, { claudeText: (b) => { if (b.purpose === 'sommelier_script') prompts.push(b.messages[0].content); return ''; } });
  await page.goto(`${BASE}/?demo=1#home`);
  const reason = await page.evaluate(() => {
    const all = WineHistory.getAll();
    const w = all.find((x) => x.name === 'Banda Azul Rioja');
    w.buy_again = true; WineHistory.save(all);
    const m = TasteMatch.assess({ name: 'Another Rioja', type: 'red', region: 'Rioja', grapes: ['Tempranillo'], body: w.body, tannins: w.tannins, acidity: w.acidity, sweetness: w.sweetness }, WineHistory.getAll());
    return m.reasons.map((r) => r.text).join(' ');
  });
  expect(reason).toContain('would buy again');
  await page.goto(`${BASE}/?demo=1#profile`);
  await expect(page.locator('#root')).toContainText('Worth buying again');
  await expect(page.locator('#root')).toContainText('Banda Azul Rioja');
  expect(prompts.some((p) => p.includes('Banda Azul Rioja') && p.includes('would buy again'))).toBe(true);
});

test('after a scan, Learn about it sits beside Rate it and Save for later, above style and price', async ({ context, page }) => {
  await newUser(context, page);
  await scan(page);
  const root = page.locator('#root');
  const y = async (t) => (await root.getByText(t, { exact: true }).first().boundingBox()).y;
  const [learn, rate, save, style] = [await y('Learn about it'), await y('Rate it'), await y('Save for later'), await y('Style')];
  expect(Math.abs(learn - rate)).toBeLessThan(2);
  expect(Math.abs(learn - save)).toBeLessThan(2);
  expect(learn).toBeLessThan(style);
  await root.getByText('Learn about it', { exact: true }).click();
  await expect(root).toContainText('How we got this');
});
