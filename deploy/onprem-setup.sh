#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
#
# On-premise installer for the CHIRAG HQ server (Ubuntu 22.04+).
#
# Pre-requisites:
#   • The server has a static public IP (you said: <SERVER_IP>)
#   • Your router forwards public ports 80 + 443 → server's LAN IP, port 80/443
#   • Run as root: sudo bash onprem-setup.sh
#
# What this does:
#   1. Detect public IP & derive sslip.io domain (e.g. 103-88-57-138.sslip.io)
#   2. apt install docker, node 20, nginx, certbot
#   3. ufw firewall: allow only ssh + http + https
#   4. Bring up Postgres + API in Docker
#   5. Apply migrations, seed demo data + sample springs
#   6. Build the React dashboard (npm install + build)
#   7. nginx: dashboard at /, API at /api/, photos at /uploads/, admin at /admin/
#   8. Let's Encrypt cert via certbot --nginx
#   9. Print the URL you give to KRPs and managers
#
# Re-runnable: it's idempotent.

set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root:  sudo bash $0"
  exit 1
fi

INSTALL_DIR="${INSTALL_DIR:-/opt/jalsakhi}"
PUBLIC_IP="${PUBLIC_IP:-}"
EMAIL="${EMAIL:-${1:-admin@chirag.org.in}}"
DOMAIN_OVERRIDE="${DOMAIN:-${2:-}}"

step() { echo ""; echo "════════ $1 ════════"; }
ok()   { echo "✓ $1"; }
fail() { echo "❌ $1" >&2; exit 1; }

# ────────── 0. Detect public IP and derive sslip.io domain ──────────
step "0/9  Detecting public IP"
if [ -z "$PUBLIC_IP" ]; then
  PUBLIC_IP=$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null \
              || curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null \
              || true)
fi
if [ -z "$PUBLIC_IP" ]; then
  fail "Could not detect public IP. Run again with:  PUBLIC_IP=<SERVER_IP> bash $0"
fi
ok "Public IP: $PUBLIC_IP"

if [ -n "$DOMAIN_OVERRIDE" ]; then
  DOMAIN="$DOMAIN_OVERRIDE"
  ok "Using custom domain: $DOMAIN  (make sure its A record points at $PUBLIC_IP)"
else
  # sslip.io wildcards: 103-88-57-138.sslip.io  ⇢  <SERVER_IP>
  DOMAIN="${PUBLIC_IP//./-}.sslip.io"
  ok "Auto-derived domain: $DOMAIN  (resolves to $PUBLIC_IP via sslip.io — no DNS setup needed)"
fi

# ────────── 1. System packages ──────────
step "1/9  Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx ufw rsync openssl dnsutils

if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
  ok "Docker installed"
else
  ok "Docker already installed"
fi

if ! command -v node &>/dev/null || [[ "$(node --version)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
ok "Node $(node --version)"

# ────────── 2. Firewall ──────────
step "2/9  Configuring UFW firewall"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ok "Firewall: ssh + 80 + 443 only"

# ────────── 3. Source ──────────
step "3/9  Locating source code at $INSTALL_DIR"
if [ ! -d "$INSTALL_DIR/backend" ]; then
  fail "$INSTALL_DIR/backend not found. rsync the project from your Mac first:
       rsync -avz --exclude node_modules --exclude .gradle --exclude build --exclude dist \\
             --exclude '*.apk' --exclude '*.jks' \\
             '/Users/.../CHIRAG JAL SAKHI/' root@$PUBLIC_IP:$INSTALL_DIR/"
fi
ok "Source present"

# ────────── 4. Backend .env ──────────
step "4/9  Configuring backend"
cd "$INSTALL_DIR/backend"
if [ ! -f .env ]; then
  cp .env.example .env
  JWT=$(openssl rand -hex 48)
  sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT|" .env
  ok "Generated 96-char JWT secret"
fi
# Always update PUBLIC_BASE_URL — domain may have changed.
sed -i "s|PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=https://$DOMAIN|" .env
ok "Set PUBLIC_BASE_URL=https://$DOMAIN"

# ────────── 5. Backend up ──────────
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
ok "Migrations + seed done"

# ────────── 6. Dashboard ──────────
step "6/9  Building manager dashboard"
cd "$INSTALL_DIR/web-dashboard"
npm install --silent --no-audit --no-fund
npm run build
mkdir -p /var/www/jalsakhi
rsync -a --delete dist/ /var/www/jalsakhi/
ok "Dashboard built → /var/www/jalsakhi"

# Admin connect page
mkdir -p /var/www/jalsakhi-admin
cp "$INSTALL_DIR/admin/connect.html" /var/www/jalsakhi-admin/index.html

# ────────── 7. nginx ──────────
step "7/9  Configuring nginx"
cp "$INSTALL_DIR/deploy/nginx-jalsakhi.conf" /etc/nginx/sites-available/jalsakhi.conf
sed -i "s|__DOMAIN__|$DOMAIN|g" /etc/nginx/sites-available/jalsakhi.conf
ln -sf /etc/nginx/sites-available/jalsakhi.conf /etc/nginx/sites-enabled/jalsakhi.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
ok "nginx serving on http://$DOMAIN/"

# ────────── 8. HTTPS ──────────
step "8/9  Issuing Let's Encrypt certificate for $DOMAIN"
# Sanity-check DNS — the cert won't issue if the world can't see the right IP.
RESOLVED=$(dig +short "$DOMAIN" | head -1)
if [ "$RESOLVED" != "$PUBLIC_IP" ]; then
  echo "⚠️  $DOMAIN resolves to '$RESOLVED' but your public IP is '$PUBLIC_IP'."
  echo "    If $DOMAIN ends in .sslip.io this should match automatically."
  echo "    If it's your own domain, fix the A record and re-run."
fi
if ! certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
  certbot --nginx --non-interactive --agree-tos --email "$EMAIL" \
    -d "$DOMAIN" --redirect || {
      echo "⚠️  certbot failed. Possible causes:"
      echo "    • Router not forwarding port 80 to this server yet"
      echo "    • ISP blocks inbound port 80"
      echo "    • DNS for $DOMAIN doesn't point at $PUBLIC_IP from the outside"
      echo "    Run again after fixing:  certbot --nginx -d $DOMAIN --redirect"
    }
else
  ok "Certificate already exists"
fi

# ────────── 9. Done ──────────
step "9/9  Summary"
cat <<EOF

════════════════════════════════════════════════════════════════════════════
✅ Jal Sakhi is LIVE on the CHIRAG HQ server.

   Public IP:           $PUBLIC_IP
   Domain (via sslip):  $DOMAIN
   Manager dashboard:   https://$DOMAIN/
   KRP Android API:     https://$DOMAIN/api
   API health check:    https://$DOMAIN/api/health
   Admin URL + QR page: https://$DOMAIN/admin/

   Demo logins (CHANGE THESE):
     Manager:  manager@chirag.org   /  chirag@2026
     Admin:    admin@chirag.org     /  chirag@2026
     KRP demo: +919999900001        /  demo1234

   Live logs:      docker compose -f $INSTALL_DIR/backend/docker-compose.yml logs -f api
   Stop:           docker compose -f $INSTALL_DIR/backend/docker-compose.yml down
   Restart:        docker compose -f $INSTALL_DIR/backend/docker-compose.yml restart
   Update + rebuild: bash $INSTALL_DIR/deploy/onprem-setup.sh

   NEXT STEPS:
   1. On your Mac, rebuild the APK with the production URL:
        cd '/Users/prahladpratapsingh/Desktop/CHIRAG JAL SAKHI'
        ./build-apk.sh https://$DOMAIN/api
      Then re-share dist/jalsakhi-release-*.apk with KRPs.

   2. Change demo passwords by logging into https://$DOMAIN/

   3. Set up nightly backups (cron):
        0 20 * * * docker compose -f $INSTALL_DIR/backend/docker-compose.yml exec -T db \\
          pg_dump -U chirag jalsakhi | gzip > /var/backups/jalsakhi-\$(date +\%F).sql.gz
════════════════════════════════════════════════════════════════════════════
EOF
