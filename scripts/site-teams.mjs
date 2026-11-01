// Builds site-teams-dist/: the Vinterest Teams website (vinterest.team), its own Cloudflare Pages
// project, separate from the consumer site (site/ -> site-dist/, vinterest.app) and the app (dist/).
// Run with `npm run site:teams:build`.
//
//   site/teams/index.html       the page (a template: %%TOKENS%% are filled in below)
//   site/teams/img/             the product screens on it
//   site/_headers               long cache on fonts
//   site/teams/_redirects       www.vinterest.team to vinterest.team
//
// Settings (Cloudflare Pages build variables, all optional):
//   DEMO_ORIGIN           where the interactive demo (the team app at /team/) is served; default
//                         https://vinterest.pages.dev. Until the console branch is on main, point it at
//                         that branch's preview.
//   CF_ANALYTICS_TOKEN    Cloudflare Web Analytics token; without it no analytics script is added
//   SITE_ORIGIN           the site's public address, for the sitemap (default https://vinterest.team)
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFonts } from './build.mjs';

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

export function build() {
  const origin = (process.env.SITE_ORIGIN || 'https://vinterest.team').replace(/\/+$/, '');
  const demo = (process.env.DEMO_ORIGIN || 'https://vinterest.pages.dev').replace(/\/+$/, '');
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  buildFonts(OUT);
  const token = process.env.CF_ANALYTICS_TOKEN;
  const vars = {
    DEMO_ORIGIN: demo,
    FONTS_V: hash(fs.readFileSync(path.join(OUT, 'fonts/fonts.css'), 'utf8')),
    ANALYTICS: token
      ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${token}"}'></script>`
      : '',
  };
  const html = fill(fs.readFileSync(path.join(SRC, 'index.html'), 'utf8'), vars);
  if (!html.includes('</body>')) throw new Error('site-teams: index.html has no </body>');
  fs.writeFileSync(path.join(OUT, 'index.html'), html.replace('</body>', `${vars.ANALYTICS}</body>`));
  fs.cpSync(path.join(SRC, 'img'), path.join(OUT, 'img'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'logo.png'), path.join(OUT, 'logo.png'));
  fs.copyFileSync(path.join(ROOT, 'site/_headers'), path.join(OUT, '_headers'));
  fs.copyFileSync(path.join(SRC, '_redirects'), path.join(OUT, '_redirects')); // www to the apex
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${origin}/</loc></url>\n</urlset>\n`);
  console.log(`Built site-teams-dist/ — demo at ${demo}${token ? ', analytics on' : ', no analytics token'}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { build(); } catch (err) { console.error(err.message || err); process.exit(1); }
}
