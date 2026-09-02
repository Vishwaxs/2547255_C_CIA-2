#!/usr/bin/env bash
# Start Postgres + Redis locally WITHOUT Docker, for environments where the
# Docker daemon isn't available. Idempotent: safe to re-run. Prefer
# `docker compose up -d` when Docker is available — this is the fallback.
#
#   bash scripts/local-services.sh
#
# Data lives under PGDATA (default /tmp/snipr-pg). Connection settings match
# backend/.env.example (snipr:snipr @ localhost:5432, redis @ localhost:6379).
set -euo pipefail

PGDATA="${PGDATA:-/tmp/snipr-pg}"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | head -1 || true)"
RUNUSER="${RUNUSER:-snipruser}"

if [ -z "$PGBIN" ]; then echo "Postgres server binaries not found"; exit 1; fi

# --- Postgres ---------------------------------------------------------------
if ! "$PGBIN/pg_isready" -h 127.0.0.1 -p 5432 -q 2>/dev/null; then
  # postgres refuses to run as root; use an unprivileged owner.
  if [ "$(id -u)" = "0" ]; then
    id "$RUNUSER" >/dev/null 2>&1 || useradd -m "$RUNUSER"
    AS_USER=(sudo -u "$RUNUSER")
  else
    AS_USER=()
  fi

  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    rm -rf "$PGDATA"; mkdir -p "$PGDATA"
    [ "${#AS_USER[@]}" -gt 0 ] && chown -R "$RUNUSER" "$PGDATA"
    "${AS_USER[@]}" "$PGBIN/initdb" -D "$PGDATA" -U snipr --auth=trust >/tmp/snipr-initdb.log 2>&1
    echo "host all all 127.0.0.1/32 trust" >> "$PGDATA/pg_hba.conf"
  fi
  "${AS_USER[@]}" "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p 5432 -k /tmp" -l /tmp/snipr-pg.log start
  # Wait for readiness.
  for _ in $(seq 1 20); do "$PGBIN/pg_isready" -h 127.0.0.1 -p 5432 -q && break; sleep 0.5; done
  "${AS_USER[@]}" "$PGBIN/createdb" -h /tmp -p 5432 -U snipr snipr 2>/dev/null || true
  echo "postgres: started"
else
  echo "postgres: already running"
fi

# --- Redis ------------------------------------------------------------------
if ! redis-cli ping >/dev/null 2>&1; then
  redis-server --daemonize yes --dir /tmp --appendonly no
  for _ in $(seq 1 10); do redis-cli ping >/dev/null 2>&1 && break; sleep 0.5; done
  echo "redis: started"
else
  echo "redis: already running"
fi

echo "services ready."
