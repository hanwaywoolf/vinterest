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

// A wine list frame sized from the screen's width (2:3) was taller than the space on a Pixel (412×780
// once the status bar is taken off) and pushed the shutter off the bottom. Both modes now fit between the top bar and the controls.
test.describe('on a tall phone', () => {
  test.use({ viewport: { width: 412, height: 780 } });
  test('in Bottle and Wine List mode the shutter and gallery button stay on screen', async ({ context, page }) => {
    await stubNetwork(context);
    await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk', vinterest_pro: '1' });
    await page.goto(`${BASE}/#camera`);
    const onScreen = async (loc) => { const b = await loc.boundingBox(); return b && b.y >= 0 && b.y + b.height <= 780; };
    const shutter = page.getByLabel('Take photo');
    const gallery = page.getByRole('button', { name: 'Choose a photo from your gallery' });
    expect(await onScreen(shutter)).toBe(true);
    await page.getByText('Wine List', { exact: true }).click();
    await expect(page.getByText('List prices in GBP')).toBeVisible();
    expect(await onScreen(shutter)).toBe(true);
    expect(await onScreen(gallery)).toBe(true);
  });
});

// The torch: a toggle left of the shutter in both modes, only when the camera reports one.
// Chromium's fake camera has no torch, so the first test gives it one and records what's asked.
test('a camera with a torch gets a toggle that switches it on and off, in Bottle and Wine List mode', async ({ context, page }) => {
  await stubNetwork(context);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk', vinterest_pro: '1' });
  await page.addInitScript(() => {
    window.__torch = [];
    const caps = MediaStreamTrack.prototype.getCapabilities;
    MediaStreamTrack.prototype.getCapabilities = function () { return { ...(caps ? caps.call(this) : {}), torch: true }; };
    const apply = MediaStreamTrack.prototype.applyConstraints;
    MediaStreamTrack.prototype.applyConstraints = function (c) {
      const t = c && c.advanced && c.advanced.find((a) => 'torch' in a);
      if (t) { window.__torch.push(t.torch); return Promise.resolve(); }
      return apply.call(this, c);
    };
  });
  await page.goto(`${BASE}/#camera`);
  const on = page.getByRole('button', { name: 'Turn the torch on' });
  await on.click();
  const off = page.getByRole('button', { name: 'Turn the torch off' });
  await expect(off).toHaveAttribute('aria-pressed', 'true');
  await page.getByText('Wine List', { exact: true }).click();
  await off.click();
  await expect(on).toBeVisible();
  expect(await page.evaluate(() => window.__torch)).toEqual([true, false]);
});

test('a camera without a torch shows no torch button', async ({ context, page }) => {
  await stubNetwork(context);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
  await page.goto(`${BASE}/#camera`);
  await expect(page.locator('#root video')).toHaveCSS('opacity', '0.88');
  await expect(page.getByRole('button', { name: /torch/ })).toHaveCount(0);
});

// The free plan's 10 label scans a month: the camera says how many are left once it's 5 or fewer,
// and with none left the shutter opens the Pro sheet instead of sending the photo.
test('free scans: the count shows from 5 left, and the 11th scan opens the Pro sheet without sending anything', async ({ context, page }) => {
  const reqs = [];
  await stubNetwork(context, { claudeRequests: reqs });
  const month = new Date().toISOString().slice(0, 7);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk', vinterest_scan_month: JSON.stringify({ m: month, n: 7 }) });
  await page.goto(`${BASE}/#camera`);
  await expect(page.getByTestId('scans-left')).toHaveText('3 free scans left this month');
  await page.evaluate((m) => localStorage.setItem('vinterest_scan_month', JSON.stringify({ m, n: 10 })), month);
  await page.goto(`${BASE}/#home`); await page.goto(`${BASE}/#camera`);
  await expect(page.getByTestId('scans-left')).toHaveText('No free scans left this month');
  await expect(page.locator('#root video')).toHaveCSS('opacity', '0.88');
  await page.getByLabel('Take photo').click();
  await expect(page.locator('[data-sheet="pro"]')).toContainText("That's your 10 free scans this month");
  expect(reqs.filter((r) => r.purpose === 'label_scan')).toHaveLength(0);
  // Last month's count doesn't carry over.
  await page.evaluate(() => localStorage.setItem('vinterest_scan_month', JSON.stringify({ m: '2020-01', n: 10 })));
  await page.goto(`${BASE}/#home`); await page.goto(`${BASE}/#camera`);
  await expect(page.locator('#root')).toContainText('Scan Wine');
  await expect(page.getByTestId('scans-left')).toHaveCount(0);
});

// The starting zoom is the main 1x lens: an iPhone with an ultra-wide reports it as its widest zoom
// ("Back Triple Camera", min 1 = 0.5x), which opened the camera far wider than Android's.
test('the camera starts on the main lens: 2 on an iPhone that counts the ultra-wide as 1, else the widest', async ({ context, page }) => {
  await stubNetwork(context);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
  await page.goto(`${BASE}/#home`);
  const z = await page.evaluate(() => [
    ScanFlow.cameraZoom({ zoom: { min: 1, max: 123 } }, 'Back Triple Camera'),
    ScanFlow.cameraZoom({ zoom: { min: 1, max: 61 } }, 'Back Dual Wide Camera'),
    ScanFlow.cameraZoom({ zoom: { min: 1, max: 10 } }, 'Back Camera'),
    ScanFlow.cameraZoom({ zoom: { min: 0.5, max: 15 } }, 'camera2 0, facing back'),
    ScanFlow.cameraZoom({ zoom: { min: 1, max: 8 } }, 'camera2 0, facing back'),
    ScanFlow.cameraZoom({}, 'Back Camera'),
  ]);
  expect(z).toEqual([2, 2, 1, 1, 1, null]);
});

test('the iPhone camera is asked for zoom 2, the main lens', async ({ context, page }) => {
  await stubNetwork(context);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
  await page.addInitScript(() => {
    window.__zoom = [];
    MediaStreamTrack.prototype.getCapabilities = function () { return { zoom: { min: 1, max: 123, step: 0.1 } }; };
    Object.defineProperty(MediaStreamTrack.prototype, 'label', { get() { return 'Back Triple Camera'; } });
    MediaStreamTrack.prototype.applyConstraints = function (c) { const z = c && c.advanced && c.advanced.find((a) => 'zoom' in a); if (z) window.__zoom.push(z.zoom); return Promise.resolve(); };
  });
  await page.goto(`${BASE}/#camera`);
  await expect(page.locator('#root video')).toHaveCSS('opacity', '0.88');
  expect(await page.evaluate(() => window.__zoom)).toEqual([2]);
});

// Only what was inside the red frame is sent and shown while the label is read.
test('the photo is cut to the red frame: the processing screen shows only what was framed', async ({ context, page }) => {
  const reqs = [];
  // The label read is held open, so the processing screen stays up to be looked at.
  await stubNetwork(context, { claudeRequests: reqs, claudeText: () => new Promise(() => {}) });
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
  await page.goto(`${BASE}/#camera`);
  await expect(page.locator('#root video')).toHaveCSS('opacity', '0.88');
  const frame = await page.getByTestId('scan-frame').boundingBox();
  await page.getByLabel('Take photo').click();
  const shot = page.getByTestId('scan-captured');
  await expect(shot).toBeVisible();
  const size = await shot.evaluate((img) => new Promise((res) => { const go = () => res([img.naturalWidth, img.naturalHeight]); img.complete ? go() : img.onload = go; }));
  // The frame is tall and narrow; the fake camera's picture is 4:3 landscape.
  expect(Math.abs(size[0] / size[1] - frame.width / frame.height)).toBeLessThan(0.03);
  expect(size[0]).toBeLessThan(size[1]);
  // What's sent is the same cut picture.
  await expect.poll(() => reqs.filter((r) => r.purpose === 'label_scan').length).toBe(1);
  const sent = reqs.find((r) => r.purpose === 'label_scan').messages[0].content[0].source.data;
  const shown = await shot.getAttribute('src');
  expect(shown.endsWith(sent)).toBe(true);
});

test('the crop maps the frame onto the picture as the preview shows it', async ({ context, page }) => {
  await stubNetwork(context);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
  await page.goto(`${BASE}/#home`);
  const r = await page.evaluate(() => [
    // A 1920×1080 picture on a 390×844 screen: scaled to 844 high, 1500 wide, cut 555 each side.
    ScanFlow.frameCrop(1920, 1080, { left: 0, top: 0, width: 390, height: 844 }, { left: 12, top: 100, width: 366, height: 600 }),
    ScanFlow.frameCrop(640, 480, { left: 0, top: 0, width: 390, height: 844 }, null),
  ]);
  const s = 844 / 1080, ox = (390 - 1920 * s) / 2;
  const want = { sx: (12 - ox) / s, sy: 100 / s, sw: 366 / s, sh: 600 / s };
  for (const k of Object.keys(want)) expect(Math.abs(r[0][k] - want[k])).toBeLessThanOrEqual(1);
  expect(r[1]).toEqual({ sx: 0, sy: 0, sw: 640, sh: 480 });
});

// Tap to focus: the camera is asked to focus on that point when it can, and a ring shows the tap.
test('a tap on the frame focuses there and shows a ring', async ({ context, page }) => {
  await stubNetwork(context);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
  await page.addInitScript(() => {
    window.__focus = [];
    MediaStreamTrack.prototype.getCapabilities = function () { return { focusMode: ['manual', 'single-shot', 'continuous'], pointsOfInterest: true }; };
    MediaStreamTrack.prototype.applyConstraints = function (c) { const f = c && c.advanced && c.advanced.find((a) => 'focusMode' in a); if (f) window.__focus.push(f); return Promise.resolve(); };
  });
  await page.goto(`${BASE}/#camera`);
  await expect(page.locator('#root video')).toHaveCSS('opacity', '0.88');
  const box = await page.getByTestId('scan-frame').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('focus-ring')).toBeVisible();
  const f = await page.evaluate(() => window.__focus);
  expect(f).toHaveLength(1);
  expect(f[0].focusMode).toBe('single-shot');
  expect(f[0].pointsOfInterest[0].x).toBeGreaterThan(0.4);
  expect(f[0].pointsOfInterest[0].x).toBeLessThan(0.6);
  await expect(page.getByTestId('focus-ring')).toHaveCount(0, { timeout: 3000 });
});

// A vintage printed only on the neck or a seal was dropped as too new: the prompt says to look there
// and carries this year.
test('the label prompt sent with a photo asks for the neck and seal and carries this year', async ({ context, page }) => {
  const reqs = [];
  await stubNetwork(context, { claudeRequests: reqs, claudeText: () => new Promise(() => {}) });
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
  await page.goto(`${BASE}/#camera`);
  await expect(page.locator('#root video')).toHaveCSS('opacity', '0.88');
  await page.getByLabel('Take photo').click();
  await expect.poll(() => reqs.filter((r) => r.purpose === 'label_scan').length).toBe(1);
  const text = reqs.find((r) => r.purpose === 'label_scan').messages[0].content[1].text;
  expect(text).toContain('neck label');
  expect(text).toContain(`The current year is ${new Date().getFullYear()}`);
  expect(text).not.toContain('{{');
});
