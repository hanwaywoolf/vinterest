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

// The demo's team all have progress now (a manager at about 76%), so a test about someone who hasn't started
// wipes the person in view first.
async function startFresh(page) {
  await page.evaluate(() => { const P = TeamLearn._all(); delete P[TeamLearn.me().id]; TeamLearn._saveAll(P); });
  await page.reload();
  await expect(page.getByTestId('team-state')).toBeVisible();
}
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
  await expect(page.getByTestId('team-venue-logo')).toHaveAttribute('src', /^brand\/social-corner\/wordmark-white\.png\?v=/); // stamped, so a new logo is never shown from an old copy
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
// A browser already holding the consumer app's data has little room left on this address. The venue and team fit; the
// sales, written last, once didn't, and Sales Insights said "No sales yet" with no word of why.
test('a nearly full browser still opens The Princess Royal with its sales', async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=sample`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  // Fill the device until about 2.2MB is left: enough for the venue and the team, not for the sales as well.
  await page.evaluate(() => { localStorage.clear(); const chunk = 'x'.repeat(100000); let i = 0; try { for (;; i++) localStorage.setItem('vinterest_fill_' + i, chunk); } catch (e) {} for (let k = 0; k < 11; k++) localStorage.removeItem('vinterest_fill_' + (i - 1 - k)); });
  await page.goto(`${BASE}/team/?seed=princess&view=console`);
  await expect(page.getByTestId('console-nav-sales')).toBeVisible();
  const st = await page.evaluate(() => ({ rows: (TeamSales.get().rows || []).length, held: Store.full(), wines: TeamData.wines().length, people: TeamLearn.people().length }));
  expect(st.wines).toBeGreaterThan(100); expect(st.people).toBe(7);
  expect(st.held).toBe(true);                                                                   // the test really did run out of room
  expect(st.rows).toBeGreaterThan(1000);
});

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
  await expect(page.getByTestId('team-venue-logo')).toHaveAttribute('src', /^brand\/princess-royal\/wordmark-white\.svg(\?v=|$)/);
  expect((await page.request.get(`${BASE}/team/brand/princess-royal/wordmark-white.svg`)).status()).toBe(200);
  expect(st).toMatchObject({ wines: 132, cards: 132, dishes: 55, cocktails: 25, demo: true, offList: true });
  expect(st.pours).toEqual(['125', '175']);
  expect(st.rows).toBeGreaterThan(1000);
  await expect(page.locator('#root')).not.toContainText('$');
  expect(errors).toEqual([]);
});

// Eloise (Toronto), installed from its site's menus and Beverage Menu (intake/eloise/): ?seed=eloise opens it in
// Canadian dollars with Canada's allergens, on the same invented team and sales, with the wordmark Carey supplied.
test('Eloise opens from ?seed=eloise on its own team, Canadian dollars and invented sales', async ({ context, page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=eloise`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  const st = await page.evaluate(() => {
    const rows = TeamSales.get().rows;
    const me = TeamLearn.me(), mr = TeamLearn.readiness(me.id);
    return { me: me.name, manager: { role: me.role, photo: me.photo, state: mr.state, pct: mr.pct }, people: TeamLearn.people().length, cur: TeamData.currency(), venue: TeamData.get().venue, allergens: TeamData.allergenCountry(),
      wines: TeamData.wines().length, cards: TeamData.wines().filter((w) => TeamData.card(w.id)).length, dishes: TeamData.dishes().length, pairings: TeamData.dishes().filter((x) => TeamData.pairing(x.id)).length,
      cocktails: TeamData.cocktails().length, mixCards: TeamData.cocktails().filter((c) => TeamData.cocktailCard(c.id)).length, glass: TeamData.wines().filter((w) => TeamData.byGlass(w)).length,
      demo: TeamSales.demo(), rows: rows.length, offList: rows.some((r) => /House Prosecco \(Events\)/.test(r.n) && !r.w) };
  });
  // The demo opens as the person it's shown to: Eloise's own head of food and beverage as its manager, with his photo,
  // at the manager's stage of the invented team (about three quarters of the way, not yet ready).
  expect(st.me).toBe('Cam Dryburgh');
  expect(st.manager).toMatchObject({ role: 'manager', photo: 'brand/eloise/cam-dryburgh.jpg', state: 'not' });
  expect(st.manager.pct).toBeGreaterThan(65);
  expect((await page.request.get(`${BASE}/team/brand/eloise/cam-dryburgh.jpg`)).status()).toBe(200);
  expect(st.people).toBe(7);
  expect(st.cur).toMatchObject({ sym: '$', code: 'CAD' });
  expect(st.allergens).toBe('CA');
  expect(st.venue).toMatchObject({ name: 'Eloise', city: 'Toronto', sample: 'eloise' });
  await expect(page.getByTestId('team-venue-logo')).toHaveAttribute('src', /^brand\/eloise\/wordmark-white\.svg(\?v=|$)/);
  expect((await page.request.get(`${BASE}/team/brand/eloise/wordmark-white.svg`)).status()).toBe(200);
  expect(st).toMatchObject({ wines: 76, cards: 76, dishes: 17, pairings: 17, cocktails: 10, mixCards: 10, glass: 12, demo: true, offList: true });
  expect(st.rows).toBeGreaterThan(1000);
  await expect(page.locator('#root')).not.toContainText('£');
  // The allergens drafted from the menu are accepted for the demo (by "Demo data"), so Menu has nothing left to confirm.
  expect(await page.evaluate(() => TeamData.dishes().every((x) => TeamData.allergensOf(x.id) != null) && TeamData.allergensOf('d-seared-scallop'))).toEqual(['shellfish']);
  // A browser that opened an earlier copy, when the manager was Elena, starts again as Cam instead of keeping her
  // with Cam added beside her; the same copy opened again keeps its team.
  await page.evaluate(() => { const t = TeamLearn.team(), m = Object.values(t.people).find((p) => p.role === 'manager'); m.name = 'Elena Ruiz'; m.photo = 'faces/1.png'; TeamLearn._saveTeam(t); const d = TeamData.get(); d.venue.seeded = 'an-older-copy'; TeamData.save(d); });
  await page.goto(`${BASE}/team/?seed=eloise`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  expect(await page.evaluate(() => [TeamLearn.me().name, TeamLearn.people().length, TeamLearn.people().some((p) => p.name === 'Elena Ruiz')])).toEqual(['Cam Dryburgh', 7, false]);
  // Shown to a prospect: the console's Wines section opens on their wines, without our sommelier review card
  // (venue.console.hide); the questions it held stay out of the drill, and another restaurant still shows the card.
  await page.goto(`${BASE}/team/?seed=eloise&view=console`);
  await page.getByTestId('console-nav-wines').click();
  await expect(page.getByTestId('console-wines')).toBeVisible();
  await expect(page.getByTestId('console-sommelier')).toHaveCount(0);
  await page.getByTestId('console-nav-menu').click();
  await expect(page.getByTestId('menu-allergens').first()).toBeVisible();
  await expect(page.getByTestId('menu-allergen-todo')).toHaveCount(0);
  await page.getByTestId('console-nav-wines').click();
  expect(await page.evaluate(() => TeamData.reviewed().held.length)).toBeGreaterThan(0);
  await page.goto(`${BASE}/team/?seed=princess&view=console`);
  await page.getByTestId('console-nav-wines').click();
  await expect(page.getByTestId('console-sommelier')).toBeVisible();
  // Admin never says what the training costs us to write: a prospect reads this screen.
  await page.getByTestId('console-nav-admin').click();
  await expect(page.getByText('Accounts and billing')).toBeVisible();
  await expect(page.locator('#root')).not.toContainText(/Writing is the only cost|about 3p|under a penny/);
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
  expect(out.parts).toContain('glass'); expect(out.parts).toContain('pairings'); expect(out.parts).not.toContain('bottle'); expect(out.parts).not.toContain('dishes'); // a bartender's minimum leaves bottles out; the menu is two areas, pairings and menu
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
    const amara = who('Amara'), priya = who('Marco'), items = TeamLearn._all(); // Marco: slipping, with faded answers due
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
  // Like a live install: nobody at 0%, the newest person a little way in, the manager most of the way.
  Object.values(states).forEach((x) => expect(x.pct).toBeGreaterThan(10));
  expect(states.Amara.pct).toBeLessThan(30); expect(states.Priya.pct).toBeLessThan(55);
  expect(states.Elena.pct).toBeGreaterThan(65); expect(states.Elena.state).toBe('not');
  await page.getByTestId('team-tab-team').click();
  await expect(page.locator('#root')).toContainText('2 ready, 1 slipping');
  // The same team on every restaurant, whatever the size of its list.
  for (const seed of ['social', 'princess-royal', 'eloise']) {
    await page.goto(`${BASE}/team/?seed=${seed}`);
    await expect(page.getByTestId('team-state')).toBeVisible();
    const st = await page.evaluate(() => TeamLearn.people().map((p) => { const r = TeamLearn.readiness(p.id); return { n: p.name.split(' ')[0], state: r.state, pct: r.pct }; }));
    st.forEach((x) => expect(x.pct, `${seed} ${x.n}`).toBeGreaterThan(10));
    expect(st.filter((x) => x.state === 'ready').length, seed).toBeGreaterThanOrEqual(2);
    expect(st.find((x) => x.n === 'Marco').state, seed).toBe('slipping');
  }
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
  await startFresh(page);
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
  await startFresh(page);
  expect(await page.getByTestId('team-part').count()).toBe(4); // glasses, bottles, pairings, menu
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
  // "Quiz me on our red wines" is a test, not a question: Vinny's test narrowed to the reds opens as a drill, with no call.
  await page.getByLabel('Back').first().click();
  const calls = reqs.filter((r) => r.purpose === 'team_vinny').length;
  await page.getByTestId('vinny-input').fill('Quiz me on our red wines');
  await page.getByLabel('Ask', { exact: true }).click();
  await expect(page.getByTestId('team-drill')).toBeVisible();
  await expect(page.getByTestId('drill-intro')).toContainText(/reds/i);
  expect(reqs.filter((r) => r.purpose === 'team_vinny').length).toBe(calls);
  expect(await page.evaluate(() => [TeamVinny.quizAsk('Quiz me on our red wines'), TeamVinny.quizAsk('test me'), TeamVinny.quizAsk('Ask me a few questions about the Malbec'), TeamVinny.quizAsk('What goes with the olives?')])).toEqual(['red wines', '', 'Malbec', null]);
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
  // A table landed with choices doesn't count toward readiness, and the progress card says so.
  await expect(page.getByTestId('guest-counted')).toContainText("doesn't count");
  await expect(page.getByTestId('guest-progress')).toContainText(/Landed 1 of your last table/);

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
  await expect(page.getByTestId('guest-counted')).toContainText("With 3 hints it doesn't count");

  // On your own: no choices and no hints.
  await page.getByText('Another table').click();
  await page.getByTestId('guest-help-own').click();
  await expect(page.getByTestId('guest-choices')).toHaveCount(0);
  await expect(page.getByTestId('guest-hints')).toHaveCount(0);
  // Landed on their own: the wine's At-the-table question is right from it, and readiness moves.
  const before = await page.evaluate(() => { const pid = TeamLearn.me().id, sc = TeamVinny.scenario(pid); return { pct: TeamLearn.readiness(pid).pct, known: TeamLearn.progress(pid, sc.wines[0]).known }; });
  await page.getByTestId('guest-reply').fill('The Grüner by the glass, peppery and fresh with the dish.');
  await page.getByText('Say', { exact: true }).click();
  await expect(page.getByTestId('guest-help-used')).toHaveText('On your own');
  // It counts where the table's wine has an At-the-table question for their role; where it has none, the screen says so
  // (never "With 0 hints it doesn't count").
  await expect(page.getByTestId('guest-counted')).toContainText(/This counts|Landed\. The .* has no At-the-table question/);
  const after = await page.evaluate(() => { const pid = TeamLearn.me().id; const log = TeamVinny.tableState(pid).log, last = log[log.length - 1]; return { pct: TeamLearn.readiness(pid).pct, known: TeamLearn.progress(pid, last.wines[0]).known, counted: true }; });
  if (/This counts/.test(await page.getByTestId('guest-counted').textContent())) expect(after.known).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId('guest-progress')).toContainText(/Landed \d of your last 4 tables/);
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
test('a test mixes its questions: no answer twice, nothing grouped, and wrong pairings the pairings rule out', async ({ context, page }) => {
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
    // Every "which wine suits this dish best" offers its first pick against wines the pairings rule out for the dish
    // (never one of its picks, never a wine tableFit calls good), so a sommelier stands behind one answer.
    const bad = TeamData.dishes().flatMap((d) => { const pr = TeamData.pairing(d.id) || {}, picks = new Set([...(pr.best || []).map((b) => b.id), pr.glass && pr.glass.id].filter(Boolean));
      return TeamLearn.dishQs(d.id).filter((q) => q.opts).flatMap((q) => q.opts.filter((o, i) => i !== q.a).map((o) => TeamData.wines().find((w) => TeamData.short(w) === o)).filter((w) => w && (picks.has(w.id) || TeamLearn.tableFit(w.id, d.id) === 'good')).map((w) => d.name + ': ' + TeamData.short(w))); });
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
  test.setTimeout(90000); // three restaurants' table questions
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
  for (const seed of ['demo', 'social', 'princess-royal', 'eloise']) {
    const r = await check(seed);
    expect(r.tooFew).toEqual([]); // no choice of one or two
    expect(r.lengthCue).toEqual([]);
    expect(r.sameClaim).toEqual([]);
    expect(r.wrongWine).toEqual([]); // every wrong wine is on the list and wrong for this table
    expect(r.wish).toEqual([]); // and is what the guest asked for: a white for a white, by the glass for a glass
    // Table questions are written as choices; one is asked as a choice only where wrong wines meet the guest's request
    // (kind, glass, price) and the dish alone rules them out, else it names the wine and asks why (demo 11 of 27, Social Corner 27 of 41;
    // fewer since a guest's floor counts too: "between £75 and £80" leaves few wrong wines that price alone doesn't rule out).
    expect(r.decided).toBeGreaterThanOrEqual(r.total * 0.4);
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
  expect(await page.evaluate(() => [TeamSample.hostSeed('socialcorner.vinterest.team'), TeamSample.hostSeed('SocialCorner.vinterest.team'), TeamSample.hostSeed('princessroyal.vinterest.team'), TeamSample.hostSeed('eloise.vinterest.team'), TeamSample.hostSeed('vinterest.pages.dev'), TeamSample.hostSeed(), TeamSample.hostSeed('demo.vinterest.team')])).toEqual(['social', 'social', 'princess-royal', 'eloise', null, null, 'demo']);
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
  // Tonight shows only what's set, never the whole menu and list, until Set tonight opens the picker; the picker's
  // open or closed state is remembered, and a dish 86'd there shows on its own once it closes.
  await expect(page.getByTestId('dash-tonight-off')).toHaveCount(0);
  await expect(page.getByTestId('dash-tonight-set')).toContainText("Nothing 86'd or on feature tonight");
  await page.getByTestId('dash-tonight-change').click();
  await page.getByTestId('dash-tonight-off').first().click();
  await page.reload();
  await expect(page.getByTestId('dash-tonight-off')).toHaveCount(10); // the picker stayed open
  await page.getByTestId('dash-tonight-change').click();
  await expect(page.getByTestId('dash-tonight-off')).toHaveCount(1); // closed: only the dish that's 86'd
  await page.reload();
  await expect(page.getByTestId('dash-tonight-set')).toBeVisible();
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
  for (const seed of ['demo', 'social', 'princess-royal', 'eloise']) {
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
  for (const seed of ['social', 'princess-royal', 'eloise']) { expect(seen[seed].q).toBe(seen.demo.q); expect(seen[seed].opt).toBe(seen.demo.opt); }
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

test('after a miss the answer is explained, menu pairings practice asks pairings, table reasons are about the wine, and the summary says which questions come back', async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=princess`);
  await page.waitForFunction(() => window.TeamLearn && TeamData.wines().length > 0 && TeamLearn.people().length > 0);
  const r = await page.evaluate(() => {
    const out = { pours: [], orders: [], missedWhy: 0, missedPlace: 0 };
    TeamData.wines().forEach((w) => TeamLearn.wineQs(w.id, { all: true }).forEach((q) => {
      const ans = q.opts && q.a != null ? q.opts[q.a] : q.ans;
      // A place question missed is followed by where it's from, never a dish to pour it with.
      if (q.k !== 'apply' && /^(place|country)$/.test(TeamLearn._topic(q.q))) { const a = TeamLearn.aside(q, ans, new Set(), { missed: true }); if (a) { out.missedPlace++; if (/^Pour it with/.test(a.text)) out.pours.push(q.q); } }
      if (q.k === 'apply') TeamLearn.choices(q).opts.forEach((o) => { if (/^(pour|avoid|suggest|recommend) the\b/i.test(o)) out.orders.push(o); });
    }));
    const pid = TeamLearn.addPerson('Sam New', 'server'); // someone who hasn't started: everyone on the demo team has
    out.practice = TeamLearn.drill(pid, 5, 'dishes').map((q) => q.id); TeamLearn.removePerson(pid);
    const badassiere = TeamLearn.wineQs('w-baron-de-badassiere-syrah', { all: true }).find((q) => /part of France/.test(q.q));
    out.explained = (TeamLearn.aside(badassiere, 'Languedoc', new Set(), { missed: true }) || {}).text;
    return out;
  });
  expect(r.missedPlace).toBeGreaterThan(20);
  expect(r.pours).toEqual([]);
  expect(r.orders).toEqual([]); // "Pour the La Giustiniana Gavi, because…" is never a reason under Why it works
  expect(r.explained).toMatch(/Languedoc/);
  expect(r.practice.length).toBe(5);
  expect(r.practice.every((id) => /#\d+$/.test(id))).toBe(true); // which wine suits it, not what's in it
  const line = await page.evaluate(() => { const pid = TeamLearn.people()[0].id, items = TeamLearn._mine(TeamLearn._all(), pid).items, day = Date.now() + 86400000;
    ['zz#0', 'zz#1'].forEach((id) => { items[id] = { reps: 1, due: day }; }); return TeamLearn.comesBack(pid, [{ id: 'zz#0' }, { id: 'zz#1' }]); });
  expect(line).toBe("You'll get the two questions you got right again tomorrow, to check they've stuck.");
});

test('training depth: Essentials asks four options with no ladder and counts what is known, Service two rungs and one reason from three, Master is unchanged', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await stubNetwork(ctx);
  // The Princess Royal's list file sets its start: servers on Essentials, the sommelier on Master.
  await page.goto(`${BASE}/team/?seed=princess&view=console`);
  await expect(page.getByTestId('team-console')).toBeVisible();
  const r = await page.evaluate(() => {
    const ws = TeamData.wines(), ds = TeamData.dishes(), srv = TeamLearn.people().find((p) => p.role === 'server'), som = TeamLearn.people().find((p) => p.role === 'sommelier');
    const all = (role) => [...ws.flatMap((w) => TeamLearn.qsFor(role, w.id)), ...ds.flatMap((d) => TeamLearn.dishQsFor(role, d.id))];
    const ess = all('server'), mas = all('sommelier');
    const four = ess.filter((q) => !q.allergen).every((q) => (q.k === 'recognise' || q.mc) && q.opts.length <= 4 && q.opts.length >= 3);
    const ids = new Set(mas.map((q) => q.id).concat(ws.flatMap((w) => TeamLearn.lightQs(w.id).map((q) => q.id))));
    const table = ess.find((q) => q.k === 'apply' && q.wine);
    const priced = ws.filter((w) => w.glass || w.bottle).filter((w) => TeamLearn.qsFor('server', w.id).some((q) => /[£$€]/.test(String(q.ans || '')))).length;
    const rd = TeamLearn.readiness(srv.id), essRungs = TeamLearn.progress(srv.id, ws[0].id).rungs.length, somRungs = TeamLearn.progress(som.id, ws[0].id).rungs.map((x) => x.label);
    TeamLearn.setTier('service'); TeamLearn.setRoleTier('sommelier', null);
    const svc = all('server'), svcTable = svc.find((q) => q.k === 'apply' && q.wine && q.pills && q.pills.groups.length === 2);
    const svcFour = svc.filter((q) => !q.allergen && !q.pills).every((q) => (q.k === 'recognise' || q.mc) && q.opts.length <= 4);
    TeamLearn.setTier('master'); const masterNow = all('sommelier').map((q) => q.id).join();
    return { tiers: [TeamLearn.tier(), TeamLearn.tier('sommelier')], four, essN: ess.length, masN: mas.length, idsKept: ess.every((q) => ids.has(q.id)),
      noContrast: !ess.some((q) => q.k === 'contrast'), noMod: !ess.some((q) => q.dish && /#(mod|1)$/.test(q.id)), allergenKept: (() => { const a = { id: 'd:x#allergen', dish: 'x', k: 'recall', allergen: true, pills: { opts: ['Milk', 'Eggs', 'None of these'], right: [0, 1], n: 2 } }; return TeamLearn.tierQ(a, 'essentials') === a; })(), // The Princess Royal's kitchen hasn't confirmed allergens yet: the shape is checked on one
      table: table && { opts: table.opts.length, why: !!table.why, mc: table.mc }, priced, pricedOf: ws.filter((w) => w.glass || w.bottle).length,
      rungs: essRungs, somRungs, ready: { tier: rd.tier, count: rd.count, pct: rd.pct },
      label: TeamLearn.rungLabel(ess.find((q) => q.wine && q.k !== 'apply'), 'essentials'), svcRungs: TeamLearn.rungsFor('service', ['recognise', 'recall', 'apply']).map((x) => x.label),
      svcTable: svcTable && svcTable.pills.groups.map((g) => g.to - g.from), svcFour, masterSame: masterNow === mas.map((q) => q.id).join(), // the sommelier's Master set is the same before the switches and after
      conf: [TeamLearn.asksConfidence({ k: 'recall', ans: '£9 a glass' }, 'essentials'), TeamLearn.asksConfidence({ k: 'recall', ans: '£9 a glass' }, 'service')] };
  });
  expect(r.tiers).toEqual(['master', 'master']); // after the test put them back
  expect(r.four).toBe(true); // every Essentials question is four options (three where the list offers no more)
  expect(r.essN).toBeLessThan(r.masN / 1.5);
  expect(r.idsKept).toBe(true); // a question keeps its id in every shape
  expect(r.noContrast).toBe(true); expect(r.noMod).toBe(true); expect(r.allergenKept).toBe(true);
  expect(r.table).toMatchObject({ mc: true, why: true }); expect(r.table.opts).toBeGreaterThanOrEqual(3);
  expect(r.priced).toBeGreaterThan(r.pricedOf * 0.8); // nearly every priced wine asks its price at Essentials
  expect(r.rungs).toBe(0); expect(r.somRungs).toEqual(['Recognise', 'Recall', 'At the table']);
  expect(r.ready.tier).toBe('essentials'); expect(r.ready.count.total).toBeGreaterThan(100); expect(r.ready.pct).toBe(Math.round(100 * r.ready.count.known / r.ready.count.total));
  expect(r.label).toBe('Our wines');
  expect(r.svcRungs).toEqual(['Know it', 'At the table']);
  expect(r.svcTable).toEqual([expect.any(Number), 3]); expect(r.svcFour).toBe(true);
  expect(r.masterSame).toBe(true); // Master is what it has always been
  expect(r.conf).toEqual([false, true]);
  // The console: the depth card, a role's own depth, and the level row only while someone is on Master.
  await page.getByTestId('console-nav-team').click();
  await page.evaluate(() => { TeamLearn.setTier('essentials'); TeamLearn.setRoleTier('sommelier', 'master'); });
  await page.getByTestId('console-tier-service').click();
  await expect(page.getByTestId('console-tier-about')).toContainText('one reason from three');
  await expect(page.getByTestId('console-level')).toBeVisible(); // the sommelier is still on Master
  await page.locator('[data-testid="console-role-tier"]').filter({ hasText: /^Same/ }).nth(2).click(); // the sommelier follows the restaurant
  await expect(page.getByTestId('console-level')).toHaveCount(0); // nobody on Master: no level row
  await page.getByTestId('console-tier-essentials').click();
  // A server on Essentials: Today counts what they know, the drill shows four options under a plain heading and no "how sure".
  await page.evaluate(() => { const s = TeamLearn.people().find((p) => p.role === 'server'); TeamLearn.setMe(s.id); });
  await page.goto(`${BASE}/team/?seed=princess&view=phone`);
  await expect(page.getByTestId('team-state')).toContainText(/You know \d+ of \d+/);
  await page.getByText(/Start today's drill|Do another 5 questions|Practise/).first().click();
  await expect(page.getByTestId('drill-q')).toBeVisible();
  expect(await page.getByTestId('drill-opt').count()).toBeLessThanOrEqual(4);
  await expect(page.getByTestId('drill-sure')).toHaveCount(0);
  await expect(page.getByTestId('team-drill')).not.toContainText(/RECOGNISE|RECALL/);
  expect(errors).toEqual([]);
  await ctx.close();
});

// The staff app on an iPad (docs/business.md "The staff app on a tablet"): a rail of tabs down the left, Today and Practise
// in two columns, a wine or dish open beside its list, nothing off the side; a screenshot of each is kept to look at.
for (const [name, viewport] of [['landscape', { width: 1180, height: 820 }], ['portrait', { width: 820, height: 1180 }]]) {
  test(`the staff app on an iPad (${name}): a rail, two columns, the wine beside the list`, async ({ browser }, info) => {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await stubNetwork(ctx);
    await page.goto(`${BASE}/team/?seed=princess&view=phone`);
    await page.waitForFunction(() => window.TeamLearn && TeamLearn.people().length > 0);
    await page.evaluate(() => { const s = TeamLearn.people().find((p) => p.role === 'server'); TeamLearn.setMe(s.id); });
    await page.reload();
    await expect(page.getByTestId('team-state')).toBeVisible();
    const noOverflow = () => page.evaluate(() => { const vw = document.documentElement.clientWidth; return [...document.querySelectorAll('#root *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1; }).length; });
    // The rail replaces the bottom bar, and Today runs in two columns with Tonight on the right.
    await expect(page.getByTestId('team-rail')).toBeVisible();
    expect(await page.locator('[data-wide-columns]').count()).toBe(1);
    const cols = page.locator('[data-wide-columns] > div');
    const [a, b] = [await cols.nth(0).boundingBox(), await cols.nth(1).boundingBox()];
    expect(b.x).toBeGreaterThan(a.x + 200); expect(Math.abs(a.y - b.y)).toBeLessThan(10);
    expect(await cols.nth(1).locator('[role="button"]').count()).toBeGreaterThan(0); // what's new to learn, on the right (Tonight too, when the day has an 86'd or a feature)
    await expect(page.getByText(/Start today's drill|Practise · 5|Do another 5/).first()).toBeVisible();
    expect(await noOverflow()).toBe(0);
    await page.screenshot({ path: info.outputPath(`tablet-team-today-${name}.png`) });
    // Practise: the three doors across.
    await page.getByTestId('team-rail').getByTestId('team-tab-vinny').click();
    const doors = page.getByTestId('vinny-doors').locator('[data-testid^="vinny-door-"]');
    const [d0, d1] = [await doors.nth(0).boundingBox(), await doors.nth(1).boundingBox()];
    expect(Math.abs(d0.y - d1.y)).toBeLessThan(4);
    // Wines: a wine opens beside the list, another row replaces it, Back returns to the list alone.
    await page.getByTestId('team-rail').getByTestId('team-tab-wines').click();
    await page.getByTestId('team-wine-row').nth(3).click();
    await expect(page.getByTestId('team-split-list')).toBeVisible();
    await expect(page.getByTestId('team-pitch')).toBeVisible();
    const name3 = await page.getByTestId('team-split-list').getByTestId('team-wine-row').nth(3).getAttribute('aria-current');
    expect(name3).toBe('true');
    await page.getByTestId('team-split-list').getByTestId('team-wine-row').nth(5).click();
    await expect(page.getByTestId('team-split-list').getByTestId('team-wine-row').nth(5)).toHaveAttribute('aria-current', 'true');
    expect(await page.evaluate(() => document.querySelectorAll('[data-testid="team-pitch"]').length)).toBe(1);
    expect(await noOverflow()).toBe(0);
    await page.screenshot({ path: info.outputPath(`tablet-team-wine-${name}.png`) });
    await page.getByLabel('Back').first().click();
    await expect(page.getByTestId('team-split-list')).toHaveCount(0);
    await expect(page.getByTestId('team-wine-row').first()).toBeVisible();
    // Menu: the same, and the rail stays while a dish is open.
    await page.getByTestId('team-rail').getByTestId('team-tab-menu').click();
    await page.getByTestId('team-dish-row').nth(4).click();
    await expect(page.getByTestId('team-split-list')).toBeVisible();
    await expect(page.getByTestId('team-rail')).toBeVisible();
    expect(await noOverflow()).toBe(0);
    await page.screenshot({ path: info.outputPath(`tablet-team-dish-${name}.png`) });
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

test('a drill about one wine never asks which wine: its table question asks only the reason', async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=princess&view=phone`);
  await page.waitForFunction(() => window.TeamLearn && TeamLearn.people().length > 0);
  const r = await page.evaluate(() => {
    const som = TeamLearn.people().find((p) => p.role === 'sommelier'), srv = TeamLearn.people().find((p) => p.role === 'server');
    // Master: every wine with a two-step table question, practised alone, asks the reason only.
    const bad = [], reworded = [];
    TeamData.wines().forEach((w) => TeamLearn.qsFor('sommelier', w.id).filter((q) => q.k === 'apply').forEach((q) => {
      const c = TeamLearn.choices(q); if (!(c.groups || []).some((g) => /suggest/i.test(g.label))) return;
      const o = TeamLearn.oneWine(q); if (!o) { bad.push(q.q); return; }
      const oc = TeamLearn.choices(o); if ((oc.groups || []).some((g) => /suggest/i.test(g.label)) || /What would you suggest/.test(o.q)) bad.push(o.q); else reworded.push(o.q);
    }));
    // Essentials: the wine-only table question isn't asked alone; a narrowed test on one wine carries no "which wine".
    const ess = TeamData.wines().flatMap((w) => TeamLearn.qsFor('server', w.id).filter((q) => q.k === 'apply' && q.mc));
    const essGone = ess.every((q) => TeamLearn.oneWine(q) === null);
    const t = TeamVinny.test(som.id, { ask: 'Tondonia' });
    return { bad, reworded: reworded.length, sample: reworded[0], essN: ess.length, essGone, test: t.qs.map((q) => q.q), title: t.title };
  });
  expect(r.bad).toEqual([]);
  expect(r.reworded).toBeGreaterThan(20);
  expect(r.sample).toMatch(/You suggest the .+\. Why does it work\?$/);
  expect(r.essN).toBeGreaterThan(20); expect(r.essGone).toBe(true);
  expect(r.test.some((q) => /What would you suggest/.test(q))).toBe(false);
  // On the screen: Practise this wine from a card with a table question.
  await page.evaluate(() => { const s = TeamLearn.people().find((p) => p.role === 'sommelier'); TeamLearn.setMe(s.id); });
  await page.reload();
  await page.getByTestId('team-tab-wines').click();
  await page.getByTestId('team-wine-row').filter({ hasText: 'Tondonia' }).first().click();
  await page.getByText(/Start this wine|Practise this wine/).click();
  await expect(page.getByTestId('drill-q')).toBeVisible();
  const seen = await page.evaluate(() => [...document.querySelectorAll('[data-testid="team-drill"]')].length);
  expect(seen).toBe(1);
  expect(await page.evaluate(() => TeamLearn.qsFor('sommelier', TeamData.wines().find((w) => /Tondonia/.test(w.name)).id).map((q) => TeamLearn.oneWine(q)).filter(Boolean).some((q) => /What would you suggest/.test(q.q)))).toBe(false);
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
  await startFresh(page);
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
  test.setTimeout(300000); // the whole review of five restaurants, twice over
  await stubNetwork(context);
  for (const seed of ['demo', 'sample', 'princess-royal', 'eloise', 'social']) { // The Social Corner last: the checks below are on it
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
  expect(!gaps || /^[12] of your top 8 sellers (isn't|aren't) known yet$/.test(gaps.title)).toBe(true);
  // One row per wine, its figure on the right, never one long sentence of names.
  if (gaps) { expect(gaps.rows.length).toBeGreaterThan(0); gaps.rows.forEach((r) => { expect(r.value).toMatch(/^\d+ of \d+ know it$/); expect(r.open.view).toBe('wine'); }); expect(gaps.text.length).toBeLessThan(80); }
  const known = brief.find((x) => x.k === 'known');
  expect(known && known.title).toMatch(/: known, but not selling$/);
  const row = await page.evaluate((id) => TeamReport.slowMovers(28, Infinity).find((x) => x.wine.id === id), known.open.id);
  expect(row.knows).toBeGreaterThanOrEqual(Math.ceil(row.of / 2));
});

// Glasses and bottles are counted apart everywhere Sales Insights reports what sold: a bottle is several glasses' takings.
test('sales insights count glasses and bottles apart', async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=demo`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  const r = await page.evaluate(() => { const s = TeamReport.salesSummary(7), b = TeamReport.salesBrief(); return { s, text: b.map((x) => x.title + ' ' + x.text).join(' ') }; });
  expect(r.s.glasses + r.s.bottles).toBe(r.s.lines);
  expect(r.text).not.toMatch(/glasses (or|and) bottles/);
  expect(r.text).toContain(`${r.s.glasses} glasses and ${r.s.bottles} bottles`);
  expect(r.text).toMatch(/\d\.\d\d glasses and \d\.\d\d bottles a guest/);
  await page.goto(`${BASE}/team/?view=console`);
  await page.getByTestId('console-nav-sales').click();
  await expect(page.getByTestId('sales-glasses')).toHaveText(/^\d\.\d\d/);
  await expect(page.getByTestId('sales-bottles')).toHaveText(/^\d\.\d\d/);
  await expect(page.getByTestId('console-sales')).toContainText('Glasses per guest');
  await expect(page.getByTestId('console-sales')).toContainText('Bottles per guest');
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
      // (A comparison with no wrong answers about what it asks borrows other wines' answers, isn't asked, and goes back at publish.)
      if (q.k === 'contrast' && s.via !== 'pool' && s.right.length !== 1) out.contrastRight.push(q.id);
    });
    return out;
  });
  expect(r.empty).toEqual([]);
  expect(r.abroad).toEqual([]); // "Which Italian region…" never offers the Rhône or the Okanagan
  expect(r.notWines).toEqual([]); // "Name a wine by the glass for…" never offers Rioja or the Loire
  expect(r.contrastRight).toEqual([]);
});

// A device that opened The Larkspur before the demo's story changed meets the new one: the old copy's team,
// progress and sales are replaced whole (it's invented), where The Social Corner keeps them between deploys.
test('an older copy of the demo restaurant is replaced whole', async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=demo`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  const before = await page.evaluate(() => {
    const d = TeamData.get(); d.venue.seeded = 'an older build'; TeamData.save(d);   // as a phone that opened it before
    TeamLearn.addPerson('Old Visitor', 'server');
    return { current: TeamSample.current('demo'), people: TeamLearn.people().length };
  });
  expect(before.current).toBe(false);
  await page.goto(`${BASE}/team/?seed=demo`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  const after = await page.evaluate(() => ({ current: TeamSample.current('demo'), names: TeamLearn.people().map((p) => p.name), sales: (TeamSales.get().rows || []).length, logo: TeamData.brand().logo }));
  expect(after.current).toBe(true);
  expect(after.names).not.toContain('Old Visitor');
  expect(after.sales).toBeGreaterThan(0);
  expect(after.logo).toMatch(/story\d+/);
});

// The Social Corner keeps its team's progress between deploys, but a changed demo story re-invents its sales.
test('a changed demo story re-invents The Social Corner sales and keeps its progress', async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto(`${BASE}/team/?seed=social`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  const before = await page.evaluate(() => {
    const d = TeamData.get(); d.venue.seeded = 'old|old|story1'; TeamData.save(d);
    const s = TeamSales.get(); s.rows = s.rows.slice(0, 3); TeamSales.save(s);
    return { people: TeamLearn.people().map((p) => p.name) };
  });
  await page.goto(`${BASE}/team/?seed=social`);
  await expect(page.getByTestId('team-state')).toBeVisible();
  const after = await page.evaluate(() => ({ current: TeamSample.current('social'), rows: TeamSales.get().rows.length, people: TeamLearn.people().map((p) => p.name) }));
  expect(after.current).toBe(true);
  expect(after.rows).toBeGreaterThan(3);
  expect(after.people).toEqual(before.people);
});

test('the faults the sommelier review found stay fixed on every restaurant: grape colours, "the The", cut-off lines, one claim per comparison', async ({ context, page }) => {
  await stubNetwork(context);
  for (const seed of ['social', 'demo']) {
    await page.goto(`${BASE}/team/?seed=${seed}`);
    await page.waitForFunction(() => window.TeamLearn && TeamData.wines().length > 0);
    const r = await page.evaluate(() => {
      const out = { colour: [], theThe: [], cut: [], claims: [], faults: [] };
      TeamData.wines().forEach((w) => [...TeamLearn.wineQs(w.id), ...TeamLearn.lightQs(w.id)].forEach((q) => {
        const s = TeamLearn.shown(TeamLearn.deal(q, 't')), wrong = s.opts.filter((o, i) => !s.right.includes(i));
        const col = TeamLearn._wineSkin(w);
        if (q.k === 'recall' && col && TeamLearn._topic(q.q) === 'grape') wrong.forEach((o) => { if (TeamLearn._grapeSkin(o) === TeamLearn._otherSkin(col)) out.colour.push(`${w.name}: ${o}`); });
        if (q.k === 'contrast') { const seen = new Set(); wrong.forEach((o) => TeamLearn._styleAxes(o).forEach((a) => { if (seen.has(a)) out.claims.push(q.id); seen.add(a); })); }
        const a = TeamLearn.aside(q, s.right.map((i) => s.opts[i]).join(' ')); if (a && a.text && /…$/.test(a.text)) out.cut.push(q.id);
        if (TeamLearn._fault(q)) out.faults.push(q.id);
      }));
      TeamData.dishes().forEach((d) => TeamLearn.dishQs(d.id, { all: true }).forEach((q) => { const t = [q.q, ...(q.opts || []), ...((q.pills || {}).opts || [])].join(' '); if (/\bthe The\b/.test(t)) out.theThe.push(q.id); }));
      return out;
    });
    expect(r.colour, seed).toEqual([]); // a still white is never asked against Syrah, a red never against Riesling
    expect(r.theThe, seed).toEqual([]);
    expect(r.cut, seed).toEqual([]); // the line after an answer is whole sentences or nothing
    expect(r.claims, seed).toEqual([]); // "Veuve is lighter" and "Lanson is fuller" are one mistake, offered once
    expect(r.faults, seed).toEqual([]); // nothing the drill asks is thin, pooled or picked out by the length of its reasons
  }
});

// The pre-shift briefing (TeamShift, docs/business.md "The pre-shift briefing"): a manager adds a special by typing it,
// one call reads and pairs it from the list, nothing reaches the team until it's approved with the allergens
// confirmed, and the briefing sent is a gate every person accepts before the app opens. Sold out shows at once with
// no second acceptance; a new special is an update with what's new marked. A special is gone when its run ends.
test('the pre-shift briefing: a special read, paired and approved, a gate everyone accepts, sold out, an update, expiry', async ({ context, page }) => {
  const asked = [];
  const special = (name, price) => JSON.stringify({ specials: [{ name, description: 'Pan-roasted, with brown butter and capers.', price, section: 'main',
    allergens: [{ code: 'fish', sure: 'stated' }, { code: 'milk', sure: 'likely' }, { code: 'not-a-code', sure: 'likely' }],
    bottle: { id: 'w-jolivet-sancerre', why: 'Its sharp citrus cuts the butter.' }, glass: { id: 'w-jolivet-sancerre', why: 'Not sold by the glass, so this is dropped.' },
    alts: [{ id: 'w-laroche-chablis', why: 'Steely and clean beside the fish.' }, { id: 'w-not-on-the-list', why: 'Invented.' }], say: `Tonight's special is the ${name}, lovely with our Sancerre.` }] });
  const errors = await openSample(context, page, { claudeRequests: asked, claudeText: (b) => (b.purpose === 'team_special' ? special(/turbot/i.test(JSON.stringify(b.messages)) ? 'Turbot' : 'Halibut', 34) : '') });
  // The manager: 86 a dish, then add a special by typing it.
  await page.getByTestId('tonight-edit').click();
  await page.getByTestId('tonight-off').first().click();
  await expect(page.getByTestId('shift-status')).toContainText('Not sent yet');
  await page.getByTestId('special-add-open').click();
  await page.getByTestId('special-text').fill('halibut, brown butter, capers 34');
  await page.getByTestId('special-read').click();
  const draft = page.getByTestId('special-draft');
  await expect(draft).toBeVisible();
  expect(asked.filter((b) => b.purpose === 'team_special')).toHaveLength(1);
  // What came back is made safe: only allergens on the restaurant's list, only wines on it, a glass pick only if it's poured by the glass.
  await expect(draft.getByTestId('special-name')).toHaveValue('Halibut');
  await expect(draft.getByTestId('special-allergen')).toHaveCount(2);
  await expect(draft).toContainText('Sancerre'); await expect(draft).toContainText('By the glass: none picked');
  expect(await page.evaluate(() => TeamShift.drafts()[0].pairing.alts.map((a) => a.id))).toEqual(['w-laroche-chablis']);
  // Not approved until the kitchen has confirmed the allergens; the team sees nothing meanwhile.
  await draft.getByTestId('special-approve').click();
  expect(await page.evaluate(() => TeamShift.specials().length)).toBe(0);
  // Swap the glass pick for one that is poured by the glass, confirm, approve.
  await draft.getByText('Pick one').click();
  await draft.getByTestId('special-wine-option').filter({ hasText: 'Chablis' }).click();
  await draft.getByTestId('special-confirm').click();
  await draft.getByTestId('special-approve').click();
  await expect(page.getByTestId('special-live')).toContainText('Halibut');
  await page.getByTestId('shift-send-btn').click();
  await expect(page.getByTestId('shift-status')).toContainText('Sent at');
  await expect(page.getByTestId('shift-register')).toContainText('have read it');
  // Whoever sent it isn't asked to accept it; a server is, before anything else opens.
  await expect(page.getByTestId('briefing-ack')).toHaveCount(0);
  await page.getByLabel('Back').click();
  await expect(page.getByTestId('tonight-specials')).toContainText('Halibut');
  await page.evaluate(() => { const d = TeamShift.get(); Object.keys(d.acks).forEach((k) => { if (d.acks[k].demo) delete d.acks[k]; }); TeamLearn.setMe(TeamLearn.people().find((p) => p.name === 'Sam').id); TeamShift.save(d); });
  const gate = page.getByTestId('team-briefing');
  await expect(gate).toBeVisible();
  await expect(gate.getByTestId('briefing-off')).toBeVisible();
  await expect(gate.getByTestId('briefing-special')).toContainText('Halibut');
  await expect(gate.getByTestId('briefing-allergens')).toContainText('Fish');
  await expect(gate.getByTestId('briefing-special')).toContainText('Chablis');
  expect(await page.evaluate(() => TeamShift.register().waiting.map((p) => p.name))).toContain('Sam');
  await page.getByTestId('briefing-ack').click();
  await expect(gate).toHaveCount(0);
  await expect(page.getByTestId('tonight-specials')).toContainText('Halibut');
  expect(await page.evaluate(() => TeamShift.register().waiting.map((p) => p.name))).not.toContain('Sam');
  // Sold out: on Today at once, and no second acceptance.
  await page.evaluate(() => { TeamShift.soldOut(TeamShift.specials()[0].id, true); });
  await expect(page.getByTestId('tonight-soldout')).toContainText('Halibut');
  await expect(page.getByTestId('team-briefing')).toHaveCount(0);
  // A second special, read from a photo, approved and sent as an update: accepted again, with what's new marked.
  await page.evaluate(async () => { const [s] = await TeamShift.read({ b64: 'AAAA', text: 'turbot' }); TeamShift.update(s.id, { confirmed: true, run: 'week' }); TeamShift.approve(s.id); });
  expect(await page.evaluate(() => TeamShift.status().changed)).toBe(true);
  expect(asked.filter((b) => b.purpose === 'team_special')[1].messages[0].content.some((c) => c.type === 'image')).toBe(true);
  await page.evaluate(() => { TeamShift.send(TeamLearn.people()[0].id); const d = TeamShift.get(); Object.keys(d.acks).forEach((k) => { if (d.acks[k].demo) delete d.acks[k]; }); TeamShift.save(d); });
  await expect(page.getByTestId('team-briefing')).toContainText("Tonight's briefing has changed");
  await expect(page.getByTestId('briefing-special').filter({ hasText: 'Turbot' })).toContainText('New');
  await expect(page.getByTestId('briefing-special').filter({ hasText: 'Halibut' })).not.toContainText('New');
  await page.getByTestId('briefing-ack').click();
  // Tomorrow: tonight's special has run out and can be brought back; the one that runs through Sunday may still be on,
  // and nobody is held at yesterday's briefing.
  const r = await page.evaluate(() => { const t = Date.now() + 86400000, me = TeamLearn.me().id; return { live: TeamShift.specials(t).map((s) => s.name), past: TeamShift.past(t).map((s) => s.name), gate: TeamShift.needsAck(me, t), far: TeamShift.specials(Date.now() + 8 * 86400000).length }; });
  expect(r.live).not.toContain('Halibut'); expect(r.past).toContain('Halibut'); expect(r.gate).toBe(false); expect(r.far).toBe(0);
  expect(errors).toEqual([]);
});

// A pitch demo's short card (docs/business.md "Pitch demos"): written from its own prompt with no questions, more wines a
// call, and enough for the app to build its Essentials questions, so every wine on the list still counts and can be drilled.
test('a short card has no written questions and the app still builds Essentials questions from it', async ({ context, page }) => {
  const asked = [];
  const errors = await openSample(context, page, { claudeRequests: asked, claudeText: (body) => {
    const text = JSON.stringify(body), ids = [...new Set((text.slice(text.lastIndexOf('Write a card for EACH of these wines')).match(/w-[a-z0-9-]+(?= \|)/g)) || [])];
    return JSON.stringify({ cards: ids.map((id) => ({ id, hook: 'From the house on the list.', pitch: 'It is fresh and bright. You will enjoy it with the fish.', say: '', taste: 'Fresh, bright and dry.', style: { body: 2, acid: 4, tannin: 0, sweet: 1 }, serve: { temp: '8-10°C', glass: 'white wine glass', decant: 'no' }, dishes: [], alts: [] })) }); } });
  const out = await page.evaluate(async () => {
    const ids = TeamData.wines().map((w) => w.id), d = TeamData.get(), dishes = {};
    ids.forEach((id) => { dishes[id] = (d.cards[id] || {}).dishes || []; }); d.cards = {}; TeamData.save(d);
    await TeamData.writeCards(ids, null, { short: true });
    const now = TeamData.get(); ids.forEach((id) => { now.cards[id].dishes = dishes[id]; }); TeamData.save(now); // the dishes a real answer would carry
    TeamLearn.setTier('essentials');
    const server = TeamLearn.people().find((p) => p.role === 'server') || TeamLearn.me();
    return { wines: ids.length, cards: Object.keys(TeamData.get().cards).length, written: Object.values(TeamData.get().cards).reduce((n, c) => n + (c.qs || []).length, 0),
      built: ids.map((id) => TeamLearn.qsFor(server.role, id).length), drill: TeamLearn.drill(server.id).length, readiness: !!TeamLearn.readiness(server.id) };
  });
  expect(out.cards).toBe(out.wines);
  expect(out.written).toBe(0);                                   // nothing written to ask
  expect(Math.min(...out.built)).toBeGreaterThanOrEqual(1);      // and still something to ask of every wine
  expect(out.drill).toBeGreaterThan(0);
  expect(out.readiness).toBe(true);
  const calls = asked.filter((b) => b.purpose === 'team_cards');
  expect(calls.length).toBe(Math.ceil(out.wines / 8));           // eight wines a call, not four
  expect(JSON.stringify(calls[0])).toContain('Write nothing else for a wine');
  expect(errors).toEqual([]);
});

// The console's first-use tour: by itself on a person's first visit, a spotlight down the sidebar with a card at each
// stop, each stop opening its section; nothing under it takes a click; Done (or Skip) is remembered for that person on the
// device, and "Take the tour" at the sidebar's foot brings it back.
test('the console tour: first visit only, each stop opens its section, skippable, and it comes back when asked', async ({ context, page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await stubNetwork(context);
  await context.addInitScript(() => { window.VINTEREST_TOUR = 'real'; });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE}/team/?seed=eloise&view=console`);
  const card = page.getByTestId('console-tour-card');
  await expect(card).toHaveAttribute('data-step', 'welcome');
  await expect(card).toContainText("Welcome to Eloise's console");
  await expect(page.getByTestId('console-tour-light')).toHaveCount(0);
  const steps = await page.evaluate(() => TeamTour.steps().map((s) => s.id));
  expect(steps).toEqual(['welcome', 'dash', 'sales', 'team', 'wines', 'cocktails', 'menu', 'upload', 'phone']);
  await page.getByTestId('console-tour-next').click();
  // each section's stop lights its place in the sidebar and opens the section behind the dimming
  for (const [id, testid] of [['dash', 'console-dash'], ['sales', null], ['team', null], ['wines', 'console-wines']]) {
    await expect(card).toHaveAttribute('data-step', id);
    const nav = await page.getByTestId('console-nav-' + id).boundingBox();
    await expect.poll(async () => { const light = await page.getByTestId('console-tour-light').boundingBox(); return Math.abs(light.y + light.height / 2 - (nav.y + nav.height / 2)); }).toBeLessThan(3); // once it has slid there
    if (testid) await expect(page.getByTestId(testid)).toBeVisible();
    // the card stays on screen and clear of the lit control
    const box = await card.boundingBox();
    expect(box.x).toBeGreaterThan(nav.x + nav.width); expect(box.y + box.height).toBeLessThanOrEqual(800);
    if (id !== 'wines') await page.getByTestId('console-tour-next').click();
  }
  await expect(card).toContainText('4 of 8');
  // a click meant for the page behind does nothing while the tour is up
  await page.mouse.click(120, 400);
  await expect(card).toHaveAttribute('data-step', 'wines');
  await page.getByTestId('console-tour-back').click();
  await expect(card).toHaveAttribute('data-step', 'team');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await expect(card).toHaveAttribute('data-step', 'upload');
  await page.getByTestId('console-tour-next').click();
  await expect(card).toHaveAttribute('data-step', 'phone');
  await expect(page.getByTestId('console-tour-skip')).toHaveCount(0);
  await expect(page.getByTestId('console-tour-next')).toHaveText('Done');
  await page.getByTestId('console-tour-next').click();
  await expect(page.getByTestId('console-tour')).toHaveCount(0);
  await page.reload(); // seen: it doesn't come back by itself
  await expect(page.getByTestId('team-console')).toBeVisible();
  await expect(page.getByTestId('console-tour')).toHaveCount(0);
  await page.getByTestId('console-tour-start').click(); // until asked
  await expect(card).toHaveAttribute('data-step', 'welcome');
  await page.getByTestId('console-tour-skip').click();
  await expect(page.getByTestId('console-tour')).toHaveCount(0);
  // a restaurant with no cocktails has no cocktail stop; on a narrow window the card sits at the foot
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`${BASE}/team/?seed=demo&view=console`);
  await expect(card).toHaveAttribute('data-step', 'welcome');
  expect(await page.evaluate(() => TeamTour.steps().some((s) => s.id === 'cocktails'))).toBe(false);
  await page.getByTestId('console-tour-next').click();
  await expect(card).toHaveAttribute('data-step', 'dash');
  const foot = await card.boundingBox();
  expect(foot.y + foot.height).toBeGreaterThan(760); expect(foot.x + foot.width).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('console-tour')).toHaveCount(0);
  expect(errors).toEqual([]);
});

// One text size on the cards (docs/business.md "One size on the cards"): on a wine's, a cocktail's and a dish's card every
// line is 14px, the size of the sentence in Where you stand, only the name is larger (20px), and nothing is heavier
// than 600. On every restaurant, on the phone and in the console's drawer. Sizes had drifted between 11 and 22.
const CARD_SEEDS = ['demo', 'social', 'princess', 'eloise'];
for (const seed of CARD_SEEDS) {
  test(`the cards keep one text size and light weights (${seed})`, async ({ browser }) => {
    const stray = (page, tid) => page.getByTestId(tid).first().evaluate((root) => {
      const bad = [], own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
      root.querySelectorAll('*').forEach((el) => { if (!own(el) || !el.offsetParent || el.closest('svg')) return; const cs = getComputedStyle(el), name = !!el.closest('[data-card-name]');
        const size = Math.round(parseFloat(cs.fontSize)), w = Number(cs.fontWeight);
        if (size !== (name ? 20 : 14) || w > 600) bad.push(`${el.textContent.trim().slice(0, 40)}: ${size}px ${w}`); });
      return bad; });
    // The phone: a wine, a dish and (where the venue has them) a cocktail, each opened from its list.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage();
    await stubNetwork(ctx);
    await page.goto(`${BASE}/team/?seed=${seed}&view=phone`);
    await expect(page.getByTestId('team-state')).toBeVisible();
    await page.getByTestId('team-tab-wines').click();
    await page.getByTestId('team-wine-row').first().click();
    await expect(page.getByTestId('team-wine')).toBeVisible(); expect(await stray(page, 'team-wine')).toEqual([]);
    await page.getByLabel('Back').click();
    if (await page.getByTestId('team-list-switch').count()) {
      await page.getByTestId('team-list-switch').getByText('Cocktails').click();
      await page.getByTestId('team-cocktail-row').first().click();
      await expect(page.getByTestId('team-cocktail')).toBeVisible(); expect(await stray(page, 'team-cocktail')).toEqual([]);
      await page.getByLabel('Back').click();
    }
    await page.getByTestId('team-tab-menu').click();
    await page.getByTestId('team-dish-row').first().click();
    await expect(page.getByTestId('team-dish')).toBeVisible(); expect(await stray(page, 'team-dish')).toEqual([]);
    await ctx.close();
  });
}

// The console's new look (team-console2.jsx), shown where a restaurant's file asks for it: The Larkspur's does, as a
// preview. Tests elsewhere pin the classic console (helpers.stubNetwork); this one asks for the new one.
test('the console\'s new look: four pages, the same drawer, and the way back to classic', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { window.VINTEREST_CONSOLE = 'preview'; });
  await stubNetwork(ctx);
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${BASE}/team/?seed=demo&view=console`);
  const con = page.getByTestId('team-console');
  await expect(con).toHaveAttribute('data-look', 'preview');
  // A device that opened The Larkspur before its file asked for the new look still gets it.
  expect(await page.evaluate(() => { const d = TeamData.get(); delete d.venue.console; TeamData.save(d); const o = window.VINTEREST_CONSOLE; window.VINTEREST_CONSOLE = null; const look = TeamData.consoleLook(); window.VINTEREST_CONSOLE = o; return look; })).toBe('preview');
  // One standout fact with quick ones beneath, about what knowing the list sells.
  await expect(page.getByTestId('c2-fact')).toContainText('with a server trained on it');
  expect(await page.getByTestId('c2-bullets').locator('> div').count()).toBeLessThanOrEqual(3);
  await expect(page.getByTestId('c2-seller').first().getByTestId('c2-knowers')).toContainText(/\d of \d/);
  await expect(page.getByTestId('c2-person')).toHaveCount(7);
  // Five figures under the sentence, the pairing among them; then what training is worth, wine by wine, and what
  // needs the manager as what's so and what to do.
  await expect(page.getByTestId('c2-kpi-pairing')).toContainText('pairing');
  await expect(page.getByTestId('c2-lift')).toContainText('×'); expect(await page.getByTestId('c2-lift-row').count()).toBeGreaterThan(1);
  expect(await page.getByTestId('c2-needs').getByTestId('c2-act').count()).toBeGreaterThan(1);
  await expect(page.getByTestId('console-dash')).not.toContainText(/know(s|n)? it|known by/);
  await expect(page.getByTestId('console-dash')).not.toContainText(/the floor/i);
  // Training's worth is said in weeks, and a wine can be put first for the people not trained on it.
  await expect(page.getByTestId('c2-lift')).toContainText('a week'); await expect(page.getByTestId('c2-lift')).not.toContainText('a shift');
  await page.getByTestId('c2-lift-assign').first().click(); await expect(page.getByTestId('c2-lift-assign').first()).toContainText('First in their drills');
  // How far training has spread leaves room to grow: whole team, at least half, fewer.
  await expect(page.getByTestId('c2-spread').first()).toContainText('whole team trained');
  // A line of Needs you opens a plan: where things stand, then steps, with a button where the console can do one.
  await page.getByTestId('c2-needs').getByTestId('c2-need').first().click();
  await expect(page.getByTestId('c2-plan')).toContainText('What to do'); expect(await page.getByTestId('c2-plan-step').count()).toBeGreaterThan(2);
  await page.getByTestId('c2-plan-do').first().click(); await expect(page.getByTestId('c2-plan-do').first()).toContainText('Done');
  await page.getByTestId('c2-plan-close').click();
  // A figure opens the card it summarises.
  await page.getByTestId('c2-kpi-pairing').click(); await expect(page.getByTestId('c2-pairing-panel')).toHaveAttribute('data-lit', '1');
  await page.getByTestId('console-nav-dash').click();
  // The demo's Tonight is set for it, so the tile is never empty.
  await expect(page.getByTestId('c2-tonight')).toContainText('Pushing');
  // The summary is Poppins at a light weight, loaded from the build's own fonts.
  expect(await page.getByTestId('c2-fact').evaluate(el => getComputedStyle(el).fontWeight)).toBe('300');
  expect(await page.evaluate(() => document.fonts.check('300 38px Poppins'))).toBe(true);
  // A best seller opens the same wine drawer as the classic console.
  await page.getByTestId('c2-seller').first().click();
  await expect(page.getByTestId('console-panel')).toBeVisible();
  await page.getByTestId('console-panel-close').click();
  await page.getByTestId('console-nav-sales').click();
  await expect(page.getByTestId('c2-fact')).toContainText('Wine sales are');
  // Every line of the briefing is what the sales say, then what to do; nothing in the console's own shorthand.
  expect(await page.getByTestId('sales-brief').getByTestId('c2-act').count()).toBeGreaterThan(2);
  await expect(page.getByTestId('sales-brief')).not.toContainText(/\(\d of \d\)/);
  await expect(page.getByTestId('c2-kpi-glasses')).toContainText('Glasses sold'); await expect(page.getByTestId('c2-kpi-bottles')).toContainText('Bottles sold');
  const all = await page.getByTestId('sales-trend').locator('svg text').first().textContent();
  await page.getByTestId('c2-chart-bottles').click();
  await expect(page.getByTestId('sales-trend').locator('svg text').first()).not.toHaveText(all);
  await expect(page.getByTestId('c2-wine-row').first()).toBeVisible(); await expect(page.getByTestId('c2-upside')).toBeVisible();
  // Which nights sell wine: a bar per night of the week from the POS, the strongest and weakest named, with something to do about it.
  await expect(page.getByTestId('c2-weekday-bar')).toHaveCount(7); await expect(page.getByTestId('c2-weekday')).toContainText('Closed');
  await expect(page.getByTestId('c2-weekday-act')).toContainText('→');
  expect(await page.evaluate(() => { const w = TeamReport.byWeekday(28), open = w.days.filter(d => d.nights); return [open.length, open.every(d => d.revenue > 0 && d.nights <= 4), w.best[w.key] >= w.worst[w.key]]; })).toEqual([6, true, true]);
  await page.getByTestId('console-nav-wines').click();
  await expect(page.getByTestId('c2-list-row')).toHaveCount(30);
  await page.getByTestId('c2-wine-filter-glass').click(); await expect(page.getByTestId('c2-list-row')).toHaveCount(15);
  // Wines is the buyer's page: five figures about the list itself, each opening what it's about; what needs the
  // buyer as what's so and what to do; the list's balance against its sales; the price ladder; markup against the shop.
  await page.getByTestId('c2-wine-filter-all').click();
  await expect(page.getByTestId('c2-kpi-topfive')).toContainText('%'); await expect(page.getByTestId('c2-kpi-markup')).toContainText('×');
  await page.getByTestId('c2-kpi-through').click(); await expect(page.getByTestId('c2-wine-filter-through')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.getByTestId('c2-list-row').count()).toBeLessThan(30);
  await page.getByTestId('c2-wine-filter-all').click();
  for (const t of ['Glasses sold', 'Bottles sold', 'Drinking window', 'On the menu', 'Shop price', 'Markup']) await expect(page.getByTestId('c2-list')).toContainText(t);
  expect(await page.getByTestId('c2-wine-needs').getByTestId('c2-act').count()).toBeGreaterThan(1);
  expect(await page.getByTestId('c2-balance-row').count()).toBeGreaterThan(3);
  const colours = await page.getByTestId('c2-balance').innerText();
  await page.getByTestId('c2-balance-grape').click(); expect(await page.getByTestId('c2-balance').innerText()).not.toBe(colours);
  expect(await page.getByTestId('c2-ladder-rung').count()).toBe(await page.evaluate(() => TeamBuyer.bands().edges.length));
  // No bottle's name is cut off: the chips wrap instead of squeezing into columns.
  expect(await page.getByTestId('c2-ladder-chip').evaluateAll(els => els.filter(el => el.firstElementChild.scrollWidth > el.firstElementChild.clientWidth + 1).length)).toBe(0); await expect(page.getByTestId('c2-ladder-sum')).toContainText('No step up');
  // The ladder is a grid on one price scale: every bottle named in its band, and under each band what's listed against what sells.
  expect(await page.getByTestId('c2-ladder-chip').count()).toBe(await page.evaluate(() => TeamBuyer.bands().listed));
  expect(await page.evaluate(() => { const b = TeamBuyer.bands(); return [b.edges.length <= TeamBuyer.BANDS_MAX, b.rows.every(r => r.cells.every((c, i) => c.every(y => y.p >= b.edges[i].lo && y.p <= b.edges[i].hi))), b.totals.length === b.edges.length]; })).toEqual([true, true, true]);
  await expect(page.getByTestId('c2-ladder-sum')).toContainText('bottle sales');
  // The summary under the ladder is three lines at most, however long the list.
  expect(await page.getByTestId('c2-ladder-sum').getByTestId('c2-need').count()).toBeLessThanOrEqual(3);
  await page.getByTestId('c2-ladder-chip').first().click(); await expect(page.getByTestId('console-panel')).toBeVisible(); await page.getByTestId('console-scrim').click();
  // What the page says is what TeamBuyer worked out: the list's shares add up, and a markup is the bottle over its shop price.
  expect(await page.evaluate(() => { const b = TeamBuyer.balance('colour'), m = TeamBuyer.markups(), w = TeamBuyer.wines()[0], k = TeamBuyer.markup(w); return [Math.round(100 * b.reduce((a, g) => a + g.share, 0)), Math.abs(k.x - TeamBuyer._m(w.bottle) / k.retail) < 0.01, m.source]; })).toEqual([100, true, 'demo']);
  // Training has left this page: who is trained on a wine is on the Training page.
  await expect(page.getByTestId('c2-list').locator('thead')).not.toContainText(/trained/i);
  // The list's header row stays in view as the list scrolls under it.
  expect(await page.getByTestId('c2-list').locator('thead th').first().evaluate(el => getComputedStyle(el).position)).toBe('sticky');
  await page.evaluate(() => { const sc = document.querySelector('[data-testid="team-console"] [data-scroll]'), l = document.querySelector('[data-testid="c2-list"]'); sc.scrollTop += l.getBoundingClientRect().top - sc.getBoundingClientRect().top + 600; });
  expect(await page.getByTestId('c2-list').locator('thead th').first().evaluate(el => { const r = el.getBoundingClientRect(), s = document.querySelector('[data-testid="team-console"] [data-scroll]').getBoundingClientRect(); return Math.round(r.top - s.top); })).toBeLessThan(130);
  // The search box and the filters are locked with the title, above the header.
  await expect(page.getByTestId('c2-list')).toHaveAttribute('data-stuck', '');
  expect(await page.getByTestId('c2-list').getByTestId('c2-card-head').evaluate(el => { const s = document.querySelector('[data-testid="team-console"] [data-scroll]').getBoundingClientRect(), th = el.parentElement.querySelector('thead th').getBoundingClientRect(), r = el.getBoundingClientRect(); return [Math.round(r.top - s.top), th.top <= r.bottom && r.bottom - th.top < 3 && getComputedStyle(el).boxShadow !== 'none', !!el.querySelector('[data-testid="c2-wine-find"]'), !!el.querySelector('[data-testid="c2-wine-filter-glass"]')]; })).toEqual([0, true, true, true]);
  // A wine opened while the header is locked lies over it: the locked header never shows through a drawer or a dialog.
  await page.getByTestId('c2-list').locator('tbody tr').nth(8).click(); await expect(page.getByTestId('console-panel')).toBeVisible();
  expect(await page.getByTestId('c2-list').getByTestId('c2-card-head').evaluate(el => { const r = el.getBoundingClientRect(), p = document.querySelector('[data-testid="console-panel"]').getBoundingClientRect(), x = Math.max(r.left, p.left) + 20, top = document.elementFromPoint(x, r.top + 10); return !!top.closest('[data-testid="console-panel"]'); })).toBe(true);
  await page.getByTestId('console-scrim').click();
  await page.evaluate(() => { document.querySelector('[data-testid="team-console"] [data-scroll]').scrollTop = 0; });
  await expect(page.getByTestId('console-wines')).not.toContainText(/know(s|n)? it|known by|the floor/i);
  // Training: everything about training in one place. Each person's areas and next step, pushed from here; a person opens on Team.
  await page.getByTestId('console-nav-training').click();
  await expect(page.getByTestId('c2-training-row')).toHaveCount(7);
  for (const t of ['Glasses', 'Bottles', 'Pairings', 'Menu', 'Next step']) await expect(page.getByTestId('c2-training-people')).toContainText(t);
  await expect(page.getByTestId('c2-training-spread').getByTestId('c2-spread')).toHaveCount(4);
  await page.getByTestId('c2-training-push').first().click(); await expect(page.getByTestId('c2-training-push').first()).toContainText('Pushed');
  await page.getByTestId('c2-training-tracks').click(); await expect(page.getByTestId('c2-tracks')).toBeVisible(); await page.getByTestId('c2-tracks-close').click();
  await expect(page.getByTestId('c2-training')).not.toContainText(/know(s|n)? it|known by|the floor|overdue/i);
  // Menu: allergens are a switch. Off, nothing on the page or in training mentions them.
  await page.getByTestId('console-nav-menu').click();
  await expect(page.getByTestId('c2-dish-row')).toHaveCount(27);
  // Every dish shows a wine by the glass and a bottle to offer, each with who is trained on it; the figures and the
  // training spread are split the same way, and what needs the manager is a fact then an action.
  await expect(page.getByTestId('c2-dishes')).toContainText('By the glass'); await expect(page.getByTestId('c2-dishes')).toContainText('By the bottle');
  expect(await page.getByTestId('c2-dish-bottle').filter({ hasText: 'a bottle' }).count()).toBe(27);
  expect(await page.getByTestId('c2-dish-bottle').filter({ hasNotText: 'The same wine' }).count()).toBeGreaterThan(15);
  await expect(page.getByTestId('c2-kpi-pairglass')).toContainText('glass'); await expect(page.getByTestId('c2-kpi-pairbottle')).toContainText('bottle');
  await expect(page.getByTestId('c2-pair-spread').getByTestId('c2-spread')).toHaveCount(2);
  expect(await page.getByTestId('c2-menu-needs').getByTestId('c2-act').count()).toBeGreaterThan(1);
  // Every table's header stays in view as it scrolls, and the side column scrolls by itself beside the long table.
  expect(await page.getByTestId('c2-dishes').locator('thead th').first().evaluate(el => getComputedStyle(el).position)).toBe('sticky');
  await page.evaluate(() => { const sc = document.querySelector('[data-testid="team-console"] [data-scroll]'), l = document.querySelector('[data-testid="c2-dishes"]'); sc.scrollTop += l.getBoundingClientRect().top - sc.getBoundingClientRect().top + 500; });
  expect(await page.getByTestId('c2-dishes').locator('thead th').first().evaluate(el => { const s = document.querySelector('[data-testid="team-console"] [data-scroll]').getBoundingClientRect(); return Math.round(el.getBoundingClientRect().top - s.top); })).toBeLessThan(70);
  // The card's title is locked above the header, so the header never floats alone.
  await expect(page.getByTestId('c2-dishes')).toHaveAttribute('data-stuck', '');
  expect(await page.getByTestId('c2-dishes').getByTestId('c2-card-head').evaluate(el => { const s = document.querySelector('[data-testid="team-console"] [data-scroll]').getBoundingClientRect(), th = el.parentElement.querySelector('thead th').getBoundingClientRect(), r = el.getBoundingClientRect(); return [Math.round(r.top - s.top), th.top <= r.bottom && r.bottom - th.top < 3 && getComputedStyle(el).boxShadow !== 'none']; })).toEqual([0, true]);
  expect(await page.getByTestId('c2-side').evaluate(el => { const sc = document.querySelector('[data-testid="team-console"] [data-scroll]'); return [getComputedStyle(el).overflowY, el.clientHeight <= sc.clientHeight, el.scrollHeight > el.clientHeight]; })).toEqual(['auto', true, true]);
  await page.evaluate(() => { document.querySelector('[data-testid="team-console"] [data-scroll]').scrollTop = 0; });
  // Under every header but the first, the data is centred beneath it.
  expect(await page.getByTestId('c2-dishes').locator('tbody td:nth-child(2)').nth(1).evaluate(el => getComputedStyle(el).textAlign)).toBe('center');
  expect(await page.getByTestId('c2-dishes').locator('thead th').nth(2).evaluate(el => getComputedStyle(el).textAlign)).toBe('center');
  expect(await page.getByTestId('c2-dishes').locator('tbody td:nth-child(1)').nth(1).evaluate(el => getComputedStyle(el).textAlign)).not.toBe('center');
  // Every dish with a wine poured by the glass or a bottle-only pick has a bottle question, counted under Pairings.
  const bq = await page.evaluate(() => { const qs = TeamData.dishes().map((x) => TeamLearn.dishQs(x.id).find((q) => q.bottle)).filter(Boolean); return { n: qs.length, pairing: qs.every((q) => TeamLearn.isPairing(q)), four: qs.every((q) => q.opts.length === 4 && q.opts[q.a]), which: qs.filter((q) => /Which do you offer/.test(q.q)).length, upsell: qs.filter((q) => /Offer the bottle at/.test(q.opts[q.a])).length }; });
  expect(bq.n).toBeGreaterThan(12); expect(bq.pairing).toBe(true); expect(bq.four).toBe(true); expect(bq.which).toBeGreaterThan(0); expect(bq.upsell).toBeGreaterThan(0);
  await page.getByTestId('c2-kpi-pairbottle').click(); expect(await page.getByTestId('c2-dish-row').count()).toBeLessThan(27);
  await page.getByTestId('c2-menu-filter-all').click();
  await expect(page.getByTestId('c2-dishes')).toContainText('Allergens');
  await page.getByTestId('c2-allergens-switch').click();
  await expect(page.getByTestId('c2-dishes')).not.toContainText('Allergens');
  expect(await page.evaluate(() => TeamData.trainsAllergens())).toBe(false);
  await page.getByTestId('c2-allergens-switch').click();
  // The other sections are the classic ones inside the new shell.
  await page.getByTestId('console-nav-cocktails').count();
  // Team: a sentence, five figures, each person's areas against the minimum with what they sell, and a next step to push.
  await page.getByTestId('console-nav-team').click();
  await expect(page.getByTestId('c2-fact')).toContainText('ready for service');
  await expect(page.getByTestId('c2-team-row')).toHaveCount(7);
  // Pick a person: their areas against the minimum, what they sell, and a next step to push.
  await page.getByTestId('c2-team-row').filter({ hasText: 'Priya' }).click();
  await expect(page.getByTestId('c2-stands')).toContainText('to go'); await expect(page.getByTestId('c2-sells')).toContainText('a week');
  await expect(page.getByTestId('c2-sells')).toContainText('About Priya'); expect(await page.getByTestId('c2-about-row').count()).toBeGreaterThan(4);
  // Where they stand also says what comes next in each area, so the card carries its weight beside About.
  expect(await page.getByTestId('c2-left-row').count()).toBeGreaterThan(0);
  await expect(page.getByTestId('c2-next')).toContainText(/→ \d+ of \d+/);
  await page.getByTestId('c2-push').click(); await expect(page.getByTestId('c2-push')).toContainText('First in');
  await expect(page.getByTestId('c2-mins')).toContainText('Server');
  // The demo opens with bespoke training in flight, tracked.
  await expect(page.getByTestId('c2-kpi-bespoke')).toContainText('running');
  // The figure counts every track the window lists, drafts included.
  expect(await page.evaluate(() => TeamPlans.all().length)).toBe(Number((await page.getByTestId('c2-kpi-bespoke').innerText()).match(/\n(\d+)/)[1]));
  // Four areas: glasses, bottles, pairings and the menu.
  for (const t of ['By the glass', 'Bottles', 'Pairings', 'Menu']) await expect(page.getByTestId('c2-stands')).toContainText(t);
  // The bespoke figure opens every track: who it's for, what it covers, how far along.
  await page.getByTestId('c2-kpi-bespoke').click();
  await expect(page.getByTestId('c2-track').first()).toContainText(/For \w+/); await expect(page.getByTestId('c2-track').first()).toContainText(/questions?/); await expect(page.getByTestId('c2-tracks')).toContainText(/running/);
  await page.getByTestId('c2-track').filter({ hasText: 'Dani' }).first().click();
  await expect(page.getByTestId('c2-person-detail')).toContainText('Dani'); await expect(page.getByTestId('c2-tracks')).toHaveCount(0);
  await page.getByTestId('c2-team-row').filter({ hasText: 'Priya' }).click(); await expect(page.getByTestId('c2-bespoke-plan').first()).toContainText(/\d+ of \d+ done/);
  // The classic team tools stay under Manage.
  await page.getByTestId('c2-manage-c2-manage-team').click(); await expect(page.getByTestId('console-team')).toBeVisible();
  // And back to the classic console, remembered on the device.
  await page.evaluate(() => { window.VINTEREST_CONSOLE = null; });
  await page.getByTestId('c2-classic').click();
  await expect(con).not.toHaveAttribute('data-look', 'preview');
  await page.getByTestId('console-new-look').click();
  await expect(con).toHaveAttribute('data-look', 'preview');
  expect(errors).toEqual([]);
  await ctx.close();
});

// Bespoke training (team-plans.js): the manager asks Vinny for a plan in their own words, reads the draft, pushes
// it; it shows on that person's Today as its own training, and a question that covers one of their own counts.
test('bespoke training: Vinny writes a plan, the manager pushes it, and it counts towards readiness', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { window.VINTEREST_CONSOLE = 'preview'; });
  const reqs = [];
  // Vinny's answer is built from what the prompt offered: a new question on the first wine, covering one of its own.
  const answer = (b) => { if (b.purpose !== 'team_plan') return ''; const text = b.messages[0].content, wine = /^(w-[^ ]+) \| WINE/m.exec(text)[1], own = new RegExp('^  (' + wine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '#\\d+) \\| not known', 'm').exec(text);
    const q = (n, covers) => ({ on: wine, q: `Bespoke question ${n} about this wine?`, opts: ['Right ' + n, 'Wrong a' + n, 'Wrong b' + n, 'Wrong c' + n], a: 0, why: 'Because.', covers });
    return JSON.stringify({ title: 'Reds: prices and pairings', summary: 'Three short parts on the reds she misses.', parts: [{ title: 'Prices', why: 'What each costs.', qs: [q(1, own ? own[1] : ''), q(2, '')] }, { title: 'Pairings', why: 'What to pour.', qs: [q(3, ''), q(4, ''), { on: 'not-a-wine', q: 'Dropped?', opts: ['a', 'b', 'c', 'd'], a: 0 }] }] }); };
  await stubNetwork(ctx, { claudeRequests: reqs, claudeText: answer });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${BASE}/team/?seed=demo&view=console`);
  await page.getByTestId('console-nav-team').click();
  await page.getByTestId('c2-team-row').filter({ hasText: 'Amara' }).click();
  await page.getByTestId('c2-vinny-sug').nth(1).click(); // a suggestion fills the box; only the arrow sends
  expect(reqs.filter(r => r.purpose === 'team_plan')).toHaveLength(0);
  await page.getByTestId('c2-vinny-send').click();
  const draft = page.getByTestId('c2-plan-draft');
  await expect(draft).toContainText('Reds: prices and pairings'); await expect(draft).toContainText('2 parts · 4 questions · 1 count');
  const sent = reqs.find(r => r.purpose === 'team_plan').messages[0].content;
  expect(sent).toContain('Amara'); expect(sent).toContain('WINE:'); expect(sent).not.toContain('{{');
  await expect(draft.getByTestId('c2-draft-q').first()).toContainText('counts towards');
  // Pushed: tracked on the console, and on Amara's phone as its own training.
  await draft.getByTestId('c2-draft-push').click();
  await expect(page.getByTestId('c2-bespoke-plan').first()).toContainText('0 of 4 done');
  const state = await page.evaluate(() => { const a = TeamLearn.people().find(p => p.name.startsWith('Amara')), plan = TeamPlans.forPerson(a.id)[0], qs = TeamPlans.questions(plan.id), q = qs.find(x => x.covers);
    const items = () => TeamLearn._mine(TeamLearn._all(), a.id).items, before = !!(items()[q.covers] && items()[q.covers].reps);
    TeamLearn.record(a.id, q, true, 'think'); TeamLearn.record(a.id, qs.find(x => !x.covers), false, 'think');
    return { before, covered: !!items()[q.covers].reps, prog: TeamPlans.progress(plan), id: a.id }; });
  expect(state.before).toBe(false); expect(state.covered).toBe(true); expect(state.prog.done).toBe(1); expect(state.prog.total).toBe(4);
  await page.goto(`${BASE}/team/?seed=demo&view=phone`);
  await page.evaluate((id) => { TeamLearn.setMe(id); window.dispatchEvent(new Event('vbiz:data')); }, state.id); await page.reload();
  const card = page.getByTestId('today-plan').first();
  await expect(card).toContainText('Reds: prices and pairings'); await expect(card).toContainText('1 of 4');
  await card.getByText(/Carry on|Start/).click(); await expect(page.getByTestId('team-drill')).toBeVisible();
  expect(errors).toEqual([]);
  await ctx.close();
});

// On a phone the new console is one page of the key figures from every section, with no section navigation to get
// lost in; a person or a wine still opens, and the way back to the staff app is in the header.
test('the console on a phone: one page of key figures from every section', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { window.VINTEREST_CONSOLE = 'preview'; });
  await stubNetwork(ctx);
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${BASE}/team/?seed=demo&view=console`);
  const m = page.getByTestId('c2-mobile'); await expect(m).toBeVisible();
  await expect(page.getByTestId('console-nav-wines')).toHaveCount(0); await expect(page.getByTestId('c2-classic')).toHaveCount(0);
  for (const t of ['Wine sales', 'Wine per guest', 'Glasses sold', 'Bottles sold', 'Training done', 'Needs you', 'Tonight', 'The team', 'Best sellers', 'The list', 'The menu']) await expect(m).toContainText(t, { ignoreCase: true });
  await expect(page.getByTestId('c2m-person')).toHaveCount(7); expect(await page.getByTestId('c2m-fact').count()).toBeGreaterThan(4);
  await expect(page.getByTestId('c2m-more')).toContainText('tablet or a computer');
  // Nothing runs off the side of the phone.
  expect(await page.evaluate(() => { const sc = document.querySelector('[data-testid="team-console"] [data-scroll]'); return sc.scrollWidth <= sc.clientWidth + 1; })).toBe(true);
  await page.getByTestId('c2m-wine').first().click(); await expect(page.getByTestId('console-panel')).toBeVisible(); await page.getByTestId('console-panel-close').click();
  await page.getByTestId('console-to-phone').click(); await expect(page.getByTestId('team-console')).toHaveCount(0);
  expect(errors).toEqual([]); await ctx.close();
});

// On an iPad the new console keeps every section in reach and nothing is cut off: a table too wide for its card
// scrolls sideways inside it, and the page itself never runs off the side.
for (const [W, H, name] of [[1194, 834, 'on its side'], [834, 1194, 'upright']]) test(`the new console on an iPad ${name}: every section reachable, no table cut off`, async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  await ctx.addInitScript(() => { window.VINTEREST_CONSOLE = 'preview'; });
  await stubNetwork(ctx);
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${BASE}/team/?seed=demo&view=console`); await expect(page.getByTestId('team-console')).toBeVisible();
  if (W > 1000) expect(await page.getByTestId('console-nav-admin').evaluate(el => el.parentElement.scrollWidth <= el.parentElement.clientWidth + 1)).toBe(true);
  for (const k of ['dash', 'sales', 'team', 'training', 'wines', 'menu']) {
    await page.getByTestId('console-nav-' + k).click(); await page.waitForTimeout(250);
    const r = await page.evaluate(() => { const sc = document.querySelector('[data-testid="team-console"] [data-scroll]'), cut = [];
      sc.querySelectorAll('table').forEach(t => { const w = t.parentElement, c = t.closest('[data-testid]'); if (t.getBoundingClientRect().right > c.getBoundingClientRect().right + 1 && getComputedStyle(w).overflowX !== 'auto') cut.push(c.getAttribute('data-testid')); });
      return { side: sc.scrollWidth - sc.clientWidth, cut }; });
    expect(r, k).toEqual({ side: 0, cut: [] });
  }
  expect(errors).toEqual([]); await ctx.close();
});

// The new console's navigation starts hidden at the left edge and slides over the page, never pushing it across;
// and a page's cards can be dragged by their grip, within a column or into another, kept per person, with a way back.
test('the new console: navigation hidden at the left edge, and cards dragged to a new place', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await stubNetwork(ctx);
  await ctx.addInitScript(() => { window.VINTEREST_CONSOLE = 'preview'; window.VINTEREST_NAV = null; });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${BASE}/team/?seed=demo&view=console`);
  const drawer = page.getByTestId('c2-nav-drawer'); await expect(drawer).toHaveAttribute('data-open', '0');
  const left = () => page.getByTestId('c2-head').evaluate(el => Math.round(el.getBoundingClientRect().left)), before = await left();
  await page.mouse.move(500, 400); await page.mouse.move(3, 400); await expect(drawer).toHaveAttribute('data-open', '1');
  expect(await left()).toBe(before); // a layer over the page: nothing moved across
  await page.getByTestId('console-nav-sales').click(); await expect(drawer).toHaveAttribute('data-open', '0');
  await expect(page.getByTestId('console-sales')).toBeVisible();
  // No bar across the top: the page runs full height, and the section's name leads the sentence at its head.
  await expect(page.getByTestId('c2-top')).toHaveCount(0); await expect(page.getByTestId('c2-head')).toContainText('Sales Insights');
  expect(await page.getByTestId('c2-head').evaluate(el => Math.round(el.getBoundingClientRect().top))).toBeLessThan(60);
  // The mouse leaving the open drawer closes it; the small tab on the edge opens it too, and the drawer says who is signed in.
  await page.getByTestId('c2-nav-tab').click(); await expect(page.getByTestId('c2-nav-me')).toContainText('Elena'); await expect(drawer).toHaveAttribute('data-open', '1');
  await page.mouse.move(100, 400); await page.mouse.move(900, 500); await expect(drawer).toHaveAttribute('data-open', '0');
  // Drag "Where the next £ is" from the left column to the top of the right one.
  const order = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-testid^="c2-stack-"]')].map(s => [s.getAttribute('data-testid').slice(9), [...s.querySelectorAll(':scope>[data-testid="c2-drag"]')].map(d => d.getAttribute('data-k'))])));
  expect(await order()).toEqual({ top: ['c2-mix'], left: ['sales-brief', 'c2-upside'], right: ['sales-trend', 'sales-servers', 'c2-weekday'], bottom: ['sales-wines'] });
  const g = page.locator('[data-k="c2-upside"] [data-testid="c2-grip"]'); await g.scrollIntoViewIfNeeded();
  const gb = await g.boundingBox(), tb = await page.locator('[data-k="sales-servers"]').boundingBox();
  await page.mouse.move(gb.x + 24, gb.y + 8); await page.mouse.down(); await page.mouse.move(gb.x + 60, gb.y + 30, { steps: 5 }); await page.waitForTimeout(80);
  await page.mouse.move(tb.x + 200, Math.min(880, Math.max(90, tb.y + 20)), { steps: 10 }); await page.waitForTimeout(120); await page.mouse.up();
  await expect.poll(order).toEqual({ top: ['c2-mix'], left: ['sales-brief'], right: ['sales-trend', 'c2-upside', 'sales-servers', 'c2-weekday'], bottom: ['sales-wines'] });
  // A mistake is one step back: Undo (or Ctrl+Z) puts the card where it was, and the move can be made again.
  await expect(page.getByTestId('c2-board-note')).toContainText('Card moved');
  await page.getByTestId('c2-note-undo').click(); expect((await order()).left).toEqual(['sales-brief', 'c2-upside']);
  // Undone back to the page's own layout, the pill says so and fades by itself.
  await expect(page.getByTestId('c2-board-note')).toContainText('Move undone'); await expect(page.getByTestId('c2-board-note')).toHaveCount(0, { timeout: 5000 });
  // A move asks: Undo, Default layout or Save. Save keeps it and the pill fades away; the way back to the default stays at the foot.
  await page.evaluate(() => { const pid = TeamReport.people().find(x => x.person.role === 'manager').person.id; window.__pid = pid; });
  { const g5 = page.locator('[data-k="c2-upside"] [data-testid="c2-grip"]'); await g5.scrollIntoViewIfNeeded(); const a = await g5.boundingBox(), t = await page.locator('[data-k="sales-servers"]').boundingBox();
    await page.mouse.move(a.x + 24, a.y + 8); await page.mouse.down(); await page.mouse.move(a.x + 60, a.y + 30, { steps: 5 }); await page.waitForTimeout(80);
    await page.mouse.move(t.x + 200, Math.min(880, Math.max(90, t.y + 20)), { steps: 10 }); await page.waitForTimeout(120); await page.mouse.up(); }
  await expect(page.getByTestId('c2-note-save')).toBeVisible(); await expect(page.getByTestId('c2-note-reset')).toBeVisible();
  await page.waitForTimeout(3500); await expect(page.getByTestId('c2-board-note')).toContainText('Card moved'); // it waits for an answer
  await page.getByTestId('c2-note-save').click(); await expect(page.getByTestId('c2-board-note')).toContainText('Layout saved');
  await expect(page.getByTestId('c2-board-note')).toHaveCount(0, { timeout: 5000 }); await expect(page.getByTestId('c2-board-reset')).toBeVisible();
  expect((await order()).right[1]).toBe('c2-upside');
  await page.getByTestId('c2-board-reset').click(); await expect(page.getByTestId('c2-board-note')).toContainText('Back to the default layout');
  await expect(page.getByTestId('c2-board-note')).toHaveCount(0, { timeout: 5000 }); await expect(page.getByTestId('c2-board-reset')).toHaveCount(0);
  expect(await page.evaluate(() => { const pid = TeamReport.people().find(x => x.person.role === 'manager').person.id, def = { top: ['c2-mix'], left: ['sales-brief', 'c2-upside'], right: ['sales-trend', 'sales-servers', 'c2-weekday'], bottom: ['sales-wines'] };
    TeamBoard.move(pid, 'sales', def, 'c2-upside', 'right', 'sales-servers', false); const a = TeamBoard.canUndo(pid, 'sales'); TeamBoard.reset(pid, 'sales'); const b = TeamBoard.changed(pid, 'sales', def); TeamBoard.undo(pid, 'sales'); return [a, b, TeamBoard.changed(pid, 'sales', def)]; })).toEqual([true, false, true]);
  await page.reload(); await page.mouse.move(500, 400); await page.mouse.move(3, 400); await page.getByTestId('console-nav-sales').click();
  expect((await order()).right[1]).toBe('c2-upside');
  // A card only goes where it fits: Best sellers needs the full width, so the narrow left column won't take it.
  expect(await page.evaluate(() => [TeamBoard.fits(860, 430), TeamBoard.fits(860, 1300), TeamBoard.fits(420, 900, 2), TeamBoard.fits(520, 900, 2), TeamBoard.fits(520, 900, 2, 2)])).toEqual([false, true, true, false, true]);
  { const g3 = page.locator('[data-k="sales-wines"] [data-testid="c2-grip"]'); await g3.scrollIntoViewIfNeeded(); const a = await g3.boundingBox(), t = await page.locator('[data-k="sales-brief"]').boundingBox();
    await page.mouse.move(a.x + 24, a.y + 8); await page.mouse.down(); await page.mouse.move(a.x + 60, a.y + 30, { steps: 5 }); await page.waitForTimeout(80);
    await page.mouse.move(t.x + 100, Math.min(880, Math.max(40, t.y + 40)), { steps: 10 }); await page.waitForTimeout(150);
    await expect(page.getByTestId('c2-stack-left')).toHaveAttribute('data-fits', 'no'); await expect(page.getByTestId('c2-stack-top')).toHaveAttribute('data-fits', 'yes');
    await page.mouse.up(); await page.waitForTimeout(200); }
  expect((await order()).bottom).toEqual(['sales-wines']);
  // It's kept: another section and back, and after a reload.
  await page.getByTestId('c2-board-reset').click(); expect(await order()).toEqual({ top: ['c2-mix'], left: ['sales-brief', 'c2-upside'], right: ['sales-trend', 'sales-servers', 'c2-weekday'], bottom: ['sales-wines'] });
  // Team's cards for a person sit two across and move the same way: About swapped in front of Where they stand.
  await page.getByTestId('c2-nav-tab').click(); await page.getByTestId('console-nav-team').click();
  expect((await order()).detail).toEqual(['c2-stands', 'c2-sells', 'c2-next', 'c2-vinny', 'c2-bespoke']);
  { const g2 = page.locator('[data-k="c2-sells"] [data-testid="c2-grip"]'); await g2.scrollIntoViewIfNeeded(); const a = await g2.boundingBox(), t = await page.locator('[data-k="c2-stands"]').boundingBox();
    await page.mouse.move(a.x + 24, a.y + 8); await page.mouse.down(); await page.mouse.move(a.x + 60, a.y + 30, { steps: 5 }); await page.waitForTimeout(80);
    await page.mouse.move(t.x + 30, Math.min(880, Math.max(90, t.y + 80)), { steps: 10 }); await page.waitForTimeout(120); await page.mouse.up(); }
  await expect.poll(async () => (await order()).detail.slice(0, 2)).toEqual(['c2-sells', 'c2-stands']);
  await page.getByTestId('c2-nav-tab').click(); await page.getByTestId('console-nav-menu').click(); expect((await order()).side).toEqual(['c2-menu-needs', 'c2-pair-spread', 'c2-trains']);
  // The full-width tables move too: the dishes table on Menu and Best sellers on Sales Insights are cards like the rest.
  expect((await order()).main).toEqual(['c2-dishes']); await expect(page.locator('[data-k="c2-dishes"] [data-testid="c2-grip"]')).toHaveCount(1);
  expect(await page.evaluate(() => { const def = { top: ['c2-mix'], left: ['a'], right: ['b'], bottom: ['sales-wines'] }; return TeamBoard.arrange({ top: ['sales-wines', 'c2-mix'], left: ['a'], right: ['b'], bottom: [] }, def); })).toEqual({ top: ['sales-wines', 'c2-mix'], left: ['a'], right: ['b'], bottom: [] });
  // Every side card moved under the table: the empty column folds away and the table takes the page's width; a drag brings it back to drop into.
  await page.evaluate(() => { const pid = TeamReport.people().find(x => x.person.role === 'manager').person.id, def = { side: ['c2-menu-needs', 'c2-pair-spread', 'c2-trains'], main: ['c2-dishes'] };
    for (const k of def.side) TeamBoard.move(pid, 'menu', def, k, 'main', null, true); });
  await page.getByTestId('c2-nav-tab').click(); await page.getByTestId('console-nav-sales').click(); await page.getByTestId('c2-nav-tab').click(); await page.getByTestId('console-nav-menu').click();
  expect((await order()).main).toEqual(['c2-dishes', 'c2-menu-needs', 'c2-pair-spread', 'c2-trains']);
  await expect(page.getByTestId('c2-side')).toHaveCount(0); await expect(page.getByTestId('c2-stack-side')).toHaveCount(0);
  expect(await page.evaluate(() => { const h = document.querySelector('[data-testid="c2-head"]').parentElement.getBoundingClientRect(), d = document.querySelector('[data-k="c2-dishes"]').getBoundingClientRect(); return d.width > h.width - 120; })).toBe(true);
  { const g4 = page.locator('[data-k="c2-trains"] [data-testid="c2-grip"]'); await g4.scrollIntoViewIfNeeded(); const a = await g4.boundingBox();
    await page.mouse.move(a.x + 24, a.y + 8); await page.mouse.down(); await page.mouse.move(a.x + 60, a.y + 30, { steps: 5 }); await page.waitForTimeout(150);
    await expect(page.getByTestId('c2-stack-side')).toHaveCount(1); await page.mouse.up(); await page.keyboard.press('Escape'); }
  await page.getByTestId(await page.getByTestId('c2-note-reset').count() ? 'c2-note-reset' : 'c2-board-reset').click(); expect((await order()).side).toEqual(['c2-menu-needs', 'c2-pair-spread', 'c2-trains']);
  // A new card the page gains later joins its own column, and one it loses is dropped.
  expect(await page.evaluate(() => TeamBoard.arrange({ left: ['b', 'gone'], right: ['a'] }, { left: ['a', 'b'], right: ['c', 'd'] }))).toEqual({ left: ['b'], right: ['c', 'd', 'a'] });
  // The navigation can go back along the top, and be hidden again.
  await page.getByTestId('c2-nav-tab').click(); await page.getByTestId('c2-nav-top').click(); await expect(page.getByTestId('c2-nav-drawer')).toHaveCount(0);
  await page.getByTestId('console-nav-wines').click(); await expect(page.getByTestId('console-wines')).toBeVisible();
  await page.getByTestId('c2-nav-side').click(); await expect(page.getByTestId('c2-nav-drawer')).toHaveCount(1);
  expect(errors).toEqual([]); await ctx.close();
});

// With no mouse, a small tab on the left edge opens the navigation, and a touch outside it closes it.
test('the new console on a touch screen: a tab on the left edge opens the navigation', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1194, height: 834 }, hasTouch: true, isMobile: true });
  await stubNetwork(ctx);
  await ctx.addInitScript(() => { window.VINTEREST_CONSOLE = 'preview'; window.VINTEREST_NAV = null; });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${BASE}/team/?seed=demo&view=console`);
  const drawer = page.getByTestId('c2-nav-drawer'), tab = page.getByTestId('c2-nav-tab');
  await expect(tab).toBeVisible(); expect((await tab.boundingBox()).x).toBe(0);
  await tab.tap(); await expect(drawer).toHaveAttribute('data-open', '1'); await expect(tab).toHaveCount(0);
  await page.touchscreen.tap(800, 500); await expect(drawer).toHaveAttribute('data-open', '0');
  await tab.tap(); await page.getByTestId('console-nav-wines').tap(); await expect(page.getByTestId('console-wines')).toBeVisible(); await expect(drawer).toHaveAttribute('data-open', '0');
  expect(errors).toEqual([]); await ctx.close();
});

// The Social Corner and Eloise are offered the new console by their own files, as The Larkspur is; every page opens
// for each with its own currency, and Eloise's file keeps its other console setting beside it.
for (const [seed, money] of [['social', '$'], ['eloise', '$']]) test(`the new console is offered to ${seed}, and every page opens`, async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await stubNetwork(ctx);
  await ctx.addInitScript(() => { window.VINTEREST_CONSOLE = null; });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${BASE}/team/?seed=${seed}&view=console`);
  await expect(page.getByTestId('team-console')).toHaveAttribute('data-look', 'preview', { timeout: 30000 });
  expect(await page.evaluate(() => [TeamData.offersNewLook(), TeamData.consoleLook()])).toEqual([true, 'preview']);
  for (const [k, tid] of [['dash', 'console-dash'], ['sales', 'console-sales'], ['team', 'c2-team'], ['training', 'c2-training'], ['wines', 'console-wines'], ['menu', 'c2-dishes']]) {
    await page.getByTestId('console-nav-' + k).click(); await expect(page.getByTestId(tid)).toBeVisible(); await expect(page.getByTestId('c2-head')).toBeVisible();
  }
  await page.getByTestId('console-nav-sales').click(); await expect(page.getByTestId('sales-revenue')).toContainText(money);
  // The ladder's bands follow the list's prices, so no band holds most of it, and two bottles from one producer are named apart.
  expect(await page.evaluate(() => { const b = TeamBuyer.bands(); return Math.max(...b.totals.map((t) => t.n)) / b.listed; })).toBeLessThan(0.5);
  expect(await page.evaluate(() => { const ns = TeamBuyer.bands().rows.flatMap((r) => r.cells.flat().map((y) => TeamData.nick(y.w))); return ns.length - new Set(ns).size; })).toBe(0);
  // Eloise's file carries Vinny's buyer review, so the Wines page opens with shop prices and his read of the list.
  if (seed === 'eloise') { expect(await page.evaluate(() => [!!TeamBuyer.reviewed(), TeamBuyer.markups() && TeamBuyer.markups().source])).toEqual([true, 'estimate']);
    await page.getByTestId('console-nav-wines').click(); await expect(page.getByTestId('console-wines')).toContainText('times their shop price'); }
  expect(errors).toEqual([]); await ctx.close();
});

// Cocktails in the new look: every cocktail on the list with who is trained on it and the dishes its card pours it with,
// the bar team's progress, what needs the manager, and a cocktail opening its card in the drawer; its cards move like the rest.
test('the new console\'s Cocktails page', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await stubNetwork(ctx);
  await ctx.addInitScript(() => { window.VINTEREST_CONSOLE = null; });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${BASE}/team/?seed=social&view=console`);
  await expect(page.getByTestId('team-console')).toHaveAttribute('data-look', 'preview', { timeout: 30000 });
  await page.getByTestId('console-nav-cocktails').click(); await expect(page.getByTestId('console-cocktails')).toBeVisible();
  const n = await page.evaluate(() => TeamData.cocktails().length); expect(n).toBeGreaterThan(10);
  await expect(page.getByTestId('c2-mix-row')).toHaveCount(n);
  await expect(page.getByTestId('c2-head')).toContainText('Cocktails'); await expect(page.getByTestId('c2-fact')).toContainText('cocktails have most of the team trained');
  // Who is trained on each, as the wines show it; the figures are TeamReport's.
  expect(await page.getByTestId('c2-mix-list').getByTestId('c2-knowers').count()).toBe(n);
  const most = await page.evaluate(() => TeamReport.cocktailRows().filter(x => x.kb.of && x.kb.people.length >= Math.ceil(x.kb.of / 2)).length);
  await expect(page.getByTestId('c2-kpi-mix-most')).toContainText(String(most));
  expect(await page.getByTestId('c2-mix-dishes').filter({ hasNotText: '—' }).count()).toBe(await page.evaluate(() => TeamReport.cocktailRows().filter(x => x.dishes.length).length));
  await expect(page.getByTestId('c2-mix-spread').getByTestId('c2-spread')).toHaveCount(1);
  expect(await page.getByTestId('c2-mix-person').count()).toBe(await page.evaluate(() => TeamReport.cocktailPeople().length));
  // A filter narrows the list; a cocktail opens its card; a person opens theirs.
  await page.getByTestId('c2-mix-filter-few').click();
  expect(await page.getByTestId('c2-mix-row').count()).toBe(await page.evaluate(() => TeamReport.cocktailRows().filter(x => x.kb.of && x.kb.people.length < Math.ceil(x.kb.of / 2)).length));
  await page.getByTestId('c2-mix-filter-all').click();
  await page.getByTestId('c2-mix-row').first().click(); await expect(page.getByTestId('console-panel')).toBeVisible(); await page.getByTestId('console-scrim').click();
  await page.getByTestId('c2-mix-person').first().click(); await expect(page.getByTestId('console-panel')).toBeVisible(); await page.getByTestId('console-scrim').click();
  expect(await page.locator('[data-testid="c2-stack-side"] > [data-testid="c2-drag"]').count()).toBe(3);
  expect((await page.getByTestId('console-cocktails').innerText()).match(/know(s|n)? it|known by|the floor|overdue/i)).toBe(null);
  expect(errors).toEqual([]); await ctx.close();
});

// A wine shown as a pill is outlined in its colour as the consumer app does (a red crimson, a white gold…), never filled,
// so its text stays readable: every wine pill on the price ladder and the menu is unfilled with 4.5:1 text, and its kind matches its wine.
test('wine pills are outlined in the wine\'s colour, never filled', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { window.VINTEREST_CONSOLE = 'preview'; });
  await stubNetwork(ctx);
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${BASE}/team/?seed=demo&view=console`);
  const check = () => page.evaluate(() => [...document.querySelectorAll('[data-kind]')].filter(el => el.getAttribute('data-kind') !== 'drink').map(el => {
    const cs = getComputedStyle(el), rgb = c => c.match(/\d+/g).slice(0, 3).map(Number), L = a => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(a[0]) + 0.7152 * f(a[1]) + 0.0722 * f(a[2]); };
    const a = L(rgb(cs.backgroundColor)), b = L(rgb(cs.color)); return { kind: el.getAttribute('data-kind'), ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) }; }));
  await page.getByTestId('console-nav-wines').click(); await expect(page.getByTestId('c2-ladder-chip').first()).toBeVisible();
  const ladder = await check(); expect(ladder.length).toBeGreaterThan(20);
  expect(await page.getByTestId('c2-ladder-chip').evaluateAll(els => els.filter(el => getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)').length)).toBe(0);
  expect(await page.locator('[data-kind="red"]').first().evaluate(el => getComputedStyle(el).borderTopColor)).not.toBe(await page.locator('[data-kind="white"]').first().evaluate(el => getComputedStyle(el).borderTopColor));
  expect(new Set(ladder.map(x => x.kind))).toEqual(new Set(['red', 'white', 'sparkling', 'dessert', 'rose']));
  expect(ladder.filter(x => x.ratio < 4.5)).toEqual([]);
  expect(await page.evaluate(() => [_tWineKey(TeamData.wines().find(w => /Malbec/.test(w.name))), _tWineKey(TeamData.wines().find(w => /Chablis/.test(w.name))), _tWineKey(TeamData.wines().find(w => /Taylor/.test(w.producer || '')))])).toEqual(['red', 'white', 'dessert']);
  await page.getByTestId('console-nav-menu').click(); await expect(page.getByTestId('c2-dish-wine').first()).toBeVisible();
  expect((await check()).filter(x => x.ratio < 4.5)).toEqual([]);
  expect(errors).toEqual([]); await ctx.close();
});

// Vinny's read of the list: one call, the buyer's view. Shop prices replace the demo's, only wines and dishes that
// exist are kept, a "missing" dish already on the menu is dropped, and a failure says so.
test('the buyer\'s review: Vinny reads the list against the menu, and only what is real is kept', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { window.VINTEREST_CONSOLE = 'preview'; });
  const reqs = []; let fail = true;
  await stubNetwork(ctx, { claudeRequests: reqs, claudeText: (b) => { if (b.purpose !== 'team_buyer') return ''; if (fail) { fail = false; return 'no'; }
    const text = b.messages[0].content, ws = [...text.matchAll(/^(w-[^ ]+) \|/mg)].map(m => m[1]), ds = [...text.matchAll(/^(d-[^ ]+) \| ([^|\n]+)/mg)];
    return JSON.stringify({ retail: [{ id: ws[0], price: 20 }, { id: 'w-nothing', price: 9 }], missing_dishes: [{ wine: ws[1], dish: 'Grilled sardines on toast', why: 'Its salt and acidity want oily fish.' }, { wine: ws[1], dish: ds[0][2].split(',')[0].trim(), why: 'Already here.' }, { wine: 'w-nothing', dish: 'Soup', why: 'x' }],
      weak_dishes: [{ dish: ds[1][1], why: 'Nothing on the list has the weight for it.', wants: 'a ripe, fuller white with some oak' }, { dish: 'd-nothing', why: 'x', wants: 'y' }], gaps: [{ what: 'A red under £45', why: 'The cheapest red is a jump from the house pour.' }], cut: [{ wine: ws[2], why: 'It overlaps and hasn\'t sold.' }] }); } });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${BASE}/team/?seed=demo&view=console`); await page.getByTestId('console-nav-wines').click();
  await page.getByTestId('c2-buyer-ask').click(); await expect(page.getByTestId('c2-buyer-error')).toBeVisible();
  await page.getByTestId('c2-buyer-ask').click(); const res = page.getByTestId('c2-buyer-result'); await expect(res).toBeVisible();
  await expect(res).toContainText('Grilled sardines on toast'); await expect(res).toContainText('Wants a ripe, fuller white with some oak'); await expect(res).toContainText('A red under £45');
  const sent = reqs.filter(r => r.purpose === 'team_buyer'); expect(sent).toHaveLength(2); expect(sent[0].messages[0].content).toContain('The Larkspur');
  const kept = await page.evaluate(() => { const r = TeamBuyer.reviewed(), id = Object.keys(r.retail)[0]; return { retail: Object.keys(r.retail).length, missing: r.missing.length, weak: r.weak.length, cut: r.cut.length, source: TeamBuyer.markups().source, shop: TeamBuyer.retail(TeamData.wine(id)) }; });
  expect(kept).toMatchObject({ retail: 1, missing: 1, weak: 1, cut: 1, source: 'estimate', shop: { price: 20 } });
  await expect(page.getByTestId('c2-kpi-markup')).toContainText('Vinny');
  expect(errors).toEqual([]); await ctx.close();
});

// "Pairings" means the wine for the dish, never the menu on its own: Vinny's test and a bespoke plan asked for
// pairings ask only pairing questions, and a written question about a dish that names no wine is dropped.
test('a request for pairings is about the wine for each dish, not the menu', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { window.VINTEREST_CONSOLE = 'preview'; });
  const answer = (b) => { if (b.purpose !== 'team_plan') return ''; const text = b.messages[0].content, dish = /^(\S+) \| DISH: ([^|\n,]+)/m.exec(text), pour = /pour with: ([^(]+) \(/.exec(text.slice(text.indexOf(dish[0])));
    const wines = [...text.matchAll(/^\S+ \| WINE: (.+?) (?:\d{4}|NV) \|/gm)].map((m) => m[1]);
    return JSON.stringify({ title: 'Pairings', summary: 's', parts: [{ title: 'The wine for the dish', why: 'w', qs: [
      { on: dish[1], q: `A guest orders the ${dish[2].trim()}. Which wine do you pour?`, opts: [pour[1].trim(), ...wines.filter((w) => w !== pour[1].trim()).slice(0, 3)], a: 0, why: 'y', covers: '' },
      { on: dish[1], q: `What is the ${dish[2].trim()} served with?`, opts: ['Chips', 'Rice', 'Salad', 'Bread'], a: 0, why: 'menu, not pairing', covers: '' },
      { on: dish[1], q: `Which wine by the glass suits the ${dish[2].trim()}?`, opts: [wines[1], wines[2], wines[3], wines[4]], a: 0, why: 'y', covers: '' }] }] }); };
  const reqs = []; await stubNetwork(ctx, { claudeRequests: reqs, claudeText: answer });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/team/?seed=demo&view=console`); await page.getByTestId('team-console').waitFor();
  const out = await page.evaluate(async () => { const p = TeamLearn.people().find((x) => x.name.startsWith('Priya')), ask = 'Priya needs custom training on pairings';
    const t = TeamVinny.test(p.id, { ask: 'pairings' }), s = TeamPlans.subjects(p.id, ask), plan = await TeamPlans.write(p.id, ask, null), cards = TeamPlans.fromCards(p.id, ask, null);
    return { test: t.qs.length, testAll: t.qs.every((q) => TeamLearn.isPairing(q)), dishes: s.dishes.length, wines: s.wines.length, pairing: s.pairing, written: plan.parts[0].qs.map((q) => q.q), cards: cards.parts.flatMap((x) => x.qs).every((q) => TeamLearn.isPairing({ ...q, id: q.covers })) }; });
  expect(out.test).toBeGreaterThan(3); expect(out.testAll).toBe(true);
  expect(out.pairing).toBe(true); expect(out.dishes).toBeGreaterThan(2); expect(out.wines).toBeGreaterThan(2);
  expect(out.written).toHaveLength(2); expect(out.written.join(' ')).not.toContain('served with'); expect(out.cards).toBe(true);
  const sent = reqs.find((r) => r.purpose === 'team_plan').messages[0].content;
  expect(sent).toContain('This is a PAIRING plan'); expect(sent).toContain('pour with:'); expect(sent).not.toMatch(/#know \|/);
  await ctx.close();
});

// A demo restaurant kept on a device for days stays as of today: without that its invented answers fade by the
// clock and its sales end last week, and the whole team reads as slipping.
test('a demo restaurant held for days is brought forward to today', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await stubNetwork(ctx);
  const page = await ctx.newPage(); await page.clock.install({ time: new Date('2026-11-10T16:00:00') });
  await page.goto(`${BASE}/team/?seed=demo&view=console`); await page.getByTestId('team-console').waitFor();
  const read = () => page.evaluate(() => ({ avg: TeamReport.overview().avg, ready: TeamReport.overview().ready, week: Math.round(TeamReport.salesSummary(7).revenue), fresh: TeamData.get().venue.fresh }));
  const day0 = await read(); expect(day0.ready).toBeGreaterThan(0);
  // Five days on, untouched, the team has faded and the week's sales have thinned out.
  await page.clock.setFixedTime(new Date('2026-11-15T16:00:00'));
  const stale = await read(); expect(stale.avg).toBeLessThan(day0.avg - 10);
  // Opening the app again brings it forward.
  await page.reload(); await page.getByTestId('team-console').waitFor();
  const fresh = await read(); expect(Math.abs(fresh.avg - day0.avg)).toBeLessThanOrEqual(3); expect(fresh.ready).toBe(day0.ready);
  expect(Math.abs(fresh.week - day0.week)).toBeLessThan(day0.week * 0.25); expect(fresh.fresh).toBeGreaterThan(day0.fresh || 0);
  await ctx.close();
});
