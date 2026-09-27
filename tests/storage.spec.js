// Storage goes through one seam (Store, pwa-store.js) so cloud sync can watch every write: no
// screen touches localStorage or sessionStorage, and each synced key has one owning module.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, collectErrors, ROOT } = require('./helpers');

const BASE = 'http://localhost:4173';

test('no screen reads or writes browser storage directly', async () => {
  const { APP_SOURCES } = await import(pathToFileURL(path.join(ROOT, 'scripts/app-sources.mjs')).href);
  const offenders = APP_SOURCES.filter((f) => f.endsWith('.jsx'))
    .flatMap((f) => fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').map((line, i) => [f, i + 1, line]))
    .filter(([, , line]) => /\b(localStorage|sessionStorage)\b/.test(line))
    .map(([f, n, line]) => `${f}:${n}: ${line.trim().slice(0, 100)}`);
  expect(offenders).toEqual([]);
  // Among the logic modules, only Store itself touches the browser's storage.
  const logic = APP_SOURCES.filter((f) => f.startsWith('pwa-') && f.endsWith('.js') && f !== 'pwa-store.js')
    .filter((f) => /\b(localStorage|sessionStorage)\s*\./.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  expect(logic).toEqual([]);
});

test('every device-storage write reaches Store subscribers; session handoffs and failures stay quiet', async ({ context, page }) => {
  const errors = collectErrors(page);
  await makeDeterministic(page);
  await stubNetwork(context);
  await page.goto(`${BASE}/?demo=1#home`);
  const out = await page.evaluate(() => {
    const seen = [];
    const off = Store.subscribe((k) => seen.push(k));
    const wine = WineHistory.getAll()[0];
    WineHistory.save(WineHistory.getAll());
    Favorites.toggle(wine);
    const fav = Favorites.has(wine);
    XPSystem.save(XPSystem.get());
    Settings.setScriptLength('short');
    const scansBefore = Entitlement.scanCount();
    Entitlement.addScan();
    LearnProgress.markArticle('x1');
    Flags.markWineDNAUnlockSeen();
    Handoff.openWine({ wine });            // session: not synced, no event
    Handoff.quiz.set({ mode: 'practice' });
    Cache.set('vinterest_test_cache', { a: 1 });
    off();
    Settings.setScriptLength('long');      // after unsubscribing: not seen
    return { seen, fav, handoff: Handoff.scanResult.get({}).wine.name === wine.name, quiz: Handoff.quiz.get(),
      scans: Entitlement.scanCount() - scansBefore, read: LearnProgress.articleDone('x1'), bad: Store.getJSON('vinterest_missing', 'fallback') };
  });
  expect(out.seen).toEqual(['vinterest_wines', 'vinterest_favorites', 'vinterest_xp_v3', 'vinterest_script_length',
    'vinterest_scan_count', 'vinterest_gen_article_x1_done', 'vinterest_wineDNA_unlock_seen', 'vinterest_test_cache']);
  expect(out).toMatchObject({ fav: true, handoff: true, quiz: { mode: 'practice' }, scans: 1, read: true, bad: 'fallback' });
  // Blocked storage (a private window, a full quota) reads as empty and writes report failure
  // instead of throwing into a screen.
  const blocked = await page.evaluate(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
    const r = { set: Store.set('vinterest_x', '1'), fav: (() => { try { Favorites.toggle({ name: 'Y', vintage: 1 }); return 'ok'; } catch (e) { return 'threw'; } })() };
    Storage.prototype.setItem = real;
    return r;
  });
  expect(blocked).toEqual({ set: false, fav: 'ok' });
  expect(errors).toEqual([]);
});
