// Learn shelf pieces are written for one reader: titles don't repeat a template across regions,
// comparisons are like with like, every card says which of their wines it came from, and the
// article prompt carries their own bottles, scores, prices and WineDNA.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';
const red = (name, region, rating, extra = {}) => ({ name, region, country: 'Spain', type: 'red', grapes: ['Tempranillo'], rating, body: 0.7, tannins: 0.6, acidity: 0.6, sweetness: 0.05, scanned_at: '2026-06-01T12:00:00Z', ...extra });
const WINES = [
  red('Gran Reserva 904', 'Rioja Alta', 95, { vintage: 2015, price_paid: { amount: 90, code: 'GBP' }, buy_again: true, tasted: { body: 1 } }),
  red('Viña Ardanza', 'Rioja', 91),
  red('Muga Reserva', 'Rioja', 88),
  red('Chianti Classico Riserva', 'Tuscany', 90, { country: 'Italy', grapes: ['Sangiovese'] }),
  red('Clos Mogador', 'Priorat', 93, { grapes: ['Grenache'] }),
  { name: 'Veuve Clicquot Brut', region: 'Champagne', country: 'France', type: 'sparkling', grapes: ['Chardonnay'], rating: 89, scanned_at: '2026-06-02T12:00:00Z' },
  { name: 'Cloudy Bay Sauvignon Blanc', region: 'Marlborough', country: 'New Zealand', type: 'white', grapes: ['Sauvignon Blanc'], rating: 87, scanned_at: '2026-06-03T12:00:00Z' },
];

async function user(context, page, opts = {}) {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk', vinterest_country: 'United Kingdom',
    vinterest_prefs: JSON.stringify({ types: ['red'], budget: 'mid', experience: 'casual' }), vinterest_wines: JSON.stringify(WINES), ...(opts.seed || {}) });
  await stubNetwork(context, opts);
}

test('new regions get different kinds of piece, and only compare like with like', async ({ context, page }) => {
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  const stubs = await page.evaluate(() => {
    localStorage.removeItem('vinterest_gen_stubs');
    return ContentEngine.refreshShelf(WineHistory.getAll(), 6).filter((s) => s.slots.region).map((s) => ({ a: s.archetypeId, title: s.title, sub: s.subtitle, b: s.slots.regionB || null, r: s.slots.region }));
  });
  expect(stubs.length).toBe(5);
  // Five regions, four kinds of region piece: no kind used more than twice, none titled "Beyond".
  const counts = {}; stubs.forEach((s) => { counts[s.a] = (counts[s.a] || 0) + 1; });
  expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(2);
  expect(stubs.every((s) => !/Beyond/.test(s.title))).toBe(true);
  // Only reds are compared with Rioja; Champagne and Marlborough have nothing of their kind to compare with.
  stubs.filter((s) => s.a === 'beyond_region').forEach((s) => {
    expect(['Tuscany', 'Priorat']).toContain(s.r);
    expect(s.title).toBe(`From Rioja to ${s.r}`);
  });
  expect(stubs.find((s) => s.r === 'Champagne').b).toBeNull();
});

test('an old shelf of repeated "Beyond Rioja" pieces heals, but a read one stays', async ({ context, page }) => {
  const old = (region, id) => ({ id, archetypeId: 'beyond_region', iconName: 'globe', readTime: '3 min', title: `Beyond Rioja: The ${region} Difference`, subtitle: 'x', slots: { region, regionB: 'Rioja', country: 'France' } });
  const shelf = [old('Chablis', 'a1'), old('Champagne', 'a2'), old('Marlborough', 'a3'), old('Tuscany', 'a4')];
  await user(context, page, { seed: { vinterest_gen_stubs: JSON.stringify(shelf), vinterest_gen_article_a1_done: '1' } });
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate(() => ContentEngine.shelf(WineHistory.getAll()).map((s) => ({ id: s.id, a: s.archetypeId, title: s.title })));
  expect(out[0]).toEqual({ id: 'a1', a: 'beyond_region', title: 'From Rioja to Chablis' });
  expect(out.slice(1).map((s) => s.a)).not.toContain('beyond_region');
  expect(new Set(out.slice(1).map((s) => s.a)).size).toBe(3);
  // Tuscany is red, so it could still compare with Rioja; it just isn't a repeat any more.
  expect(out.filter((s) => /Rioja to/.test(s.title)).length).toBe(1);
});

test('articles say whose they are, and the prompt knows the reader', async ({ context, page }) => {
  const errors = collectErrors(page);
  const claudeRequests = [];
  const article = { forYou: 'You scored Gran Reserva 904 a 95 and paid £90: this is why it tasted that way.', sections: [{ term: 'Tempranillo', iconName: 'grape', plain: 'Your grape.', detail: 'Detail.', examples: ['One'] }, { term: 'Your next bottle', iconName: 'compass', plain: 'Try Ribera.', detail: 'Detail.', examples: [] }] };
  await user(context, page, { claudeRequests, claudeText: (b) => (b.purpose === 'learn_article' ? JSON.stringify(article) : '') });
  await page.goto(`${BASE}/#home`);
  const stub = await page.evaluate(() => {
    const s = { id: 'ev_region_Rioja_palate_vs_textbook', archetypeId: 'palate_vs_textbook', iconName: 'compass', readTime: '3 min', title: 'Rioja vs. the Textbook', subtitle: 's', brief: 'b', slots: { region: 'Rioja' }, facts: 'f' };
    sessionStorage.setItem('vinterest_gen_article', JSON.stringify(s));
    return { because: ContentEngine.because(s), brief: ContentEngine.readerBrief(s) };
  });
  expect(stub.because).toBe('Because you gave Gran Reserva 904 a 95');
  expect(stub.brief).toContain('Gran Reserva 904 2015 (Rioja Alta), scored 95, Outstanding, paid £90, would buy again, they found it fuller than the label suggested');
  expect(stub.brief).toContain('Muga Reserva');
  expect(stub.brief).toContain('Their WineDNA for reds');
  expect(stub.brief).toContain('What they usually spend');

  await page.goto(`${BASE}/#gen-article`);
  const root = page.locator('#root');
  await expect(root).toContainText('Written for you');
  await expect(root).toContainText('Because you gave Gran Reserva 904 a 95.');
  await expect(root).toContainText('You scored Gran Reserva 904 a 95 and paid £90');
  await expect(root).toContainText('Your next bottle');
  const prompt = claudeRequests.find((r) => r.purpose === 'learn_article').messages[0].content;
  expect(prompt).toContain('About this reader');
  expect(prompt).toContain('Gran Reserva 904 2015');
  expect(prompt).not.toMatch(/\{\{\w+\}\}/);
  // Cached with the forYou line, so reopening doesn't call Claude again.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vinterest_gen_article_ev_region_Rioja_palate_vs_textbook_content')).forYou)).toContain('Gran Reserva 904');
  expect(errors).toEqual([]);
});

test('Written for you shows on the Learn shelf, WineDNA and the wine detail Learn tab', async ({ context, page }) => {
  await user(context, page, { seed: { vinterest_prefs: JSON.stringify({ types: ['red'], budget: 'mid', experience: 'enthusiast' }) } });
  await page.goto(`${BASE}/#home`);
  await page.evaluate(() => { localStorage.removeItem('vinterest_gen_stubs'); ContentEngine.refreshShelf(WineHistory.getAll(), 6); });
  await page.goto(`${BASE}/#learn`);
  const root = page.locator('#root');
  await expect(root).toContainText('Nobody else gets the same article.');
  await expect(root).toContainText('Because you gave Gran Reserva 904 a 95');

  await page.goto(`${BASE}/#profile`);
  await expect(root).toContainText('Written from your WineDNA');

  await page.evaluate((w) => sessionStorage.setItem('vinterest_scan_result', JSON.stringify({ wine: w })), WINES[0]);
  await page.goto(`${BASE}/#detail`);
  await root.getByText('Learn', { exact: true }).first().click();
  await expect(root).toContainText('Keep learning');
  await expect(root).toContainText('written from your WineDNA');
});

test('a white grape piece draws on their whites, never their reds', async ({ context, page }) => {
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate(() => {
    const pg = { id: 'g1', archetypeId: 'grape_unlock_intro', slots: { grape: 'Pinot Grigio' } };
    const none = { brief: ContentEngine.readerBrief(pg), because: ContentEngine.because(pg) };
    // A bottle labelled Pinot Gris is the same grape.
    const all = WineHistory.getAll();
    all.push({ name: 'Trimbach Pinot Gris', region: 'Alsace', country: 'France', type: 'white', grapes: ['Pinot Gris'], rating: 90, body: 0.6, acidity: 0.6, scanned_at: '2026-06-04T12:00:00Z' });
    WineHistory.save(all);
    const one = { brief: ContentEngine.readerBrief(pg), because: ContentEngine.because(pg) };
    const entering = ContentEngine.readerBrief({ id: 't', archetypeId: 'new_type_entry', slots: { type: 'White' } });
    return { none, one, entering };
  });
  expect(out.none.because).toBe('Because you unlocked Pinot Grigio');
  expect(out.none.brief).not.toMatch(/reds|Tempranillo|Gran Reserva/);
  expect(out.none.brief).not.toContain('Cloudy Bay');
  expect(out.none.brief).toContain('WineDNA for whites');
  expect(out.one.because).toBe('Because you gave Trimbach Pinot Gris a 90');
  expect(out.one.brief).toContain('Trimbach Pinot Gris (Alsace), scored 90');
  expect(out.one.brief).not.toMatch(/reds|Gran Reserva/);
  // "Entering white" is about the contrast, so it does get what they mostly drink.
  expect(out.entering).toContain('What they mostly drink (reds)');
});

test('a piece about a type they have never had says so instead of borrowing another type', async ({ context, page }) => {
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  const brief = await page.evaluate(() => {
    WineHistory.save(WineHistory.getAll().filter((w) => w.type !== 'white'));
    return ContentEngine.readerBrief({ id: 'g2', archetypeId: 'grape_unlock_intro', slots: { grape: 'Riesling' } });
  });
  expect(brief).toContain('They have no bottles on this subject yet');
  expect(brief).toContain("They haven't had any whites yet");
  expect(brief).not.toMatch(/reds|Gran Reserva/);
});
