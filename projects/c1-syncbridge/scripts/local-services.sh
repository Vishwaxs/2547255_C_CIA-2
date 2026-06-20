#!/usr/bin/env bash
# Start Postgres + Redis locally for SyncBridge (no Docker daemon required).
# Postgres on 5434, Redis on 6381 — avoids clashing with Snipr (5432/6379) and QAForge (5433/6380).
set -euo pipefail

PGDATA="${PGDATA:-/tmp/syncbridge-pg}"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | head -1 || true)"
RUNUSER="${RUNUSER:-syncbridgeuser}"

if [ -z "$PGBIN" ]; then echo "Postgres server binaries not found"; exit 1; fi

# --- Postgres on 5434 -------------------------------------------------------
if ! "$PGBIN/pg_isready" -h 127.0.0.1 -p 5434 -q 2>/dev/null; then
  if [ "$(id -u)" = "0" ]; then
    id "$RUNUSER" >/dev/null 2>&1 || useradd -m "$RUNUSER"
    AS_USER=(sudo -u "$RUNUSER")
  else
    AS_USER=()
  fi

  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    rm -rf "$PGDATA"; mkdir -p "$PGDATA"
    [ "${#AS_USER[@]}" -gt 0 ] && chown -R "$RUNUSER" "$PGDATA"
    "${AS_USER[@]}" "$PGBIN/initdb" -D "$PGDATA" -U syncbridge --auth=trust >/tmp/syncbridge-initdb.log 2>&1
    echo "host all all 127.0.0.1/32 trust" >> "$PGDATA/pg_hba.conf"
  fi
  "${AS_USER[@]}" "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p 5434 -k /tmp" -l /tmp/syncbridge-pg.log start
  for _ in $(seq 1 20); do "$PGBIN/pg_isready" -h 127.0.0.1 -p 5434 -q && break; sleep 0.5; done
  "${AS_USER[@]}" "$PGBIN/createdb" -h /tmp -p 5434 -U syncbridge syncbridge 2>/dev/null || true
  echo "postgres: started on 5434"
else
  echo "postgres: already running on 5434"
fi

# --- Redis on 6381 ----------------------------------------------------------
if ! redis-cli -p 6381 ping >/dev/null 2>&1; then
  redis-server --daemonize yes --dir /tmp --port 6381 --appendonly no
  for _ in $(seq 1 10); do redis-cli -p 6381 ping >/dev/null 2>&1 && break; sleep 0.5; done
  echo "redis: started on 6381"
else
  echo "redis: already running on 6381"
fi

echo "services ready."
