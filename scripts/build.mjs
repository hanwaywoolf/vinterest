// Builds dist/ — the deployable site. Run with `npm run build`.
//
// dist/app.js is, in order:
//   1. React 18 + ReactDOM (from node_modules, production build), exposed as window.React /
//      window.ReactDOM exactly like the old CDN <script> tags did.
//   2. __VINTEREST_ASSETS__: every data/*.json and prompts/*.txt file the app reads through
//      _loadJSON/_loadTextSync/_loadText, inlined as text so those loaders never touch the network.
//   3. The app sources from scripts/app-sources.mjs, JSX-transformed one by one and concatenated
//      into a single classic script, same as the hand-compiled bundle.js.
import * as esbuild from 'esbuild';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_SOURCES, STATIC_FILES } from './app-sources.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

// "1.3.0 (214 · 2ba108e)": package.json version, build number, commit. The build number is
// BUILD_NUMBER if set, otherwise the commit count on HEAD, which only goes up on main. A shallow
// clone can't count commits, so it falls back to the commit hash alone.
export function appVersion() {
  const { version } = JSON.parse(read('package.json'));
  const sha = (process.env.CF_PAGES_COMMIT_SHA || git('rev-parse', 'HEAD')).slice(0, 7);
  const shallow = git('rev-parse', '--is-shallow-repository') === 'true';
  const build = process.env.BUILD_NUMBER || (shallow ? '' : git('rev-list', '--count', 'HEAD'));
  const parts = [build, sha].filter(Boolean);
  return parts.length ? `${version} (${parts.join(' · ')})` : version;
}

const LOADER_CALL = /\b_load(?:JSON|TextSync|Text)\(\s*([^)]*?)\s*\)/g;

// Every loader call must pass a string literal so the file can be inlined here. The loaders'
// own bodies pass their `path` parameter through, which is the one allowed exception.
function collectAssetPaths(files) {
  const paths = new Set();
  for (const file of files) {
    const src = read(file);
    for (const m of src.matchAll(LOADER_CALL)) {
      const arg = m[1];
      if (arg === 'path') continue;
      const lit = /^(['"])([^'"]+)\1$/.exec(arg);
      if (!lit) throw new Error(`${file}: ${m[0]} — loader paths must be string literals so they can be inlined`);
      paths.add(lit[2]);
    }
  }
  return [...paths].sort();
}

function inlineAssets(paths) {
  const assets = {};
  for (const p of paths) {
    if (!fs.existsSync(path.join(ROOT, p))) throw new Error(`Loader references ${p}, which does not exist`);
    const text = read(p);
    if (p.endsWith('.json')) JSON.parse(text); // fail the build, not the app, on malformed data
    assets[p] = text;
  }
  return assets;
}

async function buildVendor() {
  const result = await esbuild.build({
    stdin: {
      contents: [
        "import * as React from 'react';",
        "import * as ReactDOM from 'react-dom';",
        "import * as ReactDOMClient from 'react-dom/client';",
        'window.React = React;',
        // The old UMD build put createRoot on ReactDOM itself; the app calls ReactDOM.createRoot.
        'window.ReactDOM = Object.assign({}, ReactDOM, ReactDOMClient);',
        // The Capacitor bridge and the plugins the app uses (Platform, pwa-platform.js). On the web
        // they sit unused: Capacitor.isNativePlatform() is false.
        "import { Capacitor } from '@capacitor/core';",
        "import { Share } from '@capacitor/share';",
        "import { Filesystem } from '@capacitor/filesystem';",
        'window.VinterestNative = { Capacitor, Share, Filesystem };',
      ].join('\n'),
      resolveDir: ROOT,
      sourcefile: 'vendor-react.js',
    },
    bundle: true,
    format: 'iife',
    minify: true,
    legalComments: 'none',
    define: { 'process.env.NODE_ENV': '"production"' },
    write: false,
  });
  return result.outputFiles[0].text;
}

// The Capacitor app has no server behind it: it calls the Worker on the live site (Platform.api).
const API_ORIGIN = JSON.stringify((process.env.VINTEREST_API_ORIGIN || 'https://vinterest.pages.dev').replace(/\/+$/, ''));

// Sign-in (pwa-account.js): the project URL and publishable key are public, and come from
// Cloudflare's build variables. Without both, the app is built without sign-in.
const SUPABASE_CONFIG = JSON.stringify(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY
  ? { url: process.env.SUPABASE_URL.replace(/\/+$/, ''), key: process.env.SUPABASE_PUBLISHABLE_KEY } : null);

async function transformSource(file, version) {
  const { code } = await esbuild.transform(read(file), {
    loader: file.endsWith('.jsx') ? 'jsx' : 'js',
    jsx: 'transform', // classic JSX, against the global React
    jsxFactory: '_h', // React.createElement with the reader's text size (pwa-textsize.js)
    define: { __APP_VERSION__: JSON.stringify(version), __SUPABASE__: SUPABASE_CONFIG, __API_ORIGIN__: API_ORIGIN },
    sourcefile: file,
    charset: 'utf8',
  });
  return code;
}

// Fonts ship with the app (dist/fonts/) instead of coming from Google Fonts: they work offline and
// inside a native wrapper, the tests see the real typeface, and no request goes to Google.
// Latin and latin-ext subsets of the weights the app uses, taken from @fontsource.
const FONTS = [
  ['poppins', ['400', '500', '600', '700', '800', '400-italic']],
  ['instrument-serif', ['400', '400-italic']],
];
const FONT_SUBSETS = /\/\* [a-z-]+-(latin|latin-ext)-\d+-(normal|italic) \*\/\n@font-face \{[\s\S]*?\n\}/g;
function buildFonts() {
  const dir = path.join(OUT, 'fonts');
  fs.mkdirSync(dir, { recursive: true });
  const css = [];
  for (const [family, styles] of FONTS) {
    const pkg = path.join(ROOT, 'node_modules/@fontsource', family);
    for (const style of styles) {
      const blocks = fs.readFileSync(path.join(pkg, `${style}.css`), 'utf8').match(FONT_SUBSETS) || [];
      if (!blocks.length) throw new Error(`fonts: no latin faces in @fontsource/${family}/${style}.css`);
      for (const block of blocks) {
        const file = block.match(/url\(\.\/files\/([^)]+\.woff2)\)/)[1];
        fs.copyFileSync(path.join(pkg, 'files', file), path.join(dir, file));
        css.push(block.replace(/src: [^;]+;/, `src: url(${file}) format('woff2');`));
      }
    }
  }
  fs.writeFileSync(path.join(dir, 'fonts.css'), css.join('\n\n') + '\n');
}

function copyStatic(rel) {
  fs.cpSync(path.join(ROOT, rel), path.join(OUT, rel), { recursive: true });
}

// index.html is the source template. Strip the React CDN tags (React is in app.js now) and point
// the bundle script at app.js. Fails if the template has no bundle tag or still references the
// CDN or bundle.js afterwards, rather than shipping a page that loads the wrong thing.
function buildIndexHtml(appHash) {
  const BUNDLE_TAG = /<script src="(?:bundle|app)\.js(?:\?v=[^"]*)?"><\/script>/;
  let html = read('index.html');
  if (!BUNDLE_TAG.test(html)) throw new Error('index.html: no <script src="bundle.js"> tag to point at app.js');
  html = html
    .replace(/<!-- React \+ Babel -->\n/, '')
    .replace(/<script src="https:\/\/unpkg\.com\/react(?:-dom)?@[^"]+"[^>]*><\/script>\n/g, '')
    .replace(/<!-- Precompiled bundle[^\n]*-->\n/, '')
    .replace(BUNDLE_TAG, `<script src="app.js?v=${appHash}"></script>`)
    // Fonts from dist/fonts (buildFonts), not Google.
    .replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com"\/>\n/, '')
    .replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]*" rel="stylesheet"\/>/,
      '<link rel="preload" href="fonts/poppins-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin/>\n' +
      '<link rel="preload" href="fonts/poppins-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin/>\n' +
      '<link rel="stylesheet" href="fonts/fonts.css"/>');
  if (/unpkg\.com|bundle\.js/.test(html)) throw new Error('index.html: leftover CDN React or bundle.js reference');
  if (/fonts\.googleapis/.test(html)) throw new Error('index.html: fonts still load from Google');
  return html;
}

async function build() {
  const version = appVersion();
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const assets = inlineAssets(collectAssetPaths(APP_SOURCES));
  const parts = [
    `/* Vinterest ${version}. Generated by scripts/build.mjs, do not edit. */`,
    await buildVendor(),
    `const __VINTEREST_ASSETS__ = Object.freeze(${JSON.stringify(assets)});`,
  ];
  for (const file of APP_SOURCES) {
    parts.push(`/* ---- ${file} ---- */\n${await transformSource(file, version)}`);
  }
  const app = parts.join('\n');
  const appHash = createHash('sha256').update(app).digest('hex').slice(0, 10);
  fs.writeFileSync(path.join(OUT, 'app.js'), app);
  fs.writeFileSync(path.join(OUT, 'index.html'), buildIndexHtml(appHash));
  STATIC_FILES.forEach(copyStatic);
  buildFonts();

  console.log(`Built dist/ — Vinterest ${version}`);
  console.log(`  app.js ${(app.length / 1024).toFixed(0)} KB, ${APP_SOURCES.length} sources, inlined: ${Object.keys(assets).join(', ')}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  build().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
