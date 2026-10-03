// Makes site/og.png, the 1200x630 card shown when vinterest.app is shared. Run `npm run site:build`
// first (it uses the built fonts), then `npm run site:og`, and commit the result.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 4177;
const server = spawn(process.execPath, [path.join(ROOT, 'scripts/serve.mjs'), 'site-dist', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  const card = path.join(ROOT, 'site-dist/og-card.html');
  fs.writeFileSync(card, `<link rel="stylesheet" href="fonts/fonts.css"><style>
    *{margin:0;box-sizing:border-box} body{width:1200px;height:630px;background:#0F0F0F;color:#fff;font-family:Poppins,sans-serif;position:relative;overflow:hidden;padding:72px 80px;display:flex;flex-direction:column;justify-content:space-between}
    .a{position:absolute;top:-140px;right:-100px;width:520px;height:520px;border-radius:50%;background:rgba(139,26,47,.28)}
    .b{position:absolute;bottom:-120px;left:-90px;width:340px;height:340px;border-radius:50%;background:rgba(139,26,47,.14)}
    img{height:40px;width:auto;align-self:flex-start;filter:invert(1) brightness(2);position:relative}
    h1{font-size:84px;font-weight:800;letter-spacing:-.035em;line-height:1.04;position:relative;max-width:980px}
    h1 i{font-family:'Instrument Serif',serif;font-weight:400;font-size:1.08em;letter-spacing:-.01em}
    p{font-size:28px;color:rgba(255,255,255,.62);position:relative}
  </style><div class="a"></div><div class="b"></div><img src="logo.png"><h1>Know if a wine is for you <i>before</i> you buy it.</h1><p>Scan a label. Get a match built from your own taste.</p>`);
  await page.goto(`http://localhost:${PORT}/og-card.html`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ROOT, 'site/og.png') });
} finally {
  fs.rmSync(path.join(ROOT, 'site-dist/og-card.html'), { force: true });
  await browser.close();
  server.kill();
}
