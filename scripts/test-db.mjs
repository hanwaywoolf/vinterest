// Runs the Supabase migrations and their row-level-security tests (supabase/tests/rls.sql) on a
// throwaway local Postgres, with a small stand-in for Supabase's auth schema and roles
// (supabase/tests/supabase-shim.sql). Needs Postgres installed (initdb, pg_ctl, psql); no
// Supabase account. `npm run test:db`.
import { execFileSync, spawnSync } from 'node:child_process';
const require_spawn = (c, a) => spawnSync(c, a, { encoding: 'utf8' });
import { mkdtempSync, readdirSync, rmSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const binDir = ['/usr/lib/postgresql/17/bin', '/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin'].find((d) => existsSync(d));
const bin = (n) => (binDir ? join(binDir, n) : n);
// Postgres won't run as root; in a root container, run it as the postgres user.
const asPg = process.getuid && process.getuid() === 0 ? ['runuser', '-u', 'postgres', '--'] : [];
const run = (cmd, args, opts = {}) => { const [c, ...a] = [...asPg, cmd, ...args]; return String(execFileSync(c, a, { stdio: 'pipe', ...opts }) ?? ''); };

const dir = mkdtempSync(join(tmpdir(), 'vinterest-db-'));
chmodSync(dir, 0o777);
const data = join(dir, 'data'), port = String(55000 + Math.floor(Math.random() * 1000));
let started = false;
try {
  run(bin('initdb'), ['-D', data, '-U', 'postgres', '--auth=trust']);
  // The server's output goes to a log file: a background server holding a pipe open would hang us.
  run(bin('pg_ctl'), ['-D', data, '-l', join(dir, 'server.log'), '-o', `-p ${port} -k ${dir} -c listen_addresses=''`, '-w', 'start'], { stdio: 'ignore' });
  started = true;
  const psql = (file) => { const [c, ...a] = [...asPg, bin('psql'), '-h', dir, '-p', port, '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-f', file];
    const r = require_spawn(c, a); if (r.status !== 0) throw Object.assign(new Error('psql failed'), { stderr: r.stderr }); return r.stderr.split('\n').filter((l) => l.includes('NOTICE')).map((l) => l.replace(/^.*NOTICE:\s*/, '')).join('\n') + '\n'; };
  psql(join(ROOT, 'supabase/tests/supabase-shim.sql'));
  for (const f of readdirSync(join(ROOT, 'supabase/migrations')).sort()) psql(join(ROOT, 'supabase/migrations', f));
  // The checks report through notices (stderr): one "ok: …" line each.
  const out = psql(join(ROOT, 'supabase/tests/rls.sql'));
  process.stdout.write(out);
} catch (e) {
  process.stderr.write(String(e.stderr || e.stdout || e.message));
  process.exitCode = 1;
} finally {
  if (started) try { run(bin('pg_ctl'), ['-D', data, '-m', 'immediate', 'stop']); } catch (e) {}
  rmSync(dir, { recursive: true, force: true });
}
