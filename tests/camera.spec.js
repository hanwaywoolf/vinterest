// The camera screen with a (fake) working camera: the gallery button is an icon, and on the first
// three visits the framing pill says for a few seconds that a gallery photo works too.
const { test, expect } = require('@playwright/test');
const { stubNetwork, seedLocalStorage } = require('./helpers');

const BASE = 'http://localhost:4173';
test.use({ permissions: ['camera'], launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } });

test('the camera shows a gallery icon, and a fading "pick a photo" tip on the first three visits only', async ({ context, page }) => {
  await stubNetwork(context);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
  const tip = page.locator('#root').getByText('Or pick a photo from your gallery');
  const visit = async () => {
    await page.goto(`${BASE}/#home`); await page.goto(`${BASE}/#camera`);
    await expect(page.getByRole('button', { name: 'Choose a photo from your gallery' })).toBeVisible();
    await expect(page.locator('#root')).not.toContainText('Photo library');
    await page.waitForTimeout(800);
    return tip.count();
  };
  expect([await visit(), await visit(), await visit(), await visit()]).toEqual([1, 1, 1, 0]);
});
test('the tip fades back to "Frame the wine label"', async ({ context, page }) => {
  await stubNetwork(context);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
  await page.goto(`${BASE}/#camera`);
  await expect(page.locator('#root').getByText('Or pick a photo from your gallery')).toBeVisible();
  await expect(page.locator('#root').getByText('Frame the wine label')).toBeVisible({ timeout: 8000 });
});

test('the camera preview has a blank poster and appears once the picture arrives (no Android play button)', async ({ context, page }) => {
  await stubNetwork(context);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
  await page.goto(`${BASE}/#camera`);
  const video = page.locator('#root video');
  expect(await video.getAttribute('poster')).toMatch(/^data:image\/gif/);
  await expect(video).toHaveCSS('opacity', '0.88');
});

test('while the camera is asking for permission there is no video element at all (Android draws a play button on one)', async ({ context, page }) => {
  await stubNetwork(context);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
  // Hold getUserMedia open, as the permission prompt does, until the test lets it go.
  await page.addInitScript(() => {
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (c) => new Promise((res, rej) => { window.__allowCamera = () => real(c).then(res, rej); });
  });
  await page.goto(`${BASE}/#camera`);
  await expect(page.locator('#root')).toContainText('Frame the wine label');
  await expect(page.locator('#root video')).toHaveCount(0);
  await page.waitForFunction(() => typeof window.__allowCamera === 'function');
  await page.evaluate(() => window.__allowCamera());
  await expect(page.locator('#root video')).toHaveCSS('opacity', '0.88');
});
