// Builds the iOS or Android app project from dist/ (docs/native-migration-spec.md step 8).
//   node scripts/native.mjs ios|android      (after npm run build)
// The ios/ and android/ folders are generated, never edited by hand and never committed (CLAUDE.md):
// this adds the platform if it's missing, copies the built web app in (cap sync), then applies the
// settings in capacitor.config.json's "vinterestNative": iOS Info.plist entries (the camera
// wording, export compliance), the iOS icon and launch screen from assets/ios/, Android
// permissions and features (the camera), and the Android icons and launch screen from
// assets/android/. Android's versionName is package.json's version; its versionCode (Google Play's
// build number) is ANDROID_VERSION_CODE when the build sets it (.github/workflows/play.yml), else 1.
// Debug builds (the PR test app) are app.vinterest.dev, "Vinterest Dev", so they install beside
// the Play app.
// Running it again changes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { patchInfoPlist, patchManifest, patchAppGradle, patchIconBackground } from './native-config.mjs';
import { ANDROID_DENSITIES, ANDROID_ICON_BACKGROUND } from './app-icons.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const platform = process.argv[2];
if (!['ios', 'android'].includes(platform)) { console.error('Usage: node scripts/native.mjs ios|android'); process.exit(1); }
if (!fs.existsSync(path.join(ROOT, 'dist/index.html'))) { console.error('Run npm run build first.'); process.exit(1); }
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'capacitor.config.json'), 'utf8')).vinterestNative || {};
const cap = (...args) => execFileSync(process.execPath, [path.join(ROOT, 'node_modules/@capacitor/cli/bin/capacitor'), ...args], { cwd: ROOT, stdio: 'inherit' });

if (!fs.existsSync(path.join(ROOT, platform))) cap('add', platform);
cap('sync', platform);

if (platform === 'ios') {
  const file = path.join(ROOT, 'ios/App/App/Info.plist');
  fs.writeFileSync(file, patchInfoPlist(fs.readFileSync(file, 'utf8'), config.ios && config.ios.infoPlist));
  // The app icon and launch screen, rendered from assets/*.svg by scripts/app-icons.mjs.
  const xc = path.join(ROOT, 'ios/App/App/Assets.xcassets');
  fs.copyFileSync(path.join(ROOT, 'assets/ios/AppIcon-1024.png'), path.join(xc, 'AppIcon.appiconset/AppIcon-512@2x.png'));
  for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'])
    fs.copyFileSync(path.join(ROOT, 'assets/ios/splash-2732.png'), path.join(xc, 'Splash.imageset', f));
} else {
  const file = path.join(ROOT, 'android/app/src/main/AndroidManifest.xml');
  fs.writeFileSync(file, patchManifest(fs.readFileSync(file, 'utf8'), config.android));
  const gradle = path.join(ROOT, 'android/app/build.gradle');
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  fs.writeFileSync(gradle, patchAppGradle(fs.readFileSync(gradle, 'utf8'), { versionName: version, versionCode: process.env.ANDROID_VERSION_CODE || 1 }));
  // The icons and launch screen, rendered from assets/*.svg by scripts/app-icons.mjs.
  const res = path.join(ROOT, 'android/app/src/main/res'), art = path.join(ROOT, 'assets/android');
  for (const d of Object.keys(ANDROID_DENSITIES)) {
    for (const f of ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground'])
      fs.copyFileSync(path.join(art, `${f}-${d}.png`), path.join(res, `mipmap-${d}`, `${f}.png`));
    fs.copyFileSync(path.join(art, `splash-port-${d}.png`), path.join(res, `drawable-port-${d}`, 'splash.png'));
    fs.copyFileSync(path.join(art, `splash-land-${d}.png`), path.join(res, `drawable-land-${d}`, 'splash.png'));
  }
  fs.copyFileSync(path.join(art, 'splash-port-mdpi.png'), path.join(res, 'drawable', 'splash.png'));
  // The debug build (the PR test app, app.vinterest.dev) is "Vinterest Dev" on the home screen.
  const debugRes = path.join(ROOT, 'android/app/src/debug/res/values');
  fs.mkdirSync(debugRes, { recursive: true });
  fs.writeFileSync(path.join(debugRes, 'strings.xml'), `<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">Vinterest Dev</string>
    <string name="title_activity_main">Vinterest Dev</string>
</resources>
`);
  const bg = path.join(res, 'values/ic_launcher_background.xml');
  fs.writeFileSync(bg, patchIconBackground(fs.readFileSync(bg, 'utf8'), ANDROID_ICON_BACKGROUND));
}
console.log(`${platform}: synced from dist/ and configured from capacitor.config.json`);
