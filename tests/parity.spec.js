// Behaviour parity between the legacy hand-compiled bundle.js (served from the repo root with
// React from the CDN tags) and the esbuild output in dist/. Both run with the same seeded data,
// clock and Math.random sequence; the rendered text, localStorage, the requests sent to /claude
// and the global names each source file defines must match.
//
// Skipped once bundle.js is deleted: at that point dist/ is the only build and there's nothing
// left to compare against.
const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors, ROOT } = require('./helpers');
const { pathToFileURL } = require('node:url');

const LEGACY = 'http://localhost:4174';
const DIST = 'http://localhost:4173';

test.skip(!fs.existsSync(path.join(ROOT, 'bundle.js')), 'bundle.js has been removed');

// #profile (WineDNA) isn't compared: its Explore Next section was redesigned (ExploreNext,
// tests/explore-next.spec.js) and deliberately differs from bundle.js.
const SCREENS = ['home', 'mywines', 'learn', 'scan', 'settings', 'account', 'mastery-map'];

// Intended differences on these screens: the version line is generated now, and the legacy build's
// QuizHubScreen crashes on the first Learn visit after WineDNA unlocks (fixed in this build),
// so both runs start with that one-off celebration already seen.
const SEED = { vinterest_wineDNA_unlock_seen: '1' };
// Globals added to the sources after bundle.js was last compiled. They exist only in dist.
const ADDED_SINCE_BUNDLE = [
  'RegionQuizBank', 'QUIZ_SIZE', 'QuizMastery', '_ceShuffle', '_regionsWithScans', 'completedRegionQuizzes',
  'grapeQuizBank', 'grapeQuizComplete', 'CompletedToggle', 'CompletedMark', '_drawQuiz', 'quizSetFor',
  'buildQuizQuestions', 'quizTitle', 'nextQuizSuggestion', 'USD_FX', 'SommelierScript', 'EXPLORE_STYLES', 'ExploreNext', 'FindOnline',
];
const normalise = (text) => text.replace(/Vinterest v[^\n]*/g, 'Vinterest v<version>');

async function snapshot(browser, base, run) {
  const context = await browser.newContext();
  const claudeRequests = [];
  await stubNetwork(context, { claudeRequests });
  const page = await context.newPage();
  await makeDeterministic(page, { fakeTimers: true });
  await seedLocalStorage(page, SEED);
  const errors = collectErrors(page);
  const result = await run(page, base);
  await page.waitForLoadState('networkidle');
  await page.clock.runFor(60_000);
  await page.waitForLoadState('networkidle');
  const state = {
    text: normalise(await page.locator('#root').innerText()),
    // Sommelier scripts are now shared between screens with a computed budget (SommelierScript),
    // so their prompts and cache keys deliberately differ from bundle.js.
    localStorage: await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([k]) => !k.startsWith('vinterest_script_')).sort())),
    // dist also pre-generates region quiz banks (added after bundle.js); legacy never asks for them.
    claude: claudeRequests.filter((r) => r.purpose !== 'region_quiz' && r.purpose !== 'sommelier_script'),
    result,
    // React's dev build (legacy) warns where the production build (dist) is silent, so only
    // count app errors, not React warnings.
    errors: errors.filter((e) => !e.startsWith('Warning:')),
  };
  await context.close();
  return state;
}

async function compare(browser, run) {
  const legacy = await snapshot(browser, LEGACY, run);
  const built = await snapshot(browser, DIST, run);
  expect(built.text.length).toBeGreaterThan(50);
  expect(built.text).toEqual(legacy.text);
  expect(built.localStorage).toEqual(legacy.localStorage);
  expect(built.claude).toEqual(legacy.claude);
  expect(built.result).toEqual(legacy.result);
  expect(built.errors).toEqual(legacy.errors);
}

for (const screen of SCREENS) {
  test(`#${screen} renders the same as bundle.js`, async ({ browser }) => {
    await compare(browser, async (page, base) => {
      await page.goto(`${base}/?demo=1#${screen}`);
    });
  });
}

// No Wine Basics quiz parity test: those quizzes now draw 5 questions by mastery (tests/
// quiz-mastery.spec.js) instead of 6 at random, so they deliberately differ from bundle.js.

// Exercises the XP badge and tier/achievement overlay in pwa-app.jsx.
test('the XP overlay renders the same as bundle.js', async ({ browser }) => {
  await compare(browser, async (page, base) => {
    await page.goto(`${base}/?demo=1#home`);
    await page.locator('#root').getByText('1805 XP', { exact: true }).click();
    await expect(page.locator('#root')).toContainText('Achievements');
    return page.locator('#root svg').count();
  });
});

test('every top-level name in the sources is defined the same way in both builds', async ({ browser }) => {
  const { APP_SOURCES } = await import(pathToFileURL(path.join(ROOT, 'scripts/app-sources.mjs')).href);
  const names = new Set();
  for (const file of APP_SOURCES) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const m of src.matchAll(/^(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) if (!ADDED_SINCE_BUNDLE.includes(m[1])) names.add(m[1]);
  }
  expect(names.size).toBeGreaterThan(100);
  const types = async (base) => {
    const context = await browser.newContext();
    await stubNetwork(context);
    const page = await context.newPage();
    await page.goto(`${base}/?demo=1`);
    await page.waitForLoadState('networkidle');
    // Indirect eval runs in global scope, so it sees top-level let/const as well as functions.
    const out = await page.evaluate((list) => Object.fromEntries(list.map((n) => [n, (0, eval)(`typeof ${n}`)])), [...names]);
    await context.close();
    return out;
  };
  expect(await types(DIST)).toEqual(await types(LEGACY));
});
