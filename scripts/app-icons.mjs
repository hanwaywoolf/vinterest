// Renders the native apps' icons and launch screens from assets/icon.svg and assets/splash.svg into
// assets/ios/ and assets/android/ (committed; scripts/native.mjs copies them into the generated
// projects, which would otherwise show Capacitor's own placeholder logo).
//   npm run icons        (needs Playwright's Chromium, as the tests do)
// The App Store rejects an icon with an alpha channel, even a fully opaque one, and a browser
// screenshot always has one, so the pixels are written back out as a plain RGB PNG here.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'assets/ios');
const OUT_ANDROID = path.join(ROOT, 'assets/android');

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
/* RGBA pixels → an 8-bit RGB PNG (colour type 2: no alpha channel). */
export function rgbPng(width, height, rgba, { alpha = false } = {}) {
  const n = alpha ? 4 : 3; // with alpha: colour type 6, 32-bit (what Google Play's listing icon wants)
  const raw = Buffer.alloc((width * n + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * n + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4, o = y * (width * n + 1) + 1 + x * n;
      for (let k = 0; k < n; k++) raw[o + k] = rgba[i + k];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = alpha ? 6 : 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* Draws an SVG at size×size. With rgb, the pixels come back (base64, fast) and are written as an
   RGB PNG with no alpha channel (the icon); otherwise it's a plain screenshot (the launch screen). */
async function render(browser, svgFile, size, outFile, { rgb = false, rgba = false, svg = null, height = size, alpha = false } = {}) {
  const page = await browser.newPage({ viewport: { width: size, height } });
  svg = svg || fs.readFileSync(path.join(ROOT, svgFile), 'utf8');
  if (!rgb && !rgba) {
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${height}"`)}</body></html>`);
    await page.screenshot({ path: outFile, clip: { x: 0, y: 0, width: size, height }, omitBackground: alpha });
  } else {
    const b64 = await page.evaluate(async ({ svg, size }) => {
      const img = new Image(); img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
      await img.decode();
      const c = document.createElement('canvas'); c.width = c.height = size;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, size, size);
      const d = g.getImageData(0, 0, size, size).data;
      let s = ''; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
      return btoa(s);
    }, { svg, size });
    fs.writeFileSync(outFile, rgbPng(size, size, Buffer.from(b64, 'base64'), { alpha: rgba }));
  }
  await page.close();
  console.log(`${path.relative(ROOT, outFile)} (${size}×${height}${rgb ? ', RGB' : ''})`);
}

/* Android: the icon's parts, taken from icon.svg so the two can't drift apart. */
const ICON = fs.readFileSync(path.join(ROOT, 'assets/icon.svg'), 'utf8');
const ICON_DEFS = ICON.match(/<defs>[\s\S]*?<\/defs>/)[0];
const ICON_MARK = ICON.slice(ICON.indexOf('<path')).replace(/<\/svg>\s*$/, '').trim();
const CRIMSON = ICON.match(/<rect[^>]*fill="(#[0-9A-Fa-f]{6})"/)[1];
// The adaptive icon's foreground layer is 108dp, of which launchers show the middle 72dp (masked to
// a circle, squircle…): the mark on a canvas half as big again keeps the same look as the square icon.
const androidForeground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-128 -128 768 768" width="432" height="432">${ICON_DEFS}${ICON_MARK}</svg>`;
// Older launchers (Android 7) use the square icon, or a round one where the launcher asks for it.
const androidRound = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${ICON_DEFS}<circle cx="256" cy="256" r="256" fill="${CRIMSON}"/>${ICON_MARK}</svg>`;
// The launch screen at any shape: crimson with the mark in the middle, sized to the short side.
const androidSplash = (w, h) => {
  const k = Math.min(w, h) / 2732 * 1.6;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${ICON_DEFS}<rect width="${w}" height="${h}" fill="${CRIMSON}"/><g transform="translate(${w / 2} ${h / 2}) scale(${k}) translate(-255.5 -255)">${ICON_MARK}</g></svg>`;
};
export const ANDROID_DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
export const ANDROID_SPLASH = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
export const ANDROID_ICON_BACKGROUND = CRIMSON;

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  await render(browser, 'assets/icon.svg', 1024, path.join(OUT, 'AppIcon-1024.png'), { rgb: true });
  await render(browser, 'assets/splash.svg', 2732, path.join(OUT, 'splash-2732.png'));
  fs.mkdirSync(OUT_ANDROID, { recursive: true });
  for (const [d, x] of Object.entries(ANDROID_DENSITIES)) {
    await render(browser, null, 48 * x, path.join(OUT_ANDROID, `ic_launcher-${d}.png`), { svg: ICON });
    await render(browser, null, 48 * x, path.join(OUT_ANDROID, `ic_launcher_round-${d}.png`), { svg: androidRound, alpha: true });
    await render(browser, null, 108 * x, path.join(OUT_ANDROID, `ic_launcher_foreground-${d}.png`), { svg: androidForeground, alpha: true });
    const [w, h] = ANDROID_SPLASH[d];
    await render(browser, null, w, path.join(OUT_ANDROID, `splash-port-${d}.png`), { svg: androidSplash(w, h), height: h });
    await render(browser, null, h, path.join(OUT_ANDROID, `splash-land-${d}.png`), { svg: androidSplash(h, w), height: w });
  }
  // Google Play's store listing icon: 512×512, square (Play rounds it itself), a 32-bit PNG.
  await render(browser, null, 512, path.join(OUT_ANDROID, 'play-icon-512.png'), { svg: ICON, rgba: true });
  await browser.close();
}
