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
    // Questions end in "?" or, for "… range in style from:", a colon.
    const q = (await root(page).locator('div', { hasText: /[?:]$/ }).last().innerText()).trim();
    asked.push(q);
    const right = pick(q);
    const correctText = await page.evaluate(
      (text) => {
        // The option marked correct in the pool — works for generated banks and the static bank.
        const all = QUIZ_TOPICS.flatMap((t) => QuizMastery.topicPool(t.id));
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
    if (round < 2) await root(page).getByText(/^Keep going/).click();
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
  await root(page).getByText(/^Keep going/).click();
  await answerQuiz(page, () => true);
  await root(page).getByText(/^Keep going/).click();
  await answerQuiz(page, () => true);
  await expect(root(page)).toContainText(/All \d+ questions answered correctly/);

  await page.goto(`${BASE}/?demo=1#learn`);
  await expect(root(page).getByText(region, { exact: true })).toHaveCount(0); // collapsed by default
  await root(page).getByText(/^1 completed — show$/).last().click();
  await expect(root(page).getByText(region, { exact: true })).toHaveCount(1);
  await root(page).getByText('Reset', { exact: true }).last().click();
  await expect(root(page).getByText(region, { exact: true })).toHaveCount(1);
  expect(await page.evaluate((r) => RegionQuizBank.progress(r).correct, region)).toBe(0);
  expect(errors).toEqual([]);
});

test('a Wine Basics topic draws from 16 questions, easy first, and completes once all are answered', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${BASE}/?demo=1#learn`);
  const { label, beginner } = await page.evaluate(() => ({
    label: QUIZ_TOPICS[0].label,
    beginner: QUIZ_TOPICS[0].questions.beginner.map((q) => q.q),
  }));
  await root(page).getByText(label, { exact: true }).click();
  const first = await answerQuiz(page, () => true);
  expect(first).toHaveLength(5);
  expect(first.every((q) => beginner.includes(q))).toBe(true); // beginner questions come first
  await expect(root(page)).toContainText('5 of 16 questions answered correctly');
  const seen = new Set(first);
  for (let round = 0; round < 3; round++) {
    await root(page).getByText(/^Keep going/).click();
    const qs = await answerQuiz(page, () => true);
    const fresh = qs.filter((q) => !seen.has(q));
    // Unanswered questions always lead the quiz.
    expect(qs.slice(0, fresh.length)).toEqual(fresh);
    qs.forEach((q) => seen.add(q));
  }
  expect(seen.size).toBe(16);
  await expect(root(page)).toContainText(/All \d+ questions answered correctly/);

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
    if (round < 2) await root(page).getByText(/^Keep going/).click();
  }
  expect(new Set(asked).size).toBe(15);
  await expect(root(page)).toContainText(/All \d+ questions answered correctly/);
  await page.goto(`${BASE}/?demo=1#learn`);
  const pill = root(page).locator('div', { has: page.getByText(grape, { exact: true }) }).last();
  await expect(pill).toContainText('✓');
  await expect(pill).not.toContainText('/15');
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

test('every results screen has Back to Learn, and a finished set suggests the next one', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${BASE}/?demo=1#learn`);
  const [first, second] = await page.evaluate(() => QUIZ_TOPICS.slice(0, 2).map((t) => t.label));
  await root(page).getByText(first, { exact: true }).click();
  await answerQuiz(page, () => true);
  // Unfinished set: keep going on it, or go back to Learn. No "See what you missed".
  await expect(root(page).getByText('Keep going · 11 to go', { exact: true })).toBeVisible();
  await expect(root(page).getByText('See what you missed')).toHaveCount(0);
  for (let i = 0; i < 3; i++) {
    await root(page).getByText(/^Keep going/).click();
    await answerQuiz(page, () => true);
  }
  await expect(root(page)).toContainText(`${first} complete!`);
  await root(page).getByText(`Next: ${second}`, { exact: true }).click();
  await expect(root(page)).toContainText(`${second}`);
  await answerQuiz(page, () => true);
  await root(page).getByText('Back to Learn', { exact: true }).click();
  await expect(root(page)).toContainText('Wine Basics');
  expect(errors).toEqual([]);
});

test('Concept Check and Words results also offer Back to Learn', async ({ page }) => {
  await page.goto(`${BASE}/?demo=1#learn`);
  await root(page).getByText('Concept Check', { exact: true }).click();
  for (let i = 0; i < 10; i++) {
    await root(page).getByText('A', { exact: true }).click();
    const next = root(page).getByText(/^(Next Question|See Results) →$/);
    const last = (await next.innerText()).startsWith('See Results');
    await next.click();
    if (last) break;
  }
  await expect(root(page)).toContainText(/\d of 6 concepts mastered/);
  await expect(root(page).getByText('Keep going', { exact: true })).toBeVisible();
  await root(page).getByText('Back to Learn', { exact: true }).click();
  await expect(root(page)).toContainText('Wine Basics');
});

test('Concept Check fills every quiz, a miss steps back one box, and Blind Call misses only flag for review', async ({ page }) => {
  await page.goto(`${BASE}/?demo=1#learn`);
  const out = await page.evaluate(() => {
    const ids = CONCEPTS.map((c) => c.id);
    // Two correct answers each, then one weak concept: the next quiz still covers all six.
    ids.forEach((id) => { MasterySystem.recordResult(id, true); MasterySystem.recordResult(id, true); });
    MasterySystem.recordResult(ids[0], false);
    const afterMiss = MasterySystem.get()[ids[0]];
    const picked = MasterySystem.selectConcepts(6);
    const before = { ...MasterySystem.get()[ids[1]] };
    MasterySystem.flagForReview(ids[1]);
    const after = MasterySystem.get()[ids[1]];
    return { box: afterMiss.box, picked, before, after, now: Date.now() };
  });
  expect(out.box).toBe(1); // 2 -> 1, not reset
  expect(out.picked).toHaveLength(6);
  expect(out.picked[0]).toBe('tannin_source');
  expect(out.after.box).toBe(out.before.box);
  expect(out.after.wrong).toBe(out.before.wrong);
  expect(out.after.nextDue).toBeLessThanOrEqual(out.now);
});

test('one tap on a locked grape (Pro) unlocks it and opens its quiz; the pill then shows progress', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${BASE}/?demo=1#learn`);
  await page.evaluate(() => localStorage.setItem('vinterest_pro', '1'));
  await page.reload();
  await root(page).getByText(/^\+\d+ more$/).click();
  await root(page).getByText('Merlot', { exact: true }).click();
  // Straight into the quiz, no second tap.
  await expect(root(page)).toContainText('The Merlot Quiz');
  await answerQuiz(page, () => true);
  await root(page).getByText('Back to Learn', { exact: true }).click();
  await expect(root(page).getByText('5/15', { exact: true })).toBeVisible();
  await expect(root(page).getByText('Merlot', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a grape quiz that fails to generate says so instead of doing nothing', async ({ context, page }) => {
  await context.unroute('**/claude');
  await stubNetwork(context); // empty responses: generation fails
  await page.goto(`${BASE}/?demo=1#learn`);
  await page.evaluate(() => { localStorage.setItem('vinterest_pro', '1'); GrapeUnlocks.unlockManual('Merlot'); });
  await page.reload();
  await root(page).getByText('Merlot', { exact: true }).click();
  await expect(root(page)).toContainText("Couldn't load the Merlot quiz");
  await expect(root(page).getByText('Merlot', { exact: true })).toBeVisible();
});

test('every Concept Check concept has 12 questions', async ({ page }) => {
  await page.goto(`${BASE}/?demo=1#learn`);
  const counts = await page.evaluate(() => CONCEPT_TEMPLATES.map((c) => c.templates.length * 2));
  expect(counts).toEqual([12, 12, 12, 12, 12, 12]);
});
