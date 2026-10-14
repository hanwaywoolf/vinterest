// Backup format v2 (Backup, pwa-backup.js): a full round trip, the original unversioned files,
// restoring onto a phone that already has data (nothing lost), damaged files with a message a
// person can act on, and the screen asking before it restores.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';

async function demo(context, page) {
  await makeDeterministic(page);
  await stubNetwork(context);
  await page.goto(`${BASE}/?demo=1#home`);
}

test('v2 round trip: everything that is theirs comes back, and nothing that isn\'t', async ({ context, page }) => {
  await demo(context, page);
  const out = await page.evaluate(() => {
    Favorites.toggle(WineHistory.getAll()[0]);
    LearnProgress.markArticle('abc');
    LearnProgress.markOnRamp('what-is-body');
    Settings.setScriptLength('short');
    Store.set('vinterest_pro', '1');
    Store.set('vinterest_scancards_v6_cache', '{"x":1}');
    const file = JSON.stringify(Backup.exportData());
    const keep = (k) => k !== 'vinterest_pro' && k !== 'vinterest_scan_count' && !k.startsWith('vinterest_scancards_');
    const before = Object.fromEntries(Store.keys('vinterest_').filter(keep).map((k) => [k, Store.get(k)]));
    localStorage.clear();
    const r = Backup.read(file);
    Backup.apply(r.data);
    const after = Object.fromEntries(Store.keys('vinterest_').map((k) => [k, Store.get(k)]));
    const d = JSON.parse(file);
    return {
      head: [d.format, d.version, typeof d.exported], summary: r.summary,
      lost: Object.keys(before).filter((k) => Backup.SETTINGS_KEYS.includes(k) || Backup._isProgressKey(k)).filter((k) => after[k] !== before[k]),
      wines: WineHistory.getAll().length === d.wines.length, xp: XPSystem.get().total === d.xp.total,
      notBackedUp: ['vinterest_pro', 'vinterest_scancards_v6_cache'].filter((k) => k in after),
      fav: Favorites.list().length, read: LearnProgress.articleDone('abc') && LearnProgress.onRampDone('what-is-body'), script: Settings.scriptLength(),
    };
  });
  expect(out.head).toEqual(['vinterest-backup', 2, 'string']);
  expect(out.summary.newWines).toBeGreaterThan(10);
  expect(out.lost).toEqual([]);
  expect(out).toMatchObject({ wines: true, xp: true, notBackedUp: [], fav: 1, read: true, script: 'short' });
});

test('the original unversioned backups still restore, XP put back in its proper place', async ({ context, page }) => {
  await demo(context, page);
  const out = await page.evaluate(() => {
    const wine = { name: 'Old Backup Rioja', type: 'red', vintage: 2015, rating: 91, grapes: ['Tempranillo'], scanned_at: '2025-01-01T00:00:00Z' };
    const xp = { total: 99999, events: ['type_red'], scansThisWeek: [], totalRatings: 3, grapesSeen: ['Tempranillo'], quizCompleted: {}, quizStreaks: {} };
    const r = Backup.read(JSON.stringify({ wines: [wine], xp, exported: '2025-02-01T00:00:00Z' }));
    Backup.apply(r.data);
    const raw = JSON.parse(localStorage.getItem('vinterest_xp_v3'));
    return { ok: r.ok, version: r.summary.version, found: !!WineHistory.find(wine), total: XPSystem.get().total, envelope: !!(raw.accounts && raw.accounts.local) };
  });
  expect(out).toEqual({ ok: true, version: 1, found: true, total: 99999, envelope: true });
});

test('restoring onto a phone with data merges: no duplicate bottles, higher ratings kept, XP never lowered, progress combined', async ({ context, page }) => {
  await demo(context, page);
  const out = await page.evaluate(() => {
    const mine = WineHistory.getAll(); const first = mine[0];
    const xpBefore = XPSystem.get().total;
    // The backup has the same bottle scored higher, one new bottle, less XP, and a different unlock.
    const file = { format: 'vinterest-backup', version: 2, exported: '2026-01-01T00:00:00Z',
      wines: [{ ...first, rating: 100, last_scanned: '2020-01-01T00:00:00Z' }, { name: 'Brand New Test', type: 'white', vintage: 2022, rating: 88 }],
      xp: { total: 5, events: ['backup_only_event'], scansThisWeek: [], totalRatings: 0, grapesSeen: [], quizCompleted: {}, quizStreaks: {} },
      settings: {}, progress: { vinterest_grape_unlocks_v1: JSON.stringify({ version: 1, accounts: { local: { unlocked: { Nebbiolo: 1 } } } }) } };
    localStorage.setItem('vinterest_grape_unlocks_v1', JSON.stringify({ version: 1, accounts: { local: { unlocked: { Sangiovese: 1 } } } }));
    const r = Backup.read(JSON.stringify(file));
    const text = Backup.describe(r.summary);
    const done = Backup.apply(r.data);
    const all = WineHistory.getAll();
    const unlocked = JSON.parse(localStorage.getItem('vinterest_grape_unlocks_v1')).accounts.local.unlocked;
    return { text, done, count: all.length - mine.length, rating: WineHistory.find(first).rating,
      xp: XPSystem.get().total === xpBefore, event: XPSystem.get().events.includes('backup_only_event'), unlocked: Object.keys(unlocked).sort() };
  });
  expect(out.text).toContain('1 new wine, 1 merged with ones you have');
  expect(out.text).toContain('Nothing on this phone is lost.');
  expect(out.done).toEqual({ added: 1, updated: 1 });
  expect(out).toMatchObject({ count: 1, rating: 100, xp: true, event: true, unlocked: ['Nebbiolo', 'Sangiovese'] });
});

test('damaged or wrong files say what\'s wrong and change nothing', async ({ context, page }) => {
  await demo(context, page);
  const out = await page.evaluate(() => {
    const before = localStorage.getItem('vinterest_wines');
    const errs = ['not json {', '[1,2,3]', JSON.stringify({ hello: 'world' }), JSON.stringify({ format: 'vinterest-backup', version: 3, wines: [] }),
      JSON.stringify({ wines: 'oops' }), JSON.stringify({ wines: [], xp: { nope: true } })].map((t) => Backup.read(t).error);
    const partial = Backup.read(JSON.stringify({ wines: [{ name: 'Good' }, { nope: 1 }, null] }));
    return { errs, unchanged: localStorage.getItem('vinterest_wines') === before, skipped: partial.summary.skippedWines, text: Backup.describe(partial.summary) };
  });
  expect(out.errs).toEqual([
    'This file isn\'t a Vinterest backup: it isn\'t readable as a backup file at all.',
    'This file isn\'t a Vinterest backup.',
    'This file isn\'t a Vinterest backup: it has no wines or XP in it.',
    'This backup was made by a newer version of Vinterest. Update the app, then try again.',
    'The wines in this backup are damaged, so nothing was restored.',
    'The XP in this backup is damaged, so nothing was restored.',
  ]);
  expect(out.unchanged).toBe(true);
  expect(out.skipped).toBe(2);
  expect(out.text).toContain('2 damaged entries will be skipped.');
});

test('the welcome screen\'s Restore it asks with a summary before restoring; a bad file gets its own message', async ({ context, page }) => {
  // The one file import left: the welcome screen (WineDNA's Export/Import card went when signing in became the backup).
  const errors = collectErrors(page);
  await demo(context, page);
  const good = await page.evaluate(() => JSON.stringify({ ...Backup.exportData(), wines: [...WineHistory.getAll(), { name: 'From Backup Test', type: 'red', rating: 90 }] }));
  const context2 = await page.context().browser().newContext({ serviceWorkers: 'block' });
  const fresh = await context2.newPage();
  const freshErrors = collectErrors(fresh);
  await makeDeterministic(fresh);
  await stubNetwork(context2);
  await fresh.goto(`${BASE}/`);
  const dialogs = [];
  fresh.on('dialog', (d) => { dialogs.push(d.message()); d.type() === 'confirm' ? d.dismiss() : d.accept(); });
  const pick = async (text) => {
    const chooser = fresh.waitForEvent('filechooser');
    await fresh.getByTestId('welcome-restore').click();
    await (await chooser).setFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(text) });
    await expect.poll(() => dialogs.length).toBeGreaterThan(0);
  };
  await pick('{ broken');
  expect(dialogs.shift()).toContain('isn\'t a Vinterest backup');
  await pick(good);
  expect(dialogs.shift()).toMatch(/^Backup from \d{4}-\d{2}-\d{2}: \d+ new wines.*Restore it\?$/s);
  // Declined: nothing restored, still on the welcome screen.
  expect(await fresh.evaluate(() => WineHistory.getAll().length)).toBe(0);
  expect(await fresh.evaluate(() => location.hash)).not.toBe('#home');
  expect(errors).toEqual([]);
  expect(freshErrors).toEqual([]);
  await context2.close();
});
