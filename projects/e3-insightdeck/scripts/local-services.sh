#!/usr/bin/env bash
# Start Postgres + Redis locally for E3 InsightDeck (no Docker daemon required).
# Postgres on 5436, Redis on 6383 — +1 from D1 RAG, so all five projects' dev stacks
# can run side by side without clashing.
set -euo pipefail

PGDATA="${PGDATA:-/tmp/insightdeck-pg}"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | head -1 || true)"
RUNUSER="${RUNUSER:-insightdeckuser}"

if [ -z "$PGBIN" ]; then echo "Postgres server binaries not found"; exit 1; fi

# --- Postgres on 5436 -------------------------------------------------------
if ! "$PGBIN/pg_isready" -h 127.0.0.1 -p 5436 -q 2>/dev/null; then
  if [ "$(id -u)" = "0" ]; then
    id "$RUNUSER" >/dev/null 2>&1 || useradd -m "$RUNUSER"
    AS_USER=(sudo -u "$RUNUSER")
  else
    AS_USER=()
  fi

  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    rm -rf "$PGDATA"; mkdir -p "$PGDATA"
    [ "${#AS_USER[@]}" -gt 0 ] && chown -R "$RUNUSER" "$PGDATA"
    "${AS_USER[@]}" "$PGBIN/initdb" -D "$PGDATA" -U insightdeck --auth=trust >/tmp/insightdeck-initdb.log 2>&1
    echo "host all all 127.0.0.1/32 trust" >> "$PGDATA/pg_hba.conf"
  fi
  "${AS_USER[@]}" "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p 5436 -k /tmp" -l /tmp/insightdeck-pg.log start
  for _ in $(seq 1 20); do "$PGBIN/pg_isready" -h 127.0.0.1 -p 5436 -q && break; sleep 0.5; done
  "${AS_USER[@]}" "$PGBIN/createdb" -h /tmp -p 5436 -U insightdeck insightdeck 2>/dev/null || true
  echo "postgres: started on 5436"
else
  echo "postgres: already running on 5436"
fi

# --- Redis on 6383 ----------------------------------------------------------
if ! redis-cli -p 6383 ping >/dev/null 2>&1; then
  redis-server --daemonize yes --dir /tmp --port 6383 --appendonly no
  for _ in $(seq 1 10); do redis-cli -p 6383 ping >/dev/null 2>&1 && break; sleep 0.5; done
  echo "redis: started on 6383"
else
  echo "redis: already running on 6383"
fi

echo "services ready."
