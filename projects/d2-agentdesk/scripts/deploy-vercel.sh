#!/usr/bin/env bash
#
# One-shot deploy of D2 AgentDesk to Vercel + Supabase.
#
# Run this on YOUR machine, where your browser and logins live. It handles every step
# that needs your credentials, and does the rest itself:
#
#   1. logs you into Vercel (opens your real browser)
#   2. reads your Supabase database password, without echoing or storing it
#   3. creates both Vercel projects and sets their environment variables
#   4. deploys the API, reads back its URL, points the frontend at it, deploys that
#   5. seeds the demo and verifies all five planner branches against the live database
#
# The Supabase project, schema and RLS already exist -- only the password is missing,
# because it is the one value the Supabase API will not hand out.
#
#   Usage:  bash scripts/deploy-vercel.sh
#
set -euo pipefail

SUPABASE_REF="zhfhznnrxpgkpsejukxc"     # project "d2-agentdesk", ap-south-1
SUPABASE_REGION="ap-south-1"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

say()  { printf '\n\033[1;36m==>\033[0m %s\n' "$1"; }
ok()   { printf '    \033[32m✓\033[0m %s\n' "$1"; }
die()  { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

# ---------------------------------------------------------------- prerequisites
command -v node >/dev/null || die "node is not installed"
command -v npx  >/dev/null || die "npx is not installed"
command -v curl >/dev/null || die "curl is not installed"
ok "node $(node -v)"

say "Logging in to Vercel (this opens your browser)"
# `whoami` fails when logged out; only then do we prompt.
npx --yes vercel@latest whoami >/dev/null 2>&1 || npx --yes vercel@latest login
ok "Vercel: $(npx --yes vercel@latest whoami 2>/dev/null)"

# ---------------------------------------------------------------- the one secret
cat <<'EOF'

  Supabase database password
  ──────────────────────────
  Open:  https://supabase.com/dashboard/project/zhfhznnrxpgkpsejukxc/settings/database

  If you never saw the password, click "Reset database password" and copy the new one.
  It is read silently below -- not echoed, not written to disk, not kept in shell history.

EOF
read -rsp "  Password: " DB_PASSWORD
echo
[ -n "$DB_PASSWORD" ] || die "no password entered"

# URL-encode, since Postgres passwords routinely contain characters that break a URI.
ENC_PASSWORD="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$DB_PASSWORD")"

# Pooled connection for the serverless runtime: a Lambda opens a connection per invocation,
# so it must go through pgbouncer or the database runs out of slots under any real traffic.
DATABASE_URL="postgresql://postgres.${SUPABASE_REF}:${ENC_PASSWORD}@aws-0-${SUPABASE_REGION}.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
# Direct connection for migrations, which cannot run through a transaction-mode pooler.
DIRECT_URL="postgresql://postgres:${ENC_PASSWORD}@db.${SUPABASE_REF}.supabase.co:5432/postgres"

say "Checking the database is reachable before deploying anything"
cd "$HERE/backend"
[ -d node_modules ] || npm install >/dev/null 2>&1
DATABASE_URL="$DIRECT_URL" DIRECT_URL="$DIRECT_URL" \
  npx prisma migrate status >/dev/null 2>&1 \
  && ok "connected, schema present" \
  || die "could not connect. Check the password, and that the project is not paused."

# ---------------------------------------------------------------- deploy the API
say "Deploying the API"
cd "$HERE/backend"
npx --yes vercel@latest link --yes --project d2-agentdesk-api >/dev/null

set_env () {  # name value  — replace any existing value rather than erroring on re-run
  npx --yes vercel@latest env rm "$1" production --yes >/dev/null 2>&1 || true
  printf '%s' "$2" | npx --yes vercel@latest env add "$1" production >/dev/null
}
set_env DATABASE_URL   "$DATABASE_URL"
set_env DIRECT_URL     "$DIRECT_URL"
set_env PLANNER_KIND   "rule_based"
set_env AGENT_MAX_STEPS "6"
set_env NODE_ENV       "production"
# REDIS_URL is deliberately unset: there is no Redis on serverless, and the cache is
# fail-open by design, so the app reports redis:"not_configured" and runs at full speed.
ok "environment set (5 variables, REDIS_URL intentionally absent)"

API_URL="$(npx --yes vercel@latest deploy --prod --yes 2>/dev/null | tail -1)"
[ -n "$API_URL" ] || die "API deploy produced no URL"
ok "API: $API_URL"

say "Verifying the API before pointing the UI at it"
for i in $(seq 1 30); do
  HEALTH="$(curl -fsS "$API_URL/healthz" 2>/dev/null || true)"
  [ -n "$HEALTH" ] && break
  sleep 2
done
echo "$HEALTH" | grep -q '"postgres":true' \
  || die "API is up but Postgres is unreachable. Response: ${HEALTH:-<none>}"
ok "healthz: $HEALTH"

# ---------------------------------------------------------------- deploy the UI
say "Deploying the UI"
cd "$HERE/frontend"

# Proxy /api and /healthz to the API deployment so the browser only ever sees one origin:
# no CORS preflight, and no backend URL baked into the bundle.
cat > vercel.json <<JSON
{
  "\$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "rewrites": [
    { "source": "/api/(.*)",  "destination": "${API_URL}/api/\$1" },
    { "source": "/healthz",   "destination": "${API_URL}/healthz" },
    { "source": "/((?!assets/).*)", "destination": "/index.html" }
  ]
}
JSON

npx --yes vercel@latest link --yes --project d2-agentdesk >/dev/null
UI_URL="$(npx --yes vercel@latest deploy --prod --yes 2>/dev/null | tail -1)"
[ -n "$UI_URL" ] || die "UI deploy produced no URL"
ok "UI: $UI_URL"

# ---------------------------------------------------------------- prove it works
say "Seeding the demo and checking every planner branch"
curl -fsS -X POST "$API_URL/api/seed" >/dev/null || die "seed failed"

curl -fsS "$API_URL/api/tickets" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
  const t=JSON.parse(s);
  const want=["answered_from_kb","refund_issued","no_order_found","no_kb_coverage","refund_failed"];
  const got=new Set(t.map(x=>x.outcome));
  for (const x of t.sort((a,b)=>a.customerId.localeCompare(b.customerId)))
    console.log(`    ${x.customerId.padEnd(10)} ${String(x.status).padEnd(10)} ${String(x.outcome).padEnd(18)} ${x.stepCount} steps`);
  const missing = want.filter(w=>!got.has(w));
  if (missing.length) { console.error("\n  ✗ branches never reached: "+missing.join(", ")); process.exit(1); }
  console.log("\n    all five planner branches reached");
});' || die "the seeded run did not exercise every branch"

cat <<EOF

  ────────────────────────────────────────────────────────────
   Live.

     App   $UI_URL
     API   $API_URL

   Try it:  open the app, pick "Refund for my keyboard" for a three-step trace
            ending in a real refund, then "Do you offer student internships?"
            to watch the agent reject a weak match instead of answering from it.
  ────────────────────────────────────────────────────────────

EOF
