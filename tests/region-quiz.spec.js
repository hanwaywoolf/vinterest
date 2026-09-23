// Region quizzes draw 5 questions from a generated bank of 15, least-recently-served first, so
// retakes cycle through the whole bank instead of repeating the same questions.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';

const bank = (region) =>
  JSON.stringify(
    Array.from({ length: 15 }, (_, i) => ({
      difficulty: ['easy', 'medium', 'hard'][Math.floor(i / 5)],
      q: `${region} question ${i + 1}?`,
      opts: ['Right', 'Wrong one', 'Wrong two', 'Wrong three'],
      a: 0,
      fact: `Fact ${i + 1}.`,
    })),
  );

async function openRegionQuiz(page) {
  await page.goto(`${BASE}/?demo=1#learn`);
  const region = await page.evaluate(() => regionQuizCandidates(WineHistory.getAll())[0]);
  expect(region).toBeTruthy();
  await page.locator('#root').getByText(region, { exact: true }).click();
  return region;
}

test('three retakes of a region quiz cover all 15 bank questions with no repeats', async ({ context, page }) => {
  const claudeRequests = [];
  await stubNetwork(context, {
    claudeRequests,
    claudeText: (body) => (body.purpose === 'region_quiz' ? bank(/region (.+?)\. Use ONLY/.exec(body.messages[0].content)[1]) : ''),
  });
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_wineDNA_unlock_seen: '1' });
  const errors = collectErrors(page);

  const region = await openRegionQuiz(page);
  // Pick answers that aren't all correct so the region isn't retired after the first round.
  const root = page.locator('#root');
  const all = [];
  for (let round = 0; round < 3; round++) {
    const qs = [];
    for (let i = 0; i < 5; i++) {
      qs.push((await root.getByText(new RegExp(`^${region} question \\d+\\?$`)).innerText()).trim());
      await root.getByText(i === 0 ? 'Wrong one' : 'Right', { exact: true }).click();
      await root.getByText(/^(Next Question|See Results) →$/).click();
    }
    expect(qs).toHaveLength(5);
    all.push(...qs);
    await expect(root.getByText('New quiz', { exact: true })).toBeVisible();
    if (round < 2) await root.getByText('New quiz', { exact: true }).click();
  }
  expect(new Set(all).size).toBe(15);
  // Generated once and cached, even with several regions prefetched.
  expect(claudeRequests.filter((r) => r.purpose === 'region_quiz' && r.messages[0].content.includes(`region ${region}.`))).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('without a generated bank the quiz falls back to fixed questions and offers "Try again"', async ({ context, page }) => {
  await stubNetwork(context); // every /claude call "fails" (empty text)
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_wineDNA_unlock_seen: '1' });
  const errors = collectErrors(page);

  await openRegionQuiz(page);
  const root = page.locator('#root');
  for (let i = 0; i < 10; i++) {
    await root.getByText('B', { exact: true }).click();
    const next = root.getByText(/^(Next Question|See Results) →$/);
    const last = (await next.innerText()).startsWith('See Results');
    await next.click();
    if (last) break;
  }
  await expect(root.getByText('Try again', { exact: true })).toBeVisible();
  await expect(root.getByText('New quiz', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
