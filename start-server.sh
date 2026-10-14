#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
#
# Start the CHIRAG Jal Sakhi backend on this machine (or a VPS).
# Requires Docker.
#
# Usage:
#   ./start-server.sh            # interactive (asks for SMS keys etc.)
#   ./start-server.sh --quick    # no prompts; uses defaults

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)/backend"
cd "$ROOT"

MODE="${1:-interactive}"

if ! command -v docker &> /dev/null; then
  cat >&2 <<EOF
❌ Docker not found on PATH.

Install:
  • macOS:   https://docs.docker.com/desktop/install/mac-install/
  • Linux:   curl -fsSL https://get.docker.com | sh

Then re-run this script.
EOF
  exit 1
fi

# ───────── prepare .env ─────────
if [ ! -f .env ]; then
  cp .env.example .env

  # Generate a real JWT secret (no manual editing required)
  if command -v openssl &> /dev/null; then
    JWT=$(openssl rand -hex 48)
  else
    JWT=$(date | shasum | awk '{print $1}')
  fi
  # Cross-platform in-place sed
  sed -i.bak "s|JWT_SECRET=.*|JWT_SECRET=$JWT|" .env && rm -f .env.bak
  echo "✓ Generated random JWT_SECRET (48 bytes hex) into .env"
fi

if [ "$MODE" = "interactive" ]; then
  echo ""
  echo "Optional: SMS gateway (Fast2SMS) — leave blank for dev (OTPs printed to logs)."
  read -p "  Fast2SMS API key (or blank): " FASTKEY
  if [ -n "$FASTKEY" ]; then
    sed -i.bak "s|FAST2SMS_API_KEY=.*|FAST2SMS_API_KEY=$FASTKEY|" .env && rm -f .env.bak
    sed -i.bak "s|OTP_DEV_LOG=.*|OTP_DEV_LOG=false|" .env && rm -f .env.bak
    echo "  ✓ Real SMS will be sent."
  else
    echo "  ✓ Dev mode: OTPs printed to backend logs (no SMS sent)."
  fi

  read -p "  Public base URL for photos (default http://localhost:8080): " PUB
  PUB=${PUB:-http://localhost:8080}
  sed -i.bak "s|PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=$PUB|" .env && rm -f .env.bak
fi

# ───────── bring up ─────────
echo ""
echo "→ Starting Postgres + API containers…"
docker compose up -d --build
echo ""
echo "→ Waiting for Postgres to accept connections…"
for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U chirag &>/dev/null; then break; fi
  sleep 1
done

echo ""
echo "→ Running migrations…"
docker compose exec -T api npm run migrate

if [ "$MODE" = "interactive" ]; then
  read -p "Seed demo data + sample springs? [Y/n]: " SEED
  SEED=${SEED:-Y}
else
  SEED=Y
fi
if [ "${SEED^^}" = "Y" ]; then
  docker compose exec -T api npm run seed -- --csv /app/../docs/sample_springs.csv 2>/dev/null \
    || docker compose exec -T api npm run seed
fi

# ───────── status ─────────
IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "<your-ip>")
PORT=8080

cat <<EOF

════════════════════════════════════════════════════════════
✓ CHIRAG Jal Sakhi backend is running.

  Health check:    http://localhost:$PORT/health
  API docs:        http://localhost:$PORT/docs
  Local IP:        $IP   (phones on same Wi-Fi use http://$IP:$PORT)

  Demo credentials (created by seed):
    Manager:  manager@chirag.org / chirag@2026
    Admin:    admin@chirag.org   / chirag@2026
    KRP:      +919999900001  (request OTP, see logs)

  Logs:           docker compose -f $ROOT/docker-compose.yml logs -f api
  Stop:           docker compose -f $ROOT/docker-compose.yml down

Next: open the admin connect page in your browser:
    file://$(cd .. && pwd)/admin/connect.html

It will help you generate an APK and a scannable QR code for KRPs.
════════════════════════════════════════════════════════════
EOF
