// The restaurant staff-training app (team-*.js, team-app.jsx, docs/business.md): the sample
// restaurant, the drill and its review schedule, readiness against a role's minimum, an upload
// reviewed and published into staff cards, pairings and assignments, and the Worker keeping its
// Claude calls to Pro accounts.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const { stubNetwork } = require('./helpers');

const BASE = 'http://localhost:4173';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const DAY = 86400000;

async function openSample(context, page, opts = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // /config is answered by the Worker, which the static test server doesn't run.
  page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
  await stubNetwork(context, opts);
  await page.goto(`${BASE}/team/`);
  await page.getByText('Look around with a sample restaurant').click();
  await expect(page.getByTestId('team-state')).toBeVisible();
  return errors;
}

test('the sample restaurant opens on Today: not ready yet, with every wine and dish to learn', async ({ context, page }) => {
  const errors = await openSample(context, page);
  await expect(page.getByTestId('team-state')).toHaveText('Not ready yet');
  await expect(page.locator('#root')).toContainText('0 of 7 known · need 80%'); // seven wines by the glass, a manager's minimum
  await expect(page.locator('#root')).toContainText('New to learn (17)'); // ten wines and seven dishes
  await page.getByTestId('team-tab-wines').click();
  await expect(page.getByTestId('team-wine-row')).toHaveCount(10);
  await page.getByText('Viña Ardanza Reserva').first().click();
  await expect(page.getByTestId('team-pitch')).toContainText('Rioja');
  await page.getByLabel('Back').click();
  await page.getByTestId('team-tab-menu').click();
  await page.getByText('Braised lamb shoulder, white beans, rosemary').click();
  await expect(page.getByTestId('team-dish')).toContainText('Viña Ardanza Reserva');
  expect(errors).toEqual([]);
});

test('a staff member sees only Today, Wines and Menu; a manager also Upload and Team', async ({ context, page }) => {
  await openSample(context, page);
  await expect(page.getByTestId('team-tab-upload')).toBeVisible();
  await page.getByTestId('team-who').click();
  await page.getByText('Sam · Server').click();
  await expect(page.getByTestId('team-tab-upload')).toHaveCount(0);
  await expect(page.getByTestId('team-tab-team')).toHaveCount(0);
});

test('the review schedule: a confident miss comes back within hours, right answers space out, capped at 60 days', async ({ context, page }) => {
  await openSample(context, page);
  const out = await page.evaluate(([DAY]) => {
    const pid = TeamLearn.people()[1].id, q = TeamLearn.wineQs('w-catena-malbec')[0], t0 = Date.now();
    const days = (it, now) => Math.round(((it.due - now) / DAY) * 100) / 100;
    const miss = TeamLearn.record(pid, q, false, 'sure', t0);
    const first = TeamLearn.record(pid, q, true, 'think', t0 + DAY);
    let it = first, now = t0 + DAY; const gaps = [];
    for (let i = 0; i < 8; i++) { now = it.due; it = TeamLearn.record(pid, q, true, 'sure', now); gaps.push(days(it, now)); }
    return { miss: days(miss, t0), first: days(first, t0 + DAY), gaps };
  }, [DAY]);
  expect(out.miss).toBeLessThanOrEqual(0.1);
  expect(out.first).toBe(1);
  for (let i = 1; i < out.gaps.length; i++) expect(out.gaps[i]).toBeGreaterThanOrEqual(out.gaps[i - 1]);
  expect(Math.max(...out.gaps)).toBe(60);
});

test('a wine counts once every question the role needs is answered right; the ladder opens rung by rung', async ({ context, page }) => {
  await openSample(context, page);
  const out = await page.evaluate(() => {
    const sam = TeamLearn.people().find((p) => p.role === 'server').id, id = 'w-catena-malbec';
    const qs = TeamLearn.wineQs(id), steps = [];
    // Only the recognise questions are open at first; answering them opens recall, then apply.
    const drillKinds = () => TeamLearn.drill(sam, 50).filter((q) => q.wine === id && !q.check).map((q) => q.k); // a surprise re-check can be any rung
    steps.push(drillKinds());
    qs.filter((q) => q.k === 'recognise').forEach((q) => TeamLearn.record(sam, q, true, 'sure'));
    steps.push(drillKinds());
    qs.filter((q) => q.k === 'recall').forEach((q) => TeamLearn.record(sam, q, true, 'sure'));
    steps.push(drillKinds());
    const before = TeamLearn.knowsWine(sam, 'server', id, TeamLearn._all()[sam].items);
    qs.filter((q) => q.k === 'apply').forEach((q) => TeamLearn.record(sam, q, true, 'sure'));
    const after = TeamLearn.knowsWine(sam, 'server', id, TeamLearn._all()[sam].items);
    const assigned = TeamLearn.assignments(sam).some((a) => a.id === id);
    return { steps, before, after, assigned, opts: qs.filter((q) => q.k === 'recognise').map((q) => q.a) };
  });
  expect(out.steps[0]).toEqual(['recognise']);
  expect(out.steps[1]).toEqual(['recall']);
  expect(out.steps[2]).toEqual(['apply']); // a server stops at apply; contrast is for sommeliers
  expect(out.before).toBe(false);
  expect(out.after).toBe(true);
  expect(out.assigned).toBe(false); // the assignment is done once the wine is known
  expect(out.opts.some((a) => a !== 0)).toBe(true); // the right option isn't always first
});

test('readiness: ready once every part meets the role minimum, then slipping when answers fade', async ({ context, page }) => {
  await openSample(context, page);
  const out = await page.evaluate(([DAY]) => {
    const alex = TeamLearn.people().find((p) => p.role === 'bartender').id, t0 = Date.now();
    const glass = TeamData.wines().filter(TeamData.byGlass), dishes = TeamData.dishes();
    glass.forEach((w) => TeamLearn.wineQs(w.id).filter((q) => ['recognise', 'recall', 'apply'].includes(q.k)).forEach((q) => TeamLearn.record(alex, q, true, 'sure', t0)));
    dishes.slice(0, 4).forEach((x) => TeamLearn.dishQs(x.id).forEach((q) => TeamLearn.record(alex, q, true, 'sure', t0)));
    const ready = TeamLearn.note(alex);
    // Three days on, the first answers (due after two) have faded.
    const later = Date.now; Date.now = () => t0 + 3 * DAY;
    const slipping = TeamLearn.readiness(alex); Date.now = later;
    return { ready: ready.state, parts: Object.keys(ready.parts), slipping: slipping.state };
  }, [DAY]);
  expect(out.ready).toBe('ready');
  expect(out.parts).toEqual(['glass', 'dishes']); // a bartender's minimum leaves bottles out
  expect(out.slipping).toBe('slipping');
});

test('a typed answer is marked locally when it plainly matches, and by Claude against the key when it doesn\'t', async ({ context, page }) => {
  const reqs = [];
  await openSample(context, page, { claudeRequests: reqs, claudeText: (b) => (b.purpose === 'team_grade' ? '{"score":0.8,"verdict":"right","missing":"","say":"Good: you named the wine and why."}' : '') });
  const out = await page.evaluate(async () => {
    const qs = TeamLearn.wineQs('w-catena-malbec');
    const recall = qs.find((q) => q.k === 'recall'), apply = qs.find((q) => q.k === 'apply');
    return { local: await TeamLearn.grade(recall, 'mendoza'), typo: await TeamLearn.grade(recall, 'Mendosa'), apply: await TeamLearn.grade(apply, 'The Catena Malbec, it is smooth and plummy and great with steak') };
  });
  expect(out.local.ok).toBe(true);
  expect(out.typo.ok).toBe(true);
  expect(out.apply).toMatchObject({ ok: true, verdict: 'right' });
  expect(reqs.filter((r) => r.purpose === 'team_grade')).toHaveLength(1);
});

test('the drill on screen: pick, say how sure, see the answer and why, then the summary', async ({ context, page }) => {
  await openSample(context, page);
  await page.getByText(/Start today's drill/).click();
  for (let i = 0; i < 5; i++) {
    await expect(page.getByTestId('drill-q')).toBeVisible();
    await page.getByTestId('drill-opt').first().click();
    await page.getByText('Sure', { exact: true }).click();
    await page.getByText('Check', { exact: true }).click();
    await expect(page.getByTestId('drill-result')).toBeVisible();
    await page.getByText(i < 4 ? 'Next' : 'Finish', { exact: true }).click();
  }
  await expect(page.getByTestId('drill-done')).toContainText('of 5 right');
});

test('an uploaded list is reviewed before it goes live; publishing writes cards and pairings and assigns the new wine', async ({ context, page }) => {
  const reqs = [];
  const list = { wines: [
    { sec: 'Red', p: 'Catena', n: 'Malbec', v: 2022, t: 'red', r: 'Mendoza', c: 'Argentina', g: ['Malbec'], gb: 'label', gl: '£12', bt: '£50' },
    { sec: 'Red', p: 'Tenuta di Arceno', n: 'Chianti Classico', v: 2021, t: 'red', r: 'Chianti Classico, Tuscany', c: 'Italy', g: ['Sangiovese'], gb: 'label', gl: '', bt: '£48' },
  ] };
  const card = { cards: [{ id: 'w-tenuta-di-arceno-chianti-classico', pitch: 'A Tuscan red.', taste: 'Cherry.', style: { body: 3, acid: 4, tannin: 3, sweet: 1 }, grape: 'Sangiovese.', place: 'Tuscany.', producer: '', serve: { temp: '16°C', glass: 'red', decant: 'no' }, dishes: [{ dish: 'Braised lamb shoulder, white beans, rosemary', why: 'Acidity for the lamb.' }], alts: [{ id: 'w-catena-malbec', when: 'fuller' }],
    qs: [{ k: 'recognise', q: 'What grape is the Chianti Classico?', opts: ['Sangiovese', 'Nebbiolo', 'Merlot', 'Barbera'], a: 0, why: 'Sangiovese.' }, { k: 'recall', q: 'Which region?', ans: 'Tuscany', acc: [], why: 'Tuscany.' }] }] };
  const pairs = { pairings: [{ dish: 'Braised lamb shoulder, white beans, rosemary', best: [{ id: 'w-tenuta-di-arceno-chianti-classico', why: 'Acidity cuts the lamb.' }, { id: 'w-catena-malbec', why: 'Body.' }], glass: { id: 'w-catena-malbec', why: 'By the glass.' }, avoid: { id: 'w-not-on-list', why: 'x' } }] };
  await openSample(context, page, { claudeRequests: reqs, claudeText: (b) => b.purpose === 'team_list' ? JSON.stringify(list) : b.purpose === 'team_cards' ? JSON.stringify(card) : b.purpose === 'team_pairings' ? JSON.stringify(pairs) : '' });
  await page.getByTestId('team-tab-upload').click();
  await page.getByText('Wine list', { exact: true }).click();
  await page.getByTestId('team-file').setInputFiles({ name: 'list.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n%%EOF') });
  const review = page.getByTestId('team-review');
  await expect(review).toContainText('1 new, 9 gone, 1 changed, 0 the same');
  await expect(review).toContainText('Catena Malbec: vintage 2021 → 2022');
  await expect(review).toContainText('Tenuta di Arceno Chianti Classico 2021');
  await expect(page.getByTestId('team-most-gone')).toBeVisible(); // one page of a long list reads as most of it gone
  // Another page joins the same draft; a wine read twice (a page break mid-section) counts once.
  await page.getByTestId('team-add-pages').click();
  await page.getByTestId('team-file').setInputFiles({ name: 'list2.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n%%EOF') });
  await expect(review).toContainText('1 new, 9 gone, 1 changed, 0 the same');
  expect(reqs.filter((r) => r.purpose === 'team_list')).toHaveLength(2);
  // Nothing is live until it's published.
  expect(await page.evaluate(() => TeamData.wines().length)).toBe(10);
  await page.getByText('Publish', { exact: true }).click();
  // Publishing writes in the background (TeamJobs): the screen is free at once and the chip says when it's done.
  await expect(page.getByTestId('team-job')).toHaveAttribute('data-state', 'done');
  const out = await page.evaluate(() => ({
    live: TeamData.wines().map((w) => w.id), vintage: TeamData.wine('w-catena-malbec').vintage,
    card: !!TeamData.card('w-tenuta-di-arceno-chianti-classico'), pair: TeamData.pairing('d-lamb'),
    sam: TeamLearn.assignments(TeamLearn.people().find((p) => p.role === 'server').id).map((a) => a.id),
  }));
  expect(out.live).toEqual(['w-catena-malbec', 'w-tenuta-di-arceno-chianti-classico']);
  expect(out.vintage).toBe(2022);
  expect(out.card).toBe(true);
  expect(out.pair.avoid).toBeNull(); // a wine that isn't on the list is never suggested
  expect(out.sam).toContain('w-tenuta-di-arceno-chianti-classico');
  expect(out.sam).not.toContain('w-ardanza-reserva'); // taken off the list, so no longer assigned
  const listReq = reqs.find((r) => r.purpose === 'team_list');
  expect(listReq.messages[0].content[0].type).toBe('document'); // a PDF goes to Claude as a document
});

test('the Worker takes the team calls without a sign-in during the pilot', async () => {
  const copy = path.join(require('node:os').tmpdir(), `worker-team-${process.pid}.mjs`);
  require('node:fs').copyFileSync(path.join(__dirname, '..', '_worker.js'), copy);
  const worker = (await import(pathToFileURL(copy).href + `?t=${Date.now()}`)).default;
  const env = { ANTHROPIC_API_KEY: 'test', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'pk', SUPABASE_SECRET_KEY: 'sk' };
  for (const purpose of ['team_list', 'team_menu', 'team_cards', 'team_pairings', 'team_grade']) {
    const r = await worker.fetch(new Request('https://vinterest.pages.dev/claude', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://vinterest.pages.dev' }, body: JSON.stringify({ purpose, messages: [{ role: 'user', content: 'x' }] }) }), env);
    expect(r.status).not.toBe(402);
  }
});

// The wine-show demo (docs/business.md): The Larkspur opens from /team/?seed=demo with its 60 wines,
// 27 dishes and seven staff with photos; a new arrival is read from its label, joins the list through
// the same review, and publishing writes its card, pairings, drinking window and assignments.
test('the demo restaurant: 30 wines, photos, and a wine added from its label updates everything', async ({ context, page }) => {
  const label = { name: 'Barolo Bussia', producer: 'Prunotto', vintage: 2019, region: 'Barolo', country: 'Italy', type: 'red', grapes: ['Nebbiolo'], grapes_basis: 'label', confidence: 'high' };
  const reqs = [];
  await stubNetwork(context, { claudeRequests: reqs, claudeText: (b) => {
    if (b.purpose === 'label_scan') return JSON.stringify(label);
    if (b.purpose === 'team_cards') return JSON.stringify({ cards: [{ id: 'w-prunotto-barolo-bussia', pitch: 'A serious Barolo.', taste: 'Cherry, tar, rose.', style: { body: 4, acid: 4, tannin: 5, sweet: 1 }, grape: 'Nebbiolo.', place: 'Barolo.', producer: '', serve: { temp: '17°C', glass: 'large red', decant: '1 hour' }, dishes: [{ dish: 'Venison loin, celeriac, blackberries', why: 'Tannin for the game.' }], alts: [], qs: [{ k: 'recognise', q: 'What grape is the Prunotto Barolo?', opts: ['Nebbiolo', 'Barbera', 'Dolcetto', 'Sangiovese'], a: 0, why: 'Barolo is Nebbiolo.' }] }] });
    if (b.purpose === 'team_pairings') return '{"pairings":[]}';
    if (b.purpose === 'vintage_info') return '{"vintage_rating":"Outstanding","drink_from":2025,"drink_to":2040,"peak_from":2027,"peak_to":2036,"note":"Firm and still knitting together."}';
    return '';
  } });
  await page.goto(`${BASE}/team/?seed=demo`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  await page.getByTestId('team-tab-team').click();
  await expect(page.getByTestId('team-person')).toHaveCount(7);
  expect(await page.locator('[data-testid="team-person"] img').count()).toBe(7);
  await page.getByTestId('team-tab-wines').click();
  await expect(page.getByTestId('team-wine-row')).toHaveCount(30);
  await page.getByTestId('team-tab-upload').click();
  // The demo file carries every card, pairing and window, so nothing is waiting to be written.
  await expect(page.getByTestId('team-pending')).toHaveCount(0);
  await page.getByTestId('team-label-file').setInputFiles({ name: 'l.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByTestId('team-found')).toBeVisible();
  await expect(page.getByLabel('Producer')).toHaveValue('Prunotto');
  await page.getByLabel('Glass price').fill('£16'); await page.getByLabel('Bottle price').fill('£78');
  await page.getByText('Add to the list').click();
  await expect(page.getByTestId('team-review')).toContainText('1 new, 0 gone, 0 changed, 30 the same');
  await page.getByText('Publish', { exact: true }).click();
  await expect(page.getByTestId('team-job')).toHaveAttribute('data-state', 'done', { timeout: 20000 });
  const out = await page.evaluate(() => { const w = TeamData.wine('w-prunotto-barolo-bussia'); return { n: TeamData.wines().length, section: w.section, glass: w.glass, peak: w.peak && w.peak.to, card: !!TeamData.card(w.id), window: TeamData.window(w).word,
    assigned: TeamLearn.people().filter((p) => TeamLearn.assignments(p.id).some((a) => a.id === w.id)).length }; });
  expect(out).toMatchObject({ n: 31, section: 'Red', glass: '£16', peak: 2036, card: true, window: 'Still young', assigned: 7 });
  // Only the new wine needs a card; the 60 the demo came with keep theirs.
  expect(reqs.filter((r) => r.purpose === 'team_cards')).toHaveLength(1);
  await page.getByTestId('team-tab-wines').click();
  await page.getByText('Prunotto Barolo Bussia').click();
  await expect(page.getByTestId('team-window')).toContainText('Best from 2027 to 2036');
});

// With its cards in the demo file, loading the demo seeds each person at a different stage: ready,
// slipping, part way, overdue and just started, with re-check history behind the retention figures.
test('the demo seeds staff at different stages of training', async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=demo`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  const states = await page.evaluate(() => Object.fromEntries(TeamLearn.people().map((p) => { const r = TeamLearn.readiness(p.id); return [p.name.split(' ')[0], { state: r.state, pct: r.pct, overdue: r.overdue }]; })));
  expect(states.Claire.state).toBe('ready');
  expect(states.Marco.state).toBe('slipping');
  expect(states.Dani.pct).toBeGreaterThan(40); expect(states.Dani.pct).toBeLessThan(100);
  expect(states.Priya.overdue).toBeGreaterThan(0);
  expect(states.Amara.state).toBe('not'); expect(states.Amara.overdue).toBe(0);
  await page.getByTestId('team-tab-team').click();
  await expect(page.locator('#root')).toContainText('1 ready, 1 slipping');
});

// A laptop that opened the demo before its training was written holds a stale Larkspur; the next
// build's ?seed=demo replaces it, while a reload of the same build keeps what's there.
test('?seed=demo replaces a Larkspur from an older build and keeps one from this build', async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=demo`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  const before = await page.evaluate(() => { const d = TeamData.get(); d.venue.seeded = 'older'; d.cards = {}; TeamData.save(d); return Object.keys(TeamData.get().cards).length; });
  expect(before).toBe(0);
  await page.goto(`${BASE}/team/?seed=demo`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  expect(await page.evaluate(() => Object.keys(TeamData.get().cards).length)).toBe(30);
  const marked = await page.evaluate(() => { const d = TeamData.get(); d.venue.name = 'Kept'; TeamData.save(d); return TeamSample.current('demo'); });
  expect(marked).toBe(true);
  await page.goto(`${BASE}/team/?seed=demo`);
  await expect(page.locator('#root')).toContainText('Kept');
});

// Recall, apply and contrast questions are answered from pills (ten, a few right), the header never
// names the wine when the question is to pick it, and the summary shows each wine's rungs and the
// readiness figure before and after.
test('the drill asks typed questions as pills, keeps the wine out of the header when it is the answer, and sums up per wine', async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=demo`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  const r = await page.evaluate(() => {
    const q = TeamLearn.wineQs('w-nyetimber-classic-cuvee');
    const recall = TeamLearn.choices(q.find((x) => x.k === 'recall')), apply = TeamLearn.choices(q.find((x) => x.k === 'apply'));
    return { recallN: recall.n, recallOpts: recall.opts.length, recallRight: recall.right.map((i) => recall.opts[i]).sort(), applyN: apply.n, applyOpts: apply.opts.length,
      ok: TeamLearn.gradeChoices(q.find((x) => x.k === 'recall'), recall.right).ok, partly: TeamLearn.gradeChoices(q.find((x) => x.k === 'recall'), recall.right.slice(0, 1)).verdict };
  });
  expect(r).toMatchObject({ recallN: 3, recallOpts: 10, recallRight: ['Chardonnay', 'Pinot Meunier', 'Pinot Noir'], applyN: 3, applyOpts: 10, ok: true, partly: 'partly' });
  // Drill Nyetimber alone as Dani (a server: recognise, recall, apply): the apply question's header must not name it.
  await page.evaluate(() => { const dani = TeamLearn.people().find((p) => p.name.startsWith('Dani')); TeamLearn.setMe(dani.id); });
  await page.goto(`${BASE}/team/`);
  await page.getByTestId('team-tab-wines').click();
  await page.getByText('Nyetimber Classic Cuvée').click();
  await page.getByText('Practise this wine').first().click();
  const seen = [];
  for (let i = 0; i < 5; i++) {
    const q = page.getByTestId('drill-q'); if (!(await q.isVisible().catch(() => false))) break;
    const header = await page.locator('[data-testid="team-drill"] > div').nth(1).innerText();
    const text = await q.innerText(); seen.push({ header, text });
    if (/from the list/i.test(text)) expect(header).not.toMatch(/Nyetimber/i);
    const choose = page.getByTestId('drill-choose');
    if (await choose.isVisible().catch(() => false)) { const n = Number((await choose.innerText()).match(/Choose (\d+)/)[1]); for (let k = 0; k < n; k++) await page.getByTestId('drill-opt').nth(k).click(); }
    else await page.getByTestId('drill-opt').first().click();
    await page.getByText('Check', { exact: true }).click();
    await expect(page.getByTestId('drill-result')).toBeVisible();
    const btn = page.getByText(/^(Next|Finish)$/); await btn.click();
    if (await page.getByTestId('drill-done').isVisible().catch(() => false)) break;
  }
  await expect(page.getByTestId('drill-done')).toBeVisible();
  await expect(page.getByTestId('drill-done')).toContainText(/Readiness \d+% → \d+%/);
  await expect(page.getByTestId('drill-item')).toHaveCount(1);
  await expect(page.getByTestId('drill-item')).toContainText('Nyetimber Classic Cuvée');
  await expect(page.getByTestId('drill-item')).toContainText('Recognise');
});

// Today lets a person practise one part of their minimum (by the glass, bottles, pairings), and a
// perfect run on a wine moves the figures: its answers are held, the bar fills, readiness rises.
test('practise by the glass from Today, and a perfect wine moves the readiness figures', async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=demo`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  expect(await page.getByTestId('team-part').count()).toBe(3);
  await page.getByTestId('team-part-practise').first().click();
  await expect(page.getByTestId('drill-q')).toBeVisible();
  const header = await page.locator('[data-testid="team-drill"] > div').nth(1).innerText();
  expect(header).toMatch(/Sparkling|White|Red|Rosé|Sweet|Fortified|·/);
  await page.goto(`${BASE}/team/`);
  const moved = await page.evaluate(() => { const me = TeamLearn.me(); const before = TeamLearn.readiness(me.id).pct;
    TeamLearn.wineQs('w-nyetimber-classic-cuvee').filter((q) => TeamLearn.ROLES[me.role].kinds.includes(q.k)).forEach((q) => TeamLearn.record(me.id, q, true, 'sure'));
    return { before, after: TeamLearn.readiness(me.id).pct, known: TeamLearn.readiness(me.id).parts.glass.known }; });
  expect(moved.after).toBeGreaterThan(moved.before); expect(moved.known).toBe(1);
  await expect(page.getByTestId('team-part').first()).toContainText('1 of 15 known');
});

// ── The management console (team-console.jsx, docs/business.md) ──
// A manager on a tablet or laptop (or anyone with ?view=console) gets the console: a sidebar of
// sections and a Dashboard whose every figure is TeamReport's, with the demo's invented sales
// labelled as such; staff never see it.
test('the console: dashboard figures from TeamReport, the demo sales labelled, and sections that open', async ({ context, browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await stubNetwork(ctx);
  await page.goto(`${BASE}/team/?seed=demo&view=console`);
  await expect(page.getByTestId('team-console')).toBeVisible();
  const want = await page.evaluate(() => { const o = TeamReport.overview(), s = TeamReport.salesSummary(7); return { avg: o.avg, overdue: o.overdue, revenue: Math.round(s.revenue), rows: TeamSales.get().rows.length, lift: TeamReport.trainedLift(28).pct, unmapped: TeamSales.unmapped().map((x) => x.item) }; });
  expect(want.rows).toBeGreaterThan(1000);
  await expect(page.getByTestId('dash-readiness')).toHaveText(`${want.avg}%`);
  await expect(page.getByTestId('dash-overdue')).toHaveText(String(want.overdue));
  await expect(page.getByTestId('sales-revenue')).toContainText(String(want.revenue));
  await expect(page.getByTestId('sales-lift')).toContainText(`${want.lift}%`);
  // The till knows a Picpoul the list doesn't: the "new on the list?" signal.
  expect(want.unmapped).toEqual(['Picpoul de Pinet 175']);
  await expect(page.getByTestId('sales-new-item')).toContainText('Picpoul');
  expect(await page.getByTestId('demo-tag').count()).toBeGreaterThan(0);
  // Marco's by-the-glass sales dipped the weeks he stopped drilling.
  const marco = await page.evaluate(() => { const m = TeamLearn.people().find((p) => p.name.startsWith('Marco')); const t = TeamReport.serverTrend(m.id, 8).filter((x) => x.shifts); return { first: t[0].perShift, last: t[t.length - 1].perShift }; });
  expect(marco.last).toBeLessThan(marco.first * 0.7);
  // Every section opens; a row opens its detail in the panel.
  for (const s of ['team', 'wines', 'menu', 'upload', 'pos', 'admin']) { await page.getByTestId(`console-nav-${s}`).click(); await expect(page.getByTestId(`console-${s}`)).toBeVisible(); }
  await page.getByTestId('console-nav-team').click();
  await page.getByTestId('team-row').first().click();
  await expect(page.getByTestId('console-person')).toBeVisible();
  await page.getByTestId('console-panel-close').click();
  await expect(page.getByTestId('console-panel')).toHaveCount(0);
  // "Train on the phone view" shows the phone app; Console brings the console back.
  await page.getByTestId('console-who').click();
  await expect(page.getByTestId('team-state')).toBeVisible();
  await page.getByTestId('team-to-console').click();
  await expect(page.getByTestId('team-console')).toBeVisible();
  expect(errors).toEqual([]);
  await ctx.close();
});

test('a server on a wide screen keeps the phone app; a manager on a phone gets the KPI strip, not the console', async ({ context, browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await stubNetwork(ctx);
  await page.goto(`${BASE}/team/?seed=demo`);
  await expect(page.getByTestId('team-console')).toBeVisible();
  await page.evaluate(() => { TeamLearn.setMe(TeamLearn.people().find((p) => p.role === 'server').id); });
  await page.reload();
  await expect(page.getByTestId('team-state')).toBeVisible();
  await expect(page.getByTestId('team-console')).toHaveCount(0);
  await expect(page.getByTestId('team-kpis')).toHaveCount(0);
  await ctx.close();
  // The phone (the default device): the manager's Today carries the KPI strip, tapping through to Team.
  const phone = await context.newPage();
  await stubNetwork(context);
  await phone.goto(`${BASE}/team/?seed=demo`);
  await expect(phone.getByTestId('team-kpis')).toBeVisible();
  await expect(phone.getByTestId('team-console')).toHaveCount(0);
  const avg = await phone.evaluate(() => TeamReport.overview().avg);
  await expect(phone.getByTestId('kpi-readiness')).toContainText(`${avg}%`);
  await expect(phone.getByTestId('kpi-sales')).toContainText('demo data');
  await phone.getByTestId('kpi-readiness').click();
  await expect(phone.getByTestId('team-people')).toBeVisible();
});

// A wine's prices edited on the console go through the draft: the review says what changed and
// nothing is live until Publish; the card's line can be rewritten in the manager's own words.
test('the console edits a wine through the draft and review, and a manager can rewrite what to say', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await stubNetwork(ctx, { claudeText: (b) => (b.purpose === 'team_pairings' ? '{"pairings":[]}' : '') });
  await page.goto(`${BASE}/team/?seed=demo&view=console`);
  await page.getByTestId('console-nav-wines').click();
  await page.getByTestId('wines-edit').first().click();
  await page.getByLabel('Glass price').fill('£15');
  await page.getByText('Review the change').click();
  await expect(page.getByTestId('team-review')).toContainText('0 new, 0 gone, 1 changed, 29 the same');
  await expect(page.getByTestId('team-review')).toContainText('glass £14 → £15');
  expect(await page.evaluate(() => TeamData.wines()[0].glass)).toBe('£14');
  await page.getByText('Publish', { exact: true }).click();
  await expect(page.getByTestId('team-job')).toHaveAttribute('data-state', 'done');
  expect(await page.evaluate(() => TeamData.wines()[0].glass)).toBe('£15');
  // The card's line.
  await page.getByTestId('console-nav-wines').click();
  await page.getByTestId('wines-row').first().click();
  await page.getByTestId('team-pitch-edit').click();
  await page.getByLabel('What to say').fill('Our house fizz: Sussex chalk, a touch of brioche.');
  await page.getByText('Save', { exact: true }).click();
  await expect(page.getByTestId('team-pitch')).toHaveText('Our house fizz: Sussex chalk, a touch of brioche.');
  expect(await page.evaluate(() => !!TeamData.card(TeamData.wines()[0].id).edited)).toBe(true);
  await ctx.close();
});

// The demo's prepared arrivals (data/team-demo-arrivals.json): Carey's two bottles, read ahead and
// their training written, publish with no Claude call: the Chablis as a new wine with its card,
// pairings and window; the Viña Ardanza 2016 as a new vintage of the 2015 on the list, card kept.
test('prepared arrivals publish offline: a new Chablis with its card, and a new vintage of the Ardanza', async ({ context, page }) => {
  const reqs = [];
  await stubNetwork(context, { claudeRequests: reqs });
  await page.goto(`${BASE}/team/?seed=demo`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  await page.getByTestId('team-tab-upload').click();
  await expect(page.getByTestId('team-arrival')).toHaveCount(2);
  await page.getByTestId('team-arrival').nth(1).click();
  await expect(page.getByLabel('Producer')).toHaveValue('Patrick Piuze');
  await expect(page.getByLabel('Glass price')).toHaveValue('£15');
  await expect(page.getByTestId('team-read-live')).toBeVisible();
  await page.getByText('Add to the list').click();
  await expect(page.getByTestId('team-review')).toContainText('1 new, 0 gone, 0 changed, 30 the same');
  await page.getByText('Publish', { exact: true }).click();
  await expect(page.getByTestId('team-job')).toHaveAttribute('data-state', 'done');
  const chablis = await page.evaluate(() => { const id = 'w-patrick-piuze-chablis-terroir-de-fleys', w = TeamData.wine(id), d = TeamData.get(); return { n: TeamData.wines().length, card: !!TeamData.card(id), qs: TeamData.card(id).qs.length, window: TeamData.window(w).word,
    mentions: Object.values(d.pairings).filter((pp) => [...(pp.best || []), pp.glass, pp.avoid].some((x) => x && x.id === id)).length, assigned: TeamLearn.people().filter((p) => TeamLearn.assignments(p.id).some((a) => a.id === id)).length, pending: TeamData.pending() }; });
  expect(chablis).toMatchObject({ n: 31, card: true, qs: 6, window: 'Still young', assigned: 7, pending: { cards: 0, pairings: 0, windows: 0 } });
  expect(chablis.mentions).toBeGreaterThan(0);
  await page.getByTestId('team-job').getByLabel('Dismiss').click();
  await page.getByTestId('team-arrival').nth(0).click();
  await page.getByText('Add to the list').click();
  await expect(page.getByTestId('team-review')).toContainText('0 new, 0 gone, 1 changed, 30 the same');
  await expect(page.getByTestId('team-review')).toContainText('vintage 2015 → 2016');
  await page.getByText('Publish', { exact: true }).click();
  await expect(page.getByTestId('team-job')).toHaveAttribute('data-state', 'done');
  const ardanza = await page.evaluate(() => { const w = TeamData.wine('w-la-rioja-alta-vina-ardanza-reserva'); return { vintage: w.vintage, peakTo: w.peak.to, card: !!TeamData.card(w.id), n: TeamData.wines().length }; });
  expect(ardanza).toEqual({ vintage: 2016, peakTo: 2034, card: true, n: 31 });
  expect(reqs).toEqual([]);
});

// A sales file from any till: the columns are read by name, lines are never counted twice, and an
// item with no wine behind it waits for the manager to confirm the match.
test('a CSV of sales is imported once, mapped to wines, and sales never move readiness', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await stubNetwork(ctx);
  await page.goto(`${BASE}/team/?seed=demo&view=console`);
  await page.getByTestId('console-nav-pos').click();
  const before = await page.evaluate(() => ({ rows: TeamSales.get().rows.length, ready: TeamLearn.people().map((p) => TeamLearn.readiness(p.id).pct) }));
  const csv = ['Date,Item,Qty,Net Amount,Server,Order ID', '2026-10-29 19:40,Catena Malbec 175,2,22.00,Dani Haddad,A1', '2026-10-29 20:05,Nyetimber Classic Cuvee Btl,1,68.00,Claire Whitfield,A2', '2026-10-29 21:10,Picpoul de Pinet 175,3,28.50,Priya,A3', 'not a date,Nothing,1,1,x,A4'].join('\n');
  await page.getByTestId('pos-csv').setInputFiles({ name: 'sales.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByTestId('pos-import-msg')).toContainText('3 new lines read from 3, 1 skipped');
  await page.getByTestId('pos-csv').setInputFiles({ name: 'sales.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByTestId('pos-import-msg')).toContainText('0 new lines');
  const after = await page.evaluate(() => { const rows = TeamSales.get().rows; const r = rows.filter((x) => x.i.startsWith('csv-')); const dani = TeamLearn.people().find((p) => p.name.startsWith('Dani'));
    return { rows: rows.length, csv: r.map((x) => [x.n, x.q, x.p, x.s, x.v === dani.id]), items: TeamSales.items().filter((x) => !x.mapped).map((x) => [x.item, x.suggest && x.suggest.id]), ready: TeamLearn.people().map((p) => TeamLearn.readiness(p.id).pct) }; });
  expect(after.rows).toBe(before.rows + 3);
  expect(after.csv).toContainEqual(['Catena Malbec 175', 2, 11, 'glass', true]);
  expect(after.csv).toContainEqual(['Nyetimber Classic Cuvee Btl', 1, 68, 'bottle', false]);
  // The file's unaccented "Cuvee" is a new till item: proposed as the Nyetimber, mapped only once confirmed; the Picpoul matches nothing.
  expect(after.items).toEqual(expect.arrayContaining([['Picpoul de Pinet 175', null], ['Nyetimber Classic Cuvee Btl', 'w-nyetimber-classic-cuvee']]));
  expect(after.items).toHaveLength(2);
  expect(after.ready).toEqual(before.ready);
  await ctx.close();
});
