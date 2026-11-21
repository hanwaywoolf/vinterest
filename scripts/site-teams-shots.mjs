// Retakes the Teams website's pictures of the console from the app as it is now: `npm run site:teams:shots`.
// The site's phones run the app's own code (live.js), so they follow the app at every build. The laptop's console
// scenes are pictures, and went stale each time the console changed until someone retook them by hand. This takes
// every one from the built app on the demo restaurant (The Larkspur), with no network, and writes their sizes and
// taps to site/teams/img/scenes/sizes.json, which the site build puts into the page (%%SCENE_SIZES%%), so a
// taller Dashboard or a moved row needs no edit to index.html.
//
// What it takes (site/teams/img/scenes/), for the console with its navigation in a drawer at the left edge:
//   nav-<section>.jpg   the navigation drawer open at the left edge with that section lit (navW wide; navTap is its row)
//   <section>.jpg       the section's whole page (dash, sales, team, training, wines, menu)
//   card-bg, dish-bg    the laptop's screen with a wine's or a dish's drawer open; card, dish: the drawer's whole text
//   mgr.jpg             the Dashboard at a tablet's width, for the strip that scrolls it
//   ../crop-*.jpg       one card each for the other pages: what needs you, the sales briefing, the team, training by person,
//                       training levels, and the top of a wine's card
//   ../day/*.jpg       the staff app on a phone: a special read from a photo, the briefing sent, Upload, a server's
//                       briefing, Today, Practise, a drill question, the list, a card, the menu, a dish (and ../phone-*.jpg)
//   plan, plan-phone    one person's next step, Ask Vinny and bespoke training on the Team page; that plan on their phone
// sizes.json holds each picture's height, the bar's height (nav), and for each drawer the row that opens it:
// how far down its page the scene scrolls first (cardAt, dishAt, a share of the scroll), where the tap lands
// (cardTap, dishTap) and where the drawer sits (cardX, cardW).
// Run it after any change to the console, look at the pictures (git status shows which moved), then
// npm run site:teams:build. tests/teams-site.spec.js fails if a size in the page and its picture disagree.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), OUT = path.join(ROOT, 'site/teams/img/scenes'), CROPS = path.join(ROOT, 'site/teams/img');
const SW = 1440, SH = 900, MW = 820; // the laptop's screen; the width the manager strip's Dashboard is taken at
const SECTIONS = ['dash', 'sales', 'team', 'training', 'wines', 'menu'];
execSync('node scripts/build.mjs', { cwd: ROOT, stdio: 'ignore' });
const port = 4196, server = spawn('node', ['scripts/serve.mjs', 'dist', String(port)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch(), sizes = {};
try {
  const ctx = await browser.newContext({ viewport: { width: SW, height: SH }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { window.VINTEREST_TOUR = 'off'; });
  for (const p of ['**/claude', '**/tts', '**/stt']) await ctx.route(p, (r) => r.fulfill({ status: 503, body: '{}' }));
  await ctx.route('**/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  let page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const shot = (name, clip) => page.screenshot({ path: path.join(OUT, name + '.jpg'), type: 'jpeg', quality: 86, clip });
  const size = (w, h) => page.setViewportSize({ width: w, height: h }).then(() => page.waitForTimeout(300));
  // The console's navigation is a drawer at the left edge (or, in a look that has one, a bar across the top). Going
  // to a section opens the drawer by the tab on that edge, takes it, then moves away so the drawer closes.
  const drawerNav = () => page.getByTestId('c2-nav-drawer').count();
  const openNav = async () => { if (!(await drawerNav())) return false; if ((await page.getByTestId('c2-nav-drawer').getAttribute('data-open')) !== '1') await page.getByTestId('c2-nav-tab').click(); await page.locator('[data-testid="c2-nav-drawer"][data-open="1"]').waitFor(); await page.waitForTimeout(350); return true; };
  const closeNav = async () => { if (!(await drawerNav())) return; await page.mouse.move(page.viewportSize().width / 2, 450, { steps: 4 }); await page.mouse.move(page.viewportSize().width - 3, 3); /* parked where it hovers nothing */ await page.locator('[data-testid="c2-nav-drawer"][data-open="0"]').waitFor(); await page.waitForTimeout(350); };
  const nav = async (k) => { await openNav(); await page.getByTestId('console-nav-' + k).click(); await page.waitForTimeout(400); await closeNav(); await page.waitForTimeout(300); };
  // What scrolls under a point: its nearest scrolling ancestor. {top, height} of its box and how tall its content is.
  const MARK = 'data-shot-scroller';
  const scroller = (x, y) => page.evaluate(([x, y, MARK]) => { document.querySelectorAll(`[${MARK}]`).forEach((e) => e.removeAttribute(MARK));
    let el = document.elementFromPoint(x, y); while (el && el !== document.body) { const s = getComputedStyle(el); if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 4) break; el = el.parentElement; }
    if (!el || el === document.body) el = document.scrollingElement; el.setAttribute(MARK, '1'); const r = el.getBoundingClientRect();
    return { top: Math.max(0, Math.round(r.top)), box: Math.round(el.clientHeight), content: el.scrollHeight }; }, [x, y, MARK]);
  const scrollTo = (y) => page.evaluate(([y, MARK]) => { const el = document.querySelector(`[${MARK}]`); el.scrollTop = y; return el.scrollTop; }, [y, MARK]);
  // A whole scrolling area in one picture: the window is made tall enough to hold it, so nothing is stitched.
  // The bar across the top: the pinned ancestor of the navigation, which stays while the page scrolls under it.
  const bar = () => page.evaluate(() => { const el = document.querySelector('[data-testid="c2-top"]'); return el ? Math.round(el.getBoundingClientRect().bottom) : 0; });
  const whole = async (name, x, w, at, skip = 0) => {
    const width = page.viewportSize().width; let h = SH, s;
    for (let i = 0; i < 5; i++) { s = await scroller(...at); await scrollTo(0); const need = s.top + s.content; if (need <= h) break; h = need; await size(width, h); }
    skip = Math.max(0, skip - s.top); // the bar's own height, where the page's scroll starts above it
    await shot(name, { x, y: s.top + skip, width: w, height: s.content - skip }); sizes[name] = s.content - skip; console.log(`${name}.jpg ${w}×${s.content - skip}`);
    await size(width, SH); return s;
  };

  const start = async () => {
    await page.goto(`http://localhost:${port}/team/?seed=demo&view=console`);
    await page.getByTestId('console-nav-dash').waitFor();
    // Tonight as a working restaurant would have it: two dishes off and two wines on feature.
    await page.evaluate(() => { const ds = TeamData.dishes(), ws = TeamData.wines().filter((w) => TeamData.byGlass(w));
      TeamData.setTonight({ off: [ds[2], ds[9]].filter(Boolean).map((x) => x.id), feature: [ws[0], ws[4]].filter(Boolean).map((w) => w.id), note: '' }); });
    await page.waitForTimeout(600);
  };
  await start();
  sizes.look = await page.evaluate(() => (TeamData.consoleLook ? TeamData.consoleLook() : 'classic'));

  sizes.nav = await bar(); sizes.navTap = {};
  for (const k of SECTIONS) {
    await size(SW, SH); await openNav(); if (!(await page.getByTestId('console-nav-' + k).count())) { console.log(`no ${k} section in this console`); await closeNav(); continue; }
    await page.getByTestId('console-nav-' + k).click(); await page.waitForTimeout(400);
    if (await drawerNav()) { // the drawer open on this section, and where a tap on its row lands
      await openNav(); const d = await page.getByTestId('c2-nav-drawer').boundingBox(), r = await page.getByTestId('console-nav-' + k).boundingBox();
      sizes.navW = Math.round(d.x + d.width) + 1; sizes.navTap[k] = { x: Math.round(r.x + Math.min(r.width / 2, 70)), y: Math.round(r.y + r.height / 2) };
      await shot('nav-' + k, { x: 0, y: 0, width: sizes.navW, height: SH }); await closeNav();
    } else await shot('nav-' + k, { x: 0, y: 0, width: SW, height: sizes.nav });
    await whole(k, 0, SW, [SW / 2, SH * 0.6], sizes.nav);
  }

  // A drawer: the page scrolled until its row is in view, the row tapped, the screen with the drawer open, then the
  // drawer's whole text.
  const drawer = async (k, name, rowId, pick) => {
    await size(SW, SH); await nav(k);
    const s = await scroller(SW / 2, SH * 0.6); await scrollTo(0);
    const label = await page.evaluate(pick), rows = page.getByTestId(rowId).filter({ hasText: label }), row = (await rows.count()) ? rows.first().getByText(label, { exact: true }).first() : page.getByText(label, { exact: true }).first(); let b = await row.boundingBox();
    const want = Math.max(0, Math.round(b.y - SH * 0.45)), got = await scrollTo(want); await page.waitForTimeout(300); b = await row.boundingBox();
    sizes[name + 'At'] = +(got / Math.max(1, s.content - s.box)).toFixed(4);
    sizes[name + 'Tap'] = { x: Math.round(b.x + Math.min(b.width / 2, 90)), y: Math.round(b.y + b.height / 2) };
    await row.click(); const panel = page.getByTestId('console-panel'); await panel.waitFor(); await page.waitForTimeout(700);
    await shot(name + '-bg', { x: 0, y: 0, width: SW, height: SH });
    const box = await panel.boundingBox(); sizes[name + 'X'] = Math.round(box.x); sizes[name + 'W'] = Math.round(box.width);
    await whole(name, Math.round(box.x), Math.round(box.width), [box.x + box.width / 2, SH * 0.6]);
    await page.getByTestId('console-panel-close').click().catch(() => {}); await page.waitForTimeout(300);
  };
  await drawer('wines', 'card', 'c2-list-row', () => { const w = TeamData.wines()[0]; return [w.producer, w.name].filter(Boolean).join(' '); });
  await drawer('menu', 'dish', 'c2-dish-row', () => { const d = TeamData.dishes().slice(0, 8).find((x, i) => i >= 2 && !TeamData.isOff(x.id) && TeamData.pairing(x.id) && TeamData.dishCard(x.id)) || TeamData.dishes()[0]; return d.name; });

  // The Dashboard at a tablet's width, for the strip that scrolls through it.
  await size(MW, SH); await nav('dash');
  sizes.mgrW = MW; sizes.mgrNav = await bar(); if (sizes.mgrNav) await shot('nav-mgr', { x: 0, y: 0, width: MW, height: sizes.mgrNav }); await whole('mgr', 0, MW, [MW / 2, SH * 0.6], sizes.mgrNav);

  // The other pages' pictures of the console (site/teams/img/crop-*.jpg): one card each, as it is on its page.
  const crop = async (k, file, testid, up, w = SW) => { await size(SW, SH); await nav(k); await size(w, 3000); let el = page.getByTestId(testid).first(); if (up) el = el.locator('xpath=..');
    if (!(await el.count())) { console.log(`no ${testid} on ${k}: ${file}.jpg kept as it was`); return; }
    await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(200); await el.screenshot({ path: path.join(CROPS, file + '.jpg'), type: 'jpeg', quality: 88 }); const b = await el.boundingBox(); console.log(`${file}.jpg ${Math.round(b.width)}×${Math.round(b.height)}`); };
  // Taken at twice the size: these sit in a frame as wide as the card itself, where a 1× picture reads soft.
  const main = page, ctx2 = await browser.newContext({ viewport: { width: SW, height: SH }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  await ctx2.addInitScript(() => { window.VINTEREST_TOUR = 'off'; }); for (const p of ['**/claude', '**/tts', '**/stt']) await ctx2.route(p, (r) => r.fulfill({ status: 503, body: '{}' }));
  await ctx2.route('**/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  page = await ctx2.newPage(); page.on('pageerror', (e) => errors.push(e.message)); await start();
  await crop('dash', 'crop-attention', 'c2-needs');
  await crop('sales', 'crop-slow', 'sales-brief');
  await crop('team', 'crop-readiness2', 'c2-team-list');
  await crop('training', 'crop-team', 'c2-training-people');
  await size(SW, SH); await nav('team'); const manage = page.getByText('Manage: add or remove people', { exact: false }).first();
  if (await manage.count()) { await manage.click(); await page.waitForTimeout(400); await crop('team', 'crop-levels', 'console-level', true, 900); await size(SW, SH); await page.getByText('Manage: add or remove people', { exact: false }).first().click().catch(() => {}); }

  { await size(SW, SH); await nav('wines'); const label = await page.evaluate(() => { const w = TeamData.wines()[0]; return [w.producer, w.name].filter(Boolean).join(' '); });
    await page.getByTestId('c2-list-row').filter({ hasText: label }).first().getByText(label, { exact: true }).first().click(); const panel = page.getByTestId('console-panel'); await panel.waitFor(); await page.waitForTimeout(700);
    const box = await panel.boundingBox(); await page.screenshot({ path: path.join(CROPS, 'crop-say.jpg'), type: 'jpeg', quality: 88, clip: { x: Math.round(box.x), y: 0, width: Math.round(box.width), height: 590 } }); console.log('crop-say.jpg'); }
  await ctx2.close(); page = main;

  // A plan for one person: on the Team page, the person a manager pushed bespoke training to, from their next step
  // down to Ask Vinny and the training being tracked (plan.jpg); then that plan as it sits on their own phone (plan-phone.jpg).
  await size(SW, SH); await nav('team');
  const who = await page.evaluate(() => { const pl = TeamPlans.get().plans.find((p) => p.status === 'pushed'), p = pl && TeamLearn.person(pl.person || pl.pid || pl.for); return p ? { id: p.id, name: p.name } : null; });
  if (who) {
    await page.getByTestId('c2-team-row').filter({ hasText: who.name.split(' ')[0] }).first().click(); await page.waitForTimeout(500);
    await size(SW, 2600); const a = await page.getByTestId('c2-next').boundingBox(), b = await page.getByTestId('c2-bespoke').boundingBox(), c = await page.getByTestId('c2-vinny').boundingBox();
    const y0 = Math.round(a.y) - 8, y1 = Math.round(Math.max(b.y + b.height, c.y + c.height)) + 8, x0 = Math.round(a.x) - 8, w = Math.round(a.width) + 16;
    await shot('plan', { x: x0, y: y0, width: w, height: y1 - y0 }); sizes.plan = [w, y1 - y0]; console.log(`plan.jpg ${w}×${y1 - y0}`);
    const ph = await ctx.newPage(); await ph.setViewportSize({ width: 390, height: 844 });
    await ph.goto(`http://localhost:${port}/team/?view=phone`); await ph.waitForFunction(() => window.TeamLearn && TeamLearn.people().length);
    await ph.evaluate((id) => TeamLearn.setMe(id), who.id); await ph.reload(); const card = ph.getByTestId('today-plan').first(); await card.waitFor(); await card.scrollIntoViewIfNeeded(); await ph.waitForTimeout(400);
    await ph.screenshot({ path: path.join(OUT, 'plan-phone.jpg'), type: 'jpeg', quality: 88 }); console.log('plan-phone.jpg 390×844'); await ph.close();
  } else console.log('no pushed plan in this demo: plan.jpg not taken');

  // The staff app's pictures (site/teams/img/day/, and the older img/phone-*.jpg the other pages use), from the
  // phone app on The Larkspur in a store of its own, so tonight's changes here never reach the console's pictures:
  // a special read from the chef's board waiting to be checked, the briefing sent and who has read it, Upload, a
  // server's briefing, their Today, Practise, a drill question, the list, a wine's card, the menu and a dish.
  {
    const DAY = path.join(CROPS, 'day'); fs.mkdirSync(DAY, { recursive: true });
    const pc = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    await pc.addInitScript(() => { window.VINTEREST_TOUR = 'off'; });
    for (const p of ['**/claude', '**/tts', '**/stt']) await pc.route(p, (r) => r.fulfill({ status: 503, body: '{}' }));
    await pc.route('**/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    const ph = await pc.newPage(); ph.on('pageerror', (e) => errors.push(e.message));
    const snap = async (name, also) => { await ph.waitForTimeout(350); const file = path.join(DAY, name + '.jpg'); await ph.screenshot({ path: file, type: 'jpeg', quality: 86 });
      if (also) fs.copyFileSync(file, path.join(CROPS, also + '.jpg')); console.log(`day/${name}.jpg${also ? ' and ' + also + '.jpg' : ''}`); };
    const top = () => ph.evaluate(() => { const s = document.querySelector('[data-scroll]'); if (s) s.scrollTop = 0; });
    await ph.goto(`http://localhost:${port}/team/?seed=demo&view=phone`); await ph.waitForFunction(() => window.TeamLearn && TeamLearn.people().length);
    // Tonight: a dish 86'd, a wine on feature, a note, and a special as the reader leaves it (a draft, read from a photo).
    await ph.evaluate(() => { const wine = (re) => (TeamData.wines().find((w) => re.test(w.producer + ' ' + w.name)) || {}).id, dish = (re) => (TeamData.dishes().find((d) => re.test(d.name)) || {}).id;
      TeamData.setTonight({ off: [dish(/cod/i)], feature: [wine(/Nyetimber/)], note: 'Table of twelve at 8. Lead with the turbot.' });
      const s = TeamShift._clean({ name: 'Roast turbot, brown butter, sea beans', description: 'Turbot on the bone, roasted, with brown butter, capers and sea beans.', price: 34, section: 'main',
        allergens: [{ code: 'fish', sure: 'stated' }, { code: 'milk', sure: 'likely' }], bottle: { id: wine(/Montmains/), why: 'Mineral and taut, with the weight for brown butter.' },
        glass: { id: wine(/Laroche/), why: 'Crisp Chablis cuts the butter and keeps the fish fresh.' }, alts: [{ id: wine(/Nyetimber/), why: 'Bubbles and acidity against the butter.' }],
        say: "Tonight's special is roast turbot with brown butter. It's lovely with a glass of the Chablis." }, 'photo'); const d = TeamShift.get(); d.specials.push(s); TeamShift.save(d); });
    await ph.reload(); await ph.getByTestId('tonight-edit').first().click(); const draft = ph.getByTestId('special-draft').first(); await draft.waitFor(); await draft.scrollIntoViewIfNeeded();
    await ph.evaluate(() => { const s = document.querySelector('[data-scroll]'), d = document.querySelector('[data-testid="special-draft"]'); if (s && d) s.scrollTop += d.getBoundingClientRect().top - s.getBoundingClientRect().top - 12; });
    await snap('special');
    await ph.getByTestId('special-confirm').first().click(); await ph.getByTestId('special-approve').first().click(); await ph.waitForTimeout(300); await ph.getByTestId('shift-send-btn').first().click(); await ph.waitForTimeout(300);
    // Here the rest of the team accept over a few minutes; for the picture, those who will have done so by now.
    await ph.evaluate(() => { const d = TeamShift.get(); for (const a of Object.values(d.acks || {})) if (a.demo) a.at = Date.now() - 60000; TeamShift.save(d); });
    await ph.goto(`http://localhost:${port}/team/?view=phone`); await ph.getByTestId('tonight-edit').first().click(); const reg = ph.getByTestId('shift-register').first(); await reg.waitFor(); await reg.scrollIntoViewIfNeeded(); await snap('sent');
    await ph.goto(`http://localhost:${port}/team/?view=phone`); await ph.getByTestId('team-tab-upload').click(); await top(); await snap('upload', 'phone-upload');
    // The phone of a server who hasn't read it yet: the briefing over the app, then Today, Practise, a question, the list, a card, the menu, a dish.
    await ph.evaluate(() => TeamLearn.setMe(TeamShift.register().waiting.filter((x) => x.role === 'server')[0].id)); await ph.reload(); await ph.getByTestId('team-briefing').waitFor(); await snap('briefing');
    await ph.getByTestId('briefing-ack').first().click(); await ph.getByTestId('team-tab-today').waitFor(); await top(); await snap('today', 'phone-today-staff');
    await ph.getByTestId('team-tab-wines').click(); await top(); await snap('wines', 'phone-wines');
    await ph.getByTestId('team-wine-row').first().click(); await ph.getByTestId('team-wine').waitFor(); await snap('card', 'phone-card');
    await ph.goto(`http://localhost:${port}/team/?view=phone`); await ph.getByTestId('team-tab-menu').click(); await top(); await snap('menu', 'phone-menu');
    await ph.getByTestId('team-dish-row').first().click(); await ph.getByTestId('team-dish').waitFor(); await snap('dish', 'phone-dish');
    await ph.goto(`http://localhost:${port}/team/?view=phone`); await ph.getByTestId('team-tab-vinny').click(); await top(); await snap('practise');
    await ph.getByTestId('vinny-next').getByText(/^(Start|Carry on|Practise|Take)/).last().click(); await ph.getByTestId('drill-q').first().waitFor(); await snap('drill', 'phone-drill');
    await pc.close();
  }

  fs.writeFileSync(path.join(OUT, 'sizes.json'), JSON.stringify(sizes, null, 1) + '\n');
  console.log('sizes.json', JSON.stringify(sizes));
  if (errors.length) { console.log('Page errors while taking them:', errors.slice(0, 3)); process.exitCode = 1; }
} finally { await browser.close(); server.kill(); }
