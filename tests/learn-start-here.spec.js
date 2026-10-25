const { test, expect } = require('@playwright/test');
const { stubNetwork } = require('./helpers');
const BASE = 'http://localhost:4173';
// "Finish your red grape quizzes" on Learn used to do nothing; it opens the quiz, or says why it can't.
test('Learn\'s Start here grape step opens the quiz or says it could not load', async ({ context, page }) => {
  await context.unroute('**/claude');
  await stubNetwork(context);
  await page.goto(`${BASE}/?demo=1#learn`);
  await page.evaluate(() => { localStorage.setItem('vinterest_pro','1'); GrapeUnlocks.unlockManual('Merlot'); const p='topic:red_grapes'; QuizMastery.topicPool('red_grapes').forEach(q=>QuizMastery.recordAnswer(p,q.q,true)); });
  await page.reload();
  await page.getByTestId('learn-start-here').click();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('start-here-status')).toContainText("Couldn't load the Merlot quiz");
});
