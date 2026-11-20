// Vinny's read of a restaurant's list as a buyer (TeamBuyer.review, prompts/team-buyer.txt): what each bottle costs in a
// shop in its market, dishes the list could sell that the menu lacks, dishes it serves thinly, what a guest would look for
// and not find, and what to cut. Written into the restaurant's file (data/team-<name>.json, `buyer`), so the install opens
// with real shop prices on the console's Wines page rather than a blank markup. One call to the deployed Worker (billed);
// VINTEREST_API_ORIGIN picks which (default production).
// Usage: npm run team:buyer -- eloise   [--dry]
import fs from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'playwright';

const args = process.argv.slice(2), dry = args.includes('--dry'), seeds = args.filter((a) => !a.startsWith('--'));
if (!seeds.length) { console.error('Name a restaurant: npm run team:buyer -- eloise'); process.exit(2); }
const API = process.env.VINTEREST_API_ORIGIN || 'https://vinterest.pages.dev';
execSync('node scripts/build.mjs', { stdio: 'ignore' });
const port = 4198, server = spawn('node', ['scripts/serve.mjs', 'dist', String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
try {
  for (const seed of seeds) {
    const page = await browser.newPage();
    // Sent with curl, which follows the machine's proxy settings (Node's own fetch doesn't).
    await page.route('**/claude', async (route) => {
      try {
        const out = await new Promise((res, rej) => { const c = spawn('curl', ['-sS', '-m', '240', '-X', 'POST', `${API}/claude`, '-H', 'Content-Type: application/json', '-H', `Origin: ${API}`, '--data-binary', '@-', '-w', '\n%{http_code}']);
          let o = ''; c.stdout.on('data', (d) => { o += d; }); c.on('close', (code) => code ? rej(new Error('curl ' + code)) : res(o)); c.stdin.end(route.request().postData()); });
        const i = out.lastIndexOf('\n'), status = Number(out.slice(i + 1)) || 502;
        if (status !== 200) console.log(`  /claude answered ${status}: ${out.slice(0, Math.min(i, 200))}`);
        await route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: out.slice(0, i) });
      } catch (e) { await route.fulfill({ status: 502, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: e.message }) }); }
    });
    await page.goto(`http://localhost:${port}/team/?seed=${seed}`);
    await page.waitForFunction(() => window.TeamBuyer && TeamData.wines().length > 0);
    const r = await page.evaluate(async () => { const d = await TeamBuyer.review(); const m = TeamBuyer.markups();
      return { d, n: TeamData.wines().length, priced: Object.keys(d.retail).length, median: m && m.median, name: TeamData.get().venue.name }; });
    console.log(`${r.name}: shop prices for ${r.priced} of ${r.n} wines, usual markup ${r.median ? r.median.toFixed(1) + '×' : 'none'}; ${r.d.missing.length} dishes the menu lacks, ${r.d.weak.length} served thinly, ${r.d.gaps.length} gaps, ${r.d.cut.length} to cut`);
    if (!dry) { const file = `data/team-${seed}.json`, doc = JSON.parse(fs.readFileSync(file, 'utf8')); doc.buyer = r.d; fs.writeFileSync(file, JSON.stringify(doc, null, 1) + '\n'); console.log(`  written to ${file}`); }
  }
} finally { await browser.close(); server.kill(); }
