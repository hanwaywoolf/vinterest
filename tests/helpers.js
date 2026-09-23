// Shared setup for the browser tests. Everything outside the local server is stubbed so the
// tests are deterministic and never spend Anthropic tokens.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FIXED_NOW = new Date('2026-06-15T12:00:00Z');

// The legacy index.html loads React from unpkg; serve the identical files from node_modules.
const UMD = {
  'unpkg.com/react@': 'node_modules/react/umd/react.development.js',
  'unpkg.com/react-dom@': 'node_modules/react-dom/umd/react-dom.development.js',
};

async function stubNetwork(context, { claudeRequests = [] } = {}) {
  await context.route(/^https?:\/\/(?!localhost[:/])/, (route) => {
    const url = route.request().url();
    const umd = Object.entries(UMD).find(([k]) => url.includes(k));
    if (umd) {
      return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(ROOT, umd[1])) });
    }
    // Google Fonts: an empty stylesheet keeps the page offline without a failed-request console error.
    return route.fulfill({ contentType: url.includes('css') ? 'text/css' : 'text/plain', body: '' });
  });
  await context.route('**/claude', (route) => {
    claudeRequests.push(JSON.parse(route.request().postData() || '{}'));
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ text: '' }) });
  });
}

// Same clock and the same Math.random sequence on every run, so two builds can be compared.
// With { fakeTimers: true } timers only advance when the test calls page.clock.runFor, so
// animations (the Home screen's typewriter prompts) end in the same state on every run.
async function makeDeterministic(page, { fakeTimers = false } = {}) {
  if (fakeTimers) {
    await page.clock.install({ time: new Date(FIXED_NOW.getTime() - 1000) });
    await page.clock.pauseAt(FIXED_NOW);
  }
  else await page.clock.setFixedTime(FIXED_NOW);
  await page.addInitScript(() => {
    let s = 0x2f6b1a;
    Math.random = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
}

// index.html seeds 22 demo wines and 1805 XP on ?demo=1, which skips onboarding. Extra keys are
// written before the app boots.
async function seedLocalStorage(page, extra = {}) {
  await page.addInitScript((entries) => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
  }, extra);
}

function collectErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

module.exports = { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors, ROOT };
