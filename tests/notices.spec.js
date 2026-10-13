// The inbox behind the bell on Home (Notices, pwa-notices.js): what the app has to say is written
// from what it already knows, told once, read when opened, and a category switched off on Profile
// writes nothing new.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';
const root = (page) => page.locator('#root');
const DAY = 24 * 3600 * 1000;
// The page's clock is fixed (makeDeterministic), so "20 days ago" is counted from that, not from now.
const NOW = new Date('2026-06-15T12:00:00Z').getTime();

const WINES = [
  // Tasted 20 days ago, never rated: a reminder to rate it, and the last scan is a while ago.
  { name: 'Viña Ardanza', vintage: 2016, region: 'Rioja', country: 'Spain', type: 'red', grapes: ['Tempranillo'], rating: 0, scan_intent: 'tasted',
    scanned_at: new Date(NOW - 20 * DAY).toISOString(), last_scanned: new Date(NOW - 20 * DAY).toISOString() },
  { name: 'Gran Reserva 904', vintage: 2011, region: 'Rioja', country: 'Spain', type: 'red', grapes: ['Tempranillo'], rating: 95,
    scanned_at: new Date(NOW - 25 * DAY).toISOString() },
];

async function user(context, page, seed = {}) {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk', vinterest_wineDNA_unlock_seen: '1',
    vinterest_prefs: JSON.stringify({ types: ['red'], budget: 'mid', experience: 'expert' }), vinterest_wines: JSON.stringify(WINES), ...seed });
  await stubNetwork(context);
}

test('the bell counts what the app has to say; opening one reads it and lands on the thing', async ({ context, page }) => {
  await user(context, page);
  const errors = collectErrors(page);
  await page.goto(`${BASE}/#home`);
  await expect(root(page)).toContainText('Recently scanned');
  // Notices.check runs a moment after a calm screen opens.
  await expect(page.getByTestId('notice-count')).toHaveText('2');
  const list = await page.evaluate(() => Notices.list().map((n) => [n.id, n.type, n.title, n.read]));
  expect(list).toEqual(expect.arrayContaining([
    ['rate:viña ardanza|2016', 'reminder', 'Rate the Viña Ardanza 2016', false],
    [expect.stringMatching(/^lapse:\d{4}-\d{2}-\d{2}$/), 'reminder', '20 days since your last scan', false],
  ]));
  // No XP pill in Home's header any more: the bell has its slot (XP still reads in Your knowledge).
  expect(await page.evaluate(() => [...document.querySelectorAll('#root span')].filter((s) => /^\d+ XP$/.test(s.textContent) && s.style.fontSize === '15px').length)).toBe(0);

  await page.getByTestId('notice-bell').click();
  await expect(page.getByTestId('screen-notices')).toContainText('Notifications');
  await expect(page.getByTestId('screen-notices')).toContainText('Rate the Viña Ardanza 2016');
  await expect(page.getByTestId('screen-notices')).toContainText('Reminders · ');
  await page.getByTestId('notice-rate:viña ardanza|2016').click();
  // The bottle's own screen, on its rating.
  await expect(root(page)).toContainText('Viña Ardanza');
  await expect(page).toHaveURL(/#identified/);
  expect(await page.evaluate(() => Notices.unread())).toBe(1);
  expect(await page.evaluate(() => Notices.list().find((n) => n.id.startsWith('rate:')).read)).toBe(true);

  // Rating it takes the reminder away on the next check.
  await page.evaluate(() => { WineHistory.rate('Viña Ardanza', 2016, 90); Notices.check(); });
  expect(await page.evaluate(() => Notices.list().map((n) => n.id).filter((id) => id.startsWith('rate:')))).toEqual([]);

  // Mark all read from the list.
  await page.goto(`${BASE}/#notices`);
  await page.getByText('Mark all read', { exact: true }).click();
  expect(await page.evaluate(() => Notices.unread())).toBe(0);
  await expect(page.getByTestId('screen-notices')).not.toContainText('Mark all read');
  expect(errors).toEqual([]);
});

test('a category switched off on Profile writes nothing new; a milestone and a fading set are told once', async ({ context, page }) => {
  await user(context, page);
  await page.goto(`${BASE}/#account`);
  await expect(page.getByTestId('notify-control')).toContainText('Reminders');
  await page.getByRole('switch', { name: 'Reminders' }).click();
  expect(await page.evaluate(() => Notices.prefs())).toEqual({ content: true, progress: true, reminder: false });
  await page.evaluate(() => { localStorage.removeItem('vinterest_notices'); Notices.check(); });
  expect(await page.evaluate(() => Notices.list().filter((n) => n.type === 'reminder'))).toEqual([]);
  // It's a setting: backed up and synced.
  expect(await page.evaluate(() => Backup.SETTINGS_KEYS.includes(Notices.PREFS_KEY) && Backup._isProgressKey(Notices.KEY))).toBe(true);

  // A milestone reached now is told once, with its own time; the same milestone again isn't.
  const added = await page.evaluate(() => {
    localStorage.setItem('vinterest_milestones', JSON.stringify({ 'overall:25': { at: Date.now() - 3600 * 1000, title: 'Wine knowledge 25%', icon: 'book' }, 'overall:0': { at: 0, title: 'Earlier', icon: 'book' } }));
    Notices.check(); const a = Notices.list().length; Notices.check(); return [a, Notices.list().length, Notices.list()[0]];
  });
  expect(added[0]).toBe(1); expect(added[1]).toBe(1);
  expect(added[2]).toMatchObject({ id: 'milestone:overall:25', type: 'progress', title: 'Wine knowledge 25%', link: { screen: 'mastery-map' } });
  expect(await page.evaluate(() => Notices.when(Date.now() - 3600 * 1000))).toBe('1h ago');
  // Two phones: combined key by key, read on either is read on both.
  expect(await page.evaluate(() => Backup._combine({ items: { a: { read: false, at: 1 } } }, { items: { a: { read: true, at: 1 }, b: { read: false, at: 2 } } }))).toEqual({ items: { a: { read: true, at: 1 }, b: { read: false, at: 2 } } });
});
