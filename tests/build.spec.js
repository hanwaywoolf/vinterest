// Non-browser checks on the build script and its output.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('@playwright/test');
const { ROOT } = require('./helpers');

const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

test('source order matches the precompiled markers in bundle.js', async () => {
  test.skip(!fs.existsSync(path.join(ROOT, 'bundle.js')), 'bundle.js has been removed');
  const { APP_SOURCES } = await load('scripts/app-sources.mjs');
  const bundle = fs.readFileSync(path.join(ROOT, 'bundle.js'), 'utf8');
  const markers = [...bundle.matchAll(/^\/\* ---- (\S+?)(?: \(precompiled\))? ---- \*\/$/gm)].map((m) => m[1]);
  expect(APP_SOURCES).toEqual(markers);
});

test('dist/app.js has no synchronous XHR and inlines every loader path', async () => {
  const app = fs.readFileSync(path.join(ROOT, 'dist/app.js'), 'utf8');
  expect(app).not.toContain('XMLHttpRequest');
  const inlined = JSON.parse(/const __VINTEREST_ASSETS__ = Object\.freeze\((\{.*?\})\);\n/s.exec(app)[1]);
  for (const file of fs.readdirSync(path.join(ROOT, 'data'))) {
    expect(inlined[`data/${file}`], `data/${file}`).toBe(fs.readFileSync(path.join(ROOT, 'data', file), 'utf8'));
  }
});

test('the version string comes from package.json', async () => {
  const { appVersion } = await load('scripts/build.mjs');
  const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  expect(appVersion()).toMatch(new RegExp(`^${version.replace(/\./g, '\\.')}( \\(.+\\))?$`));
  const app = fs.readFileSync(path.join(ROOT, 'dist/app.js'), 'utf8');
  expect(app).toContain(JSON.stringify(appVersion()));
  expect(app).not.toContain('__APP_VERSION__');
});
