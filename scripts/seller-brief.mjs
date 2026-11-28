// Vinny writes a prospect's visit brief (SellerVinny.write, prompts/seller-brief.txt): the same call the Brief page's
// "Have Vinny write it" makes, run on the built app against the deployed Worker, with what it used and what it cost.
// One call (billed); VINTEREST_API_ORIGIN picks the Worker (default production).
// Usage: npm run seller:brief -- eloise   [--out file.json] [--prompt]   (--prompt prints the prompt and makes no call)
import fs from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'playwright';

const args = process.argv.slice(2), seed = args.find((a) => !a.startsWith('--') && !a.endsWith('.json')) || 'eloise';
const outAt = args.indexOf('--out'), out = outAt >= 0 ? args[outAt + 1] : null, only = args.includes('--prompt');
const API = process.env.VINTEREST_API_ORIGIN || 'https://vinterest.pages.dev';
// Dollars per million tokens, in and out (scripts/team-cost.mjs keeps the same table).
const PRICE = { 'claude-sonnet-4-6': [3, 15], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-4-5': [1, 5], 'claude-opus-5-5': [4, 20] };
const priceOf = (m) => PRICE[Object.keys(PRICE).find((k) => String(m || '').startsWith(k))] || null;
if (!args.includes('--no-build')) execSync('node scripts/build.mjs', { stdio: 'ignore' });
const port = 4197, server = spawn('node', ['scripts/serve.mjs', 'dist', String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : {});
try {
  const page = await browser.newPage();
  await page.route('**chgwebmedia**', (r) => r.abort());
  // Sent with curl, which follows the machine's proxy settings (Node's own fetch doesn't).
  await page.route('**/claude', async (route) => {
    try {
      const res = await new Promise((ok, no) => { const c = spawn('curl', ['-sS', '-m', '540', '-X', 'POST', `${API}/claude`, '-H', 'Content-Type: application/json', '-H', `Origin: ${API}`, '--data-binary', '@-', '-w', '\n%{http_code}']);
        let o = ''; c.stdout.on('data', (d) => { o += d; }); c.on('close', (code) => code ? no(new Error('curl ' + code)) : ok(o)); c.stdin.end(route.request().postData()); });
      const i = res.lastIndexOf('\n'), status = Number(res.slice(i + 1)) || 502;
      if (status !== 200) console.log(`  /claude answered ${status}: ${res.slice(0, Math.min(i, 300))}`);
      await route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: res.slice(0, i) });
    } catch (e) { await route.fulfill({ status: 502, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: e.message }) }); }
  });
  await page.goto(`http://localhost:${port}/seller/?venue=${seed}`);
  await page.waitForFunction(() => typeof SellerVinny !== 'undefined' && TeamData.wines().length > 0);
  if (only) { console.log(await page.evaluate(() => SellerVinny.prompt())); }
  else {
    const t0 = Date.now(), r = await page.evaluate(async () => { try { const x = await SellerVinny.write(); return { ...x, name: SellerMatch.venue().name }; } catch (e) { return { error: e.message }; } });
    if (r.error) { console.error(r.error); const u = await page.evaluate(() => SellerVinny.lastUsage); if (u) console.error(`  the call was still made: ${u.model}, ${JSON.stringify(u.usage)}`); process.exitCode = 1; }
    else {
      const R = r.report, u = (r.usage && r.usage.usage) || {}, model = r.usage && r.usage.model, p = priceOf(model);
      console.log(`${r.name}: ${R.bottles} of ${R.asked} bottles written, ${R.openings} of ${R.openingsAsked} openings, ${R.dishes} of ${R.dishesAsked} dish lines; ${R.dropped.length} left out by the checks`);
      for (const d of R.dropped) console.log(`  left out: ${d.where}: ${d.why}`);
      if (R.missing.length) console.log(`  not written: ${R.missing.join(', ')}`);
      const inTok = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0), outTok = u.output_tokens || 0;
      console.log(`  ${model || 'model unknown'} · ${inTok} tokens in (${r.chars} characters), ${outTok} out · ${Math.round((Date.now() - t0) / 1000)}s${p ? ` · about $${((inTok * p[0] + outTok * p[1]) / 1e6).toFixed(2)}` : ''}`);
      const file = out || `data/seller-brief-${seed}-vinny.json`;
      fs.writeFileSync(file, JSON.stringify({ ...r.doc, model, usage: u }, null, 1) + '\n'); console.log(`  written to ${file}`);
    }
  }
} finally { await browser.close(); server.kill(); }
