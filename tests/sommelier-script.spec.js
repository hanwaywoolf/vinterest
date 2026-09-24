// Home and WineDNA show the same sommelier script, generated once, with a budget computed from
// the scanned wines' prices rather than invented by the model.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';

test('Home and WineDNA show the identical script and budget for reds', async ({ context, page }) => {
  const claudeRequests = [];
  // The stub echoes whatever budget the prompt dictates, like a well-behaved model would.
  await stubNetwork(context, {
    claudeRequests,
    claudeText: (body) => {
      if (body.purpose !== 'sommelier_script') return '';
      const prompt = body.messages[0].content;
      const budget = (/written exactly as "([^"]+)"/.exec(prompt) || [])[1];
      if (prompt.startsWith('Condense')) return `"Short: ${(/budget.*?"([^"]*\d[^"]*)"/.exec(prompt) || [])[1] || budget || ''}"`;
      return `"I love structured reds; I usually spend ${budget}."`;
    },
  });
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_wineDNA_unlock_seen: '1', vinterest_script_length: 'long' });
  const errors = collectErrors(page);

  await page.goto(`${BASE}/?demo=1#home`);
  const expected = await page.evaluate(() => {
    const reds = WineHistory.getAll().filter((w) => (w.type || '').toLowerCase() === 'red');
    return SommelierScript.budget(reds, Regional.current());
  });
  expect(expected).toMatch(/^£\d+–£\d+ GBP$/);
  const homeScript = page.locator('#root').getByText(/I love structured reds/);
  await expect(homeScript).toContainText(expected);
  const homeText = await homeScript.innerText();

  await page.locator('#root').getByText('WineDNA', { exact: true }).last().click();
  const dnaScript = page.locator('#root').getByText(/I love structured reds/);
  await expect(dnaScript).toBeVisible();
  expect(await dnaScript.innerText()).toBe(homeText);
  // Generated once and shared, not once per screen.
  expect(claudeRequests.filter((r) => r.purpose === 'sommelier_script' && !r.messages[0].content.startsWith('Condense') && /scanned these reds? wines/.test(r.messages[0].content))).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('the budget is the middle of the scanned prices, rounded outward', async ({ page }) => {
  await page.goto(`${BASE}/?demo=1#home`);
  const out = await page.evaluate(() => {
    const rc = { base: '$', code: 'USD' };
    const w = (p) => ({ price_usd: p });
    return {
      spread: SommelierScript.budget([w(12), w(22), w(28), w(35), w(90)], rc),
      one: SommelierScript.budget([w(30)], rc),
      none: SommelierScript.budget([{}, {}], rc),
      gbp: SommelierScript.budget([w(20), w(40)], { base: '£', code: 'GBP' }),
    };
  });
  expect(out.spread).toBe('$20–$35 USD');
  expect(out.one).toBe('around $30 USD');
  expect(out.none).toBeNull();
  expect(out.gbp).toBe('£15–£35 GBP');
});

// The bug: a first red scored 94 that cost £90 (label estimate £70), with "£12–£25" given at
// onboarding, produced a script saying £12–£25. Their own wine wins, at what they paid.
test('the budget comes from their own wines: price paid first, wines they disliked left out', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('vinterest_prefs', JSON.stringify({ budget: 'mid' })));
  await page.goto(`${BASE}/?demo=1#home`);
  const out = await page.evaluate(() => {
    const rc = { base: '£', code: 'GBP' };
    const fx = USD_FX.GBP;
    const riojaAlta = { name: '904', rating: 94, price_usd: 70 / fx, price_paid: { amount: 90, code: 'GBP' } };
    return {
      first: SommelierScript.budget([riojaAlta], rc),
      disliked: SommelierScript.budget([riojaAlta, { rating: 66, price_usd: 10 / fx }], rc),
      shelfCheck: SommelierScript.budget([{ price_usd: 300 / fx, scan_intent: 'checking' }], rc),
      noPrices: SommelierScript.budget([{ rating: 90 }], rc),
    };
  });
  expect(out.first).toBe('around £90 GBP');
  expect(out.disliked).toBe('around £90 GBP');
  // A bottle only looked at on a shelf isn't their budget; with nothing priced, onboarding stands in.
  expect(out.shelfCheck).toBe('£12–£25 GBP');
  expect(out.noPrices).toBe('£12–£25 GBP');
});
