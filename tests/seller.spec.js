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
  // Seller's own logo top left (the Vinterest mark with SELLER under it), then whose visit this is.
  await expect(page.getByTestId('seller-logo')).toHaveAttribute('aria-label', 'Vinterest Seller'); await expect(page.getByTestId('seller-logo')).toContainText('SELLER');
  const box = (id) => page.getByTestId(id).boundingBox(), logo = await box('seller-logo'), agency = await box('seller-agency');
  expect(logo.x).toBeLessThan(60); expect(agency.x).toBeGreaterThan(1000);
  await expect(page.getByTestId('seller-venue')).toContainText('Visit brief'); await expect(page.getByTestId('seller-venue')).toContainText('Eloise');
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
  // A bottle nobody has written about shows its figures and dishes, and says no pitch is written: no filled-in phrases.
  await page.getByTestId('seller-card-close').click();
  await page.getByTestId('seller-row').and(page.locator('[data-id="a-419770"]')).click(); // Wines of Substance Cabernet
  await expect(page.getByTestId('seller-card').getByTestId('seller-unwritten')).toBeVisible();
  await expect(page.getByTestId('seller-card').getByTestId('seller-story')).toHaveCount(0);
  expect(await page.getByTestId('seller-card').getByTestId('seller-pairing').count()).toBeGreaterThan(0);
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
    says: B.shortlist.map((f) => f.pitch.say), opens: B.shortlist.map((f) => f.pitch.primary.k), written: B.shortlist.map((f) => f.pitch.written),
    pairs: B.shortlist.map((f) => f.pitch.pairings.map((x) => x.why)), story: B.shortlist.every((f) => f.pitch.story.length >= 3 && f.pitch.story.every((s) => s.t.length > 30)),
    // every piece of writing a rep is shown: the openings, and each bottle's line, pitch, dishes and objections
    texts: [...B.openings.filter((o) => o.wines.length).map((o) => o.fact), ...B.shortlist.flatMap((f) => [f.pitch.say, ...f.pitch.story.map((s) => s.t), ...f.pitch.pairings.map((x) => x.why), ...f.pitch.objections.flatMap((o) => [o.q, o.a])])],
    abouts: SellerCatalogue.wines().map((i) => SellerMatch.about(i)),
    green: _sFit(100), red: _sFit(0), mid: _sFit(50) }; });
  // Every shortlisted bottle has its pitch written, against the figures the engine gives today.
  expect(r.written.every(Boolean)).toBe(true);
  expect(new Set(r.says).size).toBe(r.says.length);
  expect(new Set(r.opens).size).toBe(r.opens.length); // one bottle for each opening
  for (const ws of r.pairs) expect(ws.every((w) => w && w.length > 15)).toBe(true);
  expect(r.story).toBe(true);
  // Nothing is said twice. The words are written, never a phrase with another wine's name dropped in: no run of
  // six words (figures aside) appears in two places anywhere in the brief.
  const seen = new Map(), repeats = [];
  r.texts.forEach((t, n) => { const ws = String(t).toLowerCase().replace(/[$\d.,×%]+/g, '#').replace(/[^a-zà-ÿ#' ]+/g, ' ').split(/\s+/).filter(Boolean);
    for (let i = 0; i + 6 <= ws.length; i++) { const k = ws.slice(i, i + 6).join(' '); if (seen.has(k) && seen.get(k) !== n) repeats.push(k); else seen.set(k, n); } });
  expect([...new Set(repeats)]).toEqual([]);
  // "In a sentence" is something to say out loud: no percentages, no doubled commas, one sentence.
  for (const a of r.abouts) { expect(a, a).not.toMatch(/%|,,|\d{2}/); expect(a.split('. ').length, a).toBe(1); expect(a.length, a).toBeLessThan(190); }
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

test('What to bring lists the bottles to taste, marked by fit, and the fit filter shrinks or grows it', async ({ page }) => {
  await open(page, { width: 1440, height: 900 });
  await page.getByTestId('seller-tab-bring').click();
  const rows = page.getByTestId('seller-bring-row'), scores = () => rows.evaluateAll((els) => els.map((e) => +e.dataset.score));
  const base = await scores();
  expect(base.length).toBeGreaterThan(3); expect(base.every((s) => s >= 55)).toBe(true);
  expect(base.every((s, i) => !i || base[i - 1] >= s)).toBe(true); // best fit first
  await page.getByTestId('seller-bring-70').click();
  const fewer = await scores(); expect(fewer.length).toBeLessThan(base.length); expect(fewer.every((s) => s >= 70)).toBe(true);
  await page.getByTestId('seller-bring-0').click();
  const more = await scores(); expect(more.length).toBeGreaterThan(base.length);
  await expect(page.getByTestId('seller-bring-count')).toContainText(String(more.length));
  // One bottle of each wine: no wine is carried twice in two sizes.
  const names = await page.evaluate(() => SellerMatch.bring(0).rows.map((r) => r.item.producer + '|' + r.item.name));
  expect(new Set(names).size).toBe(names.length);
  // A bottle can be ticked off as packed, and opens its wine card.
  await rows.first().getByTestId('seller-bring-pack').click(); await expect(rows.first().getByTestId('seller-bring-pack')).toHaveAttribute('aria-checked', 'true');
});

test('Vinny writes the brief: a few calls, checked before it is shown, beside the hand-written one', async ({ page }) => {
  await open(page, { width: 1440, height: 900 });
  // Eloise has both: the hand-written brief shows first, and Vinny's saved one is a pill away, whole.
  await expect(page.getByTestId('seller-writer-who')).toContainText('by hand');
  const hand = await page.evaluate(() => SellerMatch.brief().shortlist.map((f) => f.pitch.say));
  await page.getByTestId('seller-writer-vinny').click();
  await expect(page.getByTestId('seller-writer-who')).toContainText('Vinny');
  const saved = await page.evaluate(() => SellerMatch.brief().shortlist.map((f) => ({ say: f.pitch.say, written: f.pitch.written, story: f.pitch.story.length, dishes: f.pitch.pairings.every((p) => p.why) })));
  expect(saved.every((b) => b.written && b.story === 4 && b.dishes)).toBe(true);
  expect(saved.map((b) => b.say)).not.toEqual(hand);
  // Writing it again: the model is stubbed to answer each call with its own bottles, one of them carrying a price
  // the facts never gave, one a sentence lifted from another bottle, and figures of its own for `against`.
  const r = await page.evaluate(async () => {
    // Every other word a number, so no two fixture lines share a run of six words unless the test means them to.
    let calls = 0; const prompts = [], w = (words, n) => words.split(' ').map((x) => `${x} ${n}`).join(' ') + '.';
    window.claude = { complete: async ({ purpose, messages }) => { calls++; const text = messages[0].content; prompts.push(text);
      const ids = [...text.split('[[cache-above]]').pop().matchAll(/^BOTTLE (a-\d+):/gm)].map((m) => m[1]), out = { openings: {}, bottles: {} };
      if (/Openings to write: yes/.test(text)) SellerVinny.ctx().opens.forEach((o, n) => { out.openings[o.k] = w('opening on their list said plainly', 9000 + n); });
      ids.forEach((id) => { const f = SellerMatch.shortlist().find((x) => x.item.id === id), n = id.slice(2);
        out.bottles[id] = { against: { bottle: 1 }, say: id === 'a-353184' ? 'This one lands at $4321 on your list.' : w('answers a gap only this code names', n),
          story: [{ h: 'The wine', t: id === 'a-317057' ? 'Shared words that every single bottle would say again.' : id === 'a-677046' ? 'Shared words that every single bottle would say again.' : w('story told once for this wine alone', n), basis: 'sheet' }],
          dishes: Object.fromEntries(f.suits.map((s) => [s.dish.id, w('reason given for this dish only', n + s.dish.id.length)]).concat([['d-not-a-dish', 'Never kept.']])),
          objections: [{ q: `Why ${n}?`, a: w('because it is what you asked for', n) }] }; });
      return JSON.stringify(out); } };
    const res = await SellerVinny.write(), d = res.doc;
    return { calls, cached: prompts.every((p) => p.split('[[cache-above]]')[0] === prompts[0].split('[[cache-above]]')[0]), report: res.report, rioja: !!d.bottles['a-353184'],
      against: d.bottles['a-157586'].against.bottle === SellerMatch.shortlist().find((f) => f.item.id === 'a-157586').landing.bottle,
      stories: [d.bottles['a-317057'], d.bottles['a-677046']].map((b) => b.story.length), stray: Object.values(d.bottles).some((b) => 'd-not-a-dish' in b.dishes), quoted: d.bottles['a-157586'].objections[0].q, stored: Object.keys(localStorage).filter((k) => /seller/i.test(k)) }; });
  expect(r.calls).toBe(4); expect(r.cached).toBe(true); // two bottles a call, the same cached head on each
  expect(r.rioja).toBe(false); expect(r.report.missing).toEqual(['a-353184']); // a made-up price leaves the bottle unwritten
  expect(r.against).toBe(true); // the figures are the engine's, never the answer's
  expect(r.stories.sort()).toEqual([0, 1]); // the second use of a sentence is left out
  expect(r.stray).toBe(false); expect(r.quoted).toBe('"Why 157586?"'); expect(r.stored).toEqual([]);
  // The page now shows Vinny's, and says what the checks left out. The unwritten bottle shows its figures alone.
  await page.getByTestId('seller-writer-vinny').click();
  await page.getByTestId('seller-tab-shortlist').click();
  await expect(page.getByTestId('seller-shortlist')).toContainText('answers 157586 a 157586 gap');
  expect(await page.evaluate(() => SellerMatch.brief().shortlist.find((f) => f.item.id === 'a-353184').pitch.written)).toBe(false);
});
