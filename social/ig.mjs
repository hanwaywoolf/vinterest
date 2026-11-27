import { chromium } from 'playwright';
const mark = (fill='#FFFFFF') => `<path d="M114 113 H212 L255.5 298 L299.5 113 H397.5 L255.5 397 Z" fill="${fill}"/>
  <circle cx="255.5" cy="137.5" r="37.5" fill="url(#grape)"/><circle cx="210" cy="225" r="37" fill="url(#grape)"/><circle cx="301" cy="225" r="37" fill="url(#grape)"/>`;
const defs = `<defs><radialGradient id="grape" cx="0.36" cy="0.34" r="0.7"><stop offset="0" stop-color="#DA93A3"/><stop offset="0.45" stop-color="#C85E77"/><stop offset="1" stop-color="#BD4E68"/></radialGradient>
<radialGradient id="glow" cx="0.5" cy="0.42" r="0.6"><stop offset="0" stop-color="#8B1A2F" stop-opacity="0.85"/><stop offset="1" stop-color="#8B1A2F" stop-opacity="0"/></radialGradient></defs>`;
// The mark at 82% of the app icon's size, centred a touch low so it sits in the middle of Instagram's circle.
const g = `<g transform="translate(256 262) scale(0.82) translate(-255.5 -255)">${mark()}</g>`;
const svgs = {
  'instagram-crimson': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}<rect width="512" height="512" fill="#8B1A2F"/>${g}</svg>`,
  'instagram-dark': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}<rect width="512" height="512" fill="#0E0E10"/><rect width="512" height="512" fill="url(#glow)"/>${g}</svg>`,
};
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1080, height: 1080 } });
for (const [n, s] of Object.entries(svgs)) {
  await p.setContent(`<body style="margin:0">${s.replace('<svg ', '<svg width="1080" height="1080" ')}</body>`);
  await p.screenshot({ path: `${n}.png` });
}
// A preview as Instagram shows it: both in their circles, at profile size, on white and on dark.
await p.setViewportSize({ width: 900, height: 420 });
const circ = (n, bg) => `<div style="background:${bg};padding:40px;display:flex;gap:40px;align-items:center">${['instagram-crimson','instagram-dark'].map(x=>`<img src="data:image/png;base64,${n[x]}" style="width:150px;height:150px;border-radius:50%"><img src="data:image/png;base64,${n[x]}" style="width:44px;height:44px;border-radius:50%">`).join('')}</div>`;
const fs = await import('node:fs');
const d = Object.fromEntries(['instagram-crimson','instagram-dark'].map(x=>[x, fs.readFileSync(`${x}.png`).toString('base64')]));
await p.setContent(`<body style="margin:0;font-family:sans-serif">${circ(d,'#fff')}${circ(d,'#000')}</body>`);
await p.screenshot({ path: 'instagram-preview.png' });
await b.close();
