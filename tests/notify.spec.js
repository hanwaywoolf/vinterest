// The "something to look at" email (scripts/notify.mjs, .github/workflows/notify.yml).
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const run = (env, args = ['--dry']) => execFileSync('node', ['scripts/notify.mjs', ...args], { cwd: ROOT, env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });

test('a message sent by hand carries its words and its link', () => {
  const m = JSON.parse(run({ NOTIFY_TO: 'a@example.com, b@example.com, not-an-address', NOTIFY_SUBJECT: 'Seller is ready', NOTIFY_MESSAGE: 'The visit brief for Eloise is up.\n\n<b>Have a look</b>', NOTIFY_LINK: 'https://internal.vinterest.team/#seller' }));
  expect(m.to).toBe(2);
  expect(m.subject).toBe('Seller is ready');
  expect(m.text).toContain('The visit brief for Eloise is up.'); expect(m.text).toContain('https://internal.vinterest.team/#seller');
  expect(m.html).toContain('&lt;b&gt;Have a look&lt;/b&gt;'); // what was typed is text, never markup
});

test('a push to main is named by what was merged, and a link that is not https falls back to the internal page', () => {
  const m = JSON.parse(run({ NOTIFY_TO: 'a@example.com', NOTIFY_COMMIT: 'Merge pull request #96 from hanwaywoolf/claude/x\n\nVinterest Seller on the internal page [notify]', NOTIFY_LINK: 'javascript:alert(1)' }));
  expect(m.subject).toBe('Vinterest: Vinterest Seller on the internal page');
  expect(m.text).toContain('See it here: https://internal.vinterest.team/');
  expect(m.html).not.toContain('javascript:');
});

test('with no key or nobody to send to, nothing is sent and it says what is missing', () => {
  const out = run({}, []);
  expect(out).toContain('Nothing sent'); expect(out).toContain('RESEND_API_KEY'); expect(out).toContain('NOTIFY_TO');
});
