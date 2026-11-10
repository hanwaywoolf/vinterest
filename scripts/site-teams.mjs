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

// Where the demo buttons go. Cloudflare's branch address is lower case, anything but letters and
// digits as '-', at most 28 characters.
export function demoUrl(branch) {
  const q = '?seed=demo&view=console';
  if (!branch || branch === 'main') return `https://demo.vinterest.team/${q}`;
  const alias = branch.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28).replace(/^-+|-+$/g, '');
  return `https://${alias}.vinterest.pages.dev/team/${q}`;
}

export function build() {
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
  const part = (n) => fs.readFileSync(path.join(SRC, `_${n}.html`), 'utf8').trimEnd();
  for (const f of ['site.css', 'site.js']) fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));
  vars.CSS_V = hash(fs.readFileSync(path.join(SRC, 'site.css'), 'utf8'));
  vars.JS_V = hash(fs.readFileSync(path.join(SRC, 'site.js'), 'utf8'));
  // Images keep their names when retaken, so every reference carries a hash of the whole img folder:
  // a new screenshot can never be served from a phone's earlier copy.
  const imgs = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? imgs(path.join(d, e.name)) : [path.join(d, e.name)]);
  vars.IMG_V = hash(imgs(path.join(SRC, 'img')).sort().map((f) => f + hash(fs.readFileSync(f))).join());
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
  fs.cpSync(path.join(SRC, 'img'), path.join(OUT, 'img'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'logo.png'), path.join(OUT, 'logo.png'));
  fs.copyFileSync(path.join(ROOT, 'site/_headers'), path.join(OUT, '_headers'));
  fs.copyFileSync(path.join(SRC, '_redirects'), path.join(OUT, '_redirects')); // www to the apex
  fs.copyFileSync(path.join(SRC, '_worker.js'), path.join(OUT, '_worker.js')); // POST /api/pilot, then the static pages
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /for/\nSitemap: ${origin}/sitemap.xml\n`);
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((f) => `  <url><loc>${origin}/${f === 'index.html' ? '' : f.replace(/\.html$/, '')}</loc></url>`).join('\n')}\n</urlset>\n`);
  console.log(`Built site-teams-dist/ (${pages.length} pages${priv.length ? `, ${priv.length} private` : ''}) — demo at ${demo}${token ? ', analytics on' : ', no analytics token'}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { build(); } catch (err) { console.error(err.message || err); process.exit(1); }
}
