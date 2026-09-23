// Explore Next on WineDNA: suggestions ranked from the user's DNA, a detail screen that teaches
// the style and prices bottles around their usual spend, scanned styles moving to "explored",
// and "Add to Learn" putting a real article on the Learn shelf.
const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors, ROOT } = require('./helpers');

const BASE = 'http://localhost:4173';

test('every catalogue style is complete and valid', () => {
  const styles = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/explore-styles.json'), 'utf8'));
  const types = ['red', 'white', 'rose', 'sparkling', 'orange', 'dessert', 'fortified'];
  expect(new Set(styles.map((s) => s.id)).size).toBe(styles.length);
  for (const s of styles) {
    expect(types, s.id).toContain(s.type);
    for (const k of ['name', 'region', 'country', 'adds']) expect(s[k], `${s.id}.${k}`).toBeTruthy();
    for (const k of ['taste', 'why', 'label', 'ask']) expect(s.learn[k], `${s.id}.learn.${k}`).toBeTruthy();
    expect(Object.keys(s.profile).length, s.id).toBeGreaterThan(0);
    for (const v of Object.values(s.profile)) expect(v >= 0 && v <= 1, s.id).toBe(true);
    expect(s.match.length, s.id).toBeGreaterThan(0);
  }
  for (const t of types) expect(styles.filter((s) => s.type === t).length, t).toBeGreaterThanOrEqual(3);
});

test('suggestions come from the DNA, span countries, and a scanned style becomes explored', async ({ page }) => {
  await page.goto(`${BASE}/?demo=1#learn`);
  const out = await page.evaluate(() => {
    const before = ExploreNext.suggest('red', WineHistory.getAll(), 'Reds');
    const top = before.picks[0].style;
    // Scan a bottle of the top pick.
    const wines = [...WineHistory.getAll(), { name: `Test ${top.name}`, type: 'red', region: top.match[0], rating: 91, grapes: [] }];
    const after = ExploreNext.suggest('red', wines, 'Reds');
    return {
      picks: before.picks.map((p) => ({ id: p.style.id, country: p.style.country, why: p.why })),
      topId: top.id,
      afterPicks: after.picks.map((p) => p.style.id),
      explored: after.explored.map((e) => [e.style.id, e.wine.rating]),
      // A Veneto Cabernet mustn't count as having explored Loire Cabernet Franc.
      looseMatch: ExploreNext.matches(ExploreNext.style('loire_cab_franc'), { name: 'Le Argille Cabernet di Cabernet', region: 'Veneto', grapes: ['Cabernet Franc'] }),
    };
  });
  expect(out.picks).toHaveLength(3);
  expect(new Set(out.picks.map((p) => p.country)).size).toBe(3);
  for (const p of out.picks) expect(p.why.length).toBeGreaterThan(40);
  expect(out.afterPicks).not.toContain(out.topId);
  expect(out.explored).toContainEqual([out.topId, 91]);
  expect(out.looseMatch).toBe(false);
});

test('opening a suggestion teaches the style, prices bottles around the usual spend, and adds a Learn article', async ({ context, page }) => {
  const errors = collectErrors(page);
  const requests = [];
  await stubNetwork(context, {
    claudeRequests: requests,
    claudeText: (b) => (b.purpose === 'explore'
      ? JSON.stringify({ wines: [
        { tier: 'value', name: 'Bottle One', producer: 'P1', vintage: '2021', price_local: 14, why: 'An easy first look.' },
        { tier: 'mid-range', name: 'Bottle Two', producer: 'P2', vintage: '2020', price_local: 25, why: 'The classic style.' },
      ] })
      : ''),
  });
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_wineDNA_unlock_seen: '1' });
  await page.goto(`${BASE}/?demo=1#profile`);
  const root = page.locator('#root');
  await expect(root).toContainText('Explore Next');
  const first = await page.evaluate(() => ExploreNext.suggest('red', WineHistory.getAll(), 'Reds').picks[0].style);
  await root.getByText(/Learn about it & find a bottle/).first().click();

  for (const heading of ["Why it's next for you", 'What it tastes like', 'Why it tastes that way', 'How to spot it', 'What to ask for']) {
    await expect(root).toContainText(heading);
  }
  await expect(root).toContainText(first.learn.taste);
  await expect(root).toContainText('Bottle Two');
  await expect(root).toContainText('Your usual');
  const prompt = requests.find((r) => r.purpose === 'explore').messages[0].content;
  expect(prompt).toContain(first.name);
  expect(prompt).toMatch(/usual spend on red wine is £\d+–£\d+ GBP/);

  await root.getByText('Add to Learn', { exact: true }).click();
  await expect(root).toContainText('On your Learn shelf');
  const stub = await page.evaluate(() => JSON.parse(localStorage.getItem('vinterest_gen_stubs')).find((s) => s.archetypeId === 'explore_style_intro'));
  expect(stub.title).toBe(`Explore Next: ${first.name}`);
  expect(stub.facts).toContain(first.learn.why);
  expect(errors).toEqual([]);
});
