// "Find it online": the search query and how it opens.
const { test, expect } = require('@playwright/test');
const { stubNetwork, seedLocalStorage } = require('./helpers');

const BASE = 'http://localhost:4173';

test('queries name the bottle once, add wine/buy, drop "near me", and set the country', async ({ page }) => {
  await page.goto(`${BASE}/?demo=1#home`);
  const out = await page.evaluate(() => {
    const q = (w) => FindOnline.query(w);
    const uk = FindOnline.url({ name: 'Etna Rosso', producer: 'Pietradolce', vintage: '2021' });
    localStorage.setItem('vinterest_region', 'us');
    const us = FindOnline.url({ name: 'Etna Rosso', producer: 'Pietradolce', vintage: '2021' });
    return {
      dupProducer: q({ name: 'Muga Selección Especial Rioja', producer: 'Muga', vintage: 2021 }),
      accentDup: q({ name: 'Chateau Fargueirol Jean XXII', producer: 'Château Fargueirol (Jean XXII)', vintage: 2020 }),
      nv: q({ name: 'Brut Réserve', producer: 'Charles Heidsieck', vintage: 'NV' }),
      withWine: q({ name: 'Tokaji Aszú 5 Puttonyos Wine', producer: 'Royal Tokaji', vintage: '2017' }),
      uk, us,
    };
  });
  expect(out.dupProducer).toBe('Muga Selección Especial Rioja 2021 wine buy');
  expect(out.accentDup).toBe('Chateau Fargueirol Jean XXII 2020 wine buy');
  expect(out.nv).toBe('Charles Heidsieck Brut Réserve wine buy');
  expect(out.withWine).toBe('Royal Tokaji Tokaji Aszú 5 Puttonyos Wine 2017 buy');
  expect(out.uk).toBe('https://www.google.com/search?q=Pietradolce%20Etna%20Rosso%202021%20wine%20buy&gl=gb');
  expect(out.us).toContain('&gl=us');
  expect(out.uk).not.toContain('near%20me');
});

test('Find it online opens a normal new tab (a link, not a popup window)', async ({ context, page }) => {
  await stubNetwork(context, {
    claudeText: (b) => (b.purpose === 'explore'
      ? JSON.stringify({ wines: [{ tier: 'value', name: 'Etna Rosso', producer: 'Pietradolce', vintage: '2021', price_local: 24, why: 'Classic.' }] })
      : ''),
  });
  await seedLocalStorage(page, { vinterest_wineDNA_unlock_seen: '1' });
  await page.goto(`${BASE}/?demo=1#profile`);
  await page.evaluate(() => { window.__opened = []; const o = window.open; window.open = (...a) => { window.__opened.push(a); return o.apply(window, a); }; });
  await page.locator('#root').getByText(/Learn about it & find a bottle/).first().click();
  const [tab] = await Promise.all([context.waitForEvent('page'), page.locator('#root').getByText('Find it online', { exact: true }).first().click()]);
  expect(tab.url()).toContain('google.com/search?q=Pietradolce%20Etna%20Rosso%202021%20wine%20buy');
  expect(await page.evaluate(() => window.__opened.length)).toBe(0);
});
