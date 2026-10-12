const { test } = require('@playwright/test');
const h = require('./helpers');
test('tuscany', async ({ page }) => {
  await h.stubNetwork(page);
  await page.goto('http://localhost:4173/');
  await page.evaluate(() => { localStorage.setItem('vinterest_onboarded', '1'); });
  await page.goto('http://localhost:4173/#home');
  await page.evaluate(() => {
    WineHistory.add({ name: 'Biondi-Santi Brunello di Montalcino 2016', producer: 'Biondi-Santi', region: 'Tuscany', sub_region: 'Montalcino', country: 'Italy', type: 'red', grapes: ['Sangiovese'], rating: 97 });
    WineHistory.add({ name: 'Ornellaia 2018', producer: 'Ornellaia', region: 'Bolgheri', country: 'Italy', type: 'red', grapes: ['Cabernet Sauvignon', 'Merlot'], rating: 94 });
    Handoff.regionPage.set('Tuscany'); location.hash = '#region-page';
  });
  await page.waitForTimeout(1200);
  await page.getByText('Grapes and wines').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'shots/tuscany-dark.png' });
  await page.evaluate(() => Settings.setTheme && Settings.setTheme('light'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'shots/tuscany-light.png' });
});
