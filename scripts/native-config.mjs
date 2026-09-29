// The edits scripts/native.mjs makes to the generated native projects, from capacitor.config.json's
// "vinterestNative". Pure text in, text out, so tests/native.spec.js can check them; both are safe
// to run again (an entry already there is replaced, not added twice).
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function patchInfoPlist(xml, entries) {
  for (const [key, value] of Object.entries(entries || {})) {
    // true/false become plist booleans (<true/>, <false/>); everything else a string.
    const val = typeof value === 'boolean' ? `<${value}/>` : `<string>${esc(value)}</string>`;
    const entry = `\t<key>${esc(key)}</key>\n\t${val}\n`;
    const re = new RegExp(`\\t?<key>${key}</key>\\s*(<string>[\\s\\S]*?</string>|<true/>|<false/>)\\n?`);
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

