#!/usr/bin/env bash
# Spins up a throwaway Postgres, applies every migration + the seed, and runs
# supabase/tests/smoke.sql (voting, RLS, drop lock, orders, money).
# Needs Postgres 15+ binaries on PATH or in /usr/lib/postgresql/<v>/bin.
set -euo pipefail
cd "$(dirname "$0")/.."

PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PGBIN:$PATH"
DATA="$(pwd)/.pgtest"
PORT="${PGPORT_TEST:-54329}"

if [ "$(id -u)" = "0" ]; then RUNAS="runuser -u postgres --"; chown_needed=1; else RUNAS=""; chown_needed=0; fi

rm -rf "$DATA" && mkdir -p "$DATA"
[ $chown_needed = 1 ] && chown postgres "$DATA"
$RUNAS initdb -D "$DATA" -U postgres -A trust >/dev/null
$RUNAS pg_ctl -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=''" -l "$DATA/log.txt" start >/dev/null
trap '$RUNAS pg_ctl -D "$DATA" stop -m fast >/dev/null 2>&1 || true' EXIT

PSQL="psql -h /tmp -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
$PSQL -f scripts/auth-stub.sql
for f in supabase/migrations/*.sql; do
  echo "→ $f"
  $PSQL -f "$f"
done
echo "→ supabase/seed.sql"
$PSQL -f supabase/seed.sql >/dev/null
echo "→ supabase/tests/smoke.sql"
$PSQL -f supabase/tests/smoke.sql
echo "→ supabase/tests/growth.sql"
$PSQL -f supabase/tests/growth.sql
echo "✓ database tests passed"
