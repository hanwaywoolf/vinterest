// Instagram icons for the App Store and Google Play links (and story highlight covers): the app
// icon's crimson and grapes, with each store's mark in white. 1080x1080, safe inside the circle crop.
import { chromium } from 'playwright';
import fs from 'node:fs';
const grape = `<radialGradient id="grape" cx="0.36" cy="0.34" r="0.7"><stop offset="0" stop-color="#DA93A3"/><stop offset="0.45" stop-color="#C85E77"/><stop offset="1" stop-color="#BD4E68"/></radialGradient>`;
// The three grapes from the app icon, as a small cluster.
const grapes = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="0" cy="-48" r="37.5" fill="url(#grape)"/><circle cx="-45.5" cy="39.5" r="37" fill="url(#grape)"/><circle cx="45.5" cy="39.5" r="37" fill="url(#grape)"/></g>`;
const apple = `<path fill="#fff" d="M16.4 12.6c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.8-1.7 0-3.3 1-4.1 2.5-1.8 3.1-.5 7.6 1.3 10.1.8 1.2 1.8 2.6 3.1 2.5 1.3-.1 1.7-.8 3.3-.8 1.5 0 2 .8 3.3.8 1.4 0 2.2-1.2 3.1-2.5.9-1.4 1.3-2.8 1.4-2.9-.1 0-2.6-1-2.7-3.9zM14 5.3c.7-.8 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z"/>`;
const play = `<path fill="#fff" d="M4 2.6c-.3.3-.5.8-.5 1.4v16c0 .6.2 1.1.5 1.4l9.1-9.4L4 2.6zm10.2 10.4 2.6 2.7-11.7 6.6c-.4.2-.8.3-1.1.2l10.2-9.5zm0-2L4 1.5c.3-.1.7 0 1.1.2l11.7 6.6-2.6 2.7zm3.7-2.1 3.1 1.8c.9.5.9 1.9 0 2.4l-3.1 1.8-2.8-3 2.8-3z"/>`;
// Each glyph's own centre in its 24-unit box, so both sit in the middle of the circle.
const centre = { apple: [10.5, 12.1], play: [12.6, 12] };
const icon = (glyph, c, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${grape}</defs>
  <rect width="512" height="512" fill="#8B1A2F"/>
  ${grapes(256, 118, 0.42)}
  <g transform="translate(${256 - c[0] * 8.6} ${262 - c[1] * 8.6}) scale(8.6)">${glyph}</g>
  <text x="256" y="408" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="36" fill="#fff" letter-spacing="0.5">${label}</text>
</svg>`;
const fontCss = fs.readFileSync('../node_modules/@fontsource/poppins/files/poppins-latin-700-normal.woff2').toString('base64');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1080, height: 1080 } });
const page = (svg) => `<style>@font-face{font-family:Poppins;font-weight:700;src:url(data:font/woff2;base64,${fontCss})}body{margin:0}</style>${svg.replace('<svg ', '<svg width="1080" height="1080" ')}`;
const out = { 'instagram-app-store': icon(apple, centre.apple, 'iPhone'), 'instagram-google-play': icon(play, centre.play, 'Android') };
for (const [n, s] of Object.entries(out)) { await p.setContent(page(s)); await p.waitForTimeout(200); await p.screenshot({ path: `${n}.png` }); }
const d = Object.fromEntries(Object.keys(out).map(n => [n, fs.readFileSync(`${n}.png`).toString('base64')]));
await p.setViewportSize({ width: 620, height: 520 });
const row = (bg) => `<div style="background:${bg};padding:30px;display:flex;gap:30px;align-items:center">${Object.keys(d).map(n => `<img src="data:image/png;base64,${d[n]}" style="width:150px;height:150px;border-radius:50%"><img src="data:image/png;base64,${d[n]}" style="width:64px;height:64px;border-radius:50%">`).join('')}</div>`;
await p.setContent(`<body style="margin:0">${row('#fff')}${row('#000')}</body>`);
await p.screenshot({ path: 'instagram-stores-preview.png', fullPage: true });
await b.close();
