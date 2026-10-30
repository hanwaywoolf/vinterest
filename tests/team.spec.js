// The restaurant staff-training app (team-*.js, team-app.jsx, docs/business.md): the sample
// restaurant, the drill and its review schedule, readiness against a role's minimum, an upload
// reviewed and published into staff cards, pairings and assignments, and the Worker keeping its
// Claude calls to Pro accounts.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const { stubNetwork } = require('./helpers');

const BASE = 'http://localhost:4173';
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
  await expect(page.locator('#root')).toContainText('0 of 7 · need 80%'); // seven wines by the glass, a manager's minimum
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
  await expect(page.getByTestId('team-published')).toBeVisible();
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

test('the Worker keeps the team calls to Pro: signed out with accounts on, it asks them to sign in', async () => {
  const copy = path.join(require('node:os').tmpdir(), `worker-team-${process.pid}.mjs`);
  require('node:fs').copyFileSync(path.join(__dirname, '..', '_worker.js'), copy);
  const worker = (await import(pathToFileURL(copy).href + `?t=${Date.now()}`)).default;
  const env = { ANTHROPIC_API_KEY: 'test', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'pk', SUPABASE_SECRET_KEY: 'sk' };
  for (const purpose of ['team_list', 'team_menu', 'team_cards', 'team_pairings', 'team_grade']) {
    const r = await worker.fetch(new Request('https://vinterest.pages.dev/claude', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://vinterest.pages.dev' }, body: JSON.stringify({ purpose, messages: [{ role: 'user', content: 'x' }] }) }), env);
    expect(r.status).toBe(402);
    expect((await r.json()).signIn).toBe(true);
  }
});
