// Applies supabase/migrations/*.sql (once each, in order) before every build.
// Uses the direct Postgres URL that Vercel's Supabase integration provides.
// Optional: SEED_DEMO=true loads supabase/seed.sql into an empty database (test/staging only).
// Optional: ADMIN_EMAILS=a@b.com,c@d.com makes those accounts admins.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.log('[migrate] No database URL set — skipping migrations.');
  process.exit(0);
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = path.join(root, 'supabase', 'migrations');
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url) || /sslmode=disable/.test(url);
const clean = url.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '');
// Supabase requires TLS; its pooler certificates are not in Node's default CA store.
const client = new pg.Client({ connectionString: clean, ssl: local ? false : { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  await client.query(`create schema if not exists inkpulse_meta;
    create table if not exists inkpulse_meta.migrations (name text primary key, applied_at timestamptz not null default now());
    revoke all on schema inkpulse_meta from public;`);
  const done = new Set((await client.query('select name from inkpulse_meta.migrations')).rows.map((r) => r.name));

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    console.log(`[migrate] applying ${file}`);
    await client.query('begin');
    try {
      await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
      await client.query('insert into inkpulse_meta.migrations (name) values ($1)', [file]);
      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      throw new Error(`${file}: ${e.message}`);
    }
  }

  if (process.env.SEED_DEMO === 'true') {
    const { rows } = await client.query('select count(*)::int as n from public.drops');
    if (rows[0].n === 0) {
      console.log('[migrate] loading demo seed');
      await client.query('begin');
      await client.query(fs.readFileSync(path.join(root, 'supabase', 'seed.sql'), 'utf8'));
      await client.query('commit');
    }
  }

  const admins = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (admins.length) {
    await client.query('update public.settings set admin_emails = $1', [admins]);
    await client.query(`update public.profiles set is_admin = true
      where id in (select id from auth.users where lower(email) = any($1))`, [admins]);
  }
  console.log('[migrate] database is up to date');
}

main()
  .then(() => client.end())
  .catch(async (e) => {
    console.error('[migrate] FAILED:', e.message);
    await client.end().catch(() => {});
    process.exit(1);
  });
