// Filled pills and badges have text that contrasts with their fill, in both themes: never a colour on
// its own tint (crimson on a crimson wash) and never under 4.5:1 (white on the white-wine yellow).
// A solid fill takes white or near-black, whichever reads (inkOn in pwa-components.jsx); a tinted one
// takes the screen's own text colour. The check reads the rendered page, so a pill written anywhere
// is covered (tests/pill-contrast.helper.js).
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage } = require('./helpers');
const audit = require('./pill-contrast.helper');

const BASE = 'http://localhost:4173';

for (const theme of ['dark', 'light']) {
  test(`filled pills have contrasting text on the ${theme} stage`, async ({ context, page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 390, height: 844 });
    await makeDeterministic(page);
    await seedLocalStorage(page, { vinterest_wineDNA_unlock_seen: '1', vinterest_theme: theme });
    await stubNetwork(context);
    const found = {};
    for (const hash of ['home', 'mywines', 'learn', 'account', 'notices', 'mastery-map']) {
      await page.goto(`${BASE}/?demo=1#${hash}`); await page.waitForTimeout(500);
      found[hash] = await page.evaluate(audit);
    }
    // WineDNA, on every type tab that has wines.
    await page.goto(`${BASE}/?demo=1#profile`); await page.waitForTimeout(500);
    for (const tab of ['Red', 'White', 'Rosé', 'Sparkling']) {
      const t = page.locator('#root').getByText(tab, { exact: true }).first();
      if (await t.count()) { await t.click(); await page.waitForTimeout(300); found['winedna-' + tab] = await page.evaluate(audit); }
    }
    // A wine's own screen for each kind of wine there is, on its three tabs: the type pill is filled in the type's colour.
    const wines = await page.evaluate(() => { const all = WineHistory.getAll(); const by = {}; all.forEach((w) => { const t = WineDNA._t(w.type); if (!by[t]) by[t] = w; }); return Object.values(by); });
    for (const w of wines) {
      const type = w.type;
      await page.evaluate((w) => { WineHistory.save([w]); sessionStorage.setItem('vinterest_scan_result', JSON.stringify({ wine: w, existingRating: w.rating || 0 })); }, w);
      await page.goto(`${BASE}/?d=1&w=${encodeURIComponent(type)}#detail`); await page.waitForTimeout(500);
      await expect(page.locator('#root')).toContainText(w.name);
      found['detail-' + type] = await page.evaluate(audit);
      for (const tab of ['Learn', 'Shop']) { await page.locator('#root').getByText(tab, { exact: true }).first().click(); await page.waitForTimeout(250); found[`detail-${type}-${tab}`] = await page.evaluate(audit); }
    }
    const bad = Object.entries(found).flatMap(([where, xs]) => xs.map((x) => `${where}: "${x.text}" ${x.color} on ${x.fill} (${x.ratio}:1${x.sameHue ? ', its own colour' : ''})`));
    expect(bad, bad.join('\n')).toEqual([]);
  });
}
