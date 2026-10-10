// The files that make up the app bundle, in load order. They share one global script scope
// (a top-level `function`/`const` in one file is visible to every file after it, and to
// tweaks-inline.compiled.js), so order matters and the build concatenates rather than
// wrapping each file in its own module.
//
// This list mirrors the `/* ---- file ---- */` markers in the legacy hand-compiled bundle.js;
// tests/build.spec.js fails if the two drift while bundle.js still exists (files added since,
// like pwa-winedna.js, are allowed; the ones bundle.js has must stay in its order).
export const APP_SOURCES = [
  'pwa-platform.js',
  'claude-bridge.js',
  'pwa-store.js',
  'pwa-textsize.js',
  'pwa-xp.js',
  'pwa-mastery.js',
  'pwa-content-engine.js',
  'pwa-grape-learning.js',
  'pwa-quiz-questions.js',
  'pwa-winedna.js',
  'pwa-match.js',
  'pwa-scan.js',
  'pwa-prefs.js',
  'pwa-mywines.js',
  'pwa-learnnext.js',
  'pwa-guides.js',
  'pwa-knowledge.js',
  'pwa-detail.js',
  'pwa-palate.js',
  'pwa-vinny.js',
  'pwa-wines.js',
  'pwa-regional.js',
  'pwa-userdata.js',
  'pwa-backup.js',
  'pwa-account.js',
  'pwa-install.js',
  'pwa-sync.js',
  'pwa-components.jsx',
  'tweaks-panel.jsx',
  'pwa-screens-main.jsx',
  'pwa-deep.js',
  'pwa-waiting.jsx',
  'pwa-scancards.jsx',
  'pwa-reveal.jsx',
  'pwa-screens-detail.jsx',
  'pwa-screens-explore.jsx',
  'pwa-sketch.jsx',
  'pwa-screens-quiz.jsx',
  'pwa-screens-aux.jsx',
  'pwa-screens-account.jsx',
  'flow-welcome.jsx',
  'flow-onboard.jsx',
  'pwa-newflow.jsx',
  'pwa-screens-learn.jsx',
  'pwa-screens-home.jsx',
  'pwa-screens-wineiq.jsx',
  'pwa-moments.jsx',
  'pwa-app.jsx',
];

// Copied into dist/ unchanged. Directories are copied recursively.
export const STATIC_FILES = [
  'manifest.json',
  'sw.js',
  '_worker.js',
  'data/retailers.json', // read by the Worker's /go, so link routing follows the deployed list
  '_headers',
  '_redirects',
  'icons',
  'logo.png',
  'onboarding-home.jpg',
  'reset.html',
  'rescue.html',
  'tweaks-inline.compiled.js',
];
