#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
#
# One-command production setup for Jal Sakhi on a fresh Ubuntu 22.04 VPS.
#
# Run as root on the VPS:
#   bash vps-setup.sh chirag.example.org admin@chirag.org
#
# Args:
#   $1 = your domain (must already have an A record pointing at this VPS's IP)
#   $2 = email for Let's Encrypt notifications
#
# What this does, in order:
#   1. Install Docker + Compose + nginx + certbot
#   2. Clone the Jal Sakhi repo
#   3. Generate a strong JWT secret
#   4. Bring up Postgres + API in Docker
#   5. Run migrations + seed demo data
#   6. Build the web dashboard (npm install + build)
#   7. Configure nginx: dashboard at /, API at /api/, photos at /uploads/
#   8. Issue Let's Encrypt cert via certbot
#   9. Print the URLs you give to KRPs and managers

set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root: sudo bash vps-setup.sh ..."
  exit 1
fi

DOMAIN="${1:-}"
EMAIL="${2:-}"
REPO_URL="${REPO_URL:-https://github.com/CHIRAG/jalsakhi.git}"  # change to your repo
INSTALL_DIR="/opt/jalsakhi"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  cat >&2 <<EOF
Usage: bash vps-setup.sh <domain> <email>

Example:
  bash vps-setup.sh chirag.example.org admin@chirag.org

Before running, make sure:
  • Your domain's A record points at this server's public IP
  • Port 80 and 443 are open in your firewall / cloud security group
EOF
  exit 1
fi

step() { echo ""; echo "════════ $1 ════════"; }
ok()   { echo "✓ $1"; }

# ────────── 1. System packages ──────────
step "1/9  Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx ufw rsync

# Docker
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
  ok "Docker installed"
else
  ok "Docker already installed"
fi

# Node 20 (for building the dashboard)
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
  ok "Node $(node --version) installed"
else
  ok "Node $(node --version) already installed"
fi

# ────────── 2. Firewall ──────────
step "2/9  Configuring firewall (UFW: SSH, HTTP, HTTPS only)"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ok "Firewall active"

# ────────── 3. Clone repo ──────────
step "3/9  Fetching Jal Sakhi source"
if [ -d "$INSTALL_DIR" ]; then
  ok "Repo already at $INSTALL_DIR — pulling latest"
  cd "$INSTALL_DIR" && git pull --quiet || true
else
  if [[ "$REPO_URL" == file://* ]] || [[ -d "$REPO_URL" ]]; then
    mkdir -p "$INSTALL_DIR"
    rsync -a "${REPO_URL#file://}/" "$INSTALL_DIR/"
  else
    git clone --quiet "$REPO_URL" "$INSTALL_DIR"
  fi
  ok "Repo at $INSTALL_DIR"
fi

# ────────── 4. Backend env ──────────
step "4/9  Configuring backend"
cd "$INSTALL_DIR/backend"
if [ ! -f .env ]; then
  cp .env.example .env
  JWT=$(openssl rand -hex 48)
  sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT|" .env
  sed -i "s|PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=https://$DOMAIN|" .env
  sed -i "s|OTP_DEV_LOG=.*|OTP_DEV_LOG=false|" .env
  ok "Generated JWT_SECRET, set PUBLIC_BASE_URL=https://$DOMAIN"
fi
cat <<EOF
  💡 Edit /opt/jalsakhi/backend/.env later to add your Fast2SMS API key:
       FAST2SMS_API_KEY=...
     Without it, OTPs are printed to the container logs (dev mode).
EOF

# ────────── 5. Start backend ──────────
step "5/9  Starting Postgres + API in Docker"
docker compose up -d --build
echo "  Waiting for Postgres…"
for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U chirag >/dev/null 2>&1; then break; fi
  sleep 1
done
ok "Postgres ready"
docker compose exec -T api npm run migrate
docker compose exec -T api npm run seed -- --csv /app/../docs/sample_springs.csv 2>/dev/null \
  || docker compose exec -T api npm run seed
ok "Migrations applied + demo data seeded"

# ────────── 6. Build dashboard ──────────
step "6/9  Building manager dashboard"
cd "$INSTALL_DIR/web-dashboard"
npm install --silent --no-audit --no-fund
npm run build
mkdir -p /var/www/jalsakhi
rsync -a --delete dist/ /var/www/jalsakhi/
ok "Dashboard built and copied to /var/www/jalsakhi"

# Also serve admin/connect.html for ops use
mkdir -p /var/www/jalsakhi-admin
cp "$INSTALL_DIR/admin/connect.html" /var/www/jalsakhi-admin/index.html
ok "Admin connect page at https://$DOMAIN/admin/"

# ────────── 7. nginx ──────────
step "7/9  Configuring nginx"
cp "$INSTALL_DIR/deploy/nginx-jalsakhi.conf" /etc/nginx/sites-available/jalsakhi.conf
sed -i "s|__DOMAIN__|$DOMAIN|g" /etc/nginx/sites-available/jalsakhi.conf
ln -sf /etc/nginx/sites-available/jalsakhi.conf /etc/nginx/sites-enabled/jalsakhi.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
ok "nginx configured"

# ────────── 8. HTTPS (Let's Encrypt) ──────────
step "8/9  Issuing Let's Encrypt certificate for $DOMAIN"
if ! certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
  certbot --nginx --non-interactive --agree-tos --email "$EMAIL" \
    -d "$DOMAIN" --redirect
  ok "HTTPS active"
else
  ok "Certificate already exists"
fi

# ────────── 9. Done ──────────
step "9/9  All done!"
cat <<EOF

════════════════════════════════════════════════════════════════════════════
  ✅  Jal Sakhi is LIVE.

  KRP Android app URL:
      https://$DOMAIN/api

  Manager dashboard:
      https://$DOMAIN/

  Admin connect page (URL + QR for KRPs):
      https://$DOMAIN/admin/

  API health check:
      https://$DOMAIN/api/health

  Demo logins (created by seed — CHANGE THESE):
      Manager:  manager@chirag.org / chirag@2026
      Admin:    admin@chirag.org   / chirag@2026
      KRP:      +919999900001  (request OTP, will SMS if Fast2SMS configured)

  Live logs:        docker compose -f $INSTALL_DIR/backend/docker-compose.yml logs -f api
  Restart backend:  docker compose -f $INSTALL_DIR/backend/docker-compose.yml restart
  Update + rebuild: cd $INSTALL_DIR && git pull && bash deploy/vps-setup.sh $DOMAIN $EMAIL

  NEXT STEPS:
    1. On your Mac, rebuild the APK with the production URL:
         ./build-apk.sh https://$DOMAIN/api
       Then re-share dist/jalsakhi-release-*.apk with KRPs.
    2. Add your Fast2SMS API key to /opt/jalsakhi/backend/.env
       and restart:  docker compose -f $INSTALL_DIR/backend/docker-compose.yml restart api
    3. Change the demo passwords by logging into https://$DOMAIN/ and rotating them.
    4. Set up nightly backups (cron suggestion at the end of deploy/PRODUCTION.md).
════════════════════════════════════════════════════════════════════════════
EOF
