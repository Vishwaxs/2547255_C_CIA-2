#!/usr/bin/env bash
# Start Postgres + Redis locally for D1 RAG (no Docker daemon required).
# Postgres on 5435, Redis on 6382 — +1 from SyncBridge (5434/6381), so all four
# projects' dev stacks can run side by side without clashing.
set -euo pipefail

PGDATA="${PGDATA:-/tmp/d1rag-pg}"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | head -1 || true)"
RUNUSER="${RUNUSER:-d1raguser}"

if [ -z "$PGBIN" ]; then echo "Postgres server binaries not found"; exit 1; fi

# --- Postgres on 5435 -------------------------------------------------------
if ! "$PGBIN/pg_isready" -h 127.0.0.1 -p 5435 -q 2>/dev/null; then
  if [ "$(id -u)" = "0" ]; then
    id "$RUNUSER" >/dev/null 2>&1 || useradd -m "$RUNUSER"
    AS_USER=(sudo -u "$RUNUSER")
  else
    AS_USER=()
  fi

  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    rm -rf "$PGDATA"; mkdir -p "$PGDATA"
    [ "${#AS_USER[@]}" -gt 0 ] && chown -R "$RUNUSER" "$PGDATA"
    "${AS_USER[@]}" "$PGBIN/initdb" -D "$PGDATA" -U d1rag --auth=trust >/tmp/d1rag-initdb.log 2>&1
    echo "host all all 127.0.0.1/32 trust" >> "$PGDATA/pg_hba.conf"
  fi
  "${AS_USER[@]}" "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p 5435 -k /tmp" -l /tmp/d1rag-pg.log start
  for _ in $(seq 1 20); do "$PGBIN/pg_isready" -h 127.0.0.1 -p 5435 -q && break; sleep 0.5; done
  "${AS_USER[@]}" "$PGBIN/createdb" -h /tmp -p 5435 -U d1rag d1rag 2>/dev/null || true
  echo "postgres: started on 5435"
else
  echo "postgres: already running on 5435"
fi

# --- Redis on 6382 ----------------------------------------------------------
if ! redis-cli -p 6382 ping >/dev/null 2>&1; then
  redis-server --daemonize yes --dir /tmp --port 6382 --appendonly no
  for _ in $(seq 1 10); do redis-cli -p 6382 ping >/dev/null 2>&1 && break; sleep 0.5; done
  echo "redis: started on 6382"
else
  echo "redis: already running on 6382"
fi

echo "services ready."
