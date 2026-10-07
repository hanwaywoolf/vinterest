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
  // The scan's moments wait for Home: one card above the navigation, with a next step.
  await expect(page.getByTestId('moment-card')).toContainText('Your first rosé wine');
  await expect(page.getByTestId('moment-card')).toContainText('2 more');
  await page.getByTestId('moment-card').getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByTestId('moment-card')).toContainText('Your first wine from France');
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
  expect(s).toEqual({ loc: { country: 'United States', state: 'Oregon', city: '' }, cur: 'USD', onboarded: '1' });
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
  // The note says it once and fades.
  await expect(page.locator('[data-saved-note]')).toHaveCSS('opacity', '0', { timeout: 6000 });
  // Back to the bottle: it shows the score already given (not the picker beside a meter that
  // already counts it), and forward again doesn't repeat the note.
  await page.locator('#root svg').first().click();
  await expect(root).toContainText('Your first bottle');
  for (let i = 0; i < 12 && !(await root.getByText('9 / 9', { exact: true }).isVisible()); i++) await next();
  await expect(root).toContainText('Scored 90 · Outstanding');
  await expect(root).not.toContainText('How was it?');
  await root.getByText('Continue', { exact: true }).click();
  await expect(root).toContainText('What do you usually drink?');
  await expect(root).not.toContainText('is saved in My Wines');
  expect(await page.evaluate(() => WineHistory.getAll().filter((w) => w.rating > 0).length)).toBe(1);
  expect(errors).toEqual([]);
});

// The welcome: five slides to swipe through (or Next), Skip to the last, then the scan. Each of
// the first four shows a preview of the real screen, fed the sample user in
// data/onboarding-sample.json; every slide fits a small and a tall phone without scrolling.
const WELCOME_TITLES = ['Scan a bottle. Know if it\'s for you.', 'Every bottle builds your WineDNA.', 'The right wine, wherever you\'re buying.',
  'Find out why you like what you like.', 'It gets better with every bottle.'];
for (const [w, h] of [[360, 640], [430, 932]]) {
  test(`the welcome slides at ${w}x${h}: Next through five, previews that fit, Skip to the last`, async ({ context, page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: w, height: h });
    await makeDeterministic(page);
    await stubNetwork(context);
    await page.goto(`${BASE}/`);
    const root = page.locator('#root');
    await expect(root.getByText(WELCOME_TITLES[0])).toBeInViewport();
    for (const title of WELCOME_TITLES.slice(1)) {
      await root.getByText('Next', { exact: true }).click();
      await expect(root.getByText(title)).toBeInViewport();
    }
    await expect(root.getByText('Next', { exact: true })).toHaveCount(0);
    await expect(root.getByText('Scan your first bottle')).toBeVisible();
    const fit = await page.evaluate(() => [...document.querySelectorAll('[aria-roledescription="carousel"] > div')].map((t) => t.scrollHeight - t.clientHeight));
    expect(fit).toEqual([0, 0, 0, 0, 0]);
    // No paywall talk in onboarding.
    await expect(root).not.toContainText('Pro');
    await page.reload();
    await root.getByText('Skip', { exact: true }).click();
    await expect(root.getByText(WELCOME_TITLES[4])).toBeInViewport();
    await expect(root).not.toContainText('Already have an account'); // no sign-in configured here
    expect(errors).toEqual([]);
  });
}

test('the welcome previews are pictures of the sample user: described, not tappable, never the reader\'s own wines', async ({ context, page }) => {
  await makeDeterministic(page);
  // Someone who reinstalled with wines on the phone: their bottles must not show in the previews.
  await seedLocalStorage(page, { vinterest_wines: JSON.stringify([{ name: 'My Own Secret Bottle', producer: 'Me', type: 'Red', rating: 95, grapes: ['Syrah'], region: 'Rioja' }]) });
  await stubNetwork(context);
  const calls = [];
  page.on('request', (r) => { if (/\/claude|\/me|supabase/.test(r.url())) calls.push(r.url()); });
  await page.goto(`${BASE}/`);
  const previews = page.locator('#root [role="img"]');
  await expect(previews).toHaveCount(4);
  const alts = await previews.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  expect(alts[0]).toContain('87% match');
  expect(alts[0]).toContain('Against it: Tannins');
  expect(alts[1]).toContain('WineDNA for reds');
  expect(alts[2]).toContain('Steak tonight. What should I look for?');
  // Vinny's answer is Vinny's own, asked once for the sample user, not written for the slide.
  expect(await page.evaluate(() => _WELCOME_SAMPLE.slides.vinny[0].source)).toBe('vinny');
  expect(alts[3]).toContain('From Rioja to Rhône Valley');
  const inside = await previews.evaluateAll((els) => els.map((e) => ({ hidden: e.firstChild.getAttribute('aria-hidden'), inert: e.firstChild.hasAttribute('inert'), pe: getComputedStyle(e.firstChild).pointerEvents, text: e.innerText })));
  for (const p of inside) {
    expect(p).toMatchObject({ hidden: 'true', inert: true, pe: 'none' });
    expect(p.text).not.toContain('My Own Secret Bottle');
  }
  // Slide 1 shows a reason for and a reason against.
  expect(inside[0].text).toContain('Syrah: you\'ve scored 2, averaging 90.');
  expect(inside[0].text).toContain('this one doesn\'t');
  expect(calls).toEqual([]);
});

// The previews show what the app's engines really produce for the sample user. If an engine
// changes what it says, this fails: regenerate with npm run sample:onboarding.
test('the sample user\'s previews are what the engines produce today', async ({ page }) => {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_region: 'uk', vinterest_currency: 'GBP' });
  await page.goto(`${BASE}/`);
  const out = await page.evaluate(() => {
    const S = _WELCOME_SAMPLE, u = S.user;
    const m = TasteMatch.assess(u.scanned, u.wines), p = WineDNA.profile('red', u.wines, 'Reds');
    return { pct: m.pct, label: m.label, reasons: m.reasons.map((r) => r.text), personality: p.personality, loved: p.loved.length,
      want: { pct: S.slides.match.pct, label: S.slides.match.label, reasons: S.slides.match.reasons.map((r) => r.text), personality: S.slides.dna.personality, loved: S.slides.dna.lovedCount } };
  });
  expect({ pct: out.pct, label: out.label, personality: out.personality, loved: out.loved }).toEqual({ pct: out.want.pct, label: out.want.label, personality: out.want.personality, loved: out.want.loved });
  for (const r of out.want.reasons) expect(out.reasons).toContain(r);
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

// Motion plays when a slide arrives; with reduced motion the previews are finished straight away.
test('the welcome previews animate, and reduced motion shows them finished at once', async ({ context, page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await makeDeterministic(page);
  await stubNetwork(context);
  await page.goto(`${BASE}/`);
  const previews = page.locator('#root [role="img"]');
  await expect(previews.nth(0)).toContainText('87%');
  const anim = await previews.evaluateAll((els) => els.map((e) => [...e.querySelectorAll('*')].some((n) => getComputedStyle(n).animationName !== 'none')));
  expect(anim).toEqual([false, false, false, false]);
  const vinny = await previews.nth(2).evaluate((e) => e.querySelector('.wp-caret') === null && e.innerText.includes(_WELCOME_SAMPLE.slides.vinny[0].a));
  expect(vinny).toBe(true);
  // The Vinny slide is the real Ask Vinny bar, after sending, over the sample user's Home.
  await expect(previews.nth(2)).toContainText('Ask a follow-up…');
  expect(await previews.nth(2).evaluate((e) => { const img = e.querySelector('img'); return img && img.getAttribute('src') === 'onboarding-home.jpg' && img.complete && img.naturalWidth > 0; })).toBe(true);
  // With motion: the match counts up from below 87 on arrival.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload();
  const early = await previews.nth(0).evaluate((e) => parseInt(e.innerText.match(/(\d+)%/)[1], 10));
  expect(early).toBeLessThan(87);
  await expect(previews.nth(0)).toContainText('87%');
});

// One swipe moves one slide, however hard: a fast drag across the whole screen, or a huge
// trackpad/wheel gesture, moves exactly one; a small drag settles back.
test('a big fling on the welcome slides moves one slide, not all of them', async ({ context, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await makeDeterministic(page);
  await stubNetwork(context);
  await page.goto(`${BASE}/`);
  const track = page.locator('[aria-roledescription="carousel"]');
  const at = () => track.evaluate((el) => Math.round(el.scrollLeft / el.clientWidth));
  const box = await track.boundingBox();
  const y = box.y + box.height / 2;
  // A hard flick right to left, across the whole screen in a few frames.
  await page.mouse.move(box.x + box.width - 5, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 5, y, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(900);
  expect(await at()).toBe(1);
  // A small nudge settles back.
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 25, y, { steps: 10 });
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(900);
  expect(await at()).toBe(1);
  // A huge trackpad swipe is one slide too.
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.wheel(4000, 0);
  await page.waitForTimeout(900);
  expect(await at()).toBe(2);
  // And back the other way, one at a time.
  await page.mouse.move(box.x + 5, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 5, y, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(900);
  expect(await at()).toBe(1);
  await expect(page.locator('#root').getByText('Every bottle builds your WineDNA.')).toBeInViewport();
});

// Real touch input (through the browser's own gesture handling): swipes go forward and back, one
// slide each, from anywhere on the slide, including over a preview.
test.describe('the welcome slides on a touch screen', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('swipe forward and back, one slide at a time', async ({ context, page }) => {
    await makeDeterministic(page);
    await stubNetwork(context);
    await page.goto(`${BASE}/`);
    const track = page.locator('[aria-roledescription="carousel"]');
    const at = () => track.evaluate((el) => Math.round(el.scrollLeft / el.clientWidth));
    const cdp = await context.newCDPSession(page);
    const swipe = async (x0, y, dx, ms) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
      for (let i = 1; i <= 8; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dx * i / 8, y: y + i }] });
        await page.waitForTimeout(ms / 8);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(700);
    };
    await swipe(330, 500, -220, 200); // over the preview
    expect(await at()).toBe(1);
    await swipe(330, 300, -260, 120); // a hard flick
    expect(await at()).toBe(2);
    await swipe(60, 500, 220, 200); // back
    expect(await at()).toBe(1);
    await swipe(60, 300, 260, 120); // and back again
    expect(await at()).toBe(0);
    await swipe(60, 300, 260, 120); // nothing before the first
    expect(await at()).toBe(0);
  });
});

// The last slide: the red dot walks down the timeline when the slide arrives.
test('the timeline dot moves from the first bottle to every bottle after', async ({ context, page }) => {
  await makeDeterministic(page);
  await stubNetwork(context);
  await page.goto(`${BASE}/`);
  await page.locator('#root').getByText('Skip', { exact: true }).click();
  const step = () => page.locator('[data-step]').getAttribute('data-step');
  await expect.poll(step).toBe('0');
  await expect.poll(step, { timeout: 5000 }).toBe('2');
});
