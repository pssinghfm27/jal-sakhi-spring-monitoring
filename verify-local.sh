#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
#
# End-to-end smoke test for Jal Sakhi backend + dashboard on this Mac.
# Brings up Docker, runs migrations + seed, then hits every endpoint that
# matters and prints PASS/FAIL for each. Safe to re-run.
#
# Usage:
#   ./verify-local.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/backend"

API="http://localhost:8080"
PASS=0; FAIL=0
check() {
  local label="$1"; shift
  if eval "$@" >/dev/null 2>&1; then
    echo "  ✓ $label"; PASS=$((PASS+1))
  else
    echo "  ✗ $label"; FAIL=$((FAIL+1))
  fi
}

step() { echo ""; echo "════════ $1 ════════"; }

# ───── 1. .env ─────
step "1/7  .env"
if [ ! -f .env ]; then
  cp .env.example .env
  if command -v openssl &>/dev/null; then
    JWT=$(openssl rand -hex 48)
  else
    JWT=$(date | shasum | awk '{print $1}')$(date | shasum | awk '{print $1}')
  fi
  /usr/bin/sed -i.bak "s|JWT_SECRET=.*|JWT_SECRET=$JWT|" .env && /bin/rm -f .env.bak
  echo "  ✓ Generated .env with random JWT_SECRET"
else
  echo "  ✓ .env already exists"
fi

# ───── 2. docker compose up ─────
step "2/7  docker compose up -d --build"
docker compose up -d --build 2>&1 | /usr/bin/tail -5

# ───── 3. wait for Postgres ─────
step "3/7  Waiting for Postgres to accept connections (max 60s)"
for i in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U chirag >/dev/null 2>&1; then
    echo "  ✓ Postgres ready (after ${i}s)"
    break
  fi
  sleep 1
  if [ "$i" = "60" ]; then echo "  ✗ Postgres didn't start"; exit 1; fi
done

# ───── 4. migrate + seed ─────
step "4/7  Migrations + seed"
docker compose exec -T api npm run migrate 2>&1 | /usr/bin/tail -3
docker compose exec -T api npm run seed -- --csv /app/../docs/sample_springs.csv 2>&1 \
  | /usr/bin/tail -8 || docker compose exec -T api npm run seed 2>&1 | /usr/bin/tail -8

# ───── 5. Wait for API to be healthy ─────
step "5/7  Waiting for API"
for i in $(seq 1 30); do
  if /usr/bin/curl -fsS "$API/health" >/dev/null 2>&1; then
    echo "  ✓ API up"; break
  fi
  sleep 1
done

# ───── 6. Endpoint checks ─────
step "6/7  Endpoint smoke tests"

# 6a. health
HEALTH=$(/usr/bin/curl -fsS "$API/health")
check "GET /health returns ok=true" "echo '$HEALTH' | /usr/bin/grep -q '\"ok\":true'"

# 6b. manager login (seeded user)
MGR_RES=$(/usr/bin/curl -fsS -X POST "$API/auth/login" \
  -H "content-type: application/json" \
  -d '{"identifier":"manager@chirag.org","password":"chirag@2026"}' 2>/dev/null)
MGR_TOKEN=$(echo "$MGR_RES" | /usr/bin/python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))' 2>/dev/null)
check "POST /auth/login as manager (email + password)" "test -n '$MGR_TOKEN'"

# 6c. KRP login (seeded demo KRP)
KRP_RES=$(/usr/bin/curl -fsS -X POST "$API/auth/login" \
  -H "content-type: application/json" \
  -d '{"identifier":"+919999900001","password":"demo1234"}' 2>/dev/null)
KRP_TOKEN=$(echo "$KRP_RES" | /usr/bin/python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))' 2>/dev/null)
check "POST /auth/login as KRP (phone + password)"   "test -n '$KRP_TOKEN'"

# 6d. KRP can fetch their springs
SPRINGS=$(/usr/bin/curl -fsS "$API/krp/springs" -H "authorization: Bearer $KRP_TOKEN" 2>/dev/null)
check "GET /krp/springs (KRP sees village's springs)" "echo '$SPRINGS' | /usr/bin/grep -q '\"items\"'"

# 6e. Villages list (public, used by signup screen)
VILLS=$(/usr/bin/curl -fsS "$API/krp/villages" 2>/dev/null)
check "GET /krp/villages (public, for signup dropdown)" "echo '$VILLS' | /usr/bin/grep -q '\"items\"'"

# 6f. New KRP signup → pending
VILL_ID=$(echo "$VILLS" | /usr/bin/python3 -c 'import sys,json; print(json.load(sys.stdin)["items"][0]["id"])' 2>/dev/null)
TS=$(date +%s)
NEWPHONE="+91$(date +%s | rev | cut -c1-10)"
SIGNUP=$(/usr/bin/curl -fsS -X POST "$API/auth/signup" \
  -H "content-type: application/json" \
  -d "{\"name\":\"Test KRP $TS\",\"phone\":\"$NEWPHONE\",\"password\":\"test1234\",\"village_id\":\"$VILL_ID\",\"note\":\"Auto smoke test\"}" 2>/dev/null)
check "POST /auth/signup creates pending KRP" "echo '$SIGNUP' | /usr/bin/grep -q '\"pending\":true'"

# 6g. Pending KRP can't log in yet (returns 202 pending)
PENDING_LOGIN=$(/usr/bin/curl -s -w "\n%{http_code}" -X POST "$API/auth/login" \
  -H "content-type: application/json" \
  -d "{\"identifier\":\"$NEWPHONE\",\"password\":\"test1234\"}" 2>/dev/null)
PENDING_CODE=$(echo "$PENDING_LOGIN" | /usr/bin/tail -1)
check "Pending KRP login returns 202 (waiting)" "test '$PENDING_CODE' = '202'"

# 6h. Manager sees them in the pending list
PEND_LIST=$(/usr/bin/curl -fsS "$API/krp/pending" -H "authorization: Bearer $MGR_TOKEN" 2>/dev/null)
NEW_ID=$(echo "$PEND_LIST" | /usr/bin/python3 -c "import sys,json; print(next((u['id'] for u in json.load(sys.stdin)['items'] if u['phone']=='$NEWPHONE'),''))" 2>/dev/null)
check "GET /krp/pending shows the new signup"        "test -n '$NEW_ID'"

# 6i. Manager approves
APPROVE=$(/usr/bin/curl -fsS -X POST "$API/krp/$NEW_ID/approve" -H "authorization: Bearer $MGR_TOKEN" 2>/dev/null)
check "POST /krp/:id/approve succeeds"               "echo '$APPROVE' | /usr/bin/grep -q '\"ok\":true'"

# 6j. Now they can log in
APPROVED_LOGIN=$(/usr/bin/curl -fsS -X POST "$API/auth/login" \
  -H "content-type: application/json" \
  -d "{\"identifier\":\"$NEWPHONE\",\"password\":\"test1234\"}" 2>/dev/null)
APPROVED_TOKEN=$(echo "$APPROVED_LOGIN" | /usr/bin/python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))' 2>/dev/null)
check "Approved KRP can now log in"                  "test -n '$APPROVED_TOKEN'"

# 6k. Dashboard endpoints
SUMMARY=$(/usr/bin/curl -fsS "$API/dashboard/summary" -H "authorization: Bearer $MGR_TOKEN" 2>/dev/null)
check "GET /dashboard/summary"                       "echo '$SUMMARY' | /usr/bin/grep -q '\"springs\"'"

MAP=$(/usr/bin/curl -fsS "$API/dashboard/map" -H "authorization: Bearer $MGR_TOKEN" 2>/dev/null)
check "GET /dashboard/map (markers for Leaflet)"     "echo '$MAP' | /usr/bin/grep -q '\"items\"'"

# 6l. Old SMS / OTP routes are gone
OTP_404=$(/usr/bin/curl -s -o /dev/null -w '%{http_code}' -X POST "$API/auth/otp/request" \
  -H "content-type: application/json" -d '{"phone":"+911234567890"}')
check "OLD /auth/otp/request returns 404 (removed)"  "test '$OTP_404' = '404'"

# ───── 7. Summary ─────
step "7/7  Summary"
TOTAL=$((PASS+FAIL))
echo ""
echo "  Passed:  $PASS / $TOTAL"
echo "  Failed:  $FAIL"

LOCAL_IP=$(/usr/sbin/ipconfig getifaddr en0 2>/dev/null || /usr/sbin/ipconfig getifaddr en1 2>/dev/null || echo "<your-ip>")

cat <<EOF

════════════════════════════════════════════════════════════
  Backend is running at:    http://localhost:8080
  API docs (Swagger):       http://localhost:8080/docs
  From an Android phone     http://$LOCAL_IP:8080
    on the same Wi-Fi:

  Demo logins:
    Manager:  manager@chirag.org   /  chirag@2026
    Admin:    admin@chirag.org     /  chirag@2026
    KRP:      +919999900001        /  demo1234
    Smoke-test KRP (auto-approved): $NEWPHONE / test1234

  Try the dashboard:
    cd web-dashboard && npm install && npm run dev
    Opens http://localhost:5173

  Live logs:    docker compose -f backend/docker-compose.yml logs -f api
  Stop all:     docker compose -f backend/docker-compose.yml down
  Reset data:   docker compose -f backend/docker-compose.yml down -v
════════════════════════════════════════════════════════════
EOF

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
