// Renders the native app's icon and launch screen from assets/icon.svg and assets/splash.svg into
// assets/ios/ (committed; scripts/native.mjs copies them into the generated iOS project).
//   npm run icons        (needs Playwright's Chromium, as the tests do)
// The App Store rejects an icon with an alpha channel, even a fully opaque one, and a browser
// screenshot always has one, so the pixels are written back out as a plain RGB PNG here.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'assets/ios');

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
/* RGBA pixels → an 8-bit RGB PNG (colour type 2: no alpha channel). */
export function rgbPng(width, height, rgba) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4, o = y * (width * 3 + 1) + 1 + x * 3;
      raw[o] = rgba[i]; raw[o + 1] = rgba[i + 1]; raw[o + 2] = rgba[i + 2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* Draws an SVG at size×size. With rgb, the pixels come back (base64, fast) and are written as an
   RGB PNG with no alpha channel (the icon); otherwise it's a plain screenshot (the launch screen). */
async function render(browser, svgFile, size, outFile, { rgb = false } = {}) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const svg = fs.readFileSync(path.join(ROOT, svgFile), 'utf8');
  if (!rgb) {
    await page.setContent(`<html><body style="margin:0">${svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</body></html>`);
    await page.screenshot({ path: outFile, clip: { x: 0, y: 0, width: size, height: size } });
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
    fs.writeFileSync(outFile, rgbPng(size, size, Buffer.from(b64, 'base64')));
  }
  await page.close();
  console.log(`${path.relative(ROOT, outFile)} (${size}×${size}${rgb ? ', RGB' : ''})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  await render(browser, 'assets/icon.svg', 1024, path.join(OUT, 'AppIcon-1024.png'), { rgb: true });
  await render(browser, 'assets/splash.svg', 2732, path.join(OUT, 'splash-2732.png'));
  await browser.close();
}
