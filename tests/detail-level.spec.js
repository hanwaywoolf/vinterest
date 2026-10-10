// How much detail the app shows (DetailLevel, pwa-detail.js): a casual drinker starts with the
// essentials and sees more as they learn; enthusiasts and experts start further in; a level never
// goes down; "Show all details" on Profile shows everything. WineDNA, the scan result and the
// cards after a scan follow it, and the onboarding question previews it.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const PRIORAT = {
  name: 'Clos Test Priorat', confidence: 'high', alternative: '', producer: 'Clos Test', vintage: 2019, region: 'Priorat', sub_region: '',
  country: 'Spain', type: 'red', grapes: ['Garnacha'], body: 0.9, tannins: 0.75, acidity: 0.5, sweetness: 0.05, texture: null,
  effervescence: null, abv: 14.5, tasting_notes: ['Black cherry'], food_pairings: ['Lamb'], price_usd: 40, description: 'A test wine.',
};

async function user(context, page, { experience = 'casual', seed = {}, label } = {}) {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_prefs: JSON.stringify({ experience, types: ['red'] }), vinterest_detail_intro: '1', vinterest_wineDNA_unlock_seen: '1', ...seed });
  await stubNetwork(context, { detail: 'real', claudeText: (b) => (b.purpose === 'label_scan' && label ? JSON.stringify(label) : '') });
}

test('where each experience answer starts, how learning moves it up, and that it never comes down', async ({ context, page }) => {
  await user(context, page);
  await page.goto(`${BASE}/?demo=1#home`);
  const r = await page.evaluate(() => {
    const out = {};
    const set = (e) => UserPrefs.set('experience', e);
    ['novice', 'casual', 'enthusiast', 'expert'].forEach((e) => { set(e); out[e] = DetailLevel.level(); });
    set('casual');
    const wines = WineHistory.getAll(), few = wines.slice(0, 4);
    // Learning leads: 25% Mastery is More; 19 wines add 9 points, so 16% is enough with them, not without.
    out.m25 = DetailLevel.earnedNow(few, 25); out.m15few = DetailLevel.earnedNow(few, 16); out.m15many = DetailLevel.earnedNow(wines, 16);
    // Everything needs 50% Mastery and 15 scored wines.
    out.all50few = DetailLevel.earnedNow(few, 50); out.all50many = DetailLevel.earnedNow(wines, 50);
    DetailLevel.check(wines, 30); out.afterRise = DetailLevel.level();
    DetailLevel.check(wines, 0); out.afterFade = DetailLevel.level();
    // Kept per answer: another answer has its own level, and coming back keeps the earned one.
    set('novice'); out.novice = DetailLevel.level(); set('casual'); out.backToCasual = DetailLevel.level();
    DetailLevel.setShowAll(true); out.showAll = DetailLevel.level(); DetailLevel.setShowAll(false);
    return out;
  });
  expect(r).toEqual({ novice: 'simple', casual: 'simple', enthusiast: 'more', expert: 'everything', m25: 1, m15few: 0, m15many: 1,
    all50few: 1, all50many: 2, afterRise: 'more', afterFade: 'more', novice: 'simple', backToCasual: 'more', showAll: 'everything' });
});

test('WineDNA at Simple: a portrait in pictures, the useful rows, a line on value; Show all details opens the rest', async ({ context, page }) => {
  const errors = collectErrors(page);
  await user(context, page);
  await page.goto(`${BASE}/?demo=1#profile`);
  const root = page.locator('#root');
  await expect(page.getByTestId('dna-taste-tiles')).toBeVisible();
  await expect(page.getByTestId('dna-taste-tiles')).toContainText('Body');
  await expect(page.getByTestId('dna-flavours')).toBeVisible();
  await expect(page.getByTestId('dna-best-value')).toBeVisible();
  await expect(root).toContainText('Your “House” Wines');
  await expect(root).toContainText('Explore');
  for (const later of ['How Well We Know You', 'Your Journey', 'Flavour Signatures', 'Taste Profile', 'Your rating at each price']) await expect(root).not.toContainText(later);
  await expect(page.getByTestId('dna-love-avoid')).toHaveCount(0);
  // A taste tile opens WineDNA's own page for that trait: the wines they choose on its scale and
  // what the word means, never the palate page's Blind Call scoring.
  await page.getByTestId('dna-taste-tiles').locator('[data-trait="body"]').click();
  await expect(page).toHaveURL(/#dna-trait/);
  await expect(page.getByTestId('dna-trait-hero')).toContainText('The reds you choose');
  // Five steps along the scale with a verdict; the list follows the step picked, best first.
  const steps = page.getByTestId('dna-trait-steps');
  await expect(steps.locator('[aria-pressed]')).toHaveCount(5);
  await expect(page.getByTestId('dna-trait-verdict')).toContainText(/Your best ratings are in|Most of your reds sit in/);
  // What the word means and how to notice it come first, above their chart and bottles.
  const top = async (id) => page.getByTestId(id).evaluate((e) => e.getBoundingClientRect().top);
  expect(await top('dna-trait-about')).toBeLessThan(await top('dna-trait-hero'));
  expect(await top('dna-trait-hero')).toBeLessThan(await top('dna-trait-steps'));
  await expect(page.getByTestId('dna-trait-about')).toContainText('How to notice it');
  // A short explainer: the rest is folded behind "More about body", and the chart starts on the first screen.
  await expect(page.getByTestId('dna-trait-about')).not.toContainText('Tip:');
  expect(await top('dna-trait-steps')).toBeLessThan(page.viewportSize().height);
  await page.getByTestId('dna-trait-about').getByText('More about body').click();
  await expect(page.getByTestId('dna-trait-about')).toContainText('Tip:');
  const listed = async () => page.getByTestId('dna-trait-bottles').getByRole('button').filter({ hasNotText: /^Show (\d+ more|less)/ }).allInnerTexts();
  const first = await listed();
  expect(first.length).toBeGreaterThan(0);
  const scores = first.map((t) => Number((t.match(/(\d+)\s*$/) || [])[1] || 0));
  expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  // The best five, the rest behind "Show N more".
  const fullest = await steps.locator('[aria-pressed="true"]').getAttribute('aria-label');
  const n = Number(fullest.match(/(\d+)$/)[1]);
  expect(first.length).toBe(Math.min(n, 5));
  expect(n, 'the sample user needs a step of more than 5 to test Show more').toBeGreaterThan(5);
  {
    await page.getByTestId('dna-trait-bottles').getByText(`Show ${n - 5} more`).click();
    expect((await listed()).length).toBe(n);
  }
  const other = steps.locator('[aria-pressed="false"]').filter({ hasNotText: /^0/ }).first();
  await other.click();
  await expect.poll(listed).not.toEqual(first);
  await expect(root).toContainText('How to notice it');
  for (const blind of ['Blind Call', 'on target', 'calls']) await expect(root).not.toContainText(blind);
  await page.goBack();
  await expect(page).toHaveURL(/#profile/);
  await page.getByTestId('dna-more-later').getByText('Show all details').click();
  await expect(root).toContainText('How Well We Know You');
  await expect(root).toContainText('Flavour Signatures');
  await expect(page.getByTestId('dna-love-avoid')).toBeVisible();
  await expect(page.getByTestId('dna-more-later')).toHaveCount(0);
  expect(await page.evaluate(() => DetailLevel.showAll())).toBe(true);
  expect(errors).toEqual([]);
});

test('WineDNA at More adds How Well We Know You and Journey, still not Flavour Signatures', async ({ context, page }) => {
  await user(context, page, { experience: 'enthusiast' });
  await page.goto(`${BASE}/?demo=1#profile`);
  const root = page.locator('#root');
  await expect(root).toContainText('How Well We Know You');
  await expect(root).not.toContainText('Flavour Signatures');
  await expect(page.getByTestId('dna-best-value')).toBeVisible();
  // Folded rows carry a picture beside their line: a target and the journey's bars.
  await expect(page.getByTestId('dna-target')).toBeVisible();
  expect(await page.getByTestId('dna-target').locator('circle').count()).toBeGreaterThan(8);
  await expect(page.getByTestId('dna-journey-bars')).toBeVisible();
  // Show all: Value opens on their score at each price, names the band they score best in, and a
  // tapped band lists its bottles.
  await page.getByTestId('dna-more-later').getByText('Show all details').click();
  await page.locator('[data-section="value"]').click().catch(() => {});
  const v = await page.evaluate(() => WineDNA.profile('red', WineHistory.getAll(), 'Reds').value);
  expect(v.bands.length).toBeGreaterThan(1);
  expect(v.bands.reduce((s, b) => s + b.n, 0)).toBe(v.n);
  // History: their places most first, each with its average, and untried places that grow their grapes.
  const pl = await page.evaluate(() => WineDNA.profile('red', WineHistory.getAll(), 'Reds').places);
  expect(pl.list.length).toBeGreaterThan(1);
  expect(pl.list[0].n).toBeGreaterThanOrEqual(pl.list[pl.list.length - 1].n);
  pl.next.forEach((x) => expect(pl.list.map((y) => y.name)).not.toContain(x.name));
});

test('WineDNA says what it is: a first-visit card until read, and one line always', async ({ context, page }) => {
  await user(context, page);
  await page.goto(`${BASE}/?demo=1#profile`);
  await expect(page.getByTestId('dna-intro')).toContainText("Your taste, worked out from the");
  await expect(page.getByTestId('dna-welcome')).toContainText('What is WineDNA?');
  await page.getByTestId('dna-welcome').getByText('Got it').click();
  await expect(page.getByTestId('dna-welcome')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('dna-intro')).toBeVisible();
  await expect(page.getByTestId('dna-welcome')).toHaveCount(0);
});

test('Value and History at Everything: price bands with a named best band; places with their pages', async ({ context, page }) => {
  await user(context, page, { experience: 'expert' });
  await page.goto(`${BASE}/?demo=1#profile`);
  await expect(page.getByTestId('dna-band-bars').first()).toBeVisible();
  const card = page.getByTestId('dna-band-bars').filter({ has: page.locator('[aria-pressed]') });
  await expect(page.getByTestId('dna-value-verdict')).toContainText('Your best ratings come from');
  const before = await page.getByTestId('dna-band-bottles').innerText();
  await card.locator('[aria-pressed="false"]').first().click();
  await expect.poll(() => page.getByTestId('dna-band-bottles').innerText()).not.toBe(before);
  await expect(page.getByTestId('dna-places')).toBeVisible();
  await page.getByTestId('dna-places').getByRole('button').first().click();
  await expect(page).toHaveURL(/#region-page/);
});

test('the scan result at Simple: the top reason either way, and "Why N%?" waits for More; the cards open on their main line', async ({ context, page }) => {
  await user(context, page, { label: PRIORAT, seed: { vinterest_scan_path: JSON.stringify({ deck: 0, quick: 5 }) } });
  await page.goto(`${BASE}/?demo=1#camera`);
  await page.getByTestId('scan-file').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
  const root = page.locator('#root');
  await expect(root).toContainText('Learn about it');
  const brief = root.locator('[data-brief="1"]').first();
  await expect(brief).toBeVisible();
  expect(await brief.locator(':scope > div').count()).toBeLessThanOrEqual(2);
  await expect(root).not.toContainText(/Why \d+%\?/);
  // The deck: the match card's reasons are brief, with More for the rest.
  await root.getByText('Learn about it', { exact: true }).click();
  await expect(root).toContainText('How we got this');
  const mores = root.locator('[data-card-more]');
  const n = await mores.count();
  if (n) { await mores.first().click(); await expect(mores).toHaveCount(n - 1); }
});

test('a rise is told once as a moment card, and someone who used the app before levels gets one explanation', async ({ context, page }) => {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_prefs: JSON.stringify({ experience: 'casual', types: ['red'] }), vinterest_wineDNA_unlock_seen: '1' });
  await stubNetwork(context, { detail: 'real' });
  await page.goto(`${BASE}/?demo=1#home`);
  const card = page.getByTestId('moment-card');
  await expect(card).toContainText('Vinterest keeps it simple for now');
  await card.getByRole('button', { name: 'Dismiss' }).click();
  // Learning lifts them to More: told once, on a calm screen.
  await page.evaluate(() => { const real = KnowledgeMap.compute.bind(KnowledgeMap); KnowledgeMap.compute = (w) => ({ ...real(w), overall: 30 }); });
  await page.locator('#root').getByText('Learn', { exact: true }).last().click();
  await expect(card).toContainText('Your WineDNA shows more now');
  expect(await page.evaluate(() => DetailLevel.level())).toBe('more');
});

test('Profile: the experience answer says what it changes, and "Show all details" switches every screen to full', async ({ context, page }) => {
  await user(context, page);
  await page.goto(`${BASE}/?demo=1#account`);
  const sw = page.getByTestId('detail-switch');
  await expect(sw).toContainText('You see the essentials now; more opens as you learn.');
  await sw.getByRole('switch', { name: 'Show all details' }).click();
  await expect(sw).toContainText('Every screen shows its full detail.');
  expect(await page.evaluate(() => [DetailLevel.showAll(), DetailLevel.level()])).toEqual([true, 'everything']);
});

test('onboarding: the experience question previews what each answer shows', async ({ context, page }) => {
  await makeDeterministic(page);
  await stubNetwork(context, { detail: 'real' });
  await page.goto(`${BASE}/`);
  await page.evaluate(() => { location.hash = '#home'; });
  const html = await page.evaluate(() => {
    const out = {};
    ['casual', 'enthusiast', 'expert'].forEach((e) => {
      const host = document.createElement('div'); document.body.appendChild(host);
      ReactDOM.flushSync(() => ReactDOM.createRoot(host).render(React.createElement(DetailPreview, { exp: e })));
      out[e] = [host.querySelector('[data-testid="detail-preview"]').dataset.level, (host.textContent.match(/Opens as you learn/gi) || []).length, (host.textContent.match(/What to try next|Your best value/g) || []).length];
    });
    return out;
  });
  expect(html).toEqual({ casual: ['simple', 1, 2], enthusiast: ['more', 1, 2], expert: ['everything', 0, 2] });
});
