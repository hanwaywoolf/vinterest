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
  await page.goto(`${BASE}/team/?seed=sample`); // The Copper Pan: no longer offered on the setup screen, kept as the tests' small restaurant
  await expect(page.getByTestId('team-state')).toBeVisible();
  return errors;
}

test('the setup screen offers The Larkspur only, a device left on The Copper Pan goes back to it, and Change restaurant returns there', async ({ context, page }) => {
  await openSample(context, page);
  await page.goto(`${BASE}/team/`); // no seed: the Copper Pan is retired
  await expect(page.getByTestId('team-load-demo')).toBeVisible();
  await expect(page.getByText('Look around with a sample restaurant')).toHaveCount(0);
  await expect(page.getByTestId('team-load-demo')).toContainText(/Open The Larkspur: 30 wines, 27 dishes, a team of \w+/);
  await page.getByTestId('team-load-demo').click();
  await expect(page.locator('#root')).toContainText('The Larkspur');
  await page.reload(); // The Larkspur stays put
  await expect(page.locator('#root')).toContainText('The Larkspur');
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('team-who').click();
  await page.getByTestId('team-change-restaurant').click();
  await expect(page.getByTestId('team-load-demo')).toBeVisible();
});

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

test('the publish check: every question is checked, the ones that fail are rewritten under the same id, and the demo is only counted', async ({ context, page }) => {
  const reqs = [];
  const errors = await openSample(context, page, { claudeRequests: reqs, claudeText: (b) => {
    if (b.purpose !== 'team_fix') return '';
    const ids = [...b.messages[0].content.matchAll(/^ID (\S+)/gm)].map((m) => m[1]);
    return JSON.stringify({ fixes: ids.filter((id) => id === 'w-ardanza-reserva#bad').map((id) => ({ id, q: { q: 'Which grape leads the blend in the La Rioja Alta Viña Ardanza Reserva?', ans: 'Tempranillo', acc: [], why: 'Ardanza is mostly Tempranillo.' } })) });
  } });
  const r = await page.evaluate(async () => {
    // A question that offers its own answer as one of two.
    const d = TeamData.get(); d.cards['w-ardanza-reserva'].qs.push({ id: 'w-ardanza-reserva#bad', k: 'recall', q: 'Is the La Rioja Alta Viña Ardanza Reserva drunk young or aged?', ans: 'Aged', acc: [], why: 'x' }); TeamData.save(d);
    const before = TeamLearn.audit().map((f) => f.q.id);
    const checked = await TeamData.checkQuestions();
    const q = TeamData.card('w-ardanza-reserva').qs.find((x) => x.id === 'w-ardanza-reserva#bad');
    return { before, checked, q, after: TeamLearn.audit().map((f) => f.q.id), line: TeamData.checkedLine() };
  });
  expect(r.before).toContain('w-ardanza-reserva#bad');
  expect(r.q.q).toMatch(/Which grape leads/); // rewritten in place, same id and kind
  expect(r.q.k).toBe('recall');
  expect(r.after).not.toContain('w-ardanza-reserva#bad');
  expect(r.checked.fixed).toBeGreaterThanOrEqual(1);
  expect(r.checked.failed).toBe(r.before.length);
  expect(r.line).toMatch(/questions checked · \d+ rewritten/);
  const fix = reqs.filter((x) => x.purpose === 'team_fix');
  expect(fix.length).toBeGreaterThan(0);
  expect(fix[0].messages[0].content).toMatch(/PROBLEM giveaway/);
  // The demo restaurant runs offline: it's counted, never sent.
  await page.goto(`${BASE}/team/?seed=demo`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  const n = reqs.length;
  const demo = await page.evaluate(() => TeamData.checkQuestions());
  expect(reqs.length).toBe(n);
  expect(demo.asked).toBeGreaterThan(100);
  expect(errors).toEqual([]);
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
  for (const purpose of ['team_list', 'team_menu', 'team_cards', 'team_pairings', 'team_grade', 'team_vinny', 'team_guest', 'team_fix']) {
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

// The drill's summary lists what was in it; a row opens that wine's card (or dish), and Back returns to the summary.
test('a row of the drill summary opens the wine card, and Back returns to the summary', async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=demo`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  await page.getByText(/Start today's drill|Practise/).first().click();
  for (let i = 0; i < 5; i++) {
    await expect(page.getByTestId('drill-q')).toBeVisible();
    await page.getByTestId('drill-opt').first().click();
    await page.getByText('Check').click();
    await expect(page.getByTestId('drill-result')).toBeVisible();
    await page.getByText(/^Next$|^Finish$/).click();
  }
  await expect(page.getByTestId('drill-done')).toBeVisible();
  const first = page.getByTestId('drill-item').first();
  const name = (await first.locator('span').first().textContent()).trim();
  await first.click();
  await expect(page.locator('[data-testid="team-wine"], [data-testid="team-dish"]').first()).toBeVisible();
  await expect(page.locator('#root')).toContainText(name.slice(0, 12));
  await page.getByLabel('Back').click();
  await expect(page.getByTestId('drill-done')).toBeVisible();
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

// Vinny in the staff app (team-vinny.js): a test aimed at what this person needs, answers about the
// list and menu, and a guest at a table, all from the restaurant's own list, menu, cards and pairings.
async function asMarco(context, page, opts = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
  await stubNetwork(context, opts);
  await page.goto(`${BASE}/team/?seed=demo`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  await page.getByTestId('team-who').click();
  await page.getByRole('button', { name: /Marco/ }).first().click();
  await expect(page.locator('#root')).toContainText('Hi Marco');
  return errors;
}

test("Vinny's test aims at what this person needs, and a request narrows it", async ({ context, page }) => {
  const errors = await asMarco(context, page);
  await page.getByTestId('team-tab-vinny').click();
  await expect(page.getByTestId('vinny-test-why')).toContainText(/faded|new to you/); // Marco's demo answers have faded
  await page.getByTestId('vinny-test-ask').fill('the moon');
  await expect(page.getByTestId('vinny-test-asked')).toContainText('Nothing you sell matches');
  await page.getByTestId('vinny-test-ask').fill('the reds');
  await expect(page.getByTestId('vinny-test-asked')).toContainText(/\d+ questions/);
  await page.getByTestId('vinny-test-ask').fill('');
  await page.getByText("Start Vinny's test").click();
  await expect(page.getByTestId('drill-intro')).toContainText("Vinny's test");
  await expect(page.getByTestId('drill-q')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Ask Vinny answers from the list and menu, and opens the wines it names', async ({ context, page }) => {
  const reqs = [];
  const errors = await asMarco(context, page, { claudeRequests: reqs, claudeText: (b) => {
    if (b.purpose !== 'team_vinny') return '';
    const tag = (b.messages[0].content.match(/(W\d+) Bründlmayer/) || [])[1];
    return JSON.stringify({ answer: `The Grüner by the glass (${tag}) at £11: peppery and fresh, and it loves the salt (D1) .`, wines: [tag], dishes: ['D1'] });
  } });
  await page.getByTestId('team-tab-vinny').click();
  await page.getByTestId('vinny-input').fill('What goes with the olives by the glass?');
  await page.getByLabel('Ask', { exact: true }).click();
  await expect(page.getByTestId('vinny-answer')).toContainText('Grüner by the glass');
  // the list's tags never reach the server, with or without their brackets, and leave no empty brackets behind
  await expect(page.getByTestId('vinny-answer')).toHaveText('The Grüner by the glass at £11: peppery and fresh, and it loves the salt.');
  const prompt = reqs.find((r) => r.purpose === 'team_vinny').messages[0].content;
  expect(prompt).toContain('Gordal olives'); // the menu is in it
  expect(prompt).toMatch(/Bründlmayer[^\n]*say "/); // with the card of the wine the dish pairs with
  await page.getByTestId('vinny-chip').first().click();
  await expect(page.getByTestId('team-pitch')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a guest at the table: Vinny opens, the server answers, and the table is marked', async ({ context, page }) => {
  const reqs = [];
  const errors = await asMarco(context, page, { claudeRequests: reqs, claudeText: (b) => {
    if (b.purpose !== 'team_guest') return '';
    const c = b.messages[0].content;
    if (!/SERVER:/.test(c)) return '{"guest":"Evening! What would you pour with this?","done":false}';
    return JSON.stringify({ guest: 'Perfect, we will have that.', done: true, mark: { score: 0.8, verdict: 'right', good: 'You named the wine and why.', missing: '', better: 'Try the Grüner at £11.' } });
  } });
  await page.getByTestId('team-tab-vinny').click();
  await page.getByText('Take a table').click();
  await expect(page.getByTestId('guest-line')).toContainText('What would you pour');
  await page.getByTestId('guest-reply').fill('The Grüner by the glass, it is peppery and fresh.');
  await page.getByText('Say', { exact: true }).click();
  await expect(page.getByTestId('guest-mark')).toContainText('That landed');
  const first = reqs.find((r) => r.purpose === 'team_guest').messages[0].content;
  expect(first).toMatch(/What a good answer[\s\S]*- /); // the marking key, from the dish's pairing
  expect(reqs.filter((r) => r.purpose === 'team_guest')[1].messages[0].content).toContain('SERVER: The Grüner by the glass');
  expect(errors).toEqual([]);
});

test('a guest at the table comes with choices, hints or none, and two tables that land move someone up a step', async ({ context, page }) => {
  const reqs = [];
  const errors = await asMarco(context, page, { claudeRequests: reqs, claudeText: (b) => {
    if (b.purpose !== 'team_guest') return '';
    if (!/SERVER:/.test(b.messages[0].content)) return '{"guest":"Evening! What would you pour with this?","done":false}';
    return JSON.stringify({ guest: 'Lovely.', done: true, mark: { score: 0.8, verdict: 'right', good: 'Named it and why.', missing: '', better: '' } });
  } });
  // A sommelier starts on their own; someone with no answers held starts with choices.
  const starts = await page.evaluate(() => {
    const people = TeamLearn.people();
    const som = people.find((p) => p.role === 'sommelier');
    return { som: som ? TeamVinny._startLevel(som.id) : 'own' };
  });
  expect(starts.som).toBe('own');

  await page.getByTestId('team-tab-vinny').click();
  await page.getByText('Take a table').click();
  await expect(page.getByTestId('guest-line')).toBeVisible();
  await page.getByTestId('guest-help-choices').click();
  // Three wines; a wrong one says why and the right one opens the reasons.
  await expect(page.getByTestId('guest-choice')).toHaveCount(3);
  for (let i = 0; i < 3 && !(await page.getByTestId('guest-reason').count()); i++) await page.getByTestId('guest-choice').nth(i).click();
  await expect(page.getByTestId('guest-reason').first()).toBeVisible();
  for (let i = 0; i < 3 && !(await page.getByTestId('guest-reply').inputValue()); i++) await page.getByTestId('guest-reason').nth(i).click();
  await expect(page.getByTestId('guest-reply')).toHaveValue(/I'd (go for|steer)/);
  await page.getByText('Say', { exact: true }).click();
  await expect(page.getByTestId('guest-help-used')).toHaveText('With choices');
  await expect(page.getByTestId('guest-moved')).toHaveCount(0);

  // A second table that lands at the same step moves them up to hints.
  await page.getByText('Another table').click();
  await expect(page.getByTestId('guest-help-choices')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('guest-choices')).toBeVisible();
  await page.getByTestId('guest-reply').fill('The house white, it is fresh.');
  await page.getByText('Say', { exact: true }).click();
  await expect(page.getByTestId('guest-moved')).toContainText('just hints');
  await page.getByText('Another table').click();
  await expect(page.getByTestId('guest-help-hints')).toHaveAttribute('aria-checked', 'true');

  // Hints come one at a time, up to three, and the mark says how many were used.
  await expect(page.getByTestId('guest-hint-btn')).toContainText('1 of 3');
  for (let i = 0; i < 3; i++) await page.getByTestId('guest-hint-btn').click();
  await expect(page.getByTestId('guest-hint')).toHaveCount(3);
  await expect(page.getByTestId('guest-hint-btn')).toHaveCount(0);
  await page.getByTestId('guest-reply').fill('The Grüner by the glass.');
  await page.getByText('Say', { exact: true }).click();
  await expect(page.getByTestId('guest-help-used')).toHaveText('With 3 hints');

  // On your own: no choices and no hints.
  await page.getByText('Another table').click();
  await page.getByTestId('guest-help-own').click();
  await expect(page.getByTestId('guest-choices')).toHaveCount(0);
  await expect(page.getByTestId('guest-hints')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('tables are picked for the person: wines they don\'t know, requests they\'ve missed, no repeats, and the screen says why', async ({ context, page }) => {
  const errors = await asMarco(context, page, { claudeText: (b) => b.purpose === 'team_guest' ? '{"guest":"Evening! What would you pour with this?","done":false}' : '' });
  const r = await page.evaluate(() => {
    const pid = TeamLearn.people()[0].id, held = (id) => { const p = TeamLearn.progress(pid, id); return p.total ? p.known / p.total : 0; };
    const out = {};
    // Every table it could set, scored: the pick is among the best few and leans on wines they hold least.
    const tables = []; for (let s = 1; s <= 40; s++) tables.push(TeamVinny.scenario(pid, s * 7919));
    out.allWhy = tables.every((t) => Array.isArray(t.why));
    const pickedWeak = tables.reduce((a, t) => a + (1 - held(t.wines[0])), 0) / tables.length;
    const all = TeamData.dishes().map((x) => ({ x, p: TeamData.pairing(x.id) })).filter((d) => d.p && d.p.best && d.p.best.length);
    const every = []; all.forEach(({ x, p }) => TeamVinny.wishesFor(p).forEach((w) => { const t = TeamVinny._build(x, p, w, 1); if (t && t.wines.length) every.push(t); }));
    const anyWeak = every.reduce((a, t) => a + (1 - held(t.wines[0])), 0) / every.length;
    out.pickedWeak = pickedWeak; out.anyWeak = anyWeak;
    // Some variety: more than one table across seeds.
    out.distinct = new Set(tables.map((t) => t.dish + ':' + t.wish)).size;
    // Two missed steer-away tables make steer-away tables come up more.
    const wishShare = (k) => { let n = 0; for (let s = 1; s <= 40; s++) if (TeamVinny.scenario(pid, s * 104729).wish === k) n++; return n / 40; };
    const before = wishShare('avoid');
    const miss = every.find((t) => t.wish === 'avoid');
    TeamVinny.noteTable(pid, { level: 'choices', score: 0.1, table: { dish: miss.dish, wish: 'avoid', wines: miss.wines } });
    TeamVinny.noteTable(pid, { level: 'choices', score: 0.2, table: { dish: miss.dish, wish: 'avoid', wines: miss.wines } });
    out.before = before; out.after = wishShare('avoid');
    out.log = TeamVinny.tableState(pid).log.slice(-1)[0];
    // The table just played isn't set again straight away.
    const last = TeamVinny.scenario(pid, 3);
    TeamVinny.noteTable(pid, { level: 'choices', score: 0.8, table: last });
    let repeats = 0; for (let s = 1; s <= 20; s++) { const t = TeamVinny.scenario(pid, s * 31); if (t.dish === last.dish && t.wish === last.wish) repeats++; }
    out.repeats = repeats;
    out.missedWhy = TeamVinny.tableWhy({ ...miss, parts: { missed: 2, weak: 0 }, raw: { missedN: 2, weak: 0 } });
    return out;
  });
  expect(r.allWhy).toBe(true);
  expect(r.pickedWeak).toBeGreaterThanOrEqual(r.anyWeak);
  expect(r.distinct).toBeGreaterThan(1);
  expect(r.after).toBeGreaterThan(r.before);
  expect(r.log).toMatchObject({ wish: 'avoid' });
  expect(r.log.dish).toBeTruthy();
  expect(r.repeats).toBe(0);
  expect(r.missedWhy[0]).toMatch(/steering a guest away from a wine hasn't landed for you 2 times lately/);
  await page.getByTestId('team-tab-vinny').click();
  await page.getByText('Take a table').click();
  await expect(page.getByTestId('guest-why')).toContainText('Picked for you:');
  expect(errors).toEqual([]);
});

test('drill answers: no question gives its answer away, prices are asked one way, and a table is two short lists', async ({ context, page }) => {
  const errors = await asMarco(context, page);
  const r = await page.evaluate(() => {
    const words = (s) => TeamLearn._words(s);
    const all = TeamLearn.allQs().filter((q) => q.wine);
    // A question whose answer is in its own words: "Which grape is the … Pinot Noir made from?"
    const spoilt = all.filter((q) => { const ans = q.k === 'recognise' ? [q.opts[q.a]] : q.k === 'recall' ? String(q.ans).split(/,|\band\b|;/) : [];
      // A figure answers only when the figure is there too ("£9 a glass" isn't in "by the glass?").
      const nums = (x) => String(x || '').match(/\d+(?:\.\d+)?/g) || [], tn = new Set(nums(q.q));
      const t = new Set(words(q.q)); return ans.some((a) => { const w = words(a); return w.length && w.every((x) => t.has(x)) && nums(a).every((n) => tn.has(n)); }); }).map((q) => q.q);
    const jadot = TeamData.wines().find((w) => /Jadot/.test(w.producer + ' ' + w.name));
    const grapeQ = TeamLearn.wineQs(jadot.id).find((q) => /which grape/i.test(q.q));
    const money = all.filter((q) => q.k === 'recall' && /glass price|bottle price/i.test(q.q)).map((q) => ({ side: /glass/i.test(q.q) ? 'glass' : 'bottle', opts: TeamLearn.choices(q).opts }));
    const apply = all.filter((q) => q.k === 'apply').map((q) => TeamLearn.choices(q));
    const pills = all.flatMap((q) => (q.k === 'recognise' ? q.opts : TeamLearn.choices(q).opts));
    return { spoilt, grapeQ: grapeQ && grapeQ.q, money, apply, lower: pills.filter((o) => /^[a-z]/.test(o)) };
  });
  expect(r.spoilt).toEqual([]);
  expect(r.grapeQ).toContain('Louis Jadot');
  expect(r.grapeQ).not.toMatch(/Pinot Noir/);
  expect(r.money.length).toBeGreaterThan(0);
  for (const m of r.money) for (const o of m.opts) expect(o).toMatch(m.side === 'glass' ? /a glass|Not by the glass/ : /a bottle$/);
  const grouped = r.apply.filter((c) => c.groups);
  expect(grouped.length).toBeGreaterThan(r.apply.length * 0.9);
  for (const c of grouped) {
    // A question that already names the wine asks only why; otherwise the wine first, then why.
    const labels = c.groups.map((g) => g.label);
    expect(labels[labels.length - 1]).toBe(c.steer ? 'What do you say?' : 'Why it works'); // a guest asking for a wine that doesn't suit is steered
    if (labels.length === 2) {
      expect(labels[0]).toBe('What do you suggest?');
      expect(c.opts.slice(0, c.groups[0].to).every((o) => /^The /.test(o))).toBe(true); // every suggestion names a wine
    }
    expect(c.opts.slice(c.groups[labels.length - 1].from).some((o) => /^The .*£\d/.test(o))).toBe(false); // and no reason is a price or an offer
  }
  expect(r.lower).toEqual([]);
  expect(errors).toEqual([]);
});

test('at the table, wrong reasons are about this dish and wrong for this wine, and a wine that does not suit the dish is a steer', async ({ context, page }) => {
  const errors = await asMarco(context, page);
  const r = await page.evaluate(() => {
    const out = { offDish: [], notWrong: [], steers: [] };
    TeamData.wines().forEach((w) => TeamLearn.wineQs(w.id).filter((q) => q.k === 'apply').forEach((q) => {
      const c = TeamLearn.choices(q), dish = TeamLearn.dishIn(q.q); if (!c || !dish) return;
      const g = c.groups[c.groups.length - 1], wrong = c.opts.slice(g.from, g.to).filter((o, i) => !c.right.includes(g.from + i));
      // No wrong reason names another dish's food.
      const here = new Set(TeamLearn._words(dish.name + ' ' + (dish.desc || '')));
      const other = new Set(TeamData.dishes().filter((d) => d.id !== dish.id).flatMap((d) => TeamLearn._words(d.name)).filter((x) => x.length > 4 && !here.has(x) && !['with', 'sauce', 'roast'].includes(x)));
      wrong.forEach((o) => { if (TeamLearn._words(o).some((x) => other.has(x))) out.offDish.push(o); });
      if (c.steer) out.steers.push({ wine: TeamData.short(w), dish: dish.name, right: c.right.map((i) => c.opts[i]), wrong });
      else wrong.forEach((o) => { if (!TeamLearn.contradicts(o, (TeamData.card(w.id) || {}).style || {}, TeamLearn.kindOf(w)) && !/^Steer|^Pour/.test(o)) out.notWrong.push(TeamData.short(w) + ': ' + o); });
    }));
    out.fit = TeamLearn.tableFit(TeamData.wines().find((w) => /Minuty/.test(w.producer + w.name)).id, TeamLearn.dishIn('braised lamb shoulder').id);
    out.barolo = TeamLearn.tableFit(TeamData.wines().find((w) => /Barolo/.test(w.name)).id, TeamLearn.dishIn('braised lamb shoulder').id);
    out.cod = TeamLearn.dishIn('A guest orders the pan-roast cod').name;
    return out;
  });
  expect(r.offDish).toEqual([]);
  expect(r.notWrong).toEqual([]);
  expect(r.fit).toBe('steer'); // a pale Provence rosé with a braised lamb shoulder
  expect(r.barolo).toBe('good'); // a Barolo is fine with it, though not one of the three picks
  expect(r.cod).toMatch(/^Pan-roast cod/);
  const minuty = r.steers.find((x) => /Minuty/.test(x.wine));
  expect(minuty.right.some((t) => /^Steer them to the /.test(t))).toBe(true);
  expect(minuty.wrong.some((t) => /^Pour it gladly/.test(t))).toBe(true); // "it's a classic match" is a wrong answer
  expect(errors).toEqual([]);
});

test('a four-option question never gives itself away: no wrong answer of another kind of wine, no word shared by the question and the right answer alone', async ({ context, page }) => {
  for (const seed of ['demo', 'sample']) {
    await stubNetwork(context);
    await page.goto(`${BASE}/team/?seed=${seed}`);
    await expect(page.getByTestId('team-state')).toBeVisible();
    const r = await page.evaluate(() => {
      const out = { other: [], give: [], count: 0 };
      TeamData.wines().forEach((w) => TeamLearn.wineQs(w.id).filter((q) => q.k === 'recognise').forEach((q) => {
        out.count++;
        if (TeamLearn.givesAway(q)) out.give.push(q.q);
        if (TeamLearn._kindsIn(q.opts[q.a]).length) {
          const fits = TeamLearn.KIND_FITS[TeamLearn.kindOf(w)];
          q.opts.forEach((o, i) => { const ks = TeamLearn._kindsIn(o); if (i !== q.a && ks.length && !ks.some((k) => fits.includes(k))) out.other.push(q.q + ' → ' + o); });
        }
      }));
      const ott = TeamData.wines().find((w) => /Ott/.test(w.producer || ''));
      out.ott = ott && TeamLearn.wineQs(ott.id).filter((q) => q.k === 'recognise' && /description/i.test(q.q)).map((q) => q.opts)[0];
      return out;
    });
    expect(r.count).toBeGreaterThan(15);
    expect(r.give).toEqual([]);
    expect(r.other).toEqual([]);
    if (seed === 'demo') expect(r.ott.every((o) => /rosé/i.test(o))).toBe(true); // all four are rosés
  }
});

test('a recall question offers wrong answers of its own kind: flavours for a flavour, climates for a climate', async ({ context, page }) => {
  const errors = await asMarco(context, page);
  const r = await page.evaluate(() => {
    const rs = TeamLearn.allQs().filter((q) => q.wine && q.k === 'recall');
    const pick = (re) => { const q = rs.find((x) => re.test(x.q)); const c = TeamLearn.choices(q); return { opts: c.opts, right: c.right.map((i) => c.opts[i]) }; };
    return {
      untyped: rs.filter((q) => !TeamLearn._topic(q.q) && !/price|much|glass|bottle/i.test(q.q)).map((q) => q.q),
      flavour: pick(/flavours does Pinot Noir/), climate: pick(/climate of Provence/), port: pick(/keep the sweetness/), months: pick(/minimum time/),
    };
  });
  expect(r.untyped).toEqual([]); // every recall question is read as one kind
    expect(r.flavour.opts.some((o) => /fermentation|climate|valley|bank/i.test(o))).toBe(false);
  expect(r.climate.right).toEqual(['Hot, dry Mediterranean']); // one answer, commas and all
  expect(r.climate.opts.every((o) => /mediterranean|continental|maritime|atlantic|desert|tropical/i.test(o))).toBe(true);
  expect(r.port.opts.filter((o) => /grape spirit/i.test(o))).toEqual(['Fermentation is stopped with grape spirit']); // no same-meaning decoy
  expect(r.months.opts.every((o) => /month/i.test(o))).toBe(true);
  expect(errors).toEqual([]);
});

test('options are dealt afresh each time: the right answer spreads across places, and a question seen again comes back reordered', async ({ context, page }) => {
  const errors = await asMarco(context, page);
  const r = await page.evaluate(() => {
    const rec = TeamLearn.allQs().filter((q) => q.k === 'recognise'), pos = [0, 0, 0, 0];
    for (let n = 0; n < 10; n++) rec.forEach((q, i) => pos[TeamLearn.deal(q, `t${n}-${i}`).a]++);
    const q = rec[0], orders = new Set(); for (let n = 0; n < 10; n++) orders.add(TeamLearn.deal(q, `o${n}`).opts.join('|'));
    const pc = TeamLearn.allQs().find((x) => x.k === 'recall'), dealt = TeamLearn.deal(pc, 'g');
    return { share: pos.map((x) => x / pos.reduce((a, b) => a + b, 0)), orders: orders.size,
      again: TeamLearn.deal(q, 'same').opts.join() === TeamLearn.deal(q, 'same').opts.join(),
      graded: TeamLearn.gradeChoices(dealt, TeamLearn.choices(dealt).right).ok };
  });
  for (const s of r.share) expect(s).toBeGreaterThan(0.18); // no place holds the answer far more than its share
  expect(r.orders).toBeGreaterThan(4);
  expect(r.again).toBe(true); // one showing stays put, so the screen and the marking agree
  expect(r.graded).toBe(true);
  expect(errors).toEqual([]);
});

test('scrolling: the next question opens at its top, a new screen opens at its top, and Back returns to where you were', async ({ context, page }) => {
  await page.setViewportSize({ width: 390, height: 560 });
  const errors = await asMarco(context, page);
  const scroller = page.locator('[data-scroll]').first();
  const top = () => scroller.evaluate((el) => el.scrollTop);
  // A list scrolled down, then a wine opened from it: the wine opens at its top, and Back returns to the list where it was.
  await page.getByTestId('team-tab-wines').click();
  await scroller.evaluate((el) => { el.scrollTop = 600; });
  const listAt = await top();
  expect(listAt).toBeGreaterThan(300);
  // Tap a row where it already is, as a finger would (a locator's click scrolls it into view first).
  const box = await scroller.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('team-pitch')).toBeVisible();
  expect(await top()).toBe(0);
  await scroller.evaluate((el) => { el.scrollTop = 400; });
  await page.getByLabel('Back').click();
  expect(Math.abs((await top()) - listAt)).toBeLessThan(2);
  // A tab opens at its top.
  await page.getByTestId('team-tab-menu').click();
  expect(await top()).toBe(0);
  // In a drill, the next question opens at its top however far the last one was scrolled.
  await page.getByTestId('team-tab-today').click();
  await page.getByText(/Start today's drill|Practise · 5 questions/).first().click();
  await expect(page.getByTestId('drill-q')).toBeVisible();
  await page.getByTestId('drill-opt').first().click();
  await page.getByText('Check', { exact: true }).click();
  await scroller.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  expect(await top()).toBeGreaterThan(0);
  await page.getByText(/^(Next|Finish)$/).first().click();
  expect(await top()).toBe(0);
  expect(errors).toEqual([]);
});

test('every recall question, about a wine or a dish, offers only answers of its own kind', async ({ context, page }) => {
  const errors = await asMarco(context, page);
  const r = await page.evaluate(() => {
    const norm = (x) => TeamLearn._norm(x);
    const recall = TeamLearn.allQs().filter((q) => q.k === 'recall' && !/price|much|glass|bottle/i.test(q.q));
    // Every right answer, filed under the kind of question it answers.
    const kindOf = {}; recall.forEach((q) => { const t = TeamLearn._topic(q.q); String(q.ans).split(/,|\band\b|;/).forEach((a) => { const k = norm(a); if (k) (kindOf[k] = kindOf[k] || new Set()).add(t); }); });
    const names = new Set(TeamData.wines().map((w) => norm(TeamData.short(w))));
    const untyped = recall.filter((q) => !TeamLearn._topic(q.q)).map((q) => q.q);
    const mixed = [], notWines = [];
    for (const q of recall) {
      const t = TeamLearn._topic(q.q), c = TeamLearn.choices(TeamLearn.deal(q, 'k'));
      for (const o of c.opts) {
        const ks = kindOf[norm(o)];
        if (ks && !ks.has(t)) mixed.push(`${q.q.slice(0, 50)} → ${o}`);
        if (t === 'wine' && !names.has(norm(o))) notWines.push(`${q.q.slice(0, 50)} → ${o}`);
      }
    }
    const dishQ = recall.find((q) => q.dish), dc = TeamLearn.choices(TeamLearn.deal(dishQ, 'd'));
    return { untyped, mixed, notWines, dishOpts: dc.opts.length };
  });
  expect(r.untyped).toEqual([]);
  expect(r.mixed).toEqual([]); // no answer to another kind of question turns up as a wrong option
  expect(r.notWines).toEqual([]); // "Name a wine for the cod" offers only wines on the list
  expect(r.dishOpts).toBeGreaterThan(3);
  expect(errors).toEqual([]);
});

test('no question offers answers from all over: comparisons stay on their two wines, tables on their reasons, nothing falls back to the mixed pool', async ({ context, page }) => {
  const errors = await asMarco(context, page);
  const r = await page.evaluate(() => {
    const norm = (x) => TeamLearn._norm(x), all = TeamLearn.allQs(), wines = TeamData.wines();
    const pooled = all.filter((q) => q.k !== 'recognise' && TeamLearn.choices(TeamLearn.deal(q, 'p')).via === 'pool').map((q) => `${q.k}: ${q.q.slice(0, 60)}`);
    // A comparison's options talk about its two wines only: no third wine on the list is named in them.
    const third = [];
    for (const q of all.filter((x) => x.k === 'contrast')) {
      const named = wines.filter((w) => norm(q.q).includes(norm(TeamData.short(w))));
      const others = wines.filter((w) => !named.includes(w) && w.id !== q.wine);
      for (const o of TeamLearn.choices(TeamLearn.deal(q, 'c')).opts) {
        const hit = others.find((w) => norm(o).includes(norm(TeamData.short(w))) || (w.producer && norm(w.producer).length > 5 && norm(o).includes(norm(w.producer))));
        if (hit) third.push(`${q.q.slice(0, 50)} → ${o}`);
      }
    }
    const tables = all.filter((q) => q.k === 'apply').map((q) => TeamLearn.choices(TeamLearn.deal(q, 't')));
    return { pooled, third, ungrouped: tables.filter((c) => !c.groups).length, priced: tables.flatMap((c) => c.groups ? c.opts.slice(c.groups[c.groups.length - 1].from) : []).filter((o) => /£\d/.test(o)) };
  });
  expect(r.pooled).toEqual([]); // every recall, comparison and table question builds its own options
  expect(r.third).toEqual([]);
  expect(r.ungrouped).toBe(0);
  expect(r.priced).toEqual([]); // "Why it works" never offers a price
  expect(errors).toEqual([]);
});

test('when the list is short of a kind of wine, well-known bottles that are not on it make up the choices', async ({ context, page }) => {
  const errors = await asMarco(context, page);
  const r = await page.evaluate(() => {
    const mine = new Set(TeamData.wines().map((w) => TeamLearn._norm(TeamData.short(w))));
    const off = TeamLearn.offList('sweet', 3, 's');
    return { n: off.length, onList: off.filter((x) => mine.has(TeamLearn._norm(x))) };
  });
  expect(r.n).toBe(3);
  expect(r.onList).toEqual([]);
  expect(errors).toEqual([]);
});

test('delivery: pace, time to start, fillers, hedges and whether the wine\'s name came through', async ({ context, page }) => {
  const errors = await asMarco(context, page);
  const r = await page.evaluate(() => {
    const t0 = 1_000_000;
    const d = TeamVoice.delivery({ text: "Um, I think I'd go for the Gusbourne, it's sort of crisp and maybe lovely with the crab", startedAt: t0, askedAt: t0, firstAt: t0 + 5200, lastAt: t0 + 5200 + 6000,
      names: [{ name: 'Gusbourne Blanc de Blancs', say: 'GUZ-born' }, { name: 'Dönnhoff Riesling Trocken', say: 'DURN-hoff' }], expected: ['Dönnhoff Riesling Trocken'] });
    // No wine on the list came through: the expected one's sounds-like spelling is offered.
    const lost = TeamVoice.delivery({ text: "I'd go for the dern off, it's dry and racy with the pork", startedAt: t0, askedAt: t0, firstAt: t0 + 900, lastAt: t0 + 4000,
      names: [{ name: 'Dönnhoff Riesling Trocken', say: 'DURN-hoff' }], expected: ['Dönnhoff Riesling Trocken'] });
    return { d, lost, heardSplit: TeamVoice.heardName('the don hoff riesling please', 'Dönnhoff Riesling Trocken'), missed: TeamVoice.heardName('the gooseberry one', 'Gusbourne Blanc de Blancs') };
  });
  expect(r.d.fillers).toBe(2); // "um", "sort of"
  expect(r.d.hedges).toBe(2); // "I think", "maybe"
  expect(r.d.wpm).toBeGreaterThan(150);
  expect(r.d.waitMs).toBe(5200);
  expect(r.d.notes.some((n) => n.k === 'wait' && !n.good)).toBe(true);
  expect(r.d.names.find((n) => /Gusbourne/.test(n.name)).heard).toBe(true);
  expect(r.d.notes.some((n) => n.k === 'name' && !n.good)).toBe(false); // they named a wine clearly: choosing it is the guest's mark, not a name problem
  expect(r.lost.notes.some((n) => n.k === 'name' && /DURN-hoff/.test(n.text))).toBe(true); // no name came through: here's how to say it
  expect(r.heardSplit).toBe(true); // speech-to-text splitting a name it doesn't know still counts
  expect(r.missed).toBe(false);
  expect(errors).toEqual([]);
});

test('a spoken table: the guest is said aloud, the reply is spoken into the box, and the result coaches the delivery', async ({ context, page }) => {
  // Stand-ins for the browser's speech engines: the voice finishes at once; the microphone "hears" a reply.
  await context.addInitScript(() => {
    window.__spoken = [];
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 5); }, cancel() {}, getVoices() { return []; } } });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    window.SpeechRecognition = class { start() { this._t = setTimeout(() => { const res = [{ 0: { transcript: "Um I'd go for the Grüner by the glass, it's peppery and fresh with the olives" }, isFinal: true, length: 1 }]; this.onresult && this.onresult({ resultIndex: 0, results: res }); }, 300); }
      stop() { clearTimeout(this._t); setTimeout(() => this.onend && this.onend(), 5); } };
  });
  const errors = await asMarco(context, page, { claudeText: (b) => {
    if (b.purpose !== 'team_guest') return '';
    if (!/SERVER:/.test(b.messages[0].content)) return '{"guest":"Evening! What would you pour with the olives?","done":false}';
    return JSON.stringify({ guest: 'Lovely, thank you.', done: true, mark: { score: 0.8, verdict: 'right', good: 'Named it and why.', missing: '', better: '' } });
  } });
  await page.getByTestId('team-tab-vinny').click();
  await page.getByText('Take a table').click();
  await expect(page.getByTestId('guest-line')).toContainText('olives');
  await expect(page.getByTestId('guest-voice')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => page.evaluate(() => window.__spoken.join('|'))).toContain('What would you pour'); // the guest said aloud
  await page.getByTestId('guest-mic').click();
  await expect(page.getByTestId('voice-notice')).toBeVisible(); // where the words go, said once
  await expect(page.getByTestId('guest-reply')).toHaveValue(/Grüner by the glass/);
  await page.getByTestId('guest-mic').click(); // tap when finished
  await page.getByText('Say', { exact: true }).click();
  await expect(page.getByTestId('you-line')).toContainText('🎙');
  await expect(page.getByTestId('you-delivery')).toContainText('filler');
  await expect(page.getByTestId('guest-delivery')).toContainText('Your delivery');
  await expect(page.getByTestId('delivery-note').first()).toBeVisible();
  // Voice off: no microphone, typing as before.
  await page.getByText('Another table').click();
  await page.getByTestId('guest-voice').click();
  await expect(page.getByTestId('guest-mic')).toHaveCount(0);
  await expect(page.getByTestId('guest-reply')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a wine card says how to pronounce the wine, and Say it speaks it', async ({ context, page }) => {
  await context.addInitScript(() => { window.__spoken = []; Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 5); }, cancel() {}, getVoices() { return []; } } }); window.SpeechSynthesisUtterance = function (t) { this.text = t; }; });
  const errors = await asMarco(context, page);
  await page.getByTestId('team-tab-wines').click();
  await page.getByText(/Dönnhoff/).first().click();
  await expect(page.getByTestId('team-say')).toContainText('DURN-hoff');
  await page.getByTestId('team-say').click();
  await expect.poll(() => page.evaluate(() => window.__spoken.join('|'))).toContain('DURN-hoff');
  expect(errors).toEqual([]);
});

// Vinny once said "nothing else comes by the glass" with another glass among the olives' best: each
// dish's line now marks which of its best wines are poured by the glass, and names the first pick.
test("Vinny's menu lines mark every by-the-glass wine in a dish's pairing", async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=demo`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  const line = await page.evaluate(() => TeamVinny._lines().text.split('\n').find((l) => /Gordal olives/.test(l)));
  expect(line).toMatch(/best with [^·]*Nyetimber Classic Cuvée \(W\d+\) also by the glass/);
  expect(line).toMatch(/first pick by the glass Bründlmayer/);
  expect(line).not.toMatch(/Sancerre \(W\d+\) also by the glass/);
  const prompt = await page.evaluate(() => _loadTextSync('prompts/team-vinny.txt'));
  expect(prompt).toContain('not the only one');
});
