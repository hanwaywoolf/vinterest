// The edits scripts/native.mjs makes to the generated native projects, from capacitor.config.json's
// "vinterestNative". Pure text in, text out, so tests/native.spec.js can check them; both are safe
// to run again (an entry already there is replaced, not added twice).
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function patchInfoPlist(xml, entries) {
  for (const [key, value] of Object.entries(entries || {})) {
    // true/false become plist booleans (<true/>, <false/>), a list an <array> of strings; everything else a string.
    const val = typeof value === 'boolean' ? `<${value}/>`
      : Array.isArray(value) ? `<array>${value.map((v) => `<string>${esc(v)}</string>`).join('')}</array>`
      : `<string>${esc(value)}</string>`;
    const entry = `\t<key>${esc(key)}</key>\n\t${val}\n`;
    const re = new RegExp(`\\t?<key>${key}</key>\\s*(<string>[\\s\\S]*?</string>|<array>[\\s\\S]*?</array>|<true/>|<false/>)\\n?`);
    xml = re.test(xml) ? xml.replace(re, entry) : xml.replace(/<\/dict>\s*<\/plist>\s*$/, `${entry}</dict>\n</plist>\n`);
  }
  return xml;
}
export function patchManifest(xml, { permissions = [], features = [] } = {}) {
  const lines = [];
  for (const p of permissions) if (!xml.includes(`android:name="${p}"`)) lines.push(`    <uses-permission android:name="${p}" />`);
  for (const f of features) if (!xml.includes(`android:name="${f.name}"`)) lines.push(`    <uses-feature android:name="${f.name}" android:required="${f.required ? 'true' : 'false'}" />`);
  return lines.length ? xml.replace(/<\/manifest>\s*$/, `${lines.join('\n')}\n</manifest>\n`) : xml;
}


/* app/build.gradle's version: versionName from package.json, versionCode (Google Play's build
   number, which must go up with every upload) from the build. Debug builds (the PR test app) get
   the ID app.vinterest.dev, so they install beside the Play app instead of clashing with it. */
export const DEBUG_ID_SUFFIX = '.dev';
export function patchAppGradle(gradle, { versionName, versionCode } = {}) {
  if (!/debug\s*\{[^}]*applicationIdSuffix/.test(gradle))
    gradle = gradle.replace(/buildTypes\s*\{/, (m) => `${m}\n        debug {\n            applicationIdSuffix "${DEBUG_ID_SUFFIX}"\n        }`);
  if (versionName) gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${String(versionName).replace(/"/g, '')}"`);
  if (versionCode) {
    const n = parseInt(versionCode, 10);
    if (!(n > 0 && n <= 2100000000)) throw new Error(`versionCode must be a whole number from 1 to 2100000000, not ${versionCode}`);
    gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${n}`);
  }
  return gradle;
}
/* values/ic_launcher_background.xml: the adaptive icon's background colour. */
export function patchIconBackground(xml, colour) {
  return xml.replace(/(<color name="ic_launcher_background">)[^<]*(<\/color>)/, `$1${colour}$2`);
}

/* Push notifications on iPhone (docs/push.md): the entitlement file and the project setting that
   points at it. "production": APNs's live service, which TestFlight and App Store builds use. Applied
   only when the build asks for push (VINTEREST_PUSH=1), so the working pipeline stays as it was. */
export function entitlementsPlist({ apsEnvironment = 'production' } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>aps-environment</key>
\t<string>${esc(apsEnvironment)}</string>
</dict>
</plist>
`;
}
export const ENTITLEMENTS_PATH = 'App/App.entitlements';
export function patchPbxproj(text) {
  return text.replace(/(\n(\t+)INFOPLIST_FILE = App\/Info\.plist;)(?!\n\t+CODE_SIGN_ENTITLEMENTS)/g, (m, line, tabs) => `${line}\n${tabs}CODE_SIGN_ENTITLEMENTS = ${ENTITLEMENTS_PATH};`);
}
