// The app-review sign-in: with REVIEWER_EMAIL and REVIEWER_CODE set, that one address signs in
// with its fixed code (the emailed code can't be read by a store reviewer); unset, the route
// doesn't exist; and ordinary sign-in is unchanged. Supabase is a fake.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { stubNetwork, makeDeterministic, seedLocalStorage } = require('./helpers');

const BASE = 'http://localhost:4173';
const SB = 'https://proj.supabase.co';

async function loadWorker() {
  const copy = path.join(require('node:os').tmpdir(), `worker-reviewer-${process.pid}.mjs`);
  require('node:fs').copyFileSync(path.join(__dirname, '..', '_worker.js'), copy);
  return (await import(pathToFileURL(copy).href)).default;
}

test.describe('Worker', () => {
  let worker, realFetch, ip = 0;
  const env = { ANTHROPIC_API_KEY: 'k', SUPABASE_URL: SB, SUPABASE_PUBLISHABLE_KEY: 'pub', SUPABASE_SECRET_KEY: 'sec', REVIEWER_EMAIL: 'Review@Vinterest.app', REVIEWER_CODE: '482915' };
  const login = (body, e = env) => worker.fetch(new Request('https://vinterest.pages.dev/reviewer/login', { method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://vinterest.pages.dev', 'cf-connecting-ip': '10.2.0.' + (++ip) }, body: JSON.stringify(body) }), e);
  test.beforeAll(async () => { worker = await loadWorker(); realFetch = globalThis.fetch; });
  test.afterEach(() => { globalThis.fetch = realFetch; });

  function fakeSb({ verifyTypes = ['magiclink', 'email'] } = {}) {
    const calls = [];
    globalThis.fetch = async (url, init = {}) => {
      url = String(url); const h = new Headers(init.headers || {});
      const body = init.body ? JSON.parse(init.body) : null;
      calls.push({ url, apikey: h.get('apikey'), body });
      const res = (st, b) => new Response(JSON.stringify(b), { status: st, headers: { 'content-type': 'application/json' } });
      if (url === `${SB}/auth/v1/admin/generate_link`) return res(200, { email_otp: '918273' });
      if (url === `${SB}/auth/v1/verify`) return verifyTypes.includes(body.type) && body.token === '918273'
        ? res(200, { access_token: 'at', refresh_token: 'rt', expires_in: 3600, expires_at: 9999999999, user: { id: 'u-rev', email: body.email, secret_field: 'x' } })
        : res(400, {});
      return res(404, {});
    };
    return calls;
  }

  test('the right address and code get a session; the one-time code is made with the secret key and spent with the public one', async () => {
    const calls = fakeSb();
    const r = await login({ email: ' review@vinterest.app ', code: '482915' });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, expires_at: 9999999999, user: { id: 'u-rev', email: 'review@vinterest.app' } });
    expect(calls[0]).toMatchObject({ url: `${SB}/auth/v1/admin/generate_link`, apikey: 'sec', body: { type: 'magiclink', email: 'review@vinterest.app' } });
    expect(calls[1]).toMatchObject({ url: `${SB}/auth/v1/verify`, apikey: 'pub', body: { type: 'magiclink', token: '918273' } });
  });

  test('it falls back to the "email" type when Supabase only accepts that one', async () => {
    const calls = fakeSb({ verifyTypes: ['email'] });
    expect((await login({ email: 'review@vinterest.app', code: '482915' })).status).toBe(200);
    expect(calls.filter((c) => c.url.endsWith('/verify')).map((c) => c.body.type)).toEqual(['magiclink', 'email']);
  });

  test('a wrong code, a wrong address or a different account is refused without asking Supabase for anything', async () => {
    const calls = fakeSb();
    for (const b of [{ email: 'review@vinterest.app', code: '000000' }, { email: 'someone@else.com', code: '482915' }, { email: 'someone@else.com', code: '000000' }, {}]) {
      const r = await login(b);
      expect(r.status).toBe(401);
      expect((await r.json()).code).toBe('invalid');
    }
    expect(calls).toEqual([]);
  });

  test('switched off, it is not there at all, whatever is sent', async () => {
    const calls = fakeSb();
    for (const e of [{ ...env, REVIEWER_CODE: '' }, { ...env, REVIEWER_EMAIL: '' }, { ...env, SUPABASE_SECRET_KEY: '' }]) {
      expect((await login({ email: 'review@vinterest.app', code: '482915' }, e)).status).toBe(404);
    }
    expect(calls).toEqual([]);
  });

  test('it is rate limited like the other sign-in routes', async () => {
    fakeSb();
    const hit = () => worker.fetch(new Request('https://vinterest.pages.dev/reviewer/login', { method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://vinterest.pages.dev', 'cf-connecting-ip': '10.9.9.9' }, body: JSON.stringify({ email: 'x@y.z', code: '111111' }) }), env);
    let last;
    for (let i = 0; i < 45; i++) last = await hit();
    expect(last.status).toBe(429);
  });

  test('a Supabase failure says so and signs nobody in', async () => {
    globalThis.fetch = async () => new Response('{}', { status: 500 });
    const r = await login({ email: 'review@vinterest.app', code: '482915' });
    expect(r.status).toBe(502);
    expect((await r.json()).code).toBe('reviewer_unavailable');
  });
});

// ---- The app ----

async function boot(context, page, { reviewer }) {
  await makeDeterministic(page);
  await page.addInitScript((sb) => { window.VINTEREST_SUPABASE = { url: sb, key: 'k' }; }, SB);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
  await stubNetwork(context);
  const seen = { verify: 0, reviewer: [] };
  await context.route(`${SB}/**`, (route) => {
    const u = route.request().url();
    if (u.endsWith('/auth/v1/otp')) return route.fulfill({ contentType: 'application/json', body: '{}' });
    if (u.endsWith('/auth/v1/verify')) { seen.verify++; return route.fulfill({ status: 400, contentType: 'application/json', body: '{"msg":"Token has expired or is invalid"}' }); }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  await context.route('**/reviewer/login', (route) => {
    seen.reviewer.push(JSON.parse(route.request().postData()));
    return reviewer
      ? route.fulfill({ contentType: 'application/json', body: JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u-rev', email: 'review@vinterest.app' } }) })
      : route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Not found."}' });
  });
  await context.route('**/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ signedIn: true, accounts: true, tier: 'free', usage: {}, caps: {} }) }));
  return seen;
}
const signIn = async (page, code) => {
  await page.goto(`${BASE}/#account`);
  await page.getByText('Sign in with email').click();
  await page.getByLabel('Email address').fill('review@vinterest.app');
  await page.getByText('Email me a code').click();
  await page.getByLabel('Sign-in code').fill(code);
  await page.getByText('Sign in', { exact: true }).click();
};

test('the reviewer types the fixed code on the ordinary sign-in screen and is signed in', async ({ context, page }) => {
  const seen = await boot(context, page, { reviewer: true });
  await signIn(page, '482915');
  await expect.poll(() => page.evaluate(() => Account.signedIn())).toBe(true);
  expect(seen.reviewer).toEqual([{ email: 'review@vinterest.app', code: '482915' }]);
});

test('with the reviewer route off, a wrong code gets the usual message and nobody is signed in', async ({ context, page }) => {
  const seen = await boot(context, page, { reviewer: false });
  await signIn(page, '123456');
  await expect(page.getByRole('alert')).toContainText("That code didn't work");
  expect(await page.evaluate(() => Account.signedIn())).toBe(false);
  expect(seen.verify).toBe(1);
});
