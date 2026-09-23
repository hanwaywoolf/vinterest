// Region, Wine Basics and grape quizzes: each quiz draws 5 questions from the set's pool,
// unanswered ones first; a set is complete only once every question has been answered
// correctly; completed sets collapse into a "completed" section and can be reset.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';

const bankFor = (name) =>
  Array.from({ length: 15 }, (_, i) => ({
    difficulty: ['easy', 'medium', 'hard'][Math.floor(i / 5)],
    q: `${name} question ${i + 1}?`,
    opts: ['Right', 'Wrong one', 'Wrong two', 'Wrong three'],
    a: 0,
    fact: `Fact ${i + 1}.`,
  }));

// Region banks come back from the stubbed /claude; grape banks too.
function claudeText(body) {
  const prompt = body.messages[0].content;
  if (body.purpose === 'region_quiz') return JSON.stringify(bankFor(/region (.+?)\. Use ONLY/.exec(prompt)[1]));
  if (body.purpose === 'grape_quiz') return JSON.stringify(bankFor(/quiz about (.+?)\. Use ONLY/.exec(prompt)[1]));
  return '';
}

test.beforeEach(async ({ context, page }) => {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_wineDNA_unlock_seen: '1' });
  page.on('dialog', (d) => d.accept());
  await stubNetwork(context, { claudeText });
});

const root = (page) => page.locator('#root');

// Answers the current quiz: `pick(questionText)` returns true to answer correctly.
async function answerQuiz(page, pick) {
  const asked = [];
  for (let i = 0; i < 10; i++) {
    const q = (await root(page).locator('div', { hasText: /\?$/ }).last().innerText()).trim();
    asked.push(q);
    const right = pick(q);
    const correctText = await page.evaluate(
      (text) => {
        // The option marked correct in the pool — works for generated banks and the static bank.
        const all = [...QUIZ_TOPICS.flatMap((t) => t.questions.beginner)];
        const hit = all.find((x) => x.q === text);
        return hit ? hit.opts[hit.a] : 'Right';
      },
      q,
    );
    const options = root(page).locator('span', { hasText: /.+/ }).filter({ hasNotText: /^[A-D✓✗]$/ });
    if (right) await root(page).getByText(correctText, { exact: true }).first().click();
    else await options.filter({ hasNotText: correctText }).filter({ hasText: /\S{3,}/ }).nth(1).click();
    const next = root(page).getByText(/^(Next Question|See Results) →$/);
    const last = (await next.innerText()).startsWith('See Results');
    await next.click();
    if (last) break;
  }
  return asked;
}

async function openRegion(page) {
  await page.goto(`${BASE}/?demo=1#learn`);
  const region = await page.evaluate(() => regionQuizCandidates(WineHistory.getAll())[0]);
  await root(page).getByText(region, { exact: true }).first().click();
  return region;
}

test('region quizzes rotate through all 15 bank questions before repeating', async ({ page }) => {
  const errors = collectErrors(page);
  const region = await openRegion(page);
  const all = [];
  for (let round = 0; round < 3; round++) {
    // Miss the first question each round so the region isn't completed yet.
    let first = true;
    all.push(...(await answerQuiz(page, () => { const r = !first; first = false; return r; })));
    if (round < 2) await root(page).getByText('New quiz', { exact: true }).click();
  }
  expect(all.filter((q) => q.startsWith(region))).toHaveLength(15);
  expect(new Set(all).size).toBe(15);
  expect(errors).toEqual([]);
});

test('with 14 of 15 correct, every quiz includes the missing question until it is answered', async ({ page }) => {
  await page.goto(`${BASE}/?demo=1#learn`);
  const draws = await page.evaluate(() => {
    const pool = Array.from({ length: 15 }, (_, i) => ({ q: `Q${i + 1}?`, opts: ['a', 'b', 'c', 'd'], a: 0 }));
    pool.slice(0, 14).forEach((q) => QuizMastery.recordAnswer('region:Test', q.q, true));
    return [1, 2, 3].map(() => QuizMastery.draw('region:Test', pool).map((q) => q.q));
  });
  for (const d of draws) {
    expect(d).toHaveLength(5);
    expect(d).toContain('Q15?');
  }
  // The 4 review slots rotate rather than repeating the same review questions.
  expect(new Set(draws.flat().filter((q) => q !== 'Q15?')).size).toBe(12);
});

test('a region completes only when every question is answered correctly, then collapses and can be reset', async ({ page }) => {
  const errors = collectErrors(page);
  const region = await openRegion(page);
  // Acing one quiz doesn't complete the region any more.
  await answerQuiz(page, () => true);
  await expect(root(page)).toContainText('5 of 15 questions answered correctly');
  await root(page).getByText('New quiz', { exact: true }).click();
  await answerQuiz(page, () => true);
  await root(page).getByText('New quiz', { exact: true }).click();
  await answerQuiz(page, () => true);
  await expect(root(page)).toContainText('Complete — every question answered correctly');

  await page.goto(`${BASE}/?demo=1#learn`);
  await expect(root(page).getByText(region, { exact: true })).toHaveCount(0); // collapsed by default
  await root(page).getByText(/^1 completed — show$/).last().click();
  await expect(root(page).getByText(region, { exact: true })).toHaveCount(1);
  await root(page).getByText('Reset', { exact: true }).last().click();
  await expect(root(page).getByText(region, { exact: true })).toHaveCount(1);
  expect(await page.evaluate((r) => RegionQuizBank.progress(r).correct, region)).toBe(0);
  expect(errors).toEqual([]);
});

test('a Wine Basics topic completes after every one of its 8 questions is answered correctly', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${BASE}/?demo=1#learn`);
  const label = await page.evaluate(() => QUIZ_TOPICS[0].label);
  await root(page).getByText(label, { exact: true }).click();
  const first = await answerQuiz(page, () => true);
  expect(first).toHaveLength(5);
  await expect(root(page)).toContainText('5 of 8 questions answered correctly');
  await root(page).getByText('New quiz', { exact: true }).click();
  const second = await answerQuiz(page, () => true);
  // The 3 not yet answered come first, then 2 review questions.
  expect(second.slice(0, 3).every((q) => !first.includes(q))).toBe(true);
  await expect(root(page)).toContainText('Complete — every question answered correctly');

  await page.goto(`${BASE}/?demo=1#learn`);
  await root(page).getByText(/^1 completed — show$/).first().click();
  await expect(root(page).getByText(label, { exact: true })).toHaveCount(1);
  await root(page).getByText('Reset', { exact: true }).first().click();
  await expect(root(page).getByText(/completed — show$/)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('grape quizzes serve 5 of the 15 questions and show a tick once complete', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${BASE}/?demo=1#learn`);
  // The demo data has no unlocked grapes; unlock one the way a Pro user would.
  const grape = 'Tempranillo';
  await page.evaluate((g) => { localStorage.setItem('vinterest_pro', '1'); GrapeUnlocks.unlockManual(g); }, grape);
  await page.reload();
  await root(page).getByText(grape, { exact: true }).click();
  const asked = [];
  for (let round = 0; round < 3; round++) {
    asked.push(...(await answerQuiz(page, () => true)));
    if (round < 2) await root(page).getByText('New quiz', { exact: true }).click();
  }
  expect(new Set(asked).size).toBe(15);
  await expect(root(page)).toContainText('Complete — every question answered correctly');
  await page.goto(`${BASE}/?demo=1#learn`);
  await expect(root(page).getByText(`✓ ${grape}`, { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('without a generated bank a region quiz uses the fixed knowledge-base questions', async ({ context, page }) => {
  await context.unroute('**/claude');
  await stubNetwork(context); // every /claude call "fails" (empty text)
  const errors = collectErrors(page);
  await openRegion(page);
  const asked = await answerQuiz(page, () => false);
  expect(asked).toHaveLength(5);
  expect(asked.some((q) => /^Which grape is the backbone of /.test(q) || /^Which climate description matches /.test(q))).toBe(true);
  await expect(root(page)).toContainText(/\d of 6 questions answered correctly/);
  expect(errors).toEqual([]);
});
