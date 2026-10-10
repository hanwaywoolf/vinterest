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
// A swipe turns the page (left: on, right: back); a tap pauses.
async function swipe(page, dx) { await page.mouse.move(200, 500); await page.mouse.down(); await page.mouse.move(200 + dx / 2, 502, { steps: 3 }); await page.mouse.move(200 + dx, 504, { steps: 3 }); await page.mouse.up(); }
const next = (page) => swipe(page, -120);
const prev = (page) => swipe(page, 120);
const tap = (page) => page.mouse.click(300, 500);
async function playIt(page) { await page.getByTestId('reveal-tips').getByText('Play it').click(); }

test('the reveal tells the scan in order: label, match, taste, grape, place, a line to say, then what next', async ({ context, page }) => {
  const errors = collectErrors(page);
  const scene = await scan(context, page, RIOJA);
  const root = page.locator('#root');
  // The first couple of reveals open on how to drive it; the stage waits underneath.
  await expect(page.getByTestId('reveal-tips')).toContainText('Swipe left to move on, right to go back');
  await page.waitForTimeout(3000);
  await expect(scene).toHaveAttribute('data-scene', 'label');
  await playIt(page);
  await expect(scene).toContainText('Viña Real Gran Reserva 2016');
  await expect(scene).toContainText('CVNE');
  await expect(scene).toContainText('Tempranillo, Graciano · Rioja');
  // Where the vintage is in its life (ScanFlow.drinkWindow: an estimate from its style until the
  // Details tab has asked Claude), as a line from young to old with the window lit.
  await expect(page.getByTestId('reveal-window')).toContainText(/Still young|Drinking well now|Past its best/);
  await expect(page.getByTestId('reveal-window')).toContainText('a rough estimate from its style');
  await expect(page.getByTestId('reveal-foot')).toContainText('Personalised scan story · powered by Vinny');
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
  // Each trait says what the word means (Palate.HOW), and each note carries its family's sketch.
  await expect(scene).toContainText('Body is weight in the mouth');
  await expect(scene).toContainText('Tannin dries your gums');
  expect(await page.getByTestId('reveal-notes').locator('svg').count()).toBe(3);
  // The grape: its page's sketch with two callouts (skin and bunch), the checked line, and no
  // "usually" for a grape the label states.
  await next(page);
  await expect(scene).toHaveAttribute('data-scene', 'grape');
  await expect(scene).toContainText('Led by the grape');
  await expect(scene).toContainText('Tempranillo');
  await expect(page.getByTestId('grape-sketch')).toHaveAttribute('aria-label', 'Sketch of Tempranillo: Red-skinned: Thick, dark skins; Medium berries in a medium bunch.');
  expect(await page.getByTestId('grape-sketch').locator('path.rv-draw').count()).toBe(2);
  await expect(scene).toContainText('Medium-high tannin, red cherry and plum');
  await expect(scene).not.toContainText(/usual|Famous in/);
  // The place: the map opens on the country, closes in on the pin, and names it.
  await next(page);
  await expect(scene).toHaveAttribute('data-scene', 'place');
  await expect(page.getByTestId('reveal-map')).toContainText('Spain');
  await expect(page.getByTestId('reveal-map').locator('.rv-zoom')).toHaveCount(1);
  await expect(page.getByTestId('reveal-map').locator('text')).toHaveText('Rioja');
  await expect(scene).toContainText('Continental, tempered by the Atlantic');
  await expect(scene.locator('svg path').first()).toBeVisible();
  await next(page);
  await expect(scene).toHaveAttribute('data-scene', 'say');
  await expect(page.getByTestId('reveal-say-sketch').locator('path.rv-draw').first()).toBeVisible();
  await expect(scene).toContainText('Gran Reserva means it waited years in oak');
  // Everything is Poppins, nothing italic.
  expect(await page.evaluate(() => [...document.querySelectorAll('.rv-stage *')].filter((e) => e.textContent.trim() && e.children.length === 0).map((e) => getComputedStyle(e)).filter((cs) => !/Poppins/.test(cs.fontFamily) || cs.fontStyle === 'italic').length)).toBe(0);
  // A swipe right goes back; the end sheet's rows lead to the rating, the deck and saving.
  await prev(page);
  await expect(scene).toHaveAttribute('data-scene', 'place');
  await root.getByText('Skip', { exact: true }).click();
  await expect(scene).toHaveAttribute('data-scene', 'end');
  await expect(root).toContainText('What next?');
  await root.getByText('Learn more about this wine', { exact: true }).click();
  await expect(root).toContainText('1 / 9');
  // Coming back to the screen (the deck's back, or from Details) doesn't replay it.
  await page.reload();
  await expect(root).toContainText('What next?');
  await expect(page.getByTestId('reveal-scene')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('scenes move on by themselves, a held finger pauses, and the whole thing takes about fifteen seconds', async ({ context, page }) => {
  const scene = await scan(context, page, RIOJA, { seed: { vinterest_reveal_tips_v1: '2' } });
  await expect(page.getByTestId('reveal-tips')).toHaveCount(0); // the tip has had its two showings
  await expect(scene).toHaveAttribute('data-scene', 'label');
  const labelMs = await page.evaluate(() => [...document.querySelectorAll('[data-testid=reveal-progress] .rv-seg')].map((e) => parseInt(getComputedStyle(e).animationDuration) * 1000)[0]);
  await expect(scene).toHaveAttribute('data-scene', 'match', { timeout: labelMs + 1500 });
  const matchMs = await page.evaluate(() => [...document.querySelectorAll('[data-testid=reveal-progress] .rv-seg')].map((e) => parseInt(getComputedStyle(e).animationDuration) * 1000)[0]);
  // A tap pauses: the scene stays put well past its length; another tap carries on.
  await tap(page);
  await expect(page.getByTestId('reveal-paused')).toBeVisible();
  await page.waitForTimeout(matchMs + 1500);
  await expect(scene).toHaveAttribute('data-scene', 'match');
  await tap(page);
  await expect(page.getByTestId('reveal-paused')).toHaveCount(0);
  await expect(scene).toHaveAttribute('data-scene', 'taste', { timeout: matchMs + 2500 });
  // Each scene stays long enough to read its words (ScanFlow.revealLength), and the whole thing is
  // in the region of fifteen to twenty-five seconds for a wine with every scene.
  const lens = await page.evaluate((w) => {
    const d = ScanFlow.reveal(w, TasteMatch.assess(w, WineHistory.getAll()), { talk: ['Gran Reserva means it waited years in oak'] });
    return _revealScenes(d, 0).map((s) => [s.key, s.ms]);
  }, RIOJA);
  for (const [k, ms] of lens) if (k !== 'end') expect(ms, k).toBeGreaterThanOrEqual(2300);
  expect(await page.evaluate(() => ScanFlow.revealLength('one two three four five six seven eight nine ten') - ScanFlow.REVEAL_LEAD)).toBe(Math.round(10 * 60000 / 260));
  const total = lens.reduce((a, [, ms]) => a + ms, 0);
  expect(total).toBeGreaterThanOrEqual(15000);
  expect(total).toBeLessThanOrEqual(50000);
});

test('too early for a match it shows the meter; a wine the knowledge base lacks skips the grape and place', async ({ context, page }) => {
  const scene = await scan(context, page, FIZZ, { demo: false, gen: null, seed: { vinterest_onboarded: '1', vinterest_region: 'uk' } });
  await playIt(page);
  await expect(scene).toHaveAttribute('data-scene', 'label');
  await next(page);
  await expect(scene).toHaveAttribute('data-scene', 'match');
  await expect(scene).toContainText('It starts with your first rating');
  await expect(scene).toContainText('Rate 3 sparkling wines');
  await next(page);
  await expect(scene).toHaveAttribute('data-scene', 'taste');
  await expect(scene).toContainText('Lively'); // bubbles, not texture, for sparkling
  await next(page);
  // No knowledge-base grape or region, no Claude lines: straight to the end.
  await expect(scene).toHaveAttribute('data-scene', 'end');
  expect(await page.getByTestId('reveal-progress').locator('> div').count()).toBe(3);
});

test('the first bottle ends on its rating and carries on with onboarding', async ({ context, page }) => {
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
  await playIt(page);
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
  const scene = await scan(context, page, RIOJA, { seed: { vinterest_text_size: 'xl', vinterest_reveal_tips_v1: '2' } });
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

test('the drinking window and how sure the grape is: estimates from style, Claude\'s window once fetched, "usually" only for a guess', async ({ context, page }) => {
  await makeDeterministic(page);
  await stubNetwork(context);
  await page.goto(`${BASE}/?demo=1#home`);
  const out = await page.evaluate((w) => {
    const now = new Date(2026, 9, 10);
    const young = ScanFlow.drinkWindow({ ...w, vintage: 2025 }, now), ready = ScanFlow.drinkWindow(w, now), old = ScanFlow.drinkWindow({ ...w, vintage: 1990 }, now);
    const rose = ScanFlow.drinkWindow({ type: 'rosé', vintage: 2024, body: 0.3 }, now);
    const nv = ScanFlow.drinkWindow({ ...w, vintage: null }, now);
    Cache.set(ScanFlow.vintageKey(w), { peak_from: 2030, peak_to: 2040 });
    const claude = ScanFlow.drinkWindow(w, now);
    const line = (basis, shares) => WineDNA.grapeLine({ grapes: ['Tempranillo', 'Garnacha'], blend: true, grapes_basis: basis, grape_shares: shares }, { shares: true });
    return { young: [young.stage, young.word, young.source], ready: [ready.stage, ready.from <= 2026 && ready.to >= 2026], old: old.stage, rose: [rose.from, rose.to], nv,
      claude: [claude.stage, claude.from, claude.to, claude.source, claude.line],
      lines: [line('label'), line('known'), line('typical'), line('known', { Tempranillo: 80, Garnacha: 20 }), line('typical', { Tempranillo: 80, Garnacha: 20 })],
      words: GrapeInfo.lookWords(GrapeInfo.get('Tempranillo')) };
  }, RIOJA);
  expect(out.young).toEqual(['young', 'Still young', 'estimate']);
  expect(out.ready).toEqual(['ready', true]);
  expect(out.old).toBe('old');
  expect(out.rose).toEqual([2024, 2026]);
  expect(out.nv).toBeNull();
  expect(out.claude).toEqual(['young', 2030, 2040, 'claude', 'Best from 2030 to 2040']);
  expect(out.lines).toEqual(['Tempranillo, Garnacha', 'Tempranillo, Garnacha', 'Usually Tempranillo and Garnacha', 'Tempranillo 80%, Garnacha 20%', 'Usually Tempranillo and Garnacha']);
  expect(out.words).toEqual(['Red-skinned: Thick, dark skins', 'Medium berries in a medium bunch']);
});
