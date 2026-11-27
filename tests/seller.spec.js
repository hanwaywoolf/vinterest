// Vinterest Seller (docs/seller.md): the visit brief for Eloise against Authentic Wines & Spirits' Ontario catalogue.
const { test, expect } = require('@playwright/test');

async function open(page, vp) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (vp) await page.setViewportSize(vp);
  await page.goto('http://localhost:4173/seller/');
  await page.waitForSelector('[data-testid=seller-brief]');
  return errors;
}

test('the brief opens on Eloise with openings, a shortlist and no errors', async ({ page }) => {
  const errors = await open(page, { width: 1440, height: 900 });
  // The agency's own logo sits top right.
  await expect(page.getByTestId('seller-agency')).toHaveAttribute('aria-label', /Authentic Wines & Spirits/);
  expect(await page.getByTestId('seller-agency').locator('img').evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
  await expect(page.getByTestId('seller-fact')).toContainText("Eloise's list leaves");
  expect(await page.getByTestId('seller-opening').count()).toBeGreaterThan(5);
  // The wine of ours that Eloise already lists is found, with the one multiple that isn't an estimate.
  await expect(page.getByTestId('seller-ours')).toContainText('Rosso di Orma');
  await expect(page.getByTestId('seller-ours')).toContainText('$87');
  expect(errors).toEqual([]);
});

test('the matching holds its rules', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const M = SellerMatch, all = M.all(), by = (cspc) => all.find((f) => f.item.cspc === cspc), short = M.shortlist();
    const houses = {}; short.forEach((f) => { const h = f.item.supplier || f.item.producer; houses[h] = (houses[h] || 0) + 1; });
    return {
      n: all.length, short: short.map((f) => ({ cspc: f.item.cspc, score: f.score, fills: f.fills.length, reasons: f.reasons.map((x) => x.basis) })),
      maxHouse: Math.max(...Object.values(houses)),
      cheap: by('321448').out, // Cono Sur Bicicleta Chardonnay, $9.65: far under their cheapest white
      ours: by('113778').out, // Rosso di Orma: already on the list
      spirit: by('21976').out, // Benromach 10
      cristal3L: by('93062').out,
      port: by('157586'), brut: by('224766'),
      sorted: all.every((f, i) => !i || all[i - 1].score >= f.score),
      touched: Object.keys(localStorage).filter((k) => k.startsWith('vbiz_')).length,
    };
  });
  expect(r.n).toBe(110);
  expect(r.short.length).toBeGreaterThanOrEqual(5);
  // Every shortlisted bottle fills an opening, and every reason says what it rests on.
  for (const f of r.short) { expect(f.fills).toBeGreaterThan(0); expect(f.reasons.every((b) => ['list', 'sheet', 'estimate'].includes(b))).toBe(true); }
  expect(r.maxHouse).toBeLessThanOrEqual(2);
  expect(r.cheap).toContain('Too cheap');
  expect(r.ours).toBe('Already on their list');
  expect(r.spirit).toContain('spirit');
  expect(r.cristal3L).toBeTruthy();
  // The list has no fortified wine and two desserts that want one; the Niagara traditional-method sparkling fits the
  // gap in their sparkling prices.
  expect(r.port.out).toBeNull(); expect(r.port.fills.some((o) => o.kind === 'dish')).toBe(true);
  expect(r.brut.fills.some((o) => o.kind === 'ladder')).toBe(true);
  expect(r.sorted).toBe(true);
  // Seller keeps the prospect in memory: nothing of Teams' on this device is written.
  expect(r.touched).toBe(0);
});

test('every tab draws, and a phone has no sideways scroll', async ({ page }) => {
  const errors = await open(page, { width: 390, height: 844 });
  for (const [tab, id] of [['shortlist', 'seller-shortlist'], ['catalogue', 'seller-catalogue'], ['sheet', 'seller-sheet'], ['brief', 'seller-brief']]) {
    await page.getByTestId('seller-tab-' + tab).click();
    await expect(page.getByTestId(id)).toBeVisible();
    const over = await page.evaluate(() => { const s = document.querySelector('[data-scroll]'); return s.scrollWidth - s.clientWidth; });
    expect(over, tab).toBeLessThanOrEqual(1);
  }
  await page.getByTestId('seller-tab-shortlist').click();
  expect(await page.getByTestId('seller-bottle').count()).toBeGreaterThanOrEqual(5);
  expect(await page.getByTestId('seller-reason').count()).toBeGreaterThan(2); // the first bottle opens on its full pitch
  expect(await page.getByTestId('seller-sheet-fit').count()).toBe(0);
  await page.getByTestId('seller-tab-catalogue').click();
  await page.getByTestId('seller-filter-out').click();
  await expect(page.getByTestId('seller-row').first()).toBeVisible();
  await page.getByTestId('seller-tab-sheet').click();
  expect(await page.getByTestId('seller-sheet-row').count()).toBeGreaterThanOrEqual(5);
  expect(await page.getByTestId('seller-sheet-fit').count()).toBeGreaterThanOrEqual(5); // each fit colour-coded
  expect(errors).toEqual([]);
});

test('the openings filter by kind and fold away, and each says what the list has today', async ({ page }) => {
  await open(page, { width: 1440, height: 900 });
  const all = await page.getByTestId('seller-opening').count();
  await page.getByTestId('seller-open-glass').click();
  const glass = page.getByTestId('seller-opening');
  expect(await glass.count()).toBeLessThan(all);
  expect(await glass.evaluateAll((els) => els.every((e) => e.dataset.kind === 'glass'))).toBe(true);
  await expect(glass.first()).toContainText('Poured today');
  await page.getByTestId('seller-open-call').click();
  // A missing wine is described from their own list, not with one line repeated on every card.
  const facts = await page.getByTestId('seller-opening-fact').evaluateAll((els) => els.map((e) => e.textContent));
  expect(new Set(facts).size).toBeGreaterThan(facts.length / 2);
  await expect(page.getByTestId('seller-opening').first()).toContainText('Closest today');
  await page.getByTestId('seller-openings').getByTestId('seller-fold').click();
  await expect(page.getByTestId('seller-opening')).toHaveCount(0);
});

test('a bottle anywhere opens its wine card: the sheet, a taste profile, how to talk about it and its pitch here', async ({ page }) => {
  const errors = await open(page, { width: 1440, height: 900 });
  await page.route('**chgwebmedia**', (r) => r.abort()); // the catalogue's pictures are the agency's own host
  await page.getByTestId('seller-tab-catalogue').click();
  await page.getByTestId('seller-row').and(page.locator('[data-id="a-224766"]')).click(); // Château des Charmes Brut
  const card = page.getByTestId('seller-card');
  await expect(card).toContainText('Brut Méthode Traditionnelle');
  await expect(card).toContainText('Taste profile'); await expect(card).toContainText('How to talk about it'); await expect(card).toContainText('From the product sheet');
  await expect(card).toContainText('CSPC'); await expect(card).toContainText('224766');
  expect(await card.getByTestId('seller-talk').count()).toBeGreaterThanOrEqual(3);
  // Here: what it sells for by the bottle and the glass, each dish with why, and what they'll say back.
  await expect(card.getByTestId('seller-price-bottle')).toContainText('× cost'); await expect(card.getByTestId('seller-price-glass')).toContainText('a pour costs them');
  expect(await card.getByTestId('seller-pairing').count()).toBeGreaterThanOrEqual(3);
  expect(await card.getByTestId('seller-objection').count()).toBeGreaterThanOrEqual(2);
  // A wine that can't go on the list still has its card, saying why.
  await page.getByTestId('seller-card-close').click();
  await page.getByTestId('seller-filter-out').click(); await page.getByTestId('seller-row').first().click();
  await expect(page.getByTestId('seller-card-fit')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByTestId('seller-card')).toHaveCount(0);
  expect(errors.filter((e) => !/chgwebmedia|ERR_FAILED|Failed to load resource/.test(e))).toEqual([]);
});

test('the shortlist says one thing per bottle, prices the bottle and the glass, and folds', async ({ page }) => {
  await open(page, { width: 1440, height: 900 });
  const r = await page.evaluate(() => { const B = SellerMatch.brief(); return {
    says: B.shortlist.map((f) => f.pitch.say), opens: B.shortlist.map((f) => f.pitch.primary.k),
    // every dish a bottle is said to suit comes with a reason, and no two dishes of one bottle read the same
    pairs: B.shortlist.map((f) => f.pitch.pairings.map((x) => x.why)), story: B.shortlist.every((f) => f.pitch.story.length >= 3 && f.pitch.story.every((s) => s.t.length > 30)),
    abouts: SellerCatalogue.wines().map((i) => SellerMatch.about(i)),
    green: _sFit(100), red: _sFit(0), mid: _sFit(50) }; });
  // "In a sentence" is something to say out loud: no percentages, no doubled commas, one sentence.
  for (const a of r.abouts) { expect(a, a).not.toMatch(/%|,,|\d{2}/); expect(a.split('. ').length, a).toBe(1); expect(a.length, a).toBeLessThan(190); }
  expect(new Set(r.says).size).toBe(r.says.length);
  expect(new Set(r.opens).size).toBe(r.opens.length); // one bottle for each opening
  for (const ws of r.pairs) { expect(ws.every((w) => w.length > 15)).toBe(true); expect(new Set(ws).size).toBe(ws.length); }
  // Dish lines are short and each its own: no opening run of words is shared by most of a bottle's dishes.
  for (const ws of r.pairs.filter((x) => x.length >= 3)) { const starts = ws.map((w) => w.split(' ').slice(0, 6).join(' ')); expect(new Set(starts).size, starts.join(' | ')).toBeGreaterThan(ws.length / 2); expect(Math.max(...ws.map((w) => w.length))).toBeLessThan(170); }
  expect(r.story).toBe(true);
  // Fit runs from bright red at 0 through yellow to brilliant green at 100.
  expect(r.red).toContain('hsl(0,'); expect(r.mid).toContain('hsl(63,'); expect(r.green).toContain('hsl(125,');
  await page.getByTestId('seller-tab-shortlist').click();
  const first = page.getByTestId('seller-bottle').first();
  await expect(first.getByTestId('seller-say')).toBeVisible(); await expect(first.getByTestId('seller-prices')).toBeVisible();
  expect(await first.getByTestId('seller-story').count()).toBeGreaterThan(0);
  // The first bottle opens on its full pitch, the rest as summaries; the switch says which, and what the other holds.
  await expect(first).toHaveAttribute('data-view', 'full');
  const second = page.getByTestId('seller-bottle').nth(1);
  await expect(second).toHaveAttribute('data-view', 'summary'); await expect(second.getByTestId('seller-story')).toHaveCount(0);
  await expect(second.getByTestId('seller-bottle-fold')).toContainText('Show the full pitch'); await expect(second.getByTestId('seller-bottle-fold')).toContainText('dish');
  await second.getByTestId('seller-view-full').click(); expect(await second.getByTestId('seller-story').count()).toBeGreaterThan(0);
  await first.getByTestId('seller-bottle-fold').click();
  await expect(first.getByTestId('seller-story')).toHaveCount(0); await expect(first.getByTestId('seller-say')).toBeVisible(); await expect(first.getByTestId('seller-prices')).toBeVisible();
  await page.getByTestId('seller-all-summary').click(); await expect(page.getByTestId('seller-story')).toHaveCount(0);
  await page.getByTestId('seller-all-full').click(); expect(await page.getByTestId('seller-story').count()).toBeGreaterThan(8);
  // The tab says how many bottles are on it.
  await expect(page.getByTestId('seller-tab-shortlist')).toContainText(`(${r.says.length})`);
  await first.getByTestId('seller-bottle-name').click(); await expect(page.getByTestId('seller-card')).toBeVisible();
});
