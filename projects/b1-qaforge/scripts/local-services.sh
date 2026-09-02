#!/usr/bin/env bash
# Start Postgres + Redis locally for QAForge (no Docker daemon required).
# Postgres on 5433, Redis on 6380 — avoids clashing with Snipr's services.
set -euo pipefail

PGDATA="${PGDATA:-/tmp/qaforge-pg}"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | head -1 || true)"
RUNUSER="${RUNUSER:-qaforgeuser}"

if [ -z "$PGBIN" ]; then echo "Postgres server binaries not found"; exit 1; fi

# --- Postgres on 5433 -------------------------------------------------------
if ! "$PGBIN/pg_isready" -h 127.0.0.1 -p 5433 -q 2>/dev/null; then
  if [ "$(id -u)" = "0" ]; then
    id "$RUNUSER" >/dev/null 2>&1 || useradd -m "$RUNUSER"
    AS_USER=(sudo -u "$RUNUSER")
  else
    AS_USER=()
  fi

  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    rm -rf "$PGDATA"; mkdir -p "$PGDATA"
    [ "${#AS_USER[@]}" -gt 0 ] && chown -R "$RUNUSER" "$PGDATA"
    "${AS_USER[@]}" "$PGBIN/initdb" -D "$PGDATA" -U qaforge --auth=trust >/tmp/qaforge-initdb.log 2>&1
    echo "host all all 127.0.0.1/32 trust" >> "$PGDATA/pg_hba.conf"
  fi
  "${AS_USER[@]}" "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p 5433 -k /tmp" -l /tmp/qaforge-pg.log start
  for _ in $(seq 1 20); do "$PGBIN/pg_isready" -h 127.0.0.1 -p 5433 -q && break; sleep 0.5; done
  "${AS_USER[@]}" "$PGBIN/createdb" -h /tmp -p 5433 -U qaforge qaforge 2>/dev/null || true
  echo "postgres: started on 5433"
else
  echo "postgres: already running on 5433"
fi

# --- Redis on 6380 ----------------------------------------------------------
if ! redis-cli -p 6380 ping >/dev/null 2>&1; then
  redis-server --daemonize yes --dir /tmp --port 6380 --appendonly no
  for _ in $(seq 1 10); do redis-cli -p 6380 ping >/dev/null 2>&1 && break; sleep 0.5; done
  echo "redis: started on 6380"
else
  echo "redis: already running on 6380"
fi

echo "services ready."
