// @ts-check
const fs = require('node:fs');
const { defineConfig, devices } = require('@playwright/test');

const hasLegacyBundle = fs.existsSync(`${__dirname}/bundle.js`);

module.exports = defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    ...devices['Pixel 7'],
    // Service workers would answer fetches before the test's network stubs see them.
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    // The built site. Builds first, so `npm test` always tests current sources.
    { command: 'npm run build && node scripts/serve.mjs dist 4173', url: 'http://localhost:4173/', reuseExistingServer: !process.env.CI },
    // The repo root with the hand-compiled bundle.js, for tests/parity.spec.js. Goes away with bundle.js.
    ...(hasLegacyBundle
      ? [{ command: 'node scripts/serve.mjs . 4174', url: 'http://localhost:4174/', reuseExistingServer: !process.env.CI }]
      : []),
  ],
});
