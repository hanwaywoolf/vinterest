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
  const reds = page.locator('#root').getByText('Red', { exact: true }).first();
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

test('local grape names and clones go by their variety: Sangiovese Grosso is Sangiovese', async ({ page }) => {
  await page.goto('http://localhost:4173/?demo=1#home');
  const out = await page.evaluate(() => [
    ['Sangiovese Grosso', 'Prugnolo Gentile', 'Spanna', 'Tinta del País', 'Weissburgunder', 'Steen'].map((g) => WineDNA.grape(g)),
    GrapeUnlocks.key('Sangiovese Grosso'),
    TasteMatch.assess({ name: 'Brunello di Montalcino', type: 'red', grapes: ['Sangiovese Grosso'], body: 0.8, tannins: 0.8, acidity: 0.75 },
      [...WineHistory.getAll(), ...[90, 92, 94].map((r, i) => ({ name: `Chianti ${i}`, type: 'red', grapes: ['Sangiovese'], rating: r, body: 0.6, tannins: 0.7, acidity: 0.8 }))])
      .reasons.map((r) => r.text).join(' '),
  ]);
  expect(out[0]).toEqual(['Sangiovese', 'Sangiovese', 'Nebbiolo', 'Tempranillo', 'Pinot Blanc', 'Chenin Blanc']);
  expect(out[1]).toBe('Sangiovese');
  expect(out[2]).toContain('Sangiovese Grosso (Sangiovese):');
  expect(out[2]).not.toContain('new grape');
});

test('tapping a type with no wines opens its tab (no pop-up), and tabs name each type in the singular', async ({ page }) => {
  const errors = collectErrors(page);
  // beforeEach has already seeded storage once, so this one sets its own after the first load.
  await page.goto(`${BASE}/#home`);
  await page.evaluate(() => {
    localStorage.clear();
    Object.entries({ vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_wineDNA_unlock_seen: '1', vinterest_region: 'uk',
      vinterest_wines: JSON.stringify([{ name: 'Prado Enea Gran Reserva', producer: 'Bodegas Muga', type: 'red', region: 'Rioja', country: 'Spain', grapes: ['Tempranillo'], rating: 96, scanned_at: '2026-09-01T12:00:00Z' }]) })
      .forEach(([k, v]) => localStorage.setItem(k, v));
  });
  await page.goto(`${BASE}/#profile`);
  const root = page.locator('#root');
  for (const t of ['Red', 'White', 'Rosé', 'Sparkling']) await expect(root.getByText(t, { exact: true }).first()).toBeVisible();
  await expect(root.getByText('Reds', { exact: true })).toHaveCount(0);
  await expect(root.getByText('Whites', { exact: true })).toHaveCount(0);
  await root.getByText('White', { exact: true }).first().click();
  await expect(root.getByText('White', { exact: true }).first()).toHaveCSS('font-weight', '700');
  await expect(root).not.toContainText("You haven't scanned a");
  expect(errors).toEqual([]);
});

// A bottle they've scored in another year leads the match: Cervaro della Sala 2019 scored 100,
// the 2022 scanned under a slightly different name. A different wine from the same producer
// and a different year of the same wine never merge in My Wines.
test('another vintage of the same wine anchors the match and says so', async ({ page }) => {
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate(() => {
    const white = (name, rating, extra = {}) => ({ name, type: 'white', producer: 'Antinori', region: 'Umbria', country: 'Italy', grapes: ['Chardonnay'], rating, body: 0.5, acidity: 0.6, sweetness: 0.05, vintage: 2021, ...extra });
    const wines = [
      white('Cervaro della Sala', 100, { vintage: 2019, body: 0.8 }),
      { ...white('Muscadet Sèvre et Maine', 84), producer: 'Domaine Luneau', region: 'Loire', grapes: ['Melon de Bourgogne'], body: 0.3 },
      { ...white('Sancerre', 86), producer: 'Henri Bourgeois', region: 'Loire', grapes: ['Sauvignon Blanc'], body: 0.35 },
      { ...white('Albariño', 85), producer: 'Pazo Señorans', region: 'Rías Baixas', grapes: ['Albariño'], body: 0.4 },
    ];
    const scan = { name: 'Cervaro Della Sala, Antinori', vintage: 2022, type: 'white', producer: 'Marchesi Antinori', region: 'Umbria', country: 'Italy', grapes: ['Chardonnay', 'Grechetto'], body: 0.75, acidity: 0.6, sweetness: 0.05 };
    const m = TasteMatch.assess(scan, wines);
    const other = TasteMatch.assess({ ...scan, name: 'Bramìto della Sala', vintage: 2022 }, wines);
    return {
      same: WineHistory.otherVintage(scan, wines[0]), sameYear: WineHistory.otherVintage({ ...scan, vintage: 2019 }, wines[0]),
      notOther: WineHistory.otherVintage({ ...scan, name: 'Bramìto della Sala' }, wines[0]), merged: WineHistory.same(scan, wines[0]),
      pct: m.pct, verdict: m.verdict, first: m.reasons[0].text, summary: m.summary, vintages: m.vintages,
      up: m.breakdown.up.map((x) => x.text), why: m.breakdown.pctWhy, otherPct: other.pct, otherFirst: other.reasons[0].kind,
    };
  });
  expect(out.same).toBe(true);
  expect(out.sameYear).toBe(false); // the same year is the same entry, not another vintage
  expect(out.notOther).toBe(false);
  expect(out.merged).toBe(false); // two years stay two wines
  expect(out.vintages).toEqual([{ vintage: 2019, rating: 100 }]);
  expect(out.first).toBe("You gave the 2019 a 100. Vintages vary, but it's the same wine.");
  expect(out.summary).toBe("You gave the 2019 a 100, so we think you'd rate this one Extraordinary.");
  expect(out.pct).toBeGreaterThanOrEqual(96);
  expect(out.verdict).toBe('hit');
  expect(out.up[0]).toBe('Other vintages of this wine: you scored the 2019 100');
  expect(out.why).toMatch(/^The same wine from another year is the best guide there is/);
  expect(out.otherFirst).not.toBe('vintage');
});
