// The free allowance (5 grapes, 5 regions) holds however unlocks came to be stored: unlocked
// while Pro was on, or merged in from another phone by sync or a backup. The first five by unlock
// time stay open, the rest are held with their progress and open again with Pro.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage } = require('./helpers');

const BASE = 'http://localhost:4173';
const GRAPES = ['Tempranillo', 'Sangiovese', 'Grenache', 'Chenin Blanc', 'Pinot Grigio', 'Cabernet Sauvignon'];
const REGIONS = ['Rioja', 'Tuscany', 'Provence', 'Bordeaux', 'Burgundy', 'Piedmont', 'Champagne'];
const store = (names) => JSON.stringify({ version: 1, accounts: { local: { unlocked: Object.fromEntries(names.map((n, i) => [n, { at: 1000 + i }])) } } });

test('six stored grapes and seven regions on the free plan: five of each open, the rest held for Pro', async ({ context, page }) => {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk', vinterest_grape_unlocks_v1: store(GRAPES), vinterest_region_unlocks_v1: store(REGIONS) });
  await stubNetwork(context);
  await page.goto(`${BASE}/#learn`);
  const out = await page.evaluate(() => {
    const free = { grapes: Object.keys(GrapeUnlocks.all()), heldG: GrapeUnlocks.held(), cab: GrapeUnlocks.isUnlocked('Cabernet Sauvignon'),
      regions: Object.keys(RegionUnlocks.all()), heldR: RegionUnlocks.held(), champagne: RegionUnlocks.isUnlocked('Champagne'),
      more: GrapeUnlocks.unlockViaRating('Merlot') };
    Store.set('vinterest_pro', '1');
    const pro = { grapes: GrapeUnlocks.count(), cab: GrapeUnlocks.isUnlocked('Cabernet Sauvignon'), regions: RegionUnlocks.count() };
    Store.remove('vinterest_pro');
    return { free, pro };
  });
  expect(out.free).toEqual({ grapes: GRAPES.slice(0, 5), heldG: ['Cabernet Sauvignon'], cab: false,
    regions: REGIONS.slice(0, 5), heldR: ['Piedmont', 'Champagne'], champagne: false, more: false });
  expect(out.pro).toEqual({ grapes: 6, cab: true, regions: 7 });
  await expect(page.locator('#root')).toContainText('5 of 50 unlocked · your 5 free grapes are open, 1 more waiting for Pro');
});
