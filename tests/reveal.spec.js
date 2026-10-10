// The post-scan reveal (ScanReveal, pwa-reveal.jsx): what a scan found, told in a few auto-playing
// scenes before the result. Every fact comes from ScanFlow.reveal.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const RIOJA = { name: 'Viña Real Gran Reserva', confidence: 'high', alternative: '', producer: 'CVNE', vintage: 2016, region: 'Rioja', sub_region: 'Rioja Alavesa',
  country: 'Spain', type: 'red', grapes: ['Tempranillo', 'Graciano'], blend: true, grapes_basis: 'label', body: 0.75, tannins: 0.6, acidity: 0.62, sweetness: 0.05, texture: null,
  effervescence: null, abv: 13.5, tasting_notes: ['dried cherry', 'leather', 'vanilla'], food_pairings: ['Lamb'], price_usd: 48, description: 'A test Rioja.' };
const FIZZ = { name: 'Test Pét-Nat', confidence: 'high', alternative: '', producer: '', vintage: null, region: 'Somewhere', sub_region: '', country: 'Narnia', type: 'sparkling',
  grapes: ['Mystery'], blend: false, grapes_basis: 'label', body: 0.4, tannins: null, acidity: 0.8, sweetness: 0.1, texture: null, effervescence: 0.6, abv: 11, tasting_notes: [], food_pairings: [], price_usd: 20, description: 'x' };
const GEN = { fact: 'CVNE was founded in 1879.', fit: 'x', caution: 'x', origin: 'x', region_style: 'x', estate: 'x', talk: ['Gran Reserva means it waited years in oak', 'x', 'x'], fact2: 'x' };

async function scan(context, page, label, { seed = {}, demo = true, gen = GEN } = {}) {
  await page.setViewportSize({ width: 390, height: 844 });
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_wineDNA_unlock_seen: '1', ...seed });
  await stubNetwork(context, { reveal: 'real', claudeText: (b) => b.purpose === 'label_scan' ? JSON.stringify(label) : b.purpose === 'scancard' && gen ? JSON.stringify(gen) : '' });
  await page.goto(`${BASE}/?demo=${demo ? 1 : 0}#camera`);
  await page.getByTestId('scan-file').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
  return page.getByTestId('reveal-scene');
}
const next = (page) => page.mouse.click(300, 500);
const prev = (page) => page.mouse.click(60, 500);

test('the reveal tells the scan in order: label, match, taste, grape, place, a line to say, then what next', async ({ context, page }) => {
  const errors = collectErrors(page);
  const scene = await scan(context, page, RIOJA);
  const root = page.locator('#root');
  await expect(scene).toHaveAttribute('data-scene', 'label');
  await expect(scene).toContainText('Viña Real Gran Reserva 2016');
  await expect(scene).toContainText('CVNE');
  await expect(scene).toContainText('Tempranillo, Graciano · Rioja');
  // The match: the real TasteMatch number and verdict, one reason for and one against.
  await next(page);
  await expect(scene).toHaveAttribute('data-scene', 'match');
  const want = await page.evaluate((w) => { const m = TasteMatch.assess(w, WineHistory.getAll()); return { pct: m.pct, label: m.label }; }, RIOJA);
  expect(want.pct).toBeGreaterThan(0);
  await expect(page.getByTestId('reveal-pct')).toHaveText(`${want.pct}%`, { timeout: 4000 });
  await expect(scene).toContainText(want.label);
  await expect(scene).toContainText('Rioja: you');
  // The traits in everyday words, from the label's figures, then the notes.
  await next(page);
  await expect(scene).toHaveAttribute('data-scene', 'taste');
  for (const t of ['Rich', 'Body', 'Gentle grip', 'Tannins', 'Fresh', 'Acidity', 'Dried cherry', 'Vanilla']) await expect(scene).toContainText(t);
  await expect(scene).not.toContainText('Texture');
  // The grape and the place, in the knowledge base's checked words, with the pin on the map.
  await next(page);
  await expect(scene).toHaveAttribute('data-scene', 'grape');
  await expect(scene).toContainText('Led by the grape');
  await expect(scene).toContainText('Tempranillo');
  await expect(scene).toContainText('Medium-high tannin, red cherry and plum');
  await expect(scene).toContainText('Famous in Rioja and Ribera del Duero');
  await next(page);
  await expect(scene).toHaveAttribute('data-scene', 'place');
  await expect(scene).toContainText('Rioja');
  await expect(scene).toContainText('Continental, tempered by the Atlantic');
  await expect(scene.locator('svg path').first()).toBeVisible();
  await next(page);
  await expect(scene).toHaveAttribute('data-scene', 'say');
  await expect(scene).toContainText('Gran Reserva means it waited years in oak');
  // A tap on the left goes back; the end sheet's rows lead to the rating, the deck and saving.
  await prev(page);
  await expect(scene).toHaveAttribute('data-scene', 'place');
  await root.getByText('Skip', { exact: true }).click();
  await expect(scene).toHaveAttribute('data-scene', 'end');
  await expect(root).toContainText('What next?');
  await root.getByText('Learn about it', { exact: true }).click();
  await expect(root).toContainText('1 / 9');
  // Coming back to the screen (the deck's back, or from Details) doesn't replay it.
  await page.reload();
  await expect(root).toContainText('What next?');
  await expect(page.getByTestId('reveal-scene')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('scenes move on by themselves, a held finger pauses, and the whole thing takes about fifteen seconds', async ({ context, page }) => {
  const scene = await scan(context, page, RIOJA);
  await expect(scene).toHaveAttribute('data-scene', 'label');
  await expect(scene).toHaveAttribute('data-scene', 'match', { timeout: 4000 });
  // Hold: the scene stays put well past its length.
  await page.mouse.move(300, 500); await page.mouse.down();
  await page.waitForTimeout(5200);
  await expect(scene).toHaveAttribute('data-scene', 'match');
  await page.mouse.up();
  await expect(scene).toHaveAttribute('data-scene', 'taste', { timeout: 5000 });
  const total = Object.values(await page.evaluate(() => REVEAL_MS)).reduce((a, b) => a + b, 0) - (await page.evaluate(() => REVEAL_MS.early));
  expect(total).toBeGreaterThanOrEqual(15000);
  expect(total).toBeLessThanOrEqual(21000);
});

test('too early for a match it shows the meter; a wine the knowledge base lacks skips the grape and place', async ({ context, page }) => {
  const scene = await scan(context, page, FIZZ, { demo: false, gen: null, seed: { vinterest_onboarded: '1', vinterest_region: 'uk' } });
  await expect(scene).toHaveAttribute('data-scene', 'label');
  await next(page);
  await expect(scene).toHaveAttribute('data-scene', 'match');
  await expect(scene).toContainText('It starts with your first score');
  await expect(scene).toContainText('Score 3 sparkling wines');
  await next(page);
  await expect(scene).toHaveAttribute('data-scene', 'taste');
  await expect(scene).toContainText('Lively'); // bubbles, not texture, for sparkling
  await next(page);
  // No knowledge-base grape or region, no Claude lines: straight to the end.
  await expect(scene).toHaveAttribute('data-scene', 'end');
  expect(await page.getByTestId('reveal-progress').locator('> div').count()).toBe(3);
});

test('the first bottle ends on its score and carries on with onboarding', async ({ context, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await makeDeterministic(page);
  await stubNetwork(context, { reveal: 'real', claudeText: (b) => b.purpose === 'label_scan' ? JSON.stringify(RIOJA) : '' });
  await page.goto(`${BASE}/`);
  const root = page.locator('#root');
  await root.getByText('Skip', { exact: true }).click();
  await root.getByText('Scan your first bottle').click();
  await root.getByText(/I'm over|I am over|over 18|legal drinking age/i).first().click().catch(() => {});
  await root.getByText(/^(Continue|Next)$/).first().click().catch(() => {});
  await page.getByTestId('scan-file').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
  const scene = page.getByTestId('reveal-scene');
  await expect(scene).toHaveAttribute('data-scene', 'label');
  await expect(root).toContainText('Your first bottle');
  await root.getByText('Skip', { exact: true }).click();
  await expect(scene).toHaveAttribute('data-scene', 'end');
  await expect(root).toContainText('Your WineDNA starts here');
  await root.getByText('90', { exact: true }).click();
  await root.getByText('Save rating').click();
  await root.getByText('Continue', { exact: true }).click();
  await expect(root).toContainText(/What do you|How much|Which wines|experience/i);
  expect(await page.evaluate(() => WineHistory.getAll().map((w) => [w.name, w.rating]))).toEqual([['Viña Real Gran Reserva', 90]]);
});

test('with reduced motion nothing moves on by itself, and at Extra large text nothing runs off the side', async ({ context, page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const scene = await scan(context, page, RIOJA, { seed: { vinterest_text_size: 'xl' } });
  await expect(scene).toHaveAttribute('data-scene', 'label');
  await page.waitForTimeout(3200);
  await expect(scene).toHaveAttribute('data-scene', 'label');
  for (let i = 0; i < 6; i++) {
    // The map's land is clipped by its box on purpose, so what's inside an overflow:hidden box is skipped.
    const bad = await page.evaluate(() => { const W = document.documentElement.clientWidth;
      const clipped = (e) => { for (let p = e.parentElement; p; p = p.parentElement) if (getComputedStyle(p).overflow === 'hidden' && p.className !== 'rv-stage') return true; return false; };
      return [...document.querySelectorAll('.rv-stage *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > W + 1 || r.left < -1) && !clipped(e); }).length; });
    expect(bad, `scene ${await scene.getAttribute('data-scene')}`).toBe(0);
    await next(page);
  }
  await expect(scene).toHaveAttribute('data-scene', 'end');
});
