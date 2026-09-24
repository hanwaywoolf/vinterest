// Home is "what next" (LearnNext.home), and Vinny answers from the user's own WineDNA, keeps a
// follow-up in context, and links each answer to the app's own learning.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';
const root = (page) => page.locator('#root');

async function demo(context, page, claudeRequests, seed = {}) {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_wineDNA_unlock_seen: '1', ...seed });
  await stubNetwork(context, { claudeRequests, claudeText: (b) => (b.purpose === 'wine_qa' ? 'Because you love savoury, structured reds like your Muga.' : '') });
}

test('Vinny knows their wines, takes a follow-up, and links to learning', async ({ context, page }) => {
  const errors = collectErrors(page);
  const reqs = [];
  await demo(context, page, reqs);
  await page.goto(`${BASE}/?demo=1#home`);
  await page.evaluate(() => GrapeUnlocks.unlockViaRating('Tempranillo'));
  // Tapping the animated suggestion fills the box; nothing is sent.
  await root(page).locator('form div[style*="cursor: text"]').click();
  expect(reqs.filter((r) => r.purpose === 'wine_qa')).toHaveLength(0);
  expect(await page.getByLabel('Ask Vinny').inputValue()).not.toBe('');

  await page.getByLabel('Ask Vinny').fill('Why do I keep picking Tempranillo?');
  await page.getByLabel('Ask', { exact: true }).click();
  await expect(root(page)).toContainText('Learn more: Tempranillo quiz');
  const first = reqs.filter((r) => r.purpose === 'wine_qa')[0].messages[0].content;
  expect(first).toContain('Reds: 20 reds scanned');
  expect(first).toContain('Muga Selección Especial Rioja (100)');
  expect(first).toContain('usual spend');
  expect(first).not.toContain('Conversation so far');

  await page.getByLabel('Ask Vinny').fill('And what should I eat with it?');
  await page.getByLabel('Ask', { exact: true }).click();
  await expect(root(page)).toContainText('Learn more: Four pairing rules that actually work');
  const second = reqs.filter((r) => r.purpose === 'wine_qa')[1].messages[0].content;
  expect(second).toContain('They asked: "Why do I keep picking Tempranillo?"');
  // Remembered for next time.
  expect(await page.evaluate(() => Vinny.recent())).toEqual(['And what should I eat with it?', 'Why do I keep picking Tempranillo?']);

  // The link opens the grape quiz's learning, a guide here.
  await root(page).getByText('Learn more: Four pairing rules that actually work').click();
  await expect(root(page)).toContainText('Wine Skills · Food pairing');
  expect(errors).toEqual([]);
});

test('Vinny\'s links: a region, a Pro grape past the free five, a guide by topic', async ({ context, page }) => {
  await demo(context, page, []);
  await page.goto(`${BASE}/?demo=1#home`);
  const out = await page.evaluate(() => {
    RegionUnlocks.unlock('Rioja');
    ['Merlot', 'Syrah', 'Gamay', 'Malbec', 'Barbera'].forEach((g) => GrapeUnlocks.unlockViaRating(g));
    return {
      region: Vinny.learnLink('Is Rioja Alta any good?', ''),
      pro: Vinny.learnLink('Tell me about Nebbiolo', ''),
      guide: Vinny.learnLink('How do I order at a restaurant?', ''),
      none: Vinny.learnLink('Hello', 'Hi there'),
    };
  });
  expect(out.region).toEqual({ kind: 'region', region: 'Rioja', label: 'Rioja quiz' });
  expect(out.pro).toEqual({ kind: 'pro', feature: 'grape-library', label: 'Nebbiolo quiz' });
  expect(out.guide.kind).toBe('guide');
  expect(out.none).toBeNull();
});

test('Home is what next: Up next, Written for you, recent scans, WineDNA, knowledge', async ({ context, page }) => {
  const errors = collectErrors(page);
  await demo(context, page, [], { vinterest_onramp_1_done: '1' });
  await page.goto(`${BASE}/?demo=1#home`);
  for (const t of ['Up next', 'Recently scanned', 'Your WineDNA', 'Try next:', 'Your red sommelier script', 'Wine knowledge']) await expect(root(page)).toContainText(t);
  for (const t of ['Top Reds', 'Take a Quiz', 'Your Reds Script']) await expect(root(page)).not.toContainText(t);
  const next = await page.evaluate(() => { const n = LearnNext.home(); return { primary: n.primary && n.primary.kind, more: n.more.map((m) => m.kind) }; });
  expect(next.primary).toBeTruthy();
  expect(next.more.length).toBeGreaterThan(0);
  // A brand-new user is told to scan first.
  const fresh = await page.evaluate(() => LearnNext.home([]).primary);
  expect(fresh.kind).toBe('scan');
  expect(errors).toEqual([]);
});

test('Home takes you straight there: a type row opens that tab, the script row opens Scripts', async ({ context, page }) => {
  await demo(context, page, [], { vinterest_dna_collapsed_v1: JSON.stringify({ scripts: true }) });
  await page.goto(`${BASE}/?demo=1#home`);
  await root(page).getByText('Rosé', { exact: true }).click();
  await expect(root(page).getByText('Rosé', { exact: true }).first()).toHaveCSS('font-weight', '700');

  await page.goto(`${BASE}/?demo=1#home`);
  await root(page).getByText('Your red sommelier script', { exact: true }).click();
  await expect(root(page).getByText('Reds', { exact: true }).first()).toHaveCSS('font-weight', '700');
  const scripts = page.locator('[data-section="scripts"]');
  await expect(scripts).toBeInViewport();
  // Opened, even though it was collapsed: no "Expand for full details" under it.
  await expect(scripts).not.toContainText('Expand for full details');
});
