// Builds site-teams-dist/: the Vinterest Teams website (vinterest.team), its own Cloudflare Pages
// project, separate from the consumer site (site/ -> site-dist/, vinterest.app) and the app (dist/).
// Run with `npm run site:teams:build`.
//
//   site/teams/*.html           the pages (templates: %%TOKENS%% are filled in below); each is served
//                               without its .html (/pricing), index.html at /
//   site/teams/_*.html          parts every page shares: %%NAV%%, %%PILOT%% (the pilot sign-up
//                               form), %%FOOTER%%; the nav marks the page it's on
//   site/teams/site.css, site.js  shared styles and the form's script
//   site/teams/img/             the product screens
//   site/teams/audio/           spoken clips for "Hear a table" (the guest's own voice, from the Worker's /tts)
//   site/teams/live/            the live phone: live.js is the Teams app's own sources (TEAM_ALL) with
//                               store.js after pwa-store.js and live.jsx in place of the app's boot line,
//                               so a phone on the site runs the real drill, never a picture of it
//   site/_headers               long cache on fonts
//   site/teams/_redirects       www.vinterest.team to vinterest.team
//
// Settings (Cloudflare Pages build variables, all optional):
//   The restaurant demo buttons open the team app's console for The Larkspur from the app project's
//   build of the same branch, so the demo always shows the app as this site describes it: on main its
//   own address, https://demo.vinterest.team (a custom domain on the app project, served by
//   serveTeamDemo in _worker.js); on any other branch that branch's preview,
//   https://<branch>.vinterest.pages.dev/team/ (CF_PAGES_BRANCH, which Cloudflare sets).
//   TEAM_DEMO_URL overrides it. (DEMO_ORIGIN, an old setting, is ignored.)
//   CF_ANALYTICS_TOKEN    Cloudflare Web Analytics token; without it no analytics script is added
//   SITE_ORIGIN           the site's public address, for the sitemap (default https://vinterest.team)
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { TEAM_ALL } from './app-sources.mjs';
import { appVersion, buildFonts, collectAssetPaths, inlineAssets, transformSource } from './build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'site/teams');
const OUT = path.join(ROOT, 'site-teams-dist');

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10);

function fill(html, vars) {
  return html.replace(/%%([A-Z_]+)%%/g, (m, k) => {
    if (!(k in vars)) throw new Error(`site-teams: unknown token ${m}`);
    return vars[k];
  });
}

// Where the demo buttons go. Cloudflare's branch address is lower case, anything but letters and
// digits as '-', at most 28 characters.
export function demoUrl(branch) {
  const q = '?seed=demo&view=console';
  if (!branch || branch === 'main') return `https://demo.vinterest.team/${q}`;
  const alias = branch.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28).replace(/^-+|-+$/g, '');
  return `https://${alias}.vinterest.pages.dev/team/${q}`;
}

// The live phone's bundle (window.TeamsLive): React, the data the app reads, then the Teams app's sources in the
// app's own order. team-app.jsx is kept for TeamApp, without the line that boots it into #root. The whole of it
// sits in one function, so none of the app's top-level names can meet a name in a page's own script.
const BOOT = /^ReactDOM\.createRoot\(document\.getElementById\("root"\)\)\.render\([^\n]*TeamApp[^\n]*\);\s*$/m;
async function buildLive() {
  const version = appVersion();
  const sources = [...TEAM_ALL.flatMap((f) => (f === 'pwa-store.js' ? [f, 'site/teams/live/store.js'] : [f])), 'site/teams/live/live.jsx'];
  const vendor = await esbuild.build({
    stdin: { contents: ["import * as React from 'react';", "import * as ReactDOM from 'react-dom';", "import * as ReactDOMClient from 'react-dom/client';",
      'window.React = React;', 'window.ReactDOM = Object.assign({}, ReactDOM, ReactDOMClient);'].join('\n'), resolveDir: ROOT, sourcefile: 'vendor-react.js' },
    bundle: true, format: 'iife', minify: true, legalComments: 'none', define: { 'process.env.NODE_ENV': '"production"' }, write: false,
  });
  // The phone only ever opens the demo restaurant, so the other restaurants' files (half the bundle) go in empty.
  const assets = inlineAssets(collectAssetPaths(sources));
  for (const k of Object.keys(assets)) if (/^data\/team-(?!demo)/.test(k)) assets[k] = { venue: {}, wines: [], dishes: [], cocktails: [], staff: [], cards: {}, pairings: {} };
  const parts = [vendor.outputFiles[0].text, 'const React = window.React, ReactDOM = window.ReactDOM;',
    `const __VINTEREST_ASSETS__ = Object.freeze(${JSON.stringify(assets)});`];
  for (const file of sources) {
    let code = await transformSource(file, version);
    if (file === 'team-app.jsx') {
      if (!BOOT.test(code)) throw new Error('site-teams: team-app.jsx no longer ends by booting TeamApp into #root; update BOOT');
      code = code.replace(BOOT, '');
    }
    parts.push(`/* ---- ${file} ---- */\n${code}`);
  }
  const min = await esbuild.transform(`(function(){\n${parts.join('\n')}\n})();`, { minify: true, legalComments: 'none', charset: 'utf8' });
  return `/* Vinterest Teams website: the live phone, from app ${version}. Generated by scripts/site-teams.mjs, do not edit. */\n${min.code}`;
}

// A restaurant's list as the site's bottles draw it (data-cellar in site.js): rows of [name, bottle price, glass
// price or 0, kind, 1 for a magnum] from the least expensive to the most, and the cards its bottles open, in the
// same order. Made at build time from the demo restaurant's own files, so the site's list is the app's.
export function cellarOf(list, train) {
  const num = (s) => { const m = /[£$€]([\d,.]+)/.exec(s || ''); return m ? +m[1].replace(',', '') : 0; };
  const KIND = { sparkling: 's', white: 'w', orange: 'w', 'rosé': 'p', red: 'r', dessert: 'd', fortified: 'd' };
  const all = list.wines.map((w) => {
    const mag = /Magnum/.test(w.other || '') && !w.bottle, bottle = num(w.bottle) || (mag ? num(w.other) : 0), c = (train.cards || {})[w.id] || {};
    const row = [(w.name.includes(w.producer) ? w.name : `${w.producer}, ${w.name}`) + (w.vintage ? ` ${w.vintage}` : ''), bottle, num(w.glass), KIND[w.type] || 'r']; if (mag) row.push(1);
    const serve = c.serve || {};
    const card = { section: w.section, where: [w.region, w.country].filter(Boolean).join(', '), grapes: (w.grapes || []).join(', '), say: c.say || '', hook: c.hook || '', pitch: c.pitch || '', taste: c.taste || '', style: c.style || null,
      serve: [serve.temp, serve.glass, serve.decant && !/^(no|none)/i.test(serve.decant) && `decant ${serve.decant}`].filter(Boolean).join(' · '), dishes: (c.dishes || []).slice(0, 3) };
    if (/37\.5|50cl|half/i.test(w.bottle || '')) card.half = 1;
    return { row, card, key: bottle || num(w.glass) * 7.5 };
  }).sort((a, b) => a.key - b.key);
  return { rows: all.map((x) => x.row), cards: all.map((x) => x.card) };
}

export async function build() {
  const origin = (process.env.SITE_ORIGIN || 'https://vinterest.team').replace(/\/+$/, '');
  const demo = process.env.TEAM_DEMO_URL || demoUrl(process.env.CF_PAGES_BRANCH);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  buildFonts(OUT);
  const token = process.env.CF_ANALYTICS_TOKEN;
  const vars = {
    DEMO_URL: demo.replace(/&/g, '&amp;'),
    FONTS_V: hash(fs.readFileSync(path.join(OUT, 'fonts/fonts.css'), 'utf8')),
    ANALYTICS: token
      ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${token}"}'></script>`
      : '',
  };
  vars.DEMO_PHONE_URL = demo.replace('view=console', 'view=phone').replace(/&/g, '&amp;'); // the same demo as the staff see it, to try by hand
  const lark = cellarOf(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/team-demo-list.json'), 'utf8')), JSON.parse(fs.readFileSync(path.join(ROOT, 'data/team-demo.json'), 'utf8')));
  vars.LARKSPUR_LIST = JSON.stringify(lark.rows).replace(/</g, '\\u003c');
  fs.writeFileSync(path.join(OUT, 'larkspur.cards.json'), JSON.stringify(lark.cards));
  vars.LARKSPUR_V = hash(JSON.stringify(lark.cards));
  const live = await buildLive();
  fs.writeFileSync(path.join(OUT, 'live.js'), live);
  vars.LIVE_V = hash(live);
  // What the app in the live phone asks for by address: the demo restaurant's logo and its team's faces.
  fs.cpSync(path.join(ROOT, 'team/brand/larkspur'), path.join(OUT, 'brand/larkspur'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'team/faces'), path.join(OUT, 'faces'), { recursive: true });
  const part = (n) => fs.readFileSync(path.join(SRC, `_${n}.html`), 'utf8').trimEnd();
  for (const f of ['site.css', 'site.js']) fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));
  vars.CSS_V = hash(fs.readFileSync(path.join(SRC, 'site.css'), 'utf8'));
  vars.JS_V = hash(fs.readFileSync(path.join(SRC, 'site.js'), 'utf8'));
  // Images keep their names when retaken, so every reference carries a hash of the whole img folder:
  // a new screenshot can never be served from a phone's earlier copy.
  const imgs = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? imgs(path.join(d, e.name)) : [path.join(d, e.name)]);
  vars.IMG_V = hash(imgs(path.join(SRC, 'img')).sort().map((f) => f + hash(fs.readFileSync(f))).join());
  // The spoken clips (site/teams/audio/, made once from the Worker's own voice) keep their names too.
  vars.AUDIO_V = hash(imgs(path.join(SRC, 'audio')).sort().map((f) => f + hash(fs.readFileSync(f))).join());
  vars.PILOT = part('pilot');
  vars.FOOTER = fill(part('footer'), vars);
  const pages = fs.readdirSync(SRC).filter((f) => f.endsWith('.html') && !f.startsWith('_')).sort();
  if (!pages.includes('index.html')) throw new Error('site-teams: no index.html');
  for (const f of pages) {
    const slug = f === 'index.html' ? '' : f.replace(/\.html$/, '');
    const nav = fill(part('nav'), vars).replace(`href="/${slug}"`, (m) => slug ? `${m} aria-current="page"` : m);
    let html = fill(fs.readFileSync(path.join(SRC, f), 'utf8'), { ...vars, NAV: nav });
    html = html.replace(/(src="img\/[^"?]+)"/g, `$1?v=${vars.IMG_V}"`);
    if (!html.includes('</body>')) throw new Error(`site-teams: ${f} has no </body>`);
    fs.writeFileSync(path.join(OUT, f), html.replace('</body>', `${vars.ANALYTICS}</body>`));
  }
  // Private pages written for one prospect (site/teams/for/<name>.html, served at /for/<name>): built like the
  // others but with no nav, never in the sitemap, and kept out of search (their own noindex, robots.txt, and the
  // Worker's X-Robots-Tag). Nothing on the site links to them.
  const forDir = path.join(SRC, 'for'), priv = fs.existsSync(forDir) ? fs.readdirSync(forDir).filter((f) => f.endsWith('.html')).sort() : [];
  if (priv.length) fs.mkdirSync(path.join(OUT, 'for'), { recursive: true });
  for (const f of priv) {
    const html = fill(fs.readFileSync(path.join(forDir, f), 'utf8'), vars);
    if (!/<meta name="robots" content="noindex/.test(html)) throw new Error(`site-teams: for/${f} must carry <meta name="robots" content="noindex, nofollow">`);
    fs.writeFileSync(path.join(OUT, 'for', f), html);
  }
  // A private page's data (the cards its list opens), served beside it.
  if (fs.existsSync(path.join(SRC, 'for'))) for (const f of fs.readdirSync(path.join(SRC, 'for')).filter((x) => x.endsWith('.json'))) fs.copyFileSync(path.join(SRC, 'for', f), path.join(OUT, 'for', f));
  fs.cpSync(path.join(SRC, 'img'), path.join(OUT, 'img'), { recursive: true });
  fs.cpSync(path.join(SRC, 'audio'), path.join(OUT, 'audio'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'logo.png'), path.join(OUT, 'logo.png'));
  fs.copyFileSync(path.join(ROOT, 'site/_headers'), path.join(OUT, '_headers'));
  fs.copyFileSync(path.join(SRC, '_redirects'), path.join(OUT, '_redirects')); // www to the apex
  fs.copyFileSync(path.join(SRC, '_worker.js'), path.join(OUT, '_worker.js')); // POST /api/pilot, then the static pages
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /for/\nSitemap: ${origin}/sitemap.xml\n`);
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((f) => `  <url><loc>${origin}/${f === 'index.html' ? '' : f.replace(/\.html$/, '')}</loc></url>`).join('\n')}\n</urlset>\n`);
  console.log(`Built site-teams-dist/ (live.js ${(live.length / 1024).toFixed(0)} KB, ${pages.length} pages${priv.length ? `, ${priv.length} private` : ''}) — demo at ${demo}${token ? ', analytics on' : ', no analytics token'}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  build().catch((err) => { console.error(err.message || err); process.exit(1); });
}
