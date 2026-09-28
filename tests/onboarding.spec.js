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
  await root.getByText('Skip', { exact: true }).click();
  await root.getByText('Scan your first bottle').click();
  // The country is guessed from the phone's time zone; Continue waits for the age confirmation.
  await expect(page.getByLabel('Country')).toHaveValue('United Kingdom');
  await expect(root).toContainText('Prices will show in £ (GBP)');
  await expect(root.getByRole('button', { name: 'Continue' })).toHaveAttribute('aria-disabled', 'true');
  await root.getByText('I\'m of legal drinking age where I live').click();
  await root.getByRole('button', { name: 'Continue' }).click();
  await page.getByTestId('scan-file').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
  // The first scan opens its own story (FirstScanStory); skippable straight to the questions.
  await expect(root).toContainText('Your first bottle');
  await root.getByText('Skip', { exact: true }).click();
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
  await root.getByText('Skip', { exact: true }).click();
  await root.getByText('Scan your first bottle').click();
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

// The first scan is the end of onboarding: its story shows what the app will do, on the cards
// where each feature belongs, and ends on the first score.
test('the first scan tells the bottle\'s story and shows what Vinterest will do with it', async ({ context, page }) => {
  const errors = collectErrors(page);
  await makeDeterministic(page);
  await stubNetwork(context, { claudeText: (b) => (b.purpose === 'label_scan' ? JSON.stringify(ROSE) : '') });
  await page.goto(`${BASE}/`);
  const root = page.locator('#root');
  await root.getByText('Skip', { exact: true }).click();
  await root.getByText('Scan your first bottle').click();
  await root.getByText('I\'m of legal drinking age where I live').click();
  await root.getByRole('button', { name: 'Continue' }).click();
  await page.getByTestId('scan-file').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
  await expect(root).toContainText('Your first bottle');
  // Card 1: the match, before there's anything to match against, with a labelled example.
  await expect(root).toContainText('Your match, from your own taste');
  await expect(root).toContainText('Your WineDNA starts with your first score');
  await expect(root).toContainText('Example');
  await expect(root).toContainText('Score 3 rosés and every rosé you scan shows how much you\'ll like it');
  const next = async () => { await page.locator('.sc-swipe > div').last().locator('> div').last().click(); await page.waitForTimeout(250); };
  const seen = new Set();
  for (let i = 0; i < 12 && !(await root.getByText('9 / 9', { exact: true }).isVisible()); i++) {
    for (const t of ['This card gets personal', 'Open in Learn now', 'Why play Blind Call', 'Your sommelier script', 'Know a good price']) if (await root.getByText(t, { exact: true }).first().isVisible().catch(() => false)) seen.add(t);
    if (await root.getByText('This scan opened the Grenache quiz and the Provence quiz.').isVisible().catch(() => false)) seen.add('unlocks named');
    await next();
  }
  expect([...seen].sort()).toEqual(['Know a good price', 'Open in Learn now', 'This card gets personal', 'Why play Blind Call', 'Your sommelier script', 'unlocks named']);
  // The last card: the WineDNA meter, the first score, then on to the questions.
  await root.getByText('90', { exact: true }).click();
  await root.getByText('Save rating').click();
  await expect(root).toContainText('Scored 90 · Outstanding');
  await root.getByText('Continue', { exact: true }).click();
  await expect(root).toContainText('Minuty Prestige Rosé is saved in My Wines.');
  expect(await page.evaluate(() => WineHistory.getAll()[0].rating)).toBe(90);
  expect(errors).toEqual([]);
});

// The welcome: four tiles to swipe through (or Next), Skip to the last, then the scan. Every tile
// fits the smallest phone at Extra large text without scrolling.
test('the welcome tiles: Next through four, Skip to the last, and each fits a small phone, at set sizes Extra large doesn\'t change', async ({ context, page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await makeDeterministic(page);
  await page.addInitScript(() => localStorage.setItem('vinterest_text_size', 'xl'));
  await stubNetwork(context);
  await page.goto(`${BASE}/`);
  const root = page.locator('#root');
  await expect(root).toContainText('Know you\'ll love it before you pour');
  for (const title of ['The right bottle, wherever you are', 'Learn from what\'s in your glass', 'Like good wine, it gets better with time']) {
    await root.getByText('Next', { exact: true }).click();
    await expect(root.getByText(title)).toBeInViewport();
  }
  await expect(root.getByText('Next', { exact: true })).toHaveCount(0);
  await expect(root.getByText('Scan your first bottle')).toBeVisible();
  const fit = await page.evaluate(() => [...document.querySelectorAll('[aria-roledescription="carousel"] > div')].map((t) => t.scrollHeight - t.clientHeight));
  expect(fit).toEqual([0, 0, 0, 0]);
  // Set sizes: Extra large leaves the tiles' text as designed.
  expect(await root.getByText('Your WineDNA').first().evaluate((e) => getComputedStyle(e).fontSize)).toBe('18px');
  // Skip from the first tile lands on the last.
  await page.reload();
  await root.getByText('Skip', { exact: true }).click();
  await expect(root.getByText('Like good wine, it gets better with time')).toBeInViewport();
  // No sign-in configured: no "Already have an account?".
  await expect(root).not.toContainText('Already have an account');
});

async function welcomeSignIn(context, page, { returning, ok = true }) {
  await makeDeterministic(page);
  await page.addInitScript(() => { window.VINTEREST_SUPABASE = { url: 'https://proj.supabase.co', key: 'sb_publishable_test' }; });
  await stubNetwork(context);
  await context.route('https://proj.supabase.co/auth/v1/**', (route) => {
    const url = route.request().url();
    const reply = (b) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(b) });
    if (url.endsWith('/otp')) return reply({});
    if (url.endsWith('/verify')) return reply({ access_token: 'acc-1', refresh_token: 'ref-1', expires_in: 3600, user: { id: 'u1', email: 'a@b.c' } });
    return reply({});
  });
  await context.route('**/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ signedIn: true, tier: 'free' }) }));
  await page.goto(`${BASE}/`);
  // The account's data coming down (Sync is covered by tests/sync.spec.js): a returning account
  // brings its wines and the onboarded flag with it.
  await page.evaluate(({ returning, ok }) => {
    Sync.syncNow = async () => {
      if (!ok) return { ok: false };
      if (returning) { Store.set('vinterest_onboarded', '1'); Store.set('vinterest_age_ok', '1'); Store.set('vinterest_region', 'uk');
        Store.setJSON('vinterest_wines', [{ name: 'Test Rioja', vintage: 2019, type: 'red', score: 92, date: new Date().toISOString() }]); }
      return { ok: true };
    };
  }, { returning, ok });
  const root = page.locator('#root');
  await root.getByText('Sign in', { exact: true }).click();
  await expect(root).toContainText('Welcome back');
  await page.getByLabel('Email address').fill('a@b.c');
  await root.getByText('Email me a code').click();
  await page.getByLabel('Sign-in code').fill('123456');
  await root.getByText('Sign in', { exact: true }).click();
  return root;
}

test('a returning user signs in from the welcome and lands on Home with their wines', async ({ context, page }) => {
  const errors = collectErrors(page);
  const root = await welcomeSignIn(context, page, { returning: true });
  await expect(root).toContainText('Recently scanned');
  await expect(root).toContainText('Test Rioja');
  expect(await page.evaluate(() => Account.signedIn())).toBe(true);
  expect(errors).toEqual([]);
});

test('a new account signed in from the welcome carries on with onboarding; no signal offers to carry on', async ({ context, page }) => {
  let root = await welcomeSignIn(context, page, { returning: false });
  await expect(root).toContainText('I\'m of legal drinking age where I live');
  await page.evaluate(() => { Store.remove('vinterest_session'); });
  root = await welcomeSignIn(context, page, { returning: false, ok: false });
  await expect(root).toContainText('We couldn\'t reach your account just now');
  await root.getByText('Continue without them for now').click();
  await expect(root).toContainText('I\'m of legal drinking age where I live');
});
