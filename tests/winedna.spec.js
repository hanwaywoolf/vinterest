// WineDNA (pwa-winedna.js + the WineDNA tab): scores read on the Parker scale, one level scale
// everywhere, preference signals from what the user scores highest, and the rating controls.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';

test.beforeEach(async ({ context, page }) => {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_wineDNA_unlock_seen: '1' });
  await stubNetwork(context);
});

test('Parker labels and quick-picks', async ({ page }) => {
  await page.goto(`${BASE}/?demo=1#home`);
  const out = await page.evaluate(() => ({
    labels: [100, 96, 95, 90, 89, 80, 79, 70, 65, 55, 0].map((s) => ParkerScale.label(s)),
    presets: ParkerScale.PRESETS,
  }));
  expect(out.labels).toEqual(['Extraordinary', 'Extraordinary', 'Outstanding', 'Outstanding', 'Very good', 'Very good', 'Average', 'Average', 'Below average', 'Poor', '']);
  expect(out.presets).toEqual([70, 80, 85, 90, 95]);
});

test('the demo reds profile: signal, grapes, dislikes and value all come from real scores', async ({ page }) => {
  await page.goto(`${BASE}/?demo=1#home`);
  const p = await page.evaluate(() => {
    const x = WineDNA.profile('red', WineHistory.getAll(), 'Reds');
    return {
      personality: x.personality, basis: x.basis, loved: x.loved.length,
      signals: x.signals.map((s) => [s.axis, s.dir]),
      grapes: x.grapeStats.map((g) => g.name),
      disliked: x.favourites.disliked.map((w) => w.rating),
      rethink: x.favourites.rethink.map((r) => [r.name, r.also || null]),
      verdict: x.value && x.value.verdict,
      confidence: x.confidence.level,
    };
  });
  expect(p.basis).toBe('loved');
  expect(p.loved).toBe(6);
  expect(p.personality).toBe('Bold & Structured');
  // This drinker's 90+ reds are softer in acidity than the rest.
  expect(p.signals).toContainEqual(['acidity', 'low']);
  // Synonyms and scan typos merge: Garnacha → Grenache, Shiraz → Syrah, Mlavac → Plavac Mali.
  for (const g of ['Grenache', 'Syrah', 'Plavac Mali']) expect(p.grapes).toContain(g);
  for (const g of ['Garnacha', 'Shiraz', 'Mlavac']) expect(p.grapes).not.toContain(g);
  // Only genuinely low scores (under 80) count as "didn't work"; 80s are Very good.
  expect(p.disliked).toEqual([66]);
  // Piedmont and Nebbiolo are the same two bottles: one line, not two.
  expect(p.rethink).toEqual([['Piedmont', 'Nebbiolo']]);
  // £28 vs £22 is not "about the same".
  expect(p.verdict.kind).not.toBe('flat');
  expect(p.confidence).toBe('strong');
});

test('one level scale: bar labels, chips and Explore Next agree', async ({ page }) => {
  await page.goto(`${BASE}/?demo=1#home`);
  const out = await page.evaluate(() => {
    const x = WineDNA.profile('red', WineHistory.getAll(), 'Reds');
    const ex = ExploreNext.suggest('red', WineHistory.getAll(), 'Reds');
    return {
      acidityLevel: WineDNA.level(x.avg.acidity),
      // Explore reads the 90+ profile when there is one, so its "shares" must match that level.
      lovedLevels: Object.fromEntries(Object.entries(x.dnaAvg).map(([k, v]) => [k, WineDNA.level(v)])),
      shares: ex.picks.map((pk) => pk.shares),
    };
  });
  expect(out.acidityLevel).toBe('mid');
  const words = { body: { high: 'full body', low: 'light body', mid: 'medium body' }, tannins: { high: 'firm tannins', low: 'soft tannins', mid: 'medium tannins' }, acidity: { high: 'fresh, high acidity', low: 'softer acidity', mid: 'balanced acidity' } };
  const allowed = Object.entries(words).map(([k, w]) => w[out.lovedLevels[k]]);
  for (const s of out.shares.filter(Boolean)) expect(allowed).toContain(s);
});

test('re-scoring a wine refreshes the profile (not just adding one)', async ({ page }) => {
  await page.goto(`${BASE}/?demo=1#home`);
  const out = await page.evaluate(() => {
    const before = WineDNA.signature(WineHistory.getAll());
    const w = WineHistory.getAll()[0];
    WineHistory.rate(w.name, w.vintage, w.rating === 95 ? 90 : 95);
    return { before, after: WineDNA.signature(WineHistory.getAll()) };
  });
  expect(out.after).not.toBe(out.before);
});

test('the WineDNA tab shows the new sections with no console errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${BASE}/?demo=1#profile`);
  const root = page.locator('#root');
  for (const t of ['Based on your 6 Outstanding (90+) reds', 'What you love', 'You tend to score softer-acid reds higher.', 'Where to look:', 'Where your best scores come from', 'Worth knowing before you buy', 'Your reds style', 'Your 90+ reds', 'Getting value', 'Your sweet spot', 'How your choices are changing', 'Blind Call accuracy']) {
    await expect(root, t).toContainText(t);
  }
  // Removed: duplicate personality badge, XP bar, "1 of 4" arrows, generic grape claims.
  for (const t of ['swipe or tap', 'to Sommelier', 'grippy by nature', 'palate is getting sharper']) await expect(root).not.toContainText(t);
  expect(errors).toEqual([]);
});

test('rating controls use the Parker scale', async ({ page }) => {
  await page.goto(`${BASE}/?demo=1#profile`);
  await page.locator('#root').getByText('Top Reds').scrollIntoViewIfNeeded();
  await page.locator('#root').getByText(/^#1$/).click();
  const root = page.locator('#root');
  await root.getByText('tap to edit').click();
  await expect(root).toContainText('100-point scale: 96+ Extraordinary');
  for (const n of ['70', '85', '95']) await expect(root.getByText(n, { exact: true }).first()).toBeVisible();
});

test('one name per grape: WineDNA, Learn unlocks, articles and XP agree', async ({ page }) => {
  await page.goto(`${BASE}/?demo=1#home`);
  const out = await page.evaluate(() => {
    const self = GRAPE_ALLOWLIST.filter((g) => WineDNA.grape(g) !== g);
    const syn = [...new Set(Object.values(WineDNA.GRAPE_SYNONYMS))].filter((t) => !GRAPE_ALLOWLIST.includes(t));
    const labels = ['Pinot Gris', 'pinot grigio', 'Grauburgunder', 'Shiraz', 'Gewurztraminer', 'Albarino', 'Mourvedre', 'Primitivo', 'Zinfandel']
      .map((g) => [WineDNA.grape(g), GrapeUnlocks.key(g)]);
    return { self, syn, labels };
  });
  // Every Learn grape keeps its own name, and every synonym lands on a Learn grape, except two
  // that aren't among the 50 (so they have no quiz, and nothing to disagree with).
  expect(out.self).toEqual([]);
  expect(out.syn.sort()).toEqual(['Blaufränkisch', 'Plavac Mali']);
  expect(out.labels).toEqual([
    ['Pinot Grigio', 'Pinot Grigio'], ['Pinot Grigio', 'Pinot Grigio'], ['Pinot Grigio', 'Pinot Grigio'], ['Syrah', 'Syrah'],
    ['Gewürztraminer', 'Gewürztraminer'], ['Albariño', 'Albariño'], ['Mourvèdre', 'Mourvèdre'], ['Primitivo', 'Primitivo'], ['Zinfandel', 'Zinfandel'],
  ]);
});

test('WineDNA opens on the type they drink most, not the first one ticked at onboarding', async ({ page }) => {
  await page.goto(`${BASE}/?demo=1#home`);
  const out = await page.evaluate(() => {
    UserPrefs.save({ ...UserPrefs.get(), types: ['rose', 'red'] });
    sessionStorage.removeItem(UserPrefs.TYPE_TAB_KEY);
    const wines = WineHistory.getAll();
    const most = UserPrefs.openingType(wines);
    const none = UserPrefs.openingType([]);
    UserPrefs.rememberType('white');
    const picked = UserPrefs.openingType(wines);
    sessionStorage.removeItem(UserPrefs.TYPE_TAB_KEY);
    return { most, none, picked };
  });
  expect(out).toEqual({ most: 'red', none: 'rose', picked: 'white' });
  await page.goto(`${BASE}/?demo=1#profile`);
  const reds = page.locator('#root').getByText('Reds', { exact: true }).first();
  await expect(reds).toHaveCSS('font-weight', '700');
});

test('wines named in WineDNA open their details', async ({ page }) => {
  await page.goto(`${BASE}/?demo=1#home`);
  await page.evaluate(() => { localStorage.setItem('vinterest_wineDNA_unlock_seen', '1');
    const all = WineHistory.getAll(); const w = all.find((x) => x.type === 'red' && x.rating >= 90); w.buy_again = true; WineHistory.save(all); });
  await page.goto(`${BASE}/?demo=1#profile`);
  const root = page.locator('#root');
  const row = root.getByText('Worth buying again', { exact: true }).locator('xpath=following-sibling::div[1]');
  const name = (await row.locator('span').first().innerText()).trim();
  await row.click();
  await expect(root.getByText('Details', { exact: true })).toBeVisible();
  await expect(root).toContainText(name);
});
