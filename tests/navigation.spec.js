// Back follows the way they came: after a quiz's "Back to Learn", Learn's back goes Home (not
// back into the quiz), and the phone's own back gesture takes the same path as the in-app arrow.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage } = require('./helpers');

const BASE = 'http://localhost:4173';
const root = (page) => page.locator('#root');
const hash = (page) => page.evaluate(() => location.hash);

test.beforeEach(async ({ context, page }) => {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_wineDNA_unlock_seen: '1' });
  await stubNetwork(context);
});

async function quizThenBackToLearn(page) {
  await page.goto(`${BASE}/?demo=1#home`);
  await root(page).getByText('Learn', { exact: true }).last().click();
  await expect(root(page)).toContainText('Wine Basics');
  const label = await page.evaluate(() => QUIZ_TOPICS[0].label);
  await root(page).getByText(label, { exact: true }).click();
  for (let i = 0; i < 5; i++) {
    await root(page).locator('span:not(.vflag)', { hasText: /\S{3,}/ }).filter({ hasNotText: /^[A-D✓✗]$/ }).nth(1).click();
    const next = root(page).getByText(/^(Next Question|See Results) →$/);
    const last = (await next.innerText()).startsWith('See Results');
    await next.click();
    if (last) break;
  }
  await root(page).getByText('Back to Learn', { exact: true }).click();
  await expect(root(page)).toContainText('Wine Basics');
}

test("Learn's back arrow after a quiz goes Home, not back into the quiz", async ({ page }) => {
  await quizThenBackToLearn(page);
  await root(page).getByRole('button', { name: 'Back' }).first().click();
  await expect(root(page)).toContainText('Recently scanned');
  expect(await hash(page)).toBe('#home');
});

test("the phone's back gesture takes the same path", async ({ page }) => {
  await quizThenBackToLearn(page);
  await page.goBack();
  await expect(root(page)).toContainText('Recently scanned');
  expect(await hash(page)).toBe('#home');
});
