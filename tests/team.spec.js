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

// The Social Corner (Vancouver), installed from its website (intake/perse/): /team/?seed=social opens its own
// list and menu with its logo and Canadian dollars, and no invented staff: whoever opens it becomes its manager.
test('The Social Corner opens from ?seed=social on its own team, logo, dollars and invented sales', async ({ context, page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=social`);
  await expect(page.getByTestId('team-venue-logo')).toHaveAttribute('src', 'brand/social-corner/wordmark-white.png');
  const logo = await page.request.get(`${BASE}/team/brand/social-corner/wordmark-white.png`);
  expect(logo.status()).toBe(200);
  const st = await page.evaluate(() => {
    const ppl = TeamLearn.people(), state = (n) => TeamLearn.readiness(ppl.find((p) => p.name.startsWith(n)).id).state;
    const rows = TeamSales.get().rows;
    return { me: TeamLearn.me().name, people: ppl.map((p) => [p.name, p.role]), sym: TeamData.currency().sym, venue: TeamData.get().venue,
      claire: state('Claire'), marco: state('Marco'), demo: TeamSales.demo(), rows: rows.length,
      sellers: [...new Set(rows.map((r) => r.v).filter(Boolean))].map((id) => TeamLearn.person(id).name.split(' ')[0]).sort(),
      happy: rows.some((r) => /Hatch B\. Yanco/.test(r.n) && !r.w) };
  });
  expect(st.me).toBe('Elena Ruiz');
  expect(st.people).toEqual([['Elena Ruiz', 'manager'], ['Claire Whitfield', 'sommelier'], ['Marco Delgado', 'bartender'], ['Dani Haddad', 'server'], ['Priya Nair', 'server'], ['Amara Okafor', 'server'], ['David Chen', 'server']]);
  expect(st.sym).toBe('$');
  expect(st.venue).toMatchObject({ name: 'The Social Corner', city: 'Vancouver', sample: 'social', brand: { accent: '#A88963' } });
  expect(st).toMatchObject({ claire: 'ready', marco: 'slipping', demo: true, happy: true });
  expect(st.rows).toBeGreaterThan(1000);
  expect(st.sellers).toEqual(['Amara', 'Claire', 'Dani', 'David', 'Marco', 'Priya']);
  await page.getByTestId('team-tab-wines').click();
  await expect(page.locator('#root')).toContainText('Antinori Tignanello');
  await expect(page.locator('#root')).toContainText('bottle $350');
  await expect(page.locator('#root')).not.toContainText('£');
  await page.reload(); // stays put, with its team
  await expect(page.getByTestId('team-venue-logo')).toBeVisible();
  expect(await page.evaluate(() => TeamLearn.people().length)).toBe(7);
  expect(errors).toEqual([]);
});

// The Princess Royal (Notting Hill, Cubitt House), installed from the menus and wine list on its site
// (intake/princess-royal/): ?seed=princess opens it in pounds on the same invented team and sales as The Social Corner,
// with its own one-line logo (white, supplied by Carey) and the POS item its list doesn't carry.
test('The Princess Royal opens from ?seed=princess on its own team, pounds and invented sales', async ({ context, page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=princess`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  const st = await page.evaluate(() => {
    const ppl = TeamLearn.people(), rows = TeamSales.get().rows;
    return { me: TeamLearn.me().name, people: ppl.length, sym: TeamData.currency().sym, venue: TeamData.get().venue, allergens: TeamData.allergenCountry(),
      wines: TeamData.wines().length, cards: TeamData.wines().filter((w) => TeamData.card(w.id)).length, dishes: TeamData.dishes().length, cocktails: TeamData.cocktails().length,
      demo: TeamSales.demo(), rows: rows.length, pours: [...new Set(rows.filter((r) => r.s === 'glass' && r.w).map((r) => r.n.split(' ').pop()))].sort(),
      offList: rows.some((r) => /House Prosecco 125/.test(r.n) && !r.w) };
  });
  expect(st.me).toBe('Elena Ruiz');
  expect(st.people).toBe(7);
  expect(st.sym).toBe('£');
  expect(st.allergens).toBe('GB');
  expect(st.venue).toMatchObject({ name: 'The Princess Royal', city: 'London', sample: 'princess-royal' });
  await expect(page.getByTestId('team-venue-logo')).toHaveAttribute('src', 'brand/princess-royal/wordmark-white.svg');
  expect((await page.request.get(`${BASE}/team/brand/princess-royal/wordmark-white.svg`)).status()).toBe(200);
  expect(st).toMatchObject({ wines: 132, cards: 132, dishes: 55, cocktails: 25, demo: true, offList: true });
  expect(st.pours).toEqual(['125', '175']);
  expect(st.rows).toBeGreaterThan(1000);
  await expect(page.locator('#root')).not.toContainText('$');
  expect(errors).toEqual([]);
});

// A device that opened The Social Corner from an older build (here: before its team and sales, set up by whoever
// opened it) reloads it from ?seed=social once the list file has moved on, though the training file is the same.
test('a device holding an older Social Corner takes the new one, with or without ?seed=social, keeping who was there and their progress', async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=social`);
  await page.evaluate(() => { const d = TeamData.get(); d.venue.seeded = 'an older copy'; TeamData.save(d);
    Store.remove(TeamLearn.KEY); TeamLearn.resetProgress(); TeamSales.clear(); TeamLearn.setMe(TeamLearn.addPerson('Alex Morgan', 'manager')); });
  await page.goto(`${BASE}/team/`); // even without ?seed

  // The new copy's team joins the person already here, who stays signed in; the demo sales are written.
  await expect.poll(() => page.evaluate(() => TeamLearn.people().length)).toBe(8);
  expect(await page.evaluate(() => [TeamLearn.me().name, TeamLearn.people().some((p) => p.name === 'Elena Ruiz'), TeamSales.get().rows.length > 1000])).toEqual(['Alex Morgan', true, true]);
  expect(await page.evaluate(() => TeamSample.current('social'))).toBe(true);
  await page.reload(); // and keeps it after that
  expect(await page.evaluate(() => TeamLearn.people().length)).toBe(8);
});

test('The Social Corner opens from the setup screen, for a phone whose link lost ?seed=social', async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/`);
  await page.getByTestId('team-load-social').click();
  await expect(page.getByTestId('team-venue-logo')).toBeVisible();
  expect(await page.evaluate(() => [TeamLearn.me().name, TeamLearn.people().length, TeamSales.get().rows.length > 1000])).toEqual(['Elena Ruiz', 7, true]);
});

test('?view=phone keeps the phone app on a wide screen, for the manager too', async ({ context, page }) => {
  await stubNetwork(context);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE}/team/?seed=social&view=phone`);
  await expect(page.getByTestId('team-tab-today')).toBeVisible();
  await expect(page.getByTestId('console-nav-dash')).toHaveCount(0);
  await page.goto(`${BASE}/team/`); // without it, the manager on a wide screen gets the console
  await expect(page.getByTestId('console-nav-dash')).toBeVisible();
});

test('The Social Corner cocktails: cards, their own part of readiness, drilled, and on the dishes they suit', async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=social`);
  // A fresh person, so the cocktail they answer below starts unknown (the demo team has its own progress).
  await page.evaluate(() => { TeamLearn.setMe(TeamLearn.addPerson('Sam Reyes', 'manager')); });
  const st = await page.evaluate(() => {
    const me = TeamLearn.me();
    const cs = TeamData.cocktails(), qs = TeamLearn.cocktailQs(cs[0].id);
    return { n: cs.length, cards: cs.filter((c) => TeamData.cocktailCard(c.id)).length, mc: qs.every((q) => q.mc && q.opts.length === 4 && q.opts[q.a]),
      parts: Object.keys(TeamLearn.readiness(me.id).parts), barKinds: TeamLearn.kindsFor('bartender', cs[0].id), barNeed: TeamLearn.readiness(TeamLearn.people().find((p) => p.role === 'bartender').id).parts.cocktails.need };
  });
  expect(st).toMatchObject({ n: 20, cards: 20, mc: true, barNeed: 0.9 });
  expect(st.parts).toContain('cocktails');
  expect(st.barKinds).toEqual(['recognise', 'recall', 'apply', 'contrast']);
  // Answering every question on one cocktail right makes it known, and the part moves.
  const moved = await page.evaluate(() => {
    const me = TeamLearn.me(), id = TeamData.cocktails()[0].id, before = TeamLearn.readiness(me.id).parts.cocktails.partial;
    TeamLearn.qsOf(id).filter((q) => TeamLearn.kindsFor(me.role, id).includes(q.k)).forEach((q) => TeamLearn.record(me.id, q, true, 'sure'));
    return { before, after: TeamLearn.readiness(me.id).parts.cocktails.partial, known: TeamLearn.knowsWine(me.id, me.role, id, TeamLearn._all()[me.id].items) };
  });
  expect(moved.known).toBe(true);
  expect(moved.after).toBeGreaterThan(moved.before);
  // The list and a card on screen.
  await page.getByTestId('team-tab-wines').click();
  await expect(page.getByTestId('team-cocktail-row')).toHaveCount(0); // wines first
  await page.getByTestId('team-list-cocktails').click();
  await expect(page.getByTestId('team-cocktail-row')).toHaveCount(20);
  await page.getByTestId('team-cocktail-row').filter({ hasText: 'The Negroni' }).click();
  await expect(page.getByTestId('team-cocktail')).toContainText('Roku Gin');
  await expect(page.getByTestId('team-pitch')).not.toBeEmpty();
  // Anything that stands on its own starts with a capital, however the card was written: pills, the base spirit, "Offer instead".
  const lower = await page.getByTestId('team-cocktail').locator('[data-pill]').evaluateAll((els) => els.map((e) => e.textContent.trim()).filter((t) => /^[a-z]/.test(t)));
  expect(lower).toEqual([]);
  await expect(page.getByTestId('team-cocktail')).toContainText('Gin');
  // The drill asks a cocktail question as four options.
  await page.getByText(/Practise this cocktail|Start this cocktail/).click();
  await expect(page.getByTestId('drill-opt')).toHaveCount(4);
  // The console has a Cocktails section beside Wines.
  await page.goto(`${BASE}/team/?view=console`);
  await page.getByTestId('console-nav-cocktails').click();
  await expect(page.getByTestId('cocktails-row')).toHaveCount(20);
  // The Larkspur has no cocktail part.
  await page.goto(`${BASE}/team/?seed=demo`);
  const demo = await page.evaluate(() => ({ n: TeamData.cocktails().length, parts: TeamLearn.people().map((p) => Object.keys(TeamLearn.readiness(p.id).parts)).flat() }));
  expect(demo.n).toBe(0);
  expect(demo.parts).not.toContain('cocktails');
  await expect(page.getByTestId('team-list-switch')).toHaveCount(0);
});

test('the setup screen offers The Social Corner and The Larkspur, a device left on The Copper Pan goes back to it, and Change restaurant returns there', async ({ context, page }) => {
  await openSample(context, page);
  await page.goto(`${BASE}/team/`); // no seed: the Copper Pan is retired
  await expect(page.getByTestId('team-load-demo')).toBeVisible();
  await expect(page.getByText('Look around with a sample restaurant')).toHaveCount(0);
  await expect(page.getByTestId('team-load-demo')).toContainText(/Open The Larkspur: 30 wines, 27 dishes, a team of \w+/);
  await expect(page.getByTestId('team-load-social')).toContainText('Open The Social Corner');
  await expect(page.getByTestId('team-load-social')).toContainText('41 wines, 20 cocktails, 62 dishes, a team of 7');
  await page.getByTestId('team-load-demo').click();
  await expect(page.locator('#root')).toContainText('The Larkspur');
  await page.reload(); // The Larkspur stays put
  await expect(page.locator('#root')).toContainText('The Larkspur');
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('team-who').click();
  await page.getByTestId('team-change-restaurant').click();
  await expect(page.getByTestId('team-load-demo')).toBeVisible();
});

test('?seed=perse opens The Social Corner in its own accent, prices in Canadian dollars, its description in what Claude writes from', async ({ context, page }) => {
  const reqs = [];
  await stubNetwork(context, { claudeRequests: reqs, claudeText: () => '{"cards":[]}' });
  await page.goto(`${BASE}/team/?seed=perse`);
  await page.waitForFunction(() => window.TeamData && TeamData.wines().length > 0);
  const r = await page.evaluate(() => ({ sample: TeamData.get().venue.sample, cur: TeamData.currency(), accent: C.cr, about: TeamData.about() }));
  expect(r.sample).toBe('social');
  expect(r.cur).toMatchObject({ sym: '$', code: 'CAD' });
  expect(r.accent).toBe('#A88963');
  expect(r.about).toMatch(/Canadian English/);
  await page.evaluate(() => { TeamData.writeCards([TeamData.wines()[0].id]).catch(() => {}); });
  await expect.poll(() => reqs.filter((x) => x.purpose === 'team_cards').length).toBeGreaterThan(0);
  expect(reqs.find((x) => x.purpose === 'team_cards').messages[0].content).toMatch(/About the restaurant: Social Corner/);
  // Another restaurant puts Vinterest's crimson back.
  const p2 = await context.newPage();
  await p2.goto(`${BASE}/team/?seed=demo`);
  await expect(p2.getByTestId('team-state')).toBeVisible();
  expect(await p2.evaluate(() => C.cr)).not.toBe('#A88963');
});

test('the sample restaurant opens on Today: not ready yet, with every wine and dish to learn', async ({ context, page }) => {
  const errors = await openSample(context, page);
  // Someone who hasn't drilled yet is shown a plan, not a verdict: the first wave (the glass list) with its days.
  await expect(page.getByTestId('team-plan')).toContainText('Your first 10 days');
  await expect(page.getByTestId('team-state')).toHaveText('The 7 wines by the glass');
  await expect(page.locator('#root')).toContainText('0 of 7 known · need 80%'); // seven wines by the glass, a manager's minimum
  await expect(page.locator('#root')).toContainText('This wave: by the glass (7 to go)'); // the bottles and dishes come in later waves
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

// The drill recipe (TeamLearn.drill): one question per wine or dish; what's due first; at most NEW_MAX new things once
// anything is due, dealt one per list section; a recall question five pills (seven for a three-grape blend); a grape
// question never offers a wine's name; "How sure are you?" asked on a price alone.
test('the drill deals one question per wine, caps new things once answers are due, keeps recall to five pills and asks confidence on prices only', async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=social`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  const r = await page.evaluate(() => {
    const who = (n) => TeamLearn.people().find((p) => p.name.startsWith(n)).id, item = (q) => q.wine || q.dish || q.cocktail;
    const amara = who('Amara'), priya = who('Priya'), items = TeamLearn._all();
    const dueFor = (pid) => Object.values((items[pid] || { items: {} }).items).filter((it) => it.reps && (it.wrong || it.due <= Date.now())).length;
    const d = TeamLearn.drill(priya), ids = d.map(item);
    const fresh = d.filter((q) => !(items[priya].items[q.id] && items[priya].items[q.id].reps) && !q.check).length;
    // A new server with nothing due: five new things from different sections of the list.
    const fresh2 = TeamLearn.addPerson('Sam New', 'server'); const d2 = TeamLearn.drill(fresh2);
    const secs = d2.map((q) => (TeamData.wine(q.wine) || TeamData.dish(q.dish) || {}).section);
    const sizes = {}; let wineAsGrape = 0, conf = 0, money = 0;
    TeamData.wines().forEach((w) => TeamLearn.wineQs(w.id).forEach((q) => { if (q.k === 'recognise') return; const c = TeamLearn.choices(q);
      if (q.k === 'recall') { sizes[c.opts.length] = (sizes[c.opts.length] || 0) + 1; if (TeamLearn._topic(q.q) === 'grape') c.opts.forEach((o) => { if (TeamData.wines().some((x) => TeamLearn._norm(o).includes(TeamLearn._norm(TeamData.short(x))))) wineAsGrape++; }); }
      if (TeamLearn.asksConfidence(q)) { conf++; if (/[£$€]/.test(String(q.ans || ''))) money++; } }));
    TeamLearn.removePerson(fresh2);
    return { due: dueFor(priya), n: d.length, distinct: new Set(ids).size, fresh, secs: new Set(secs).size, sizes, wineAsGrape, conf, money };
  });
  expect(r.n).toBe(5);
  expect(r.distinct).toBe(5); // one per wine or dish
  expect(r.due).toBeGreaterThan(0); expect(r.fresh).toBeLessThanOrEqual(2); // new things capped once anything is due
  expect(r.secs).toBeGreaterThanOrEqual(3); // a first drill spreads over the list's sections
  expect(Math.max(...Object.keys(r.sizes).map(Number))).toBeLessThanOrEqual(7); expect(Math.min(...Object.keys(r.sizes).map(Number))).toBeGreaterThanOrEqual(4);
  expect(r.wineAsGrape).toBe(0);
  expect(r.conf).toBeGreaterThan(0); expect(r.conf).toBe(r.money); // confidence is asked on prices, nowhere else yet
});

// Tonight (TeamData.tonight): a manager 86s a dish and puts a wine on feature; every Today shows it until the day ends,
// with the two by-the-glass wines that person should look at; Vinny's suggestions pick it up; nothing is scored.
test('tonight: 86d and the feature set by a manager show on everyone\'s Today with two wines to look at, and clear tomorrow', async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=social`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  await expect(page.getByTestId('team-tonight')).toContainText('Set tonight'); // the manager sees the card empty, with the way in
  await page.getByTestId('tonight-edit').click();
  await page.getByTestId('tonight-off').filter({ hasText: 'Fresh Oysters' }).click();
  await page.getByTestId('tonight-feature').filter({ hasText: 'Lambrusco' }).click();
  await page.getByText('Done', { exact: true }).click();
  await expect(page.getByTestId('tonight-off')).toContainText('Fresh Oysters');
  await expect(page.getByTestId('tonight-feature')).toBeVisible();
  await expect(page.getByTestId('team-tonight')).toContainText('Lambrusco');
  // A server sees the same, plus two wines to look at before service, each with Say it.
  await page.getByTestId('team-who').click(); await page.getByText('Priya ·').click();
  await expect(page.getByTestId('team-tonight')).toContainText("86'd: Fresh Oysters");
  await expect(page.getByTestId('tonight-look')).toBeVisible();
  expect(await page.getByLabel(/^Say /).count()).toBeGreaterThanOrEqual(3);
  await expect(page.getByTestId('tonight-edit')).toHaveCount(0);
  const r = await page.evaluate(() => ({ sugg: TeamVinny.suggest(TeamLearn.me().id), tomorrow: TeamData.tonight(Date.now() + 86400000), off: TeamData.isOff('d-fresh-oysters') }));
  expect(r.sugg[0]).toMatch(/Lambrusco|Medici/); expect(r.sugg).toContain("What's off tonight?");
  expect(r.tomorrow.off).toEqual([]); expect(r.tomorrow.feature).toEqual([]); expect(r.off).toBe(true);
});

// The menu module (docs/business.md, "The menu"): a dish's notes say what it is, what can change and what guests ask; its
// allergens are a draft until the kitchen confirms them on the console, and only then are they shown on the dish, asked
// in the drill (choose all, with confidence, a miss back within the shift), counted in readiness (the Allergens part, at
// 100%) and entered in the sign-off register.
test('the menu module: allergens are drafted, confirmed by the kitchen, then shown, drilled and registered', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage();
  await stubNetwork(ctx);
  await page.goto(`${BASE}/team/?seed=social&view=console`);
  await expect(page.getByTestId('console-dash')).toBeVisible();
  const before = await page.evaluate(() => ({ notes: Object.keys(TeamData.get().dishCards || {}).length, conf: TeamData.allergensOf('d-fresh-oysters'), parts: Object.keys(TeamLearn.readiness(TeamLearn.me().id).parts), qs: TeamLearn.dishQs('d-fresh-oysters', { all: true }).map((q) => q.id),
    know: TeamLearn.dishQs('d-fresh-oysters', { all: true }).find((q) => /#know$/.test(q.id)), others: TeamData.dishes().filter((x) => x.id !== 'd-fresh-oysters').map((x) => (TeamData.dishCard(x.id) || {}).say).filter(Boolean) }));
  expect(before.notes).toBeGreaterThan(30); expect(before.conf).toBeNull();
  // Know it asks the dish's own sentence against near-misses of the same dish, never another dish's description
  // (the question names the dish, so "the lamb shoulder" against "a lemon tart" taught nothing).
  expect(before.know.opts).toHaveLength(4); expect(before.know.opts.filter((o) => /oysters/i.test(o)).length).toBeGreaterThanOrEqual(3);
  before.know.opts.forEach((o) => expect(before.others).not.toContain(o));
  expect(before.parts).not.toContain('allergens'); // no allergen part until the kitchen has confirmed a dish
  expect(before.qs.some((id) => /#allergen$/.test(id))).toBe(false); expect(before.qs.some((id) => /#know$/.test(id))).toBe(true);
  // The kitchen confirms the oysters on the Menu tab: the draft is offered, one chip is dropped, Confirm.
  await page.getByText('Menu', { exact: true }).first().click();
  await expect(page.getByTestId('menu-allergen-todo')).toContainText('allergens to confirm');
  const row = page.getByTestId('menu-row').filter({ hasText: 'Fresh Oysters' });
  await expect(row.getByTestId('menu-allergens')).toContainText('Draft');
  await row.getByTestId('menu-confirm').click();
  const pressed = page.getByTestId('menu-allergen-toggle').filter({ has: page.locator('[aria-pressed="true"]') });
  await page.getByTestId('menu-allergen-toggle').filter({ hasText: 'Sulphites' }).click(); // not in it, says the chef
  await page.getByText('Confirm these').click();
  const after = await page.evaluate(() => ({ conf: TeamData.allergensOf('d-fresh-oysters'), by: TeamData.dishCard('d-fresh-oysters').allergens.by, parts: Object.keys(TeamLearn.readiness(TeamLearn.me().id).parts),
    q: TeamLearn.allergenQ('d-fresh-oysters'), assigned: TeamLearn.people().every((p) => TeamLearn.assignments(p.id).some((a) => a.kind === 'allergen' && a.id === 'd-fresh-oysters')) }));
  expect(after.conf).toEqual(['shellfish']); expect(after.by).toBe('Elena Ruiz'); expect(after.parts).toContain('allergens'); expect(after.assigned).toBe(true);
  expect(after.q.conf).toBe(true); expect(after.q.pills.groups[0].all).toBe(true); expect(after.q.pills.opts[after.q.pills.right[0]]).toBe('Crustaceans and molluscs');
  await expect(row.getByTestId('menu-allergens')).toContainText('Crustaceans and molluscs');
  // The register on the Team tab now counts one confirmed dish, nobody holding it yet; the CSV has a row per person.
  await page.getByText('Team', { exact: true }).first().click();
  await expect(page.getByTestId('register-table')).toBeVisible();
  await expect(page.getByTestId('register-row').first()).toContainText('0 of 1');
  const csv = await page.evaluate(() => TeamReport.allergenCsv());
  expect(csv.split('\n')[0]).toBe('Venue,Person,Role,Dishes confirmed,Held now,Passed on,Falls due'); expect(csv.split('\n').filter(Boolean).length).toBe(8);
  // On the phone, as Priya: the dish shows the confirmed allergens (never the draft), the Allergens part has its own bar,
  // and practising it asks the choose-all question with How sure; a right answer passes her in the register.
  await page.evaluate(() => { TeamLearn.setMe(TeamLearn.people().find((p) => p.name.startsWith('Priya')).id); });
  await page.goto(`${BASE}/team/?view=phone`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  await expect(page.getByTestId('team-part').filter({ hasText: 'Allergens' })).toContainText('0 of 1 known · need 100%');
  await page.getByTestId('team-tab-menu').click();
  await page.getByText('Fresh Oysters', { exact: true }).first().click();
  await expect(page.getByTestId('dish-allergens')).toContainText('Crustaceans and molluscs');
  await expect(page.getByTestId('dish-allergens')).not.toContainText('Sulphites');
  await expect(page.getByTestId('dish-say')).toContainText(/oysters/i);
  await expect(page.getByTestId('dish-mod').first()).toBeVisible();
  await page.getByLabel('Back').click();
  await page.getByTestId('team-tab-today').click();
  await page.getByTestId('team-part').filter({ hasText: 'Allergens' }).getByTestId('team-part-practise').click();
  await expect(page.getByTestId('drill-q')).toContainText('Which of these are in the Fresh Oysters?');
  await expect(page.getByTestId('drill-choose')).toContainText('Choose all that apply');
  await expect(page.getByTestId('drill-sure')).toBeVisible();
  await page.getByTestId('drill-opt').filter({ hasText: 'Crustaceans and molluscs' }).click();
  await page.getByText('Sure', { exact: true }).click();
  await page.getByText('Check', { exact: true }).click();
  await expect(page.getByTestId('drill-result')).toContainText('Right');
  const reg = await page.evaluate(() => TeamReport.allergenRegister().find((x) => x.person.name.startsWith('Priya')));
  expect(reg.state).toBe('passed'); expect(reg.known).toBe(1);
  await ctx.close();
});

test('the drill on screen: pick, say how sure, see the answer and why, then the summary', async ({ context, page }) => {
  await openSample(context, page);
  await page.getByText(/Start today's drill/).click();
  for (let i = 0; i < 5; i++) {
    await expect(page.getByTestId('drill-q')).toBeVisible();
    await page.getByTestId('drill-opt').first().click();
    const sure = page.getByText('Sure', { exact: true }); if (await sure.isVisible().catch(() => false)) await sure.click(); // asked on a price question only
    await page.getByText('Check', { exact: true }).click();
    await expect(page.getByTestId('drill-result')).toBeVisible();
    // As in the consumer quiz, the options have gone: the answer and its context are what's left.
    await expect(page.getByTestId('drill-opt')).toHaveCount(0);
    await expect(page.getByTestId('drill-answer')).toBeVisible();
    await page.getByText(i < 4 ? 'Next' : 'Finish', { exact: true }).click();
  }
  await expect(page.getByTestId('drill-done')).toContainText('of 5 right');
  // A newer copy of the restaurant (a new build's training) keeps everyone's progress and the day's drill.
  const kept = await page.evaluate(() => { const pid = TeamLearn.me().id, was = JSON.stringify(TeamLearn._all()[pid].items); TeamSample.load('sample');
    return { same: JSON.stringify((TeamLearn._all()[pid] || {}).items) === was, me: TeamLearn.me().id === pid }; });
  expect(kept).toEqual({ same: true, me: true });
  // Back on Today, the drill reads as done for the day, with more on offer rather than asked for again.
  await page.getByText('Done', { exact: true }).click();
  await expect(page.getByTestId('today-done')).toContainText("Today's drill done");
  await expect(page.getByText(/Start today's drill/)).toHaveCount(0);
  await page.getByText('Do another 5 questions').click();
  await expect(page.getByTestId('drill-q')).toBeVisible();
});

test('the publish check: every question is checked, the ones that fail are rewritten under the same id, and the demo is only counted', async ({ context, page }) => {
  const reqs = [];
  const errors = await openSample(context, page, { claudeRequests: reqs, claudeText: (b) => {
    if (b.purpose !== 'team_fix') return '';
    const ids = [...b.messages[0].content.matchAll(/^ID (\S+)/gm)].map((m) => m[1]);
    return JSON.stringify({ fixes: ids.filter((id) => id === 'w-ardanza-reserva#bad').map((id) => ({ id, q: { q: 'Which region is the La Rioja Alta Viña Ardanza Reserva from?', ans: 'Rioja', acc: [], why: 'Rioja Alta, in the north of Spain.' } })) });
  } });
  const r = await page.evaluate(async () => {
    // A question that offers its own answer as one of two.
    const d = TeamData.get(); d.cards['w-ardanza-reserva'].qs.push({ id: 'w-ardanza-reserva#bad', k: 'recall', q: 'Is the La Rioja Alta Viña Ardanza Reserva drunk young or aged?', ans: 'Aged', acc: [], why: 'x' }); TeamData.save(d);
    const before = TeamLearn.audit().map((f) => f.q.id);
    const checked = await TeamData.checkQuestions();
    const q = TeamData.card('w-ardanza-reserva').qs.find((x) => x.id === 'w-ardanza-reserva#bad');
    return { before, checked, q, after: TeamLearn.audit().map((f) => f.q.id), why: TeamLearn.audit().filter((f) => f.q.id === 'w-ardanza-reserva#bad').map((f) => f.why + ': ' + f.note), line: TeamData.checkedLine() };
  });
  expect(r.before).toContain('w-ardanza-reserva#bad');
  expect(r.q.q).toMatch(/Which region/); // rewritten in place, same id and kind (and not a repeat of the card's grape question)
  expect(r.q.k).toBe('recall');
  expect(r.why).toEqual([]);
  expect(r.after).not.toContain('w-ardanza-reserva#bad');
  expect(r.checked.fixed).toBeGreaterThanOrEqual(1);
  expect(r.checked.failed).toBe(r.before.length);
  expect(r.line).toMatch(/questions checked · \d+ rewritten/);
  const fix = reqs.filter((x) => x.purpose === 'team_fix');
  expect(fix.length).toBeGreaterThan(0);
  expect(fix.map((x) => x.messages[0].content).join('\n')).toMatch(/PROBLEM giveaway/);
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
  await expect(page.getByTestId('team-window')).toContainText('Still young'); // folded to its one line
  await page.getByTestId('fold-wine-life').getByRole('button').first().click();
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
  // The Nyetimber's table (oysters, a glass of sparkling) has nothing sparkling on the list that's clearly wrong
  // with oysters, so there's no fair choice of wine: it names the wine and asks why, two right reasons among wrong ones.
  expect(r).toMatchObject({ recallN: 3, recallOpts: 7, recallRight: ['Chardonnay', 'Pinot Meunier', 'Pinot Noir'], applyN: 2, ok: true, partly: 'partly' });
  expect(r.applyOpts).toBeGreaterThanOrEqual(5);
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
  const want = await page.evaluate(() => { const o = TeamReport.overview(), s = TeamReport.salesSummary(7); return { avg: o.avg, overdue: o.behind, revenue: Math.round(s.revenue), rows: TeamSales.get().rows.length, lift: TeamReport.trainedLift(28).pct, unmapped: TeamSales.unmapped().map((x) => x.item) }; });
  expect(want.rows).toBeGreaterThan(1000);
  await expect(page.getByTestId('dash-readiness')).toHaveText(`${want.avg}%`);
  await expect(page.getByTestId('dash-overdue')).toHaveText(String(want.overdue));
  // The dashboard rolls sales up into a tile and three lines; the detail is on Sales Insights.
  await expect(page.getByTestId('dash-sales')).toContainText(want.revenue.toLocaleString('en-US'));
  await expect(page.getByTestId('dash-sales-brief').getByTestId('sales-brief')).toHaveCount(3);
  await expect(page.getByTestId('console-sales')).toHaveCount(0);
  await page.getByTestId('dash-open-sales').click();
  await expect(page.getByTestId('console-sales-tab')).toBeVisible();
  expect(await page.getByTestId('sales-brief-list').getByTestId('sales-brief').count()).toBeGreaterThan(3);
  // Money is written in full with its thousands grouped: $8,774, never $8774 or 8.8k.
  await expect(page.getByTestId('sales-revenue')).toContainText(want.revenue.toLocaleString('en-US'));
  const m = await page.evaluate(() => ({ sym: TeamData.currency().sym, out: [TeamData.money(8774), TeamData.money(12480), TeamData.money(1250.5, { dp: 2 }), TeamData.money(-42)] }));
  expect(m.out).toEqual([`${m.sym}8,774`, `${m.sym}12,480`, `${m.sym}1,250.50`, `-${m.sym}42`]);
  await expect(page.getByTestId('sales-lift')).toContainText(`${want.lift}%`);
  // The till knows a Picpoul the list doesn't: the "new on the list?" signal.
  expect(want.unmapped).toEqual(['Picpoul de Pinet 175']);
  await expect(page.getByTestId('sales-new-item')).toContainText('Picpoul');
  expect(await page.getByTestId('demo-tag').count()).toBeGreaterThan(0);
  // Marco's by-the-glass sales dipped the weeks he stopped drilling.
  const marco = await page.evaluate(() => { const m = TeamLearn.people().find((p) => p.name.startsWith('Marco')); const t = TeamReport.serverTrend(m.id, 8).filter((x) => x.shifts); return { first: t[0].perShift, last: t[t.length - 1].perShift }; });
  expect(marco.last).toBeLessThan(marco.first * 0.7);
  // Every section opens; a row opens its detail in the panel.
  for (const s of ['dash', 'sales', 'team', 'wines', 'menu', 'upload', 'pos', 'admin']) { await page.getByTestId(`console-nav-${s}`).click(); await expect(page.getByTestId(s === 'sales' ? 'console-sales-tab' : `console-${s}`)).toBeVisible(); }
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
  // The phone (the default device): the manager's Today carries the KPI strip, each figure opening its part of the console.
  const phone = await context.newPage();
  await stubNetwork(context);
  await phone.goto(`${BASE}/team/?seed=demo`);
  await expect(phone.getByTestId('team-kpis')).toBeVisible();
  await expect(phone.getByTestId('team-console')).toHaveCount(0);
  const avg = await phone.evaluate(() => TeamReport.overview().avg);
  await expect(phone.getByTestId('kpi-readiness')).toContainText(`${avg}%`);
  await expect(phone.getByTestId('kpi-sales')).toContainText('demo data');
  await phone.getByTestId('kpi-readiness').click();
  await expect(phone.getByTestId('console-team')).toBeVisible();
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
  // The hub leads with the next thing to do and says what the list is worth here, then the three doors.
  await expect(page.getByTestId('vinny-next')).toBeVisible();
  await expect(page.getByTestId('vinny-worth')).toContainText(/a shift|more wine/);
  await page.getByTestId('vinny-door-test').click();
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
  await page.getByTestId('vinny-door-ask').click();
  await expect(page.getByTestId('vinny-sugg')).toHaveCount(await page.getByTestId('vinny-sugg').count()); // three short suggestions, none repeating a wine
  const sugg = await page.getByTestId('vinny-sugg').allTextContents();
  expect(sugg.length).toBeGreaterThanOrEqual(3); expect(sugg.length).toBeLessThanOrEqual(4);
  sugg.forEach((s) => expect(s.split(/\s+/).length).toBeLessThanOrEqual(9));
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
  await page.getByTestId('vinny-door-guest').click();
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
  await page.getByTestId('vinny-door-guest').click();
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
  await page.getByTestId('vinny-door-guest').click();
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
    // A question with too few believable wrong reasons still asks for the wine on its own.
    if (labels.length === 1 && labels[0] === 'What do you suggest?') continue;
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
      const g = c.groups[c.groups.length - 1]; if (g.label === 'What do you suggest?') return; // the wine alone: no reasons to check
      const wrong = c.opts.slice(g.from, g.to).filter((o, i) => !c.right.includes(g.from + i));
      // No wrong reason names another dish's food.
      const here = new Set(TeamLearn._words(dish.name + ' ' + (dish.desc || '')));
      const other = new Set(TeamData.dishes().filter((d) => d.id !== dish.id).flatMap((d) => TeamLearn._words(d.name)).filter((x) => x.length > 4 && !here.has(x) && !['with', 'sauce', 'roast'].includes(x)));
      // (judged on word stems, so "cheese" is the British cheeses; reasons written for this question are about it by design)
      const authoredHere = new Set(((TeamData.card(w.id) || {}).qs || []).flatMap((x) => x.wrong || []).map((t) => TeamLearn._norm(t)));
      const hereStems = new Set(TeamLearn._stems(dish.name + ' ' + (dish.desc || '')));
      wrong.forEach((o) => { if (!authoredHere.has(TeamLearn._norm(o)) && TeamLearn._words(o).some((x) => other.has(x) && !hereStems.has(TeamLearn._stems(x)[0]))) out.offDish.push(o); });
      if (c.steer) out.steers.push({ wine: TeamData.short(w), dish: dish.name, right: c.right.map((i) => c.opts[i]), wrong });
      // Every wrong reason is either written for this question as wrong (the card's `wrong`) or claims a style this wine plainly lacks.
      else { const authored = new Set(((TeamData.card(w.id) || {}).qs || []).flatMap((x) => x.wrong || []).map((t) => TeamLearn._norm(t)));
        wrong.forEach((o) => { if (!authored.has(TeamLearn._norm(o)) && !TeamLearn.contradicts(o, (TeamData.card(w.id) || {}).style || {}, TeamLearn.kindOf(w)) && !/^Steer|^Pour/.test(o)) out.notWrong.push(TeamData.short(w) + ': ' + o); }); }
    }));
    // A guest asking for a wine that doesn't suit their dish is a steer (the restaurants' own table questions are
    // now written as choices, so the steer is checked on one written the old way).
    const mw = TeamData.wines().find((w) => /Minuty/.test(w.producer + w.name));
    const sq = { id: 'x#steer', k: 'apply', wine: mw.id, q: `A guest ordering the braised lamb shoulder wants a glass of the ${TeamData.short(mw)}. How do you respond?`, key: ['the ' + TeamData.short(mw), 'it is dry and fresh'] };
    const sc = TeamLearn.choices(sq), sg = sc.groups[0];
    out.steers.push({ wine: TeamData.short(mw), dish: 'Braised lamb shoulder', right: sc.right.map((i) => sc.opts[i]), wrong: sc.opts.filter((o, i) => !sc.right.includes(i)), steer: sc.steer, label: sg.label });
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
  // The answer replaces the options, so a short screen is what makes it scroll.
  await expect(page.getByTestId('drill-result')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 360 });
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
    const dishQ = recall.find((q) => q.dish), dc = dishQ ? TeamLearn.choices(TeamLearn.deal(dishQ, 'd')) : null; // only dishes with their own glass pick ask for one
    return { untyped, mixed, notWines, dishOpts: dc ? dc.opts.length : 4 };
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
    return { pooled, third, ungrouped: tables.filter((c) => !c.groups).length, priced: tables.flatMap((c) => c.groups && c.groups[c.groups.length - 1].label !== 'What do you suggest?' ? c.opts.slice(c.groups[c.groups.length - 1].from) : []).filter((o) => /£\d/.test(o)) };
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

// The guest's follow-up comes with its own help: replies to pick from (one right, two weaker, each saying why) with
// choices, a hint with hints; the opening line's help is the pairing's, and the closing line has none.
test('a guest follow-up comes with replies to pick from, or a hint, so choices last the whole table', async ({ context, page }) => {
  const reqs = [];
  const follow = { guest: 'Sounds nice. Is it very dry?', done: false,
    replies: [{ text: 'Not bone dry: it is fresh and peppery, with a little fruit.', ok: true, why: 'Answers the question from the card.' },
      { text: 'It is very sweet, like a dessert wine.', ok: false, why: 'The card says it is dry.' },
      { text: 'Let me get the Amarone instead.', ok: false, why: 'Does not answer what they asked.' }],
    hint: 'Say how dry it is, from its card.' };
  const errors = await asMarco(context, page, { claudeRequests: reqs, claudeText: (b) => {
    if (b.purpose !== 'team_guest') return '';
    const c = b.messages[0].content, n = (c.match(/SERVER:/g) || []).length;
    if (!n) return '{"guest":"Evening! What would you pour with this?","done":false}';
    if (n === 1) return JSON.stringify(follow);
    return JSON.stringify({ guest: 'Lovely.', done: true, mark: { score: 0.8, verdict: 'right', good: 'Answered it.', missing: '', better: '' } });
  } });
  await page.getByTestId('team-tab-vinny').click();
  await page.getByTestId('vinny-door-guest').click();
  await page.getByTestId('guest-help-choices').click();
  await expect(page.getByTestId('guest-choices')).toBeVisible();
  await page.getByTestId('guest-reply').fill('The Grüner by the glass, peppery and fresh.');
  await page.getByText('Say', { exact: true }).click();
  // The follow-up's own choices: a weaker reply says why and stays out; the right one fills the box.
  await expect(page.getByTestId('guest-follow')).toHaveCount(3);
  await expect(page.getByTestId('guest-choices')).toHaveCount(0);
  const weak = page.getByTestId('guest-follow').filter({ hasText: 'very sweet' });
  await weak.click();
  await expect(weak).toContainText('The card says it is dry.');
  await expect(page.getByTestId('guest-reply')).toHaveValue('');
  await page.getByTestId('guest-follow').filter({ hasText: 'Not bone dry' }).click();
  await expect(page.getByTestId('guest-reply')).toHaveValue(/Not bone dry/);
  // The request asked for them, and only after the server had spoken.
  const gs = reqs.filter((r) => r.purpose === 'team_guest').map((r) => r.messages[0].content);
  expect(gs[0]).not.toContain('three short replies');
  expect(gs[1]).toContain('three short replies');
  await page.getByText('Say', { exact: true }).click();
  await expect(page.getByTestId('guest-mark')).toBeVisible();
  await expect(page.getByTestId('guest-follow')).toHaveCount(0);
  // With hints: the follow-up has one, shown when asked.
  await page.getByText('Another table').click();
  await page.getByTestId('guest-help-hints').click();
  await page.getByTestId('guest-reply').fill('The Grüner by the glass.');
  await page.getByText('Say', { exact: true }).click();
  await expect(page.getByTestId('guest-follow')).toHaveCount(0);
  await page.getByTestId('guest-hint-btn').click();
  await expect(page.getByTestId('guest-hint')).toHaveText('Say how dry it is, from its card.');
  expect(errors).toEqual([]);
});

// "Why does it suit?" is about the wine they just picked: the wrong reasons are claims its own card rules out at
// this dish, never another wine's reason from another dish; and Ask Vinny cut off mid-JSON still shows its words.
test('the guest\'s reasons are all about the chosen wine, and a cut-off Vinny answer shows words, not JSON', async ({ context, page }) => {
  const errors = await asMarco(context, page);
  const r = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 12; i++) {
      const sc = TeamVinny.scenario(TeamLearn.me().id, 1000 + i * 7919);
      if (!sc) continue;
      const h = sc.help;
      if (!h || !h.reasons || !h.reasons.length) continue;
      const card = TeamData.card(h.wines.find((w) => w.ok).id);
      const otherWhys = TeamData.dishes().filter((d) => d.name !== sc.dish).flatMap((d) => { const q = TeamData.pairing(d.id); return q ? [...(q.best || []), q.glass].filter(Boolean).map((b) => b.why) : []; });
      out.push({ wrong: h.reasons.filter((x) => !x.ok), fromOther: h.reasons.filter((x) => !x.ok && otherWhys.includes(x.text)).length, taste: card && card.taste });
    }
    const cut = TeamVinny.loose('{"answer": "Our list doesn\'t mark a house red, but the Road 13 Cabernet', 'answer');
    return { out, cut };
  });
  expect(r.out.length).toBeGreaterThan(3);
  for (const o of r.out) {
    expect(o.wrong.length).toBe(2);
    expect(o.fromOther).toBe(0);
    for (const w of o.wrong) expect(w.note).toMatch(/^Not the .+: its card says/);
  }
  // A guest who has named a wine that doesn't suit is asked about as such: what do you suggest instead?
  const steer = await page.evaluate(() => {
    const pid = TeamLearn.me().id;
    for (let s = 1; s <= 400; s++) { const sc = TeamVinny.scenario(pid, s * 104729); if (sc && sc.wish === 'avoid') return { ask: sc.help.ask, why: sc.help.askWhy, labels: sc.help.wines.map((w) => w.label), dish: sc.dishName }; }
    return null;
  });
  expect(steer).not.toBeNull();
  expect(steer.ask).toMatch(/^They want the .+\. What do you suggest\?$/);
  expect(steer.why).toBe(`Why is it better with the ${steer.dish}?`);
  expect(steer.labels.filter((l) => /as they asked$/.test(l))).toHaveLength(1);
  expect(steer.labels.filter((l) => /^Suggest the .+ instead$/.test(l))).toHaveLength(2);
  expect(r.cut).toBe("Our list doesn't mark a house red, but the Road 13 Cabernet");
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
  await page.getByTestId('vinny-door-guest').click();
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

test('a wine card shows how to pronounce the wine, and Say it speaks the name itself', async ({ context, page }) => {
  await context.addInitScript(() => { window.__spoken = []; Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 5); }, cancel() {}, getVoices() { return []; } } }); window.SpeechSynthesisUtterance = function (t) { this.text = t; }; });
  const errors = await asMarco(context, page);
  await page.getByTestId('team-tab-wines').click();
  await page.getByText(/Dönnhoff/).first().click();
  await expect(page.getByTestId('team-say')).toContainText('DURN-hoff');
  await page.getByTestId('team-say').click();
  // The spelling is shown as a guide; the voice is given the wine's own name, which it says better than a respelling.
  await expect.poll(() => page.evaluate(() => window.__spoken.join('|'))).toContain('Dönnhoff');
  expect(await page.evaluate(() => window.__spoken.join('|'))).not.toContain('DURN-hoff');
  expect(errors).toEqual([]);
});

// Training levels (TeamLearn.LEVELS): management sets Low, Medium or High for the restaurant, with a level
// per role over it. A level filters the written cards and questions, never rewrites them: Low is one thing to
// say, what it pours with and a fact to read; Medium adds grape, place and taste; High is everything.
test('training levels: the console sets them, cards and drills follow, a role can differ, nothing is rewritten', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await stubNetwork(ctx);
  await page.goto(`${BASE}/team/?seed=demo&view=console`);
  await expect(page.getByTestId('team-console')).toBeVisible();
  const counts = await page.evaluate(() => {
    const ws = TeamData.wines(), n = {}, ids = {};
    for (const lv of TeamLearn.LEVELS) { const qs = ws.flatMap((w) => TeamLearn.levelQs(w.id, lv)); n[lv] = qs.length; ids[lv] = qs.map((q) => q.id); }
    const lowQs = ws.flatMap((w) => TeamLearn.levelQs(w.id, 'low')), medQs = ws.flatMap((w) => TeamLearn.levelQs(w.id, 'medium'));
    return { n, level: TeamLearn.level(),
      mediumInHigh: ids.medium.every((id) => ids.high.includes(id)),
      kindsLow: [...new Set(lowQs.map((q) => q.k))].sort(), kindsMed: [...new Set(medQs.map((q) => q.k))].sort(),
      lightOnlyLow: lowQs.filter((q) => q.light).length > 0 && !medQs.some((q) => q.light),
      medRules: medQs.filter((q) => q.k !== 'apply' && TeamLearn.HIGH_ONLY.test(q.q)).length, // a table question may mention a vintage; it's asked at every level
      pair: lowQs.find((q) => q.id.endsWith('#pair')), wines: ws.length };
  });
  expect(counts.level).toBe('high'); // a restaurant starts where the app has always been
  expect(counts.n.low).toBeLessThan(counts.n.high);
  expect(counts.n.medium).toBeLessThan(counts.n.high);
  expect(counts.mediumInHigh).toBe(true); // Medium only filters what High asks
  expect(counts.kindsLow).toEqual(['apply', 'recognise']); // one thing to say, what it pours with, at the table
  expect(counts.kindsMed).toEqual(['apply', 'recall', 'recognise']); // no "tell them apart" below High
  expect(counts.lightOnlyLow).toBe(true);
  expect(counts.medRules).toBe(0);
  // Low's pairing question: one of the wine's own dishes against three from this menu it isn't poured with.
  const pair = counts.pair;
  expect(pair.opts).toHaveLength(4);
  // The right dish is the one the pairings rank this wine highest at; every wrong one is a dish it isn't a pick for
  // and plainly doesn't suit, so the question has one answer a sommelier would stand behind.
  const ranks = await page.evaluate((q) => q.opts.map((o) => { const d = TeamData.dishes().find((x) => x.name === o); return { r: TeamLearn.rankAt(q.wine, d.id), wrong: TeamLearn.clearlyWrong(q.wine, d.id) }; }), pair);
  const best = Math.min(...(await page.evaluate((id) => TeamData.dishes().map((d) => TeamLearn.rankAt(id, d.id)), pair.wine)));
  expect(ranks[pair.a].r).toBe(best);
  ranks.forEach((x, i) => { if (i !== pair.a) { expect(x.r).toBe(99); expect(x.wrong).toBe(true); } });

  // The console's Team section sets the restaurant to Low and the sommelier back to High.
  await page.getByTestId('console-nav-team').click();
  await page.getByTestId('console-level-low').click();
  await expect(page.getByTestId('console-level-about')).toContainText('One thing to say');
  await page.locator('[data-testid="console-role-level"]').filter({ hasText: /^High$/ }).nth(2).click(); // server, bartender, sommelier
  // The minimums are a grid: a step down on the server's bottles moves it by ten points.
  const before = await page.evaluate(() => TeamLearn.need('server').bottle);
  await page.getByTestId('console-minimums').locator('tr').nth(1).getByLabel('Lower').nth(1).click();
  expect(await page.evaluate(() => TeamLearn.need('server').bottle)).toBeCloseTo(before - 0.1, 5);
  // Add someone: a button in the header opens a dialog over the console.
  await page.getByTestId('console-add-person').click();
  await expect(page.getByTestId('console-add-dialog')).toBeVisible();
  await page.getByTestId('console-add-dialog').getByLabel('First name').fill('Rosa');
  await page.getByTestId('console-add-dialog').getByLabel('Last name').fill('Ferreira');
  await page.getByTestId('console-add-role-bartender').click();
  await page.getByTestId('console-add-save').click();
  await expect(page.getByTestId('console-add-dialog')).toHaveCount(0);
  await expect(page.getByTestId('team-table')).toContainText('Rosa Ferreira');
  expect(await page.evaluate(() => TeamLearn.people().find((p) => p.name === 'Rosa Ferreira').role)).toBe('bartender');
  const after = await page.evaluate(() => {
    const ppl = TeamLearn.people(), som = ppl.find((p) => p.role === 'sommelier'), srv = ppl.find((p) => p.role === 'server'), w = TeamData.wines()[0];
    const drill = TeamLearn.drill(srv.id, 40);
    return { level: TeamLearn.level(), server: TeamLearn.level('server'), som: TeamLearn.level('sommelier'),
      srvQs: TeamLearn.qsFor('server', w.id).length, somQs: TeamLearn.qsFor('sommelier', w.id).length,
      drillHigh: drill.filter((q) => !q.dish && !TeamLearn.levelQs(q.wine, 'low').some((x) => x.id === q.id)).length,
      card: TeamData.card(w.id).qs.length };
  });
  expect(after).toMatchObject({ level: 'low', server: 'low', som: 'high', drillHigh: 0, card: 6 });
  expect(after.somQs).toBeGreaterThan(after.srvQs);

  // A server's card at Low: what to say, one thing to know and the dishes; no grape-and-region or drinking window.
  await page.getByTestId('console-who').click();
  await page.evaluate(() => { const s = TeamLearn.people().find((p) => p.role === 'server'); TeamLearn.setMe(s.id); });
  await page.reload();
  await page.getByTestId('team-tab-wines').click();
  await page.getByTestId('team-wine-row').first().click();
  await expect(page.getByTestId('team-pitch')).toBeVisible();
  await expect(page.getByTestId('team-fact')).toBeVisible();
  await expect(page.getByTestId('team-grape-region')).toHaveCount(0);
  await expect(page.getByTestId('team-window')).toHaveCount(0);
  await expect(page.locator('#root')).toContainText('With our menu');
  // Back to High: the full card again, and the answers held were never touched.
  await page.evaluate(() => TeamLearn.setLevel('high'));
  await page.reload();
  await page.getByTestId('team-tab-wines').click();
  await page.getByTestId('team-wine-row').first().click();
  await expect(page.getByTestId('team-grape-region')).toBeVisible();
  await expect(page.getByTestId('team-fact')).toHaveCount(0);
  expect(errors).toEqual([]);
  await ctx.close();
});

// Vinny's test and the drill (TeamLearn.spread): ten questions never ask for the same right answer twice, and no
// two in a row share a wine or dish, a shape or an answer; wrong answers are ones the pairings rule out.
test('a test mixes its questions: no answer twice, nothing grouped, and wrong pairings that are plainly wrong', async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=demo`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  const r = await page.evaluate(() => {
    const out = {};
    for (const lv of ['low', 'medium', 'high']) {
      TeamLearn.setLevel(lv);
      const s = TeamLearn.people().find((p) => p.role === 'server'), qs = TeamVinny.test(s.id, { ask: 'reds' }).qs;
      const ans = qs.map((q) => TeamLearn.answerKey(q)), subj = qs.map((q) => TeamLearn.subjectKey(q)), shape = qs.map((q) => TeamLearn.shapeKey(q));
      out[lv] = { n: qs.length, distinctAnswers: new Set(ans).size, sameSubjectInARow: subj.filter((x, i) => i && x === subj[i - 1]).length,
        sameShapeInARow: shape.filter((x, i) => i && x === shape[i - 1]).length };
    }
    TeamLearn.setLevel('high');
    // Every "which wine suits this dish best" offers its first pick against wines that are clearly wrong for the dish.
    const bad = TeamData.dishes().flatMap((d) => TeamLearn.dishQs(d.id).filter((q) => q.opts).flatMap((q) => q.opts.filter((o, i) => i !== q.a).map((o) => TeamData.wines().find((w) => TeamData.short(w) === o)).filter((w) => w && !TeamLearn.clearlyWrong(w.id, d.id)).map((w) => d.name + ': ' + TeamData.short(w))));
    return { out, bad };
  });
  for (const lv of ['low', 'medium', 'high']) {
    expect(r.out[lv].n).toBe(10);
    expect(r.out[lv].distinctAnswers).toBe(10);
    expect(r.out[lv].sameSubjectInARow).toBe(0);
    expect(r.out[lv].sameShapeInARow).toBeLessThanOrEqual(3); // a new server has only the first rung open, so a level with two kinds of question can run out of one
  }
  expect(r.bad).toEqual([]);
});

// Table questions test the decision, then the reason (TeamLearn._decide, _applyChoices): the wrong wines are
// on the list, honour what the guest asked for and are clearly wrong for the dish; nothing gives the answer
// away by its length, by being the only one of its colour asked for, or by three wrong answers making the
// same claim; and question health flags what's answered right by everyone at once or missed by most.
test('table questions: the choice first, wrong answers that are believable and clearly wrong, and question health', async ({ context, page }) => {
  await stubNetwork(context);
  const check = async (seed) => {
    await page.goto(`${BASE}/team/?seed=${seed}`);
    await page.waitForFunction(() => window.TeamLearn && TeamData.wines().length > 0);
    return page.evaluate(() => {
      const out = { tooFew: [], lengthCue: [], sameClaim: [], wrongWine: [], wish: [], decided: 0, total: 0 };
      TeamData.wines().forEach((w) => TeamLearn.wineQs(w.id).filter((q) => q.k === 'apply').forEach((q) => {
        out.total++;
        const c = TeamLearn.choices(q), dish = TeamLearn.dishIn(q.q), wish = TeamLearn.wishIn(q.q, TeamData.wine(q.wine));
        if (c.steer || c.groups[0].label === 'What do you suggest?') out.decided++; // the server makes the call
        c.groups.forEach((g) => {
          const opts = c.opts.slice(g.from, g.to), right = opts.filter((o, i) => c.right.includes(g.from + i)), wrong = opts.filter((o, i) => !c.right.includes(g.from + i));
          if (wrong.length < 2) out.tooFew.push(q.q.slice(0, 60));
          if (g.label === 'Why it works' && !c.steer) {
            const minR = Math.min(...right.map((x) => x.length)), minW = Math.min(...wrong.map((x) => x.length));
            if (minR < 0.5 * minW) out.lengthCue.push(right.join(' / ').slice(0, 80));
            const ks = wrong.map((t) => Object.entries(TeamLearn.claimsIn(t)).filter(([, v]) => v).map(([k]) => k).sort().join(',')).filter(Boolean);
            if (ks.length - new Set(ks).size > 1) out.sameClaim.push(q.q.slice(0, 60));
          }
          if (g.label === 'What do you suggest?' && dish) wrong.forEach((o) => {
            const ow = TeamData.wines().find((x) => { const n = TeamData.short(x); return o.startsWith((/^the /i.test(n) ? '' : 'The ') + n + ',') || o === (/^the /i.test(n) ? '' : 'The ') + n || o.startsWith((/^the /i.test(n) ? '' : 'The ') + n + ' '); });
            if (!ow) return out.wrongWine.push('not on the list: ' + o);
            // clearly wrong for the dish, or failing what the guest asked for ("under £120", "isn't heavy"), which the right wine meets
            // or one the card writer named as wrong for this guest (`decoys`), never one of the dish's picks
            const pr = TeamData.pairing(dish.id) || {}, picks = [...(pr.best || []).map((b) => b.id), pr.glass && pr.glass.id].filter(Boolean);
            const named = ((((TeamData.card(q.wine) || {}).qs || [])[Number(String(q.id).split('#').pop())]) || {}).decoys || [];
            if (picks.includes(ow.id) || (!named.some((x) => x.id === ow.id) && !TeamLearn.tableWrong(ow, TeamData.wine(q.wine), dish, wish, TeamLearn.wishStyle(q.q, dish)))) out.wrongWine.push(`${dish.name}: ${TeamData.short(ow)}`);
            if (wish.kind && TeamLearn.kindOf(ow) !== wish.kind) out.wish.push(`${wish.kind} asked: ${TeamData.short(ow)}`);
            if (wish.side === 'glass' && !ow.glass) out.wish.push(`glass asked: ${TeamData.short(ow)}`);
            // what the guest said out loud never rules a wrong wine out: none over their price, none of another kind
            if (TeamLearn.overPrice(ow, TeamLearn.wishStyle(q.q, dish), wish.side)) out.wish.push(`over the price asked: ${TeamData.short(ow)}`);
            if (!wish.kind && TeamLearn.kindOf(ow) !== TeamLearn.kindOf(TeamData.wine(q.wine))) out.wish.push(`another kind: ${TeamData.short(ow)}`);
          });
        });
      }));
      return out;
    });
  };
  for (const seed of ['demo', 'social', 'princess-royal']) {
    const r = await check(seed);
    expect(r.tooFew).toEqual([]); // no choice of one or two
    expect(r.lengthCue).toEqual([]);
    expect(r.sameClaim).toEqual([]);
    expect(r.wrongWine).toEqual([]); // every wrong wine is on the list and wrong for this table
    expect(r.wish).toEqual([]); // and is what the guest asked for: a white for a white, by the glass for a glass
    // Table questions are written as choices; one is asked as a choice only where wrong wines meet the guest's request
    // (kind, glass, price) and the dish alone rules them out, else it names the wine and asks why (demo 15 of 30, Social Corner 27 of 41).
    expect(r.decided).toBeGreaterThanOrEqual(r.total * 0.45);
  }
  // The Bandol with the venison asks for the wine, then why; the question no longer names it.
  await page.goto(`${BASE}/team/?seed=demo`);
  await page.waitForFunction(() => window.TeamLearn && TeamData.wines().length > 0);
  const b = await page.evaluate(() => { const q = TeamLearn.wineQs('w-domaine-tempier-bandol').find((x) => x.k === 'apply'), c = TeamLearn.choices(q);
    return { q: q.q, labels: c.groups.map((g) => g.label), right: c.right.map((i) => c.opts[i]) }; });
  expect(b.q).not.toMatch(/Bandol|Tempier/);
  expect(b.labels).toEqual(['What do you suggest?', 'Why it works']);
  expect(b.right[0]).toMatch(/^The Domaine Tempier Bandol/);
  // Question health: everyone right and sure first time is flagged as too easy, most wrong as worth checking.
  const h = await page.evaluate(() => {
    const qs = TeamLearn.wineQs('w-nyetimber-classic-cuvee'), easy = qs[0], hard = qs[1];
    for (let i = 0; i < 5; i++) { const p = TeamLearn.addPerson('Tester ' + i, 'server', null); TeamLearn.record(p, easy, true, 'sure'); TeamLearn.record(p, hard, i === 0, 'think'); }
    const hs = TeamLearn.questionHealth(); return { easy: (hs.find((x) => x.q.id === easy.id) || {}).flag, hard: (hs.find((x) => x.q.id === hard.id) || {}).flag };
  });
  expect(h).toEqual({ easy: 'easy', hard: 'missed' });
});

// The names check in the app: every wine, cocktail and dish in the order the script numbers them, each played
// through the same voice as a table.
test('the names check plays each name through the guest voice, numbered like the listening check', async ({ context, page }) => {
  const errors = await asMarco(context, page);
  await page.getByTestId('team-tab-vinny').click();
  await page.getByTestId('vinny-say-check').click();
  await expect(page.getByTestId('say-check')).toBeVisible();
  const n = await page.evaluate(() => TeamData.wines().length + TeamData.cocktails().length + TeamData.dishes().length);
  await expect(page.getByTestId('say-row')).toHaveCount(n);
  const said = await page.evaluate(async () => { const got = []; const was = TeamVoice.speak; TeamVoice.speak = async (t) => { got.push(t); }; return got; });
  await page.evaluate(() => { window.__said = []; TeamVoice.speak = async (t) => { window.__said.push(t); }; });
  await page.getByTestId('say-row').first().click();
  const first = await page.evaluate(() => [window.__said[0], TeamData.short(TeamData.wines()[0])]);
  expect(first[0]).toBe(`Could we get a bottle of the ${first[1]}, please?`);
  expect(said).toEqual([]);
  expect(errors).toEqual([]);
});

test('a restaurant demo address names its restaurant, and nowhere else does', async ({ context, page }) => {
  await asMarco(context, page);
  expect(await page.evaluate(() => [TeamSample.hostSeed('socialcorner.vinterest.team'), TeamSample.hostSeed('SocialCorner.vinterest.team'), TeamSample.hostSeed('princessroyal.vinterest.team'), TeamSample.hostSeed('vinterest.pages.dev'), TeamSample.hostSeed()])).toEqual(['social', 'social', 'princess-royal', null, null]);
});

// Android Chrome sends every result as the whole utterance so far and repeats finals; the reply must come out once.
test('a spoken reply comes out once, however the phone repeats its results', async ({ context, page }) => {
  await asMarco(context, page);
  const r = await page.evaluate(() => {
    const said = "I'd suggest the Black Swift Curtain Vineyard Riesling, it's about 67 dollars a bottle and pairs nicely with the hint of sweetness";
    const cum = said.split(' ').map((_, i, a) => a.slice(0, i + 1).join(' ')).filter((_, i) => i % 4 === 3);
    const loop = Array(12).fill('it\'s about 67 dollars a bottle and pairs nicely with the hint of sweetness').join(' ');
    return { android: TeamVoice.joinResults(cum.concat([said, said])), desktop: TeamVoice.joinResults(["I'd suggest the Riesling", "it's about 67 dollars a bottle"]),
      loop: TeamVoice.dedupe('Black Swift ' + loop), real: TeamVoice.dedupe('Very very good, a good good wine') };
  });
  expect(r.android).toBe("I'd suggest the Black Swift Curtain Vineyard Riesling, it's about 67 dollars a bottle and pairs nicely with the hint of sweetness");
  expect(r.desktop).toBe("I'd suggest the Riesling it's about 67 dollars a bottle");
  expect(r.loop).toBe("Black Swift it's about 67 dollars a bottle and pairs nicely with the hint of sweetness");
  expect(r.real).toBe('Very very good, a good good wine'); // short repeats people really say are left alone
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

// With the server's speech-to-text on, the reply is recorded and written down by ElevenLabs through /stt: the words
// land in the box once they've finished, the privacy line says the recording is sent, and the delivery uses the
// service's own word times.
test('a spoken reply is written down by the server when it has speech to text', async ({ context, page }) => {
  await context.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak(u) { setTimeout(() => u.onend && u.onend(), 5); }, cancel() {}, getVoices() { return []; } } });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    window.SpeechRecognition = class { start() { window.__local = true; } stop() {} };
    navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() { window.__released = true; } }] });
    window.MediaRecorder = class { static isTypeSupported(t) { return t.startsWith('audio/webm'); } constructor(s, o) { this.mimeType = o.mimeType; }
      start() {} stop() { this.ondataavailable({ data: new Blob(['fake audio'], { type: 'audio/webm' }) }); setTimeout(() => this.onstop(), 5); } };
  });
  const sent = [];
  await context.route('**/config', (r) => r.fulfill({ json: { tts: false, stt: true } }));
  await context.route('**/stt', async (r) => { sent.push(r.request().headers()['content-type']); await r.fulfill({ json: { text: "I'd go for the Grüner by the glass, it's peppery and fresh", words: [{ text: "I'd", start: 0.9, end: 1.1 }, { text: 'fresh', start: 4.2, end: 4.6 }] } }); });
  const errors = await asMarco(context, page, { claudeText: (b) => b.purpose === 'team_guest' ? (/SERVER:/.test(b.messages[0].content) ? JSON.stringify({ guest: 'Lovely.', done: true, mark: { score: 0.8, verdict: 'right', good: 'Named it.', missing: '', better: '' } }) : '{"guest":"Evening! What would you pour with the olives?","done":false}') : '' });
  await page.getByTestId('team-tab-vinny').click();
  await page.getByTestId('vinny-door-guest').click();
  await expect(page.getByTestId('guest-line')).toContainText('olives');
  await page.getByTestId('guest-mic').click();
  await expect(page.getByTestId('voice-notice')).toContainText('ElevenLabs');
  await page.getByTestId('guest-mic').click(); // finished
  await expect(page.getByTestId('guest-reply')).toHaveValue(/Grüner by the glass/);
  expect(sent).toEqual(['audio/webm']);
  expect(await page.evaluate(() => [!!window.__released, !!window.__local])).toEqual([true, false]);
  // The service failing says so and hands the next reply to the phone's own recognition.
  await context.unroute('**/stt');
  await context.route('**/stt', (r) => r.fulfill({ status: 502, json: { error: 'down' } }));
  await page.getByTestId('guest-mic').click();
  await page.getByTestId('guest-mic').click();
  await expect(page.getByTestId('voice-error')).toContainText("didn't come through");
  await page.getByTestId('guest-mic').click();
  expect(await page.evaluate(() => window.__local)).toBe(true);
  expect(errors.filter((e) => !/502/.test(e))).toEqual([]);
});

test('a dish has Say it too, speaking its own name slowly', async ({ context, page }) => {
  await context.addInitScript(() => { window.__spoken = []; Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak(u) { window.__spoken.push([u.text, u.rate]); setTimeout(() => u.onend && u.onend(), 5); }, cancel() {}, getVoices() { return []; } } }); window.SpeechSynthesisUtterance = function (t) { this.text = t; }; });
  const errors = await asMarco(context, page);
  await page.getByTestId('team-tab-menu').click();
  const name = await page.evaluate(() => TeamData.dishes()[0].name);
  await page.getByText(name, { exact: true }).first().click();
  await page.getByTestId('team-dish').getByTestId('team-say').click();
  await expect.poll(() => page.evaluate(() => JSON.stringify(window.__spoken))).toContain(name);
  expect(await page.evaluate((n) => window.__spoken.find((x) => x[0] === n)[1], name)).toBe(0.8);
  expect(errors).toEqual([]);
});

// The dashboard is the person's own: a card folds to one line, Edit layout moves a card to the top, and both
// survive a reload; Reset puts the default back.
test('the console dashboard folds and reorders, and remembers it', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await stubNetwork(ctx);
  await page.goto(`${BASE}/team/?seed=demo&view=console`);
  await expect(page.getByTestId('console-dash')).toBeVisible();
  const order = () => page.getByTestId('dash-card').evaluateAll((els) => els.map((e) => e.dataset.card));
  expect((await order())[0]).toBe('tonight'); // Tonight leads the dashboard
  await page.getByTestId('dash-fold-people').click();
  await expect(page.locator('[data-card="people"]').getByTestId('dash-summary')).toContainText('ready');
  await page.getByTestId('dash-edit').click();
  await page.getByTestId('dash-top-learn').click();
  await page.getByTestId('dash-down-learn').click();
  expect((await order()).slice(0, 2)).toEqual(['tonight', 'learn']);
  await page.getByTestId('dash-edit').click();
  await page.reload();
  await expect(page.getByTestId('console-dash')).toBeVisible();
  expect((await order()).slice(0, 2)).toEqual(['tonight', 'learn']);
  await expect(page.locator('[data-card="people"]').getByTestId('dash-summary')).toBeVisible();
  await page.getByTestId('dash-edit').click();
  await page.getByTestId('dash-reset').click();
  expect((await order())[1]).toBe('glance');
  await expect(page.locator('[data-card="people"]').getByTestId('dash-summary')).toHaveCount(0);
  await ctx.close();
});

test('the sommelier runs the wine programme too: the console on a wide screen, Upload and Team on the phone', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await stubNetwork(ctx);
  await page.goto(`${BASE}/team/?seed=demo`);
  await page.evaluate(() => { TeamLearn.setMe(TeamLearn.people().find((p) => p.role === 'sommelier').id); });
  await page.reload();
  await expect(page.getByTestId('team-console')).toBeVisible();
  await page.goto(`${BASE}/team/?view=phone`);
  await expect(page.getByTestId('team-tab-upload')).toBeVisible();
  await expect(page.getByTestId('team-tab-team')).toBeVisible();
  expect(await page.evaluate(() => [TeamLearn.manages('sommelier'), TeamLearn.manages('server'), TeamLearn.manages('bartender')])).toEqual([true, false, false]);
  await ctx.close();
});

// Every restaurant runs the same Teams (CLAUDE.md): The Larkspur and The Social Corner answer a drill question the
// same way (the options leave, the answer rises in their place) and at the same text sizes.
test('both restaurants: the drill answers in the same phases and at the same text sizes', async ({ context, page }) => {
  await stubNetwork(context);
  const seen = {};
  for (const seed of ['demo', 'social', 'princess-royal']) {
    await page.goto(`${BASE}/team/?seed=${seed}&view=phone`);
    await expect(page.getByTestId('team-state')).toBeVisible();
    await page.getByText(/Start today's drill|Do another 5 questions/).first().click();
    await expect(page.getByTestId('drill-q')).toBeVisible();
    const size = (id) => page.getByTestId(id).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const q = await size('drill-q'), opt = await size('drill-opt');
    await page.getByTestId('drill-opt').first().click();
    const sure = page.getByText('Sure', { exact: true }); if (await sure.isVisible().catch(() => false)) await sure.click();
    await page.getByText('Check', { exact: true }).click();
    await expect(page.getByTestId('drill-result')).toBeVisible();
    await expect(page.getByTestId('drill-opt')).toHaveCount(0);
    await expect(page.getByTestId('drill-answer').first()).toBeVisible();
    seen[seed] = { q, opt, venue: await page.evaluate(() => TeamData.get().venue.sample) };
  }
  expect(seen.social.venue).toBe('social');
  expect(seen['princess-royal'].venue).toBe('princess-royal');
  for (const seed of ['social', 'princess-royal']) { expect(seen[seed].q).toBe(seen.demo.q); expect(seen[seed].opt).toBe(seen.demo.opt); }
  expect(seen.demo.opt).toBeGreaterThanOrEqual(15);
});

// Carey's review of a drill on The Social Corner: every wrong answer belongs to its question, the answer screen adds
// something new, and the guest's request never gives a table question away.
test('questions keep to their subject: a dish change, a country, a table request, and an answer screen that adds something', async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=social`);
  await page.waitForFunction(() => window.TeamLearn && TeamData.dishes().length > 0);
  const r = await page.evaluate(() => {
    const out = { modOther: [], notCountries: [], echoes: 0, asides: 0, bullets: 0 };
    const dishNames = TeamData.dishes().map((d) => d.name);
    TeamData.dishes().forEach((d) => TeamLearn.dishQs(d.id).forEach((q) => {
      if (/#mod$/.test(q.id)) q.pills.opts.filter((o, i) => !q.pills.right.includes(i)).forEach((o) => { const other = dishNames.find((n) => n !== d.name && !d.name.includes(n) && o.includes(n)); if (other) out.modOther.push(`${d.name}: ${o}`); });
      if (/#1$/.test(q.id)) { const a = TeamLearn.aside(q); if (a && a.list) out.bullets++; }
    }));
    const countries = new Set([...TeamData.wines().map((w) => w.country), ...TeamLearn.DECOYS.country].filter(Boolean));
    TeamData.wines().forEach((w) => TeamLearn.wineQs(w.id).forEach((q) => {
      if (q.k === 'recall' && TeamLearn._topic(q.q) === 'country') TeamLearn.choices(q).opts.forEach((o) => { if (!countries.has(o)) out.notCountries.push(`${q.q} → ${o}`); });
      const ans = q.opts && q.a != null ? q.opts[q.a] : q.ans, a = TeamLearn.aside(q, ans);
      if (a && a.text) { out.asides++; if (TeamLearn._overlap(a.text, ans) >= 0.45) out.echoes++; }
    }));
    return out;
  });
  expect(r.modOther).toEqual([]); // "the Lemon tart without the crème fraîche" is never answered about the venison
  expect(r.notCountries).toEqual([]);
  expect(r.echoes).toBe(0); // what's added never just says the answer again
  expect(r.asides).toBeGreaterThan(50);
});

test('the phone Team tab is the console Team: Add in a dialog, training level, minimums per role', async ({ context, page }) => {
  await stubNetwork(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/team/?seed=social&view=phone`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  await page.evaluate(() => { const m = TeamLearn.people().find((p) => p.role === 'manager'); TeamLearn.setMe(m.id); });
  await page.reload();
  await page.getByTestId('team-tab-team').click();
  await expect(page.getByTestId('console-level')).toBeVisible();
  await expect(page.getByTestId('console-minimums')).toBeVisible();
  await expect(page.locator('#root')).not.toContainText('overdue');
  // The minimums are a list per role on a phone, never a table wider than the screen.
  expect(await page.getByTestId('console-minimums').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.getByTestId('console-add-person').click();
  await page.getByTestId('console-add-dialog').getByLabel('First name').fill('Noor');
  await page.getByTestId('console-add-dialog').getByLabel('Last name').fill('Haddad');
  await page.getByTestId('console-add-save').click();
  await expect(page.getByTestId('team-people')).toContainText('Noor Haddad');
});

test('a wine card: where you stand near the top, sections that fold and stay folded', async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=social&view=phone`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  await page.getByTestId('team-tab-wines').click();
  await page.getByTestId('team-wine-row').first().click();
  const top = async (id) => page.getByTestId(id).first().evaluate((el) => el.getBoundingClientRect().top);
  expect(await top('team-standing')).toBeLessThan(await top('team-pitch'));
  await expect(page.getByText('Practise this wine', { exact: true })).toHaveCount(0); // the standing card's button is the one
  const taste = page.getByTestId('fold-wine-taste');
  await expect(taste).toHaveAttribute('data-folded', '0');
  await taste.getByRole('button').first().click();
  await expect(taste).toHaveAttribute('data-folded', '1');
  await page.reload();
  await page.getByTestId('team-tab-wines').click();
  await page.getByTestId('team-wine-row').nth(1).click();
  await expect(page.getByTestId('fold-wine-taste')).toHaveAttribute('data-folded', '1'); // remembered on this phone
});

// The app's own review (TeamLearn.review, `npm run team:audit`): every question of every restaurant, as the drill shows
// it, against the faults found by hand: a wrong answer about another dish, answers of mixed kinds, a table request that
// gives the answer away, an answer screen that repeats the answer or runs long, duplicates, length cues, giveaway words.
test('the review finds nothing to fix on any restaurant in the build', async ({ context, page }) => {
  test.setTimeout(240000); // the whole review of four restaurants, twice over
  await stubNetwork(context);
  for (const seed of ['demo', 'sample', 'social', 'princess-royal']) {
    await page.goto(`${BASE}/team/?seed=${seed}`);
    await page.waitForFunction(() => window.TeamLearn && TeamData.wines().length > 0);
    const flags = await page.evaluate(() => TeamLearn.review().map((f) => `[${f.code}] ${f.q.q.slice(0, 80)}: ${f.note}`));
    expect(flags, seed).toEqual([]);
  }
  // It catches what it's for: a dish's change answered about another dish is flagged.
  const caught = await page.evaluate(() => { const d = TeamData.dishes()[0], o = TeamData.dishes()[1], q = TeamLearn.dishQs(d.id, { all: true }).find((x) => /#mod$/.test(x.id)) || null;
    if (!q) return 'none'; const bad = { ...q, pills: { ...q.pills, opts: q.pills.opts.map((x, i) => q.pills.right.includes(i) ? x : `The ${o.name} is served as it comes.`) } };
    const was = TeamLearn.dishQs; TeamLearn.dishQs = (id) => id === d.id ? [bad] : []; const r = TeamLearn.review().some((f) => f.code === 'offsubject'); TeamLearn.dishQs = was; return r; });
  expect(caught).toBe(true); // on The Social Corner, whose dishes have notes
  // Repetition across one wine's questions is caught too: with the build's filter off, a second grape question on La Stella
  // (Cabernet Sauvignon again, as an earlier card had) and flavours that sit inside its description are flagged.
  const rep = await page.evaluate(() => { const d = TeamData.get(), qs = d.cards['w-la-stella-fortissimo'].qs, desc = qs.find((q) => /#0$/.test(q.id));
    qs.push({ id: 'w-la-stella-fortissimo#t1', k: 'recall', q: 'Which grape is the La Stella Fortissimo 2021 made from?', ans: 'Cabernet Sauvignon', acc: [], why: 'x' },
      { id: 'w-la-stella-fortissimo#t2', k: 'recall', q: 'Which flavours would you describe to a guest?', ans: desc.opts[desc.a].split(/, with /).pop(), acc: [], why: 'x' }); TeamData.save(d);
    const was = TeamLearn._repeats, held = TeamLearn._held; TeamLearn._repeats = () => new Set(); TeamLearn._held = () => new Set(); TeamLearn._qsCache = new WeakMap();
    const f = TeamLearn.review().filter((x) => x.code === 'repeat' && /fortissimo/.test(x.q.wine || '')).length; TeamLearn._repeats = was; TeamLearn._held = held; qs.splice(-2); TeamData.save(d); TeamLearn._qsCache = new WeakMap(); return f; });
  expect(rep).toBeGreaterThanOrEqual(2);
  // And a drill on that one wine asks each thing once and never shows the same line after an answer twice.
  const one = await page.evaluate(() => { const w = TeamData.wines().find((x) => /Fortissimo/.test(x.name)), qs = TeamLearn.qsFor('manager', w.id), used = new Set(), lines = [];
    qs.forEach((q) => { const c = TeamLearn.choices(TeamLearn.deal(q, 't')), a = TeamLearn.aside(q, (c.right || []).map((i) => c.opts[i]).join(' ') || q.ans, used); if (a && a.text) { lines.push(a.text); used.add(a.text); } });
    return { answers: qs.filter((q) => q.k !== 'apply').map((q) => TeamLearn._norm(TeamLearn._ansOf(q))), lines }; });
  expect(new Set(one.answers).size).toBe(one.answers.length);
  expect(new Set(one.lines).size).toBe(one.lines.length);
});

// The sommelier review (TeamData.sommelierReview): every question read as the drill shows it; a wine card's doubtful
// question is rewritten and read again, a list-built one is held out of the drill, and the console says so.
test('the sommelier review rewrites what it doubts, holds what it still doubts, and the drill leaves it out', async ({ context, page }) => {
  let round = 0; const seen = [];
  await stubNetwork(context, { claudeText: (b) => {
    const text = b.messages[0].content, ids = [...text.matchAll(/^ID (\S+)$/gm)].map((m) => m[1]);
    if (b.purpose === 'team_review') { round++; seen.push(...ids);
      return JSON.stringify({ reviews: ids.map((id) => (id === window_card || id === window_dish) && seen.filter((x) => x === id).length === 1 ? { id, fit: false, problem: 'two_right', note: 'A wrong option also suits.' } : { id, fit: true }) }); }
    if (b.purpose === 'team_fix') return JSON.stringify({ fixes: ids.map((id) => ({ id, q: { k: 'recall', q: 'Which grape is the Veuve Clicquot Brut mostly made from?', ans: 'Pinot Noir', acc: [], why: 'Pinot Noir leads the blend.' } })) });
    return ''; } });
  await page.goto(`${BASE}/team/?seed=social&view=console`);
  await page.waitForFunction(() => window.TeamLearn && TeamData.wines().length > 0);
  const ids = await page.evaluate(() => { const w = TeamData.wines()[0], card = TeamLearn.wineQs(w.id).find((q) => q.k === 'recall'), dish = TeamLearn.dishQs(TeamData.dishes()[0].id)[0]; return { card: card.id, dish: dish.id }; });
  var window_card = ids.card, window_dish = ids.dish; // read by the stub above
  const r = await page.evaluate(async () => { const r = await TeamData.sommelierReview(); return r; });
  expect(r.doubted).toBe(2);
  expect(r.fixed).toBe(1); // the card's question was rewritten and passed the second read
  expect(r.held).toEqual([ids.dish]); // the dish's question is built from the list, so it's held
  const out = await page.evaluate((ids) => ({ inDrill: TeamLearn.dishQs(TeamData.dishes()[0].id).some((q) => q.id === ids.dish), rewritten: TeamLearn.wineQs(TeamData.wines()[0].id).find((q) => q.id === ids.card).q, line: TeamData.checkedLine() }), ids);
  expect(out.inDrill).toBe(false);
  expect(out.rewritten).toMatch(/mostly made from/);
  expect(seen.length).toBeGreaterThan(300); // every question was read
  await page.reload();
  await page.getByTestId('console-nav-wines').click();
  await expect(page.getByTestId('console-sommelier')).toContainText('1 held out of the drill');
});

// The demo tells the story a working team would: the house pours sell most and are the ones the team knows, so
// most best sellers are known; and one glass most of the team who serve it know still sells little, which points at its
// price or pour rather than training.
test('the demo sales: best sellers mostly known, and a glass known but not selling', async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=demo`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  const brief = await page.evaluate(() => TeamReport.salesBrief());
  const gaps = brief.find((x) => x.k === 'gaps');
  expect(!gaps || /^[12] of your 8 best-selling wines/.test(gaps.title)).toBe(true);
  const known = brief.find((x) => x.k === 'known');
  expect(known && known.title).toMatch(/: known, but not selling$/);
  const row = await page.evaluate((id) => TeamReport.slowMovers(28, Infinity).find((x) => x.wine.id === id), known.open.id);
  expect(row.knows).toBeGreaterThanOrEqual(Math.ceil(row.of / 2));
});

// Console access is per person (TeamLearn.canConsole): a manager's Today figures open the console's own sections on a
// phone, a server gets no way in until someone turns it on for them, and the Add dialog sets it.
test('console access per person: Today opens the console on a phone, and a server gets it only when it is turned on', async ({ context, page }) => {
  await stubNetwork(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/team/?seed=social&view=phone`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  await page.evaluate(() => TeamLearn.setMe(TeamLearn.people().find((p) => p.role === 'manager').id));
  await page.reload();
  await page.getByTestId('kpi-sales').click();
  await expect(page.getByTestId('console-sales-tab')).toBeVisible(); // the revenue figure opens Sales Insights, not the Team tab
  // A server: no console button, no figures, until it's turned on for them.
  await page.evaluate(() => { const s = TeamLearn.people().find((p) => p.role === 'server'); TeamLearn.setMe(s.id); });
  await page.reload();
  await expect(page.getByTestId('team-state')).toBeVisible();
  await expect(page.getByTestId('team-to-console')).toHaveCount(0);
  await expect(page.getByTestId('team-kpis')).toHaveCount(0);
  await page.evaluate(() => TeamLearn.setConsole(TeamLearn.me().id, true));
  await page.reload();
  await page.getByTestId('team-to-console').click();
  await expect(page.getByTestId('team-console')).toBeVisible();
  // The Add dialog: a bartender added with the console turned on can open it.
  await page.getByTestId('console-nav-team').click();
  await page.getByTestId('console-add-person').click();
  await page.getByTestId('console-add-dialog').getByLabel('First name').fill('Noor');
  await page.getByTestId('console-add-role-bartender').click();
  await expect(page.getByTestId('console-add-console')).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('console-add-console').click();
  await page.getByTestId('console-add-save').click();
  expect(await page.evaluate(() => TeamLearn.canConsole(TeamLearn.people().find((p) => p.name === 'Noor')))).toBe(true);
});

test('what the reviewers read is what the drill shows: four options as dealt, regions of the country asked, wines for a dish, one right answer when telling two wines apart', async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=social`);
  await page.waitForFunction(() => window.TeamLearn && TeamData.dishes().length > 0);
  const r = await page.evaluate(() => {
    const out = { empty: [], abroad: [], notWines: [], contrastRight: [] };
    const all = [...TeamData.wines().flatMap((w) => [...TeamLearn.wineQs(w.id, { all: true }), ...TeamLearn.lightQs(w.id, { all: true })]), ...TeamData.dishes().flatMap((d) => TeamLearn.dishQs(d.id, { all: true }))];
    const names = TeamData.wines().map((w) => TeamLearn._norm(TeamData.short(w)));
    all.forEach((q) => {
      const s = TeamLearn.shown(TeamLearn.deal(q, 't'));
      if (!s.opts.length || !s.right.length) out.empty.push(q.id);
      if (!/OPTIONS\n\[/.test(TeamData._reviewItem(q))) out.empty.push('review:' + q.id);
      const c = TeamLearn._countryIn(q.q);
      if (q.k === 'recall' && TeamLearn._topic(q.q) === 'place' && c) s.opts.filter((o, i) => !s.right.includes(i)).forEach((o) => { const oc = TeamLearn._placeCountry(o); if (oc && oc !== c) out.abroad.push(`${q.q} → ${o}`); });
      if (q.dish && /#1$/.test(q.id)) s.opts.forEach((o) => { if (!names.some((n) => TeamLearn._norm(o).includes(n))) out.notWines.push(`${q.q} → ${o}`); });
      if (q.k === 'contrast' && s.right.length !== 1) out.contrastRight.push(q.id);
    });
    return out;
  });
  expect(r.empty).toEqual([]);
  expect(r.abroad).toEqual([]); // "Which Italian region…" never offers the Rhône or the Okanagan
  expect(r.notWines).toEqual([]); // "Name a wine by the glass for…" never offers Rioja or the Loire
  expect(r.contrastRight).toEqual([]);
});
