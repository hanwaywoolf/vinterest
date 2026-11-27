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
  await expect(page.getByTestId('seller-agency')).toContainText('Authentic Wines & Spirits');
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
  expect(await page.getByTestId('seller-reason').count()).toBeGreaterThan(10);
  await page.getByTestId('seller-tab-catalogue').click();
  await page.getByTestId('seller-filter-out').click();
  await expect(page.getByTestId('seller-row').first()).toBeVisible();
  await page.getByTestId('seller-tab-sheet').click();
  expect(await page.getByTestId('seller-sheet-row').count()).toBeGreaterThanOrEqual(5);
  expect(errors).toEqual([]);
});
