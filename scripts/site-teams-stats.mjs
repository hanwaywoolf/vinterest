// What each restaurant's demo holds, for the Teams site's internal page (site/teams/_internal.html, built to
// /internal): its wines, how many pour by the glass, dishes, cocktails, the questions its team can be asked and its
// team. Counted in the built app itself (the questions are worked out there, not written in a file), with no network,
// and written to site/teams/internal.json for the site build to read. Run after a change to a restaurant's files:
//   npm run site:teams:stats
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), DIST = path.join(ROOT, 'dist');
const { chromium } = createRequire(import.meta.url)('playwright');
// The restaurants the page lists, in its order: the seed the app opens them by.
export const SEEDS = ['demo', 'social', 'eloise', 'princess-royal', 'barbary'];

execFileSync(process.execPath, [path.join(ROOT, 'scripts/build.mjs')], { stdio: 'inherit' });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = http.createServer((q, r) => { let f = path.join(DIST, decodeURIComponent(q.url.split('?')[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!f.startsWith(DIST) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(0);
const browser = await chromium.launch(), out = {};
try {
  for (const seed of SEEDS) {
    const ctx = await browser.newContext(), page = await ctx.newPage();
    await page.addInitScript(() => { window.VINTEREST_TOUR = 'off'; });
    for (const p of ['**/claude', '**/tts', '**/stt', '**/config']) await ctx.route(p, (r) => r.fulfill({ status: 503, body: '{}' }));
    await page.goto(`http://localhost:${server.address().port}/team/?seed=${seed}&view=phone`);
    await page.waitForFunction(() => window.TeamLearn && TeamLearn.people().length > 0 && TeamData.wines().length > 0);
    out[seed] = await page.evaluate(() => { const v = TeamData.get().venue || {}, wines = TeamData.wines().filter((w) => !TeamData.isDrink(w)), drinks = TeamData.wines().filter((w) => TeamData.isDrink(w));
      const wq = TeamData.wines().flatMap((w) => [...TeamLearn.wineQs(w.id, { all: true }), ...TeamLearn.lightQs(w.id, { all: true })]), cq = TeamData.cocktails().flatMap((c) => TeamLearn.cocktailQs(c.id, { all: true })), dq = TeamData.dishes().flatMap((x) => TeamLearn.dishQs(x.id, { all: true }));
      const roles = {}; TeamLearn.people().forEach((p) => { const l = TeamLearn.ROLES[p.role].label; roles[l] = (roles[l] || 0) + 1; });
      return { name: v.name, currency: TeamData.currency().code, wines: wines.length, glass: wines.filter(TeamData.byGlass).length, cards: wines.filter((w) => TeamData.card(w.id)).length, otherDrinks: drinks.length,
        dishes: TeamData.dishes().length, paired: TeamData.dishes().filter((x) => { const p = TeamData.pairing(x.id); return p && (p.best || []).length; }).length, cocktails: TeamData.cocktails().length,
        questions: wq.length + cq.length + dq.length, wineQuestions: wq.length, dishQuestions: dq.length, cocktailQuestions: cq.length, held: ((v.reviewed || {}).held || []).length,
        team: TeamLearn.people().length, roles, console: TeamData.consoleLook() }; });
    console.log(seed, JSON.stringify(out[seed]));
    await ctx.close();
  }
} finally { await browser.close(); server.close(); }
fs.writeFileSync(path.join(ROOT, 'site/teams/internal.json'), JSON.stringify({ at: new Date().toISOString().slice(0, 10), venues: out }, null, 1) + '\n');
console.log('Wrote site/teams/internal.json');
