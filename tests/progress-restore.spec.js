// A new install must not put someone back at square one on learning. A user who has studied
// (grapes and regions unlocked and quizzed, Wine Basics, guides, articles read, Blind Calls,
// milestones, weekly Mastery snapshots, XP) gets the same Learn, XP and Mastery back from a
// backup file, and from signing in on a fresh phone.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage } = require('./helpers');

const BASE = 'http://localhost:4173';
const SB = 'https://proj.supabase.co';
const USER = '11111111-2222-3333-4444-555555555555';
const SESSION = JSON.stringify({ access_token: 'tok', refresh_token: 'r', expires_at: Date.now() / 1000 + 86400, user: { id: USER, email: 'c@example.com' } });

// A month of studying, through the app's own modules.
function study() {
  const topics = ['climate', 'soil', 'harvest', 'oak', 'tannin', 'acidity', 'colour', 'aroma', 'ageing', 'food', 'history', 'law', 'price', 'bottle', 'cellar'];
  const facts = ['granite', 'limestone', 'clay', 'gravel', 'slate', 'chalk', 'sand', 'basalt', 'marl', 'loess', 'schist', 'flint', 'quartz', 'shale', 'tuff'];
  const bank = (name) => topics.map((t, i) => ({ q: `${name} ${t}?`, opts: [facts[i], facts[(i + 1) % 15] + 'x', facts[(i + 2) % 15] + 'y', facts[(i + 3) % 15] + 'z'], a: 0, d: i < 5 ? 'easy' : i < 10 ? 'medium' : 'hard' }));
  const wines = WineHistory.getAll();
  wines.forEach((w) => { try { GrapeUnlocks.unlockViaScan(w); } catch (e) {} });
  ['Rioja', 'Tuscany', 'Burgundy'].forEach((r) => RegionUnlocks.unlock(r));
  const old = Date.now() - 40 * 864e5;
  Object.keys(GrapeUnlocks.all()).forEach((g, i) => {
    Store.set(_grapeQuizCacheKey(g), JSON.stringify(bank(g)));
    (grapeQuizBank(g) || []).slice(0, 15 - i * 3).forEach((q) => QuizMastery.recordAnswer('grape:' + g, q.q, true, old));
  });
  Object.keys(RegionUnlocks.all()).forEach((r) => {
    Store.set(RegionQuizBank.key(r), JSON.stringify(bank(r)));
    (RegionQuizBank.get(r) || []).slice(0, 10).forEach((q) => QuizMastery.recordAnswer('region:' + r, q.q, true));
  });
  const stubs = [{ id: 'ev_read_one', title: 'Read' }, { id: 'ev_unread_one', title: 'Unread' }];
  Store.set('vinterest_gen_stubs', JSON.stringify(stubs));
  LearnProgress.markArticle('ev_read_one');
  QuizMastery.topicPool('red_grapes').forEach((q) => QuizMastery.recordAnswer('topic:red_grapes', q.q, true));
  Guides.markRead('taste_four_steps');
  Guides.pool('taste_four_steps').forEach((q) => QuizMastery.recordAnswer(Guides.setId('taste_four_steps'), q.q, true));
  LearnProgress.markOnRamp('what-is-body');
  wines.slice(0, 4).forEach((w, i) => ScanFlow.saveBlindResult(w, { guess: { body: 0.5 + i / 20, acidity: 0.6, tannins: 0.4 }, score: 70 + i }));
  XPSystem.award(['quiz_correct']);
  KnowledgeMap.note(KnowledgeMap.compute(), old);
  KnowledgeMap.note(KnowledgeMap.compute());
  Milestones.check(KnowledgeMap.compute(), Palate.compute(WineHistory.getAll()));
}

// A new phone whose first scan already unlocked a grape and region they'd studied: the app made
// its own question banks for them (different questions), and its own Written for you shelf.
function firstScanHere({ grape, region }) {
  const words = ['north', 'south', 'east', 'west', 'river', 'hill', 'coast', 'valley', 'plain', 'lake', 'forest', 'island', 'mountain', 'desert', 'delta'];
  const bank = (name) => words.map((w, i) => ({ q: `Fresh ${name} ${w} fact?`, opts: [w + '1', w + '2', w + '3', w + '4'], a: 0, d: 'easy' }));
  Store.set(_grapeQuizCacheKey(grape), JSON.stringify(bank(grape)));
  Store.set(RegionQuizBank.key(region), JSON.stringify(bank(region)));
  Store.set('vinterest_gen_stubs', JSON.stringify([{ id: 'ev_new_phone', title: 'New here' }]));
}

// Everything Learn, Mastery and the XP badge show.
function snapshot() {
  const wines = WineHistory.getAll();
  const m = KnowledgeMap.compute();
  const p = Palate.compute(wines);
  const prog = KnowledgeMap.progress(m);
  return {
    wines: wines.length,
    xp: XPSystem.get().total,
    overall: m.overall,
    areas: m.areas.map((a) => [a.id, a.score, a.level, (a.items || []).map((i) => [i.name, i.score])]),
    grapes: Object.keys(GrapeUnlocks.all()).sort(), regions: Object.keys(RegionUnlocks.all()).sort(),
    palate: p && [p.score, p.calls],
    milestones: Milestones.list().map((x) => x.id).sort(),
    then: prog && prog.then != null ? prog.overall : null,
    refreshers: KnowledgeMap.refreshers().map((r) => r.id || r.name),
    onramp: LearnProgress.onRampDone('what-is-body'),
    guideRead: !!Guides.get().read.taste_four_steps,
    stubs: (Store.getJSON('vinterest_gen_stubs', []) || []).map((x) => x.id).filter((id) => id !== 'ev_new_phone'),
  };
}

// `own`: the caller has already set up the page (network and clock) itself.
async function studiedPhone(context, page, own = false) {
  if (!own) { await makeDeterministic(page); await stubNetwork(context); }
  await page.goto(`${BASE}/?demo=1#home`);
  await page.waitForFunction(() => typeof KnowledgeMap !== 'undefined' && WineHistory.getAll().length > 5);
  await page.evaluate(study);
  const before = await page.evaluate(snapshot);
  expect(before.overall).toBeGreaterThan(5);
  expect(before.milestones.length).toBeGreaterThan(0);
  expect(before.grapes.length).toBeGreaterThan(1);
  expect(before.areas.find((a) => a[0] === 'grapes')[3].some((i) => i[1] > 0)).toBe(true);
  expect(before.areas.find((a) => a[0] === 'regions')[3].some((i) => i[1] > 0)).toBe(true);
  return before;
}

test('backup file onto a new install: Learn, XP and Mastery come back exactly', async ({ context, page }) => {
  const before = await studiedPhone(context, page);
  const file = await page.evaluate(() => JSON.stringify(Backup.exportData()));
  // A fresh install on another phone: nothing stored at all.
  const context2 = await page.context().browser().newContext({ serviceWorkers: 'block' });
  const fresh = await context2.newPage();
  await makeDeterministic(fresh);
  await stubNetwork(context2);
  await fresh.goto(`${BASE}/#home`);
  await fresh.waitForFunction(() => typeof Backup !== 'undefined');
  await fresh.evaluate((f) => { const r = Backup.read(f); Backup.apply(r.data); }, file);
  await fresh.reload();
  await fresh.waitForFunction(() => typeof KnowledgeMap !== 'undefined');
  expect(await fresh.evaluate(snapshot)).toEqual(before);
});

function fakeSupabase() {
  const db = { wines: new Map(), user_docs: new Map() };
  let last = 0;
  const stamp = () => { last = Math.max(Date.now(), last + 1); return new Date(last).toISOString(); };
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const rows = db[url.pathname.split('/').pop()];
    const keyOf = (r) => r.wine_key || r.doc_key;
    if (req.method() === 'GET') {
      let out = [...rows.values()];
      const gte = url.searchParams.get('updated_at');
      if (gte) out = out.filter((r) => r.updated_at >= gte.replace(/^gte\./, ''));
      out.sort((a, b) => (a.updated_at < b.updated_at ? -1 : 1));
      const offset = +(url.searchParams.get('offset') || 0), limit = +(url.searchParams.get('limit') || 1e9);
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(out.slice(offset, offset + limit)) });
    }
    for (const r of JSON.parse(req.postData() || '[]')) rows.set(keyOf(r), { ...r, updated_at: stamp() });
    return route.fulfill({ status: 201, body: '' });
  };
}

test('signing in on a new phone: Learn, XP and Mastery come back exactly', async ({ browser }) => {
  const server = fakeSupabase();
  const open = async (seed) => {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.addInitScript((sb) => { window.VINTEREST_SUPABASE = { url: sb, key: 'sb_publishable_test' }; }, SB);
    await seedLocalStorage(page, seed);
    await stubNetwork(context);
    await context.route(`${SB}/rest/v1/**`, server);
    await context.route('**/me', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ signedIn: true, tier: 'free', usage: {}, caps: {} }) }));
    return { context, page };
  };
  const a = await open({ vinterest_session: SESSION });
  const before = await studiedPhone(a.context, a.page, true);
  await a.page.evaluate(async () => { while (Sync._running) await Sync._running; return Sync.syncNow(); });
  // The new phone: only the sign-in, as the welcome screen's "Sign in" leaves it.
  const b = await open({ vinterest_session: SESSION });
  await b.page.goto(`${BASE}/#home`);
  await b.page.waitForFunction(() => typeof Sync !== 'undefined');
  expect(await b.page.evaluate(async () => { while (Sync._running) await Sync._running; return Sync.welcomeBack(); })).toEqual({ ok: true, returning: true });
  await b.page.reload();
  await b.page.waitForFunction(() => typeof KnowledgeMap !== 'undefined');
  expect(await b.page.evaluate(snapshot)).toEqual(before);
});

test('restoring after a first scan on the new phone: the banks their answers belong to win, and read pieces stay', async ({ context, page }) => {
  const before = await studiedPhone(context, page);
  const studied = { grape: before.areas.find((a) => a[0] === 'grapes')[3][0][0], region: 'Rioja' };
  const file = await page.evaluate(() => JSON.stringify(Backup.exportData()));
  const context2 = await page.context().browser().newContext({ serviceWorkers: 'block' });
  const fresh = await context2.newPage();
  await makeDeterministic(fresh);
  await stubNetwork(context2);
  await fresh.goto(`${BASE}/#home`);
  await fresh.waitForFunction(() => typeof Backup !== 'undefined');
  await fresh.evaluate(firstScanHere, studied);
  await fresh.evaluate((f) => { const r = Backup.read(f); Backup.apply(r.data); }, file);
  await fresh.reload();
  await fresh.waitForFunction(() => typeof KnowledgeMap !== 'undefined');
  const after = await fresh.evaluate(snapshot);
  expect(after).toEqual(before);
  // The phone's own new piece is still on its shelf beside the restored ones.
  expect(await fresh.evaluate(() => Store.getJSON('vinterest_gen_stubs', []).map((x) => x.id))).toEqual(['ev_new_phone', 'ev_read_one', 'ev_unread_one']);
});

test('signing in after a first scan on the new phone: progress comes back over the phone\'s own banks', async ({ browser }) => {
  const server = fakeSupabase();
  const open = async () => {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.addInitScript((sb) => { window.VINTEREST_SUPABASE = { url: sb, key: 'sb_publishable_test' }; }, SB);
    await seedLocalStorage(page, { vinterest_session: SESSION });
    await stubNetwork(context);
    await context.route(`${SB}/rest/v1/**`, server);
    await context.route('**/me', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ signedIn: true, tier: 'free', usage: {}, caps: {} }) }));
    return { context, page };
  };
  const a = await open();
  const before = await studiedPhone(a.context, a.page, true);
  await a.page.evaluate(async () => { while (Sync._running) await Sync._running; return Sync.syncNow(); });
  const studied = { grape: before.areas.find((x) => x[0] === 'grapes')[3][0][0], region: 'Rioja' };
  // The new phone was set up signed out, scanned, then signed in on Profile.
  const b = await browser.newContext({ serviceWorkers: 'block' });
  const bp = await b.newPage();
  await bp.addInitScript((sb) => { window.VINTEREST_SUPABASE = { url: sb, key: 'sb_publishable_test' }; }, SB);
  await stubNetwork(b);
  await b.route(`${SB}/rest/v1/**`, server);
  await b.route('**/me', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ signedIn: true, tier: 'free', usage: {}, caps: {} }) }));
  await bp.goto(`${BASE}/#home`);
  await bp.waitForFunction(() => typeof Sync !== 'undefined');
  await bp.evaluate(firstScanHere, studied);
  await bp.evaluate((s) => localStorage.setItem('vinterest_session', s), SESSION);
  await bp.evaluate(async () => { while (Sync._running) await Sync._running; return Sync.syncNow(); });
  await bp.reload();
  await bp.waitForFunction(() => typeof KnowledgeMap !== 'undefined');
  expect(await bp.evaluate(snapshot)).toEqual(before);
});

test('the welcome screen restores a backup file: a returning user goes straight Home with their progress', async ({ context, page }) => {
  const before = await studiedPhone(context, page);
  const file = await page.evaluate(() => JSON.stringify(Backup.exportData()));
  const context2 = await page.context().browser().newContext({ serviceWorkers: 'block' });
  const fresh = await context2.newPage();
  await makeDeterministic(fresh);
  await stubNetwork(context2);
  await fresh.goto(`${BASE}/`);
  fresh.on('dialog', (d) => d.accept());
  const chooser = fresh.waitForEvent('filechooser');
  await fresh.getByTestId('welcome-restore').click();
  await (await chooser).setFiles({ name: 'vinterest-backup.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  await expect.poll(() => fresh.evaluate(() => location.hash)).toBe('#home');
  expect(await fresh.evaluate(snapshot)).toEqual(before);
});
