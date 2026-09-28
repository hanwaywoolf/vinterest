// Builds the iOS or Android app project from dist/ (docs/native-migration-spec.md step 8).
//   node scripts/native.mjs ios|android      (after npm run build)
// The ios/ and android/ folders are generated, never edited by hand and never committed (CLAUDE.md):
// this adds the platform if it's missing, copies the built web app in (cap sync), then applies the
// settings in capacitor.config.json's "vinterestNative": iOS Info.plist entries (the camera
// wording) and Android permissions and features (the camera). Running it again changes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { patchInfoPlist, patchManifest } from './native-config.mjs';

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
} else {
  const file = path.join(ROOT, 'android/app/src/main/AndroidManifest.xml');
  fs.writeFileSync(file, patchManifest(fs.readFileSync(file, 'utf8'), config.android));
}
console.log(`${platform}: synced from dist/ and configured from capacitor.config.json`);
