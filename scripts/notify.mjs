// Emails Vinterest's own people that there is something to look at (.github/workflows/notify.yml), through Resend.
//
//   RESEND_API_KEY   the Resend key (a GitHub secret). Without it nothing is sent and the script says so.
//   NOTIFY_TO        who gets it: one address or several, comma-separated (a GitHub variable, never in the repo)
//   RESEND_FROM      the sender, default "Vinterest <hello@vinterest.app>" (its domain is verified in Resend)
//   NOTIFY_SUBJECT   the subject; NOTIFY_MESSAGE the words; NOTIFY_LINK where to look (default the internal page)
//   NOTIFY_COMMIT    a commit message, for a push to main: its title is the subject when none is given
//
// `--dry` prints the email instead of sending it (tests/notify.spec.js).
const env = process.env, dry = process.argv.includes('--dry');
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// A merge commit's first line is "Merge pull request #95 from …"; what changed is the pull request's title, under it.
export function titleOf(commit) {
  const lines = String(commit || '').split('\n').map((l) => l.trim()).filter(Boolean), first = lines[0] || '';
  const t = /^Merge (pull request|branch)/i.test(first) && lines[1] ? lines[1] : first;
  return t.replace(/\[notify\]/gi, '').replace(/\s+/g, ' ').trim().slice(0, 140);
}
export function compose(e) {
  const link = (e.NOTIFY_LINK || 'https://internal.vinterest.team/').trim(), safe = /^https:\/\//.test(link) ? link : 'https://internal.vinterest.team/';
  const what = titleOf(e.NOTIFY_COMMIT), subject = (e.NOTIFY_SUBJECT || '').trim() || (what ? `Vinterest: ${what}` : 'Vinterest: something new to look at');
  const message = (e.NOTIFY_MESSAGE || '').trim() || (what ? `This is now live: ${what}.` : 'There is something new to look at.');
  const text = `${message}\n\nSee it here: ${safe}\n\nSent from Vinterest's build. Reply to this email to answer.`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#15110A;max-width:560px">${message.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}<p style="margin:20px 0"><a href="${esc(safe)}" style="display:inline-block;padding:11px 18px;background:#8B1A2F;color:#fff;text-decoration:none;font-weight:bold">See it</a></p><p style="margin:0;color:#6b6b72;font-size:13px">${esc(safe)}</p></div>`;
  return { subject: subject.slice(0, 160), text, html };
}
async function main() {
  const to = (env.NOTIFY_TO || '').split(',').map((s) => s.trim()).filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)), msg = compose(env);
  if (dry) { console.log(JSON.stringify({ to: to.length, ...msg }, null, 1)); return; }
  const missing = [!env.RESEND_API_KEY && 'the RESEND_API_KEY secret', !to.length && 'the NOTIFY_TO variable'].filter(Boolean);
  if (missing.length) { console.log(`Nothing sent: ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not set (repository Settings, Secrets and variables, Actions).`); return; }
  const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.RESEND_FROM || 'Vinterest <hello@vinterest.app>', to, ...(env.NOTIFY_REPLY_TO ? { reply_to: env.NOTIFY_REPLY_TO } : {}), ...msg }) });
  if (!res.ok) { console.error(`Resend refused it: ${res.status} ${(await res.text()).slice(0, 300)}`); process.exit(1); }
  console.log(`Sent "${msg.subject}" to ${to.length} ${to.length === 1 ? 'person' : 'people'}.`);
}
if (process.argv[1] && process.argv[1].endsWith('notify.mjs')) main().catch((e) => { console.error(e.message || e); process.exit(1); });
