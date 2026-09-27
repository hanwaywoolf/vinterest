// Onboarding: welcome → age + location → first scan → three questions → Home. No sign-up or
// paywall; only answers the app uses (UserPrefs), and each one changes something.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const ROSE = { name: 'Minuty Prestige Rosé', confidence: 'high', producer: 'Château Minuty', vintage: 2023, region: 'Provence', country: 'France',
  type: 'rosé', grapes: ['Grenache', 'Cinsault'], body: 0.35, acidity: 0.65, sweetness: 0.05, price_usd: 28 };

test.use({ locale: 'en-GB', timezoneId: 'Europe/London' });

test('a new user: age and location, first scan, three questions, then Home on their type', async ({ context, page }) => {
  const errors = collectErrors(page);
  await makeDeterministic(page);
  await stubNetwork(context, { claudeText: (b) => (b.purpose === 'label_scan' ? JSON.stringify(ROSE) : '') });
  await page.goto(`${BASE}/`);
  const root = page.locator('#root');
  await root.getByText('Get started').click();
  // The country is guessed from the phone's time zone; Continue waits for the age confirmation.
  await expect(page.getByLabel('Country')).toHaveValue('United Kingdom');
  await expect(root).toContainText('Prices will show in £ (GBP)');
  await expect(root.getByRole('button', { name: 'Continue' })).toHaveAttribute('aria-disabled', 'true');
  await root.getByText('I\'m of legal drinking age where I live').click();
  await root.getByRole('button', { name: 'Continue' }).click();
  await page.getByTestId('scan-file').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
  await expect(root).toContainText('Minuty Prestige Rosé is saved in My Wines.');
  // The scan's XP toasts wait for Home instead of covering the questions.
  await expect(root).not.toContainText('Wine scanned');
  await root.getByText('Rosé', { exact: true }).click();
  await root.getByRole('button', { name: 'Continue' }).click();
  await root.getByText('£12 – £25').click();
  await root.getByRole('button', { name: 'Continue' }).click();
  await root.getByText('Pretty into it').click();
  await root.getByRole('button', { name: 'Start exploring' }).click();
  await expect(root).toContainText('Your rosé sommelier script');
  await expect(root).toContainText('Take the Rosé basics quiz'); // their own type is the first gap
  await expect(root).toContainText('Wine scanned');
  for (const t of ['Create account', 'Continue with Google', 'Start Pro', 'How often do you drink', 'What are you here for']) await expect(root).not.toContainText(t);
  const state = await page.evaluate(() => ({ prefs: UserPrefs.get(), region: localStorage.getItem('vinterest_region'), age: UserPrefs.ageConfirmed(),
    onboarded: localStorage.getItem('vinterest_onboarded'), wines: WineHistory.getAll().map((w) => w.name) }));
  expect(state).toEqual({ prefs: { types: ['rose'], budget: 'mid', experience: 'enthusiast' }, region: 'uk', age: true, onboarded: '1', wines: ['Minuty Prestige Rosé'] });
  expect(errors).toEqual([]);
});

test('under age stops there; the scan and the questions can be skipped', async ({ context, page }) => {
  await makeDeterministic(page);
  await stubNetwork(context);
  await page.goto(`${BASE}/`);
  const root = page.locator('#root');
  await root.getByText('Get started').click();
  await root.getByText('I\'m not', { exact: true }).click();
  await expect(root).toContainText('only for people of legal drinking age');
  await root.getByText('Go back').click();
  await page.getByLabel('Country').selectOption('United States');
  await page.getByLabel('State').fill('Oregon');
  await root.getByText('I\'m of legal drinking age where I live').click();
  await root.getByRole('button', { name: 'Continue' }).click();
  await root.getByText('Skip', { exact: true }).click();
  await root.getByText('Skip', { exact: true }).click();
  await expect(root.getByText('My Wines')).toBeVisible();
  const s = await page.evaluate(() => ({ loc: UserPrefs.location(), cur: Regional.current().code, onboarded: localStorage.getItem('vinterest_onboarded') }));
  expect(s).toEqual({ loc: { country: 'United States', state: 'Oregon' }, cur: 'USD', onboarded: '1' });
});

test('what the answers change: price fallbacks, spend on the scan result, Learn depth', async ({ context, page }) => {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_wineDNA_unlock_seen: '1', vinterest_prefs: JSON.stringify({ types: ['white'], budget: 'mid', experience: 'expert' }) });
  await stubNetwork(context);
  await page.goto(`${BASE}/?demo=1#home`);
  const out = await page.evaluate(() => {
    const gbp = { code: 'GBP', base: '£' }, eur = { code: 'EUR', base: '€' };
    return {
      script: SommelierScript.budget([], gbp),
      travel: UserPrefs.budget(eur).label,
      fit: [10, 20, 40].map((p) => UserPrefs.spendFit(p, gbp)),
      depth: UserPrefs.depthLine(),
      skips: UserPrefs.skipsOnRamp(),
    };
  });
  expect(out.script).toBe('£12–£25 GBP');
  expect(out.travel).toBe(`€${Math.round(12 * 0.92 / 0.79)}–€${Math.round(25 * 0.92 / 0.79)}`);
  expect(out.fit).toEqual(['below', 'within', 'above']);
  expect(out.depth).toContain('very knowledgeable');
  expect(out.skips).toBe(true);
  // Experts get their Learn shelf without the beginner on-ramp first.
  await page.evaluate(() => localStorage.setItem('vinterest_gen_stubs', JSON.stringify([{ id: 'ev_x', archetypeId: 'region_rules', readTime: '3 min', title: 'The Rules Behind Rioja', subtitle: 'x', slots: { region: 'Rioja' } }])));
  await page.goto(`${BASE}/?demo=1#learn`);
  await expect(page.locator('#root')).toContainText('The Rules Behind Rioja');
  // The profile shows only what's used, each with what it changes.
  await page.goto(`${BASE}/?demo=1#account`);
  const root = page.locator('#root');
  for (const t of ['Where You Buy Wine', 'What You Drink', 'Usual Spend', 'Wine Knowledge', 'Home and WineDNA open on your first pick']) await expect(root).toContainText(t);
  for (const t of ['How Often You Drink', 'Why You\'re Here', 'City']) await expect(root).not.toContainText(t);
});
