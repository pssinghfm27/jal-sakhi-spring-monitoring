# 🏠 Jal Sakhi — On-premise deployment on the CHIRAG HQ server

Your setup, as we agreed:

| Item | Value |
|---|---|
| Server | CHIRAG HQ desktop, Ubuntu Linux, 500 GB disk, on UPS |
| Public IP (static) | **<SERVER_IP>** |
| Public hostname | **103-88-57-138.sslip.io** (free, auto-resolves to your IP — no DNS setup) |
| Final URLs | `https://103-88-57-138.sslip.io/` (dashboard) and `…/api` (KRP app) |
| Authentication | Password only — no SMS. KRPs sign up → manager approves. |

Total install time: **~30 minutes** end-to-end. Re-runnable safely.

---

## Why sslip.io?

You have a static IP but (probably) no domain name. Let's Encrypt won't issue HTTPS certificates for bare IP addresses, and the Android app needs HTTPS by default.

`sslip.io` is a free public DNS wildcard service: any subdomain of the form `<ip-with-dashes>.sslip.io` resolves to that IP. So `103-88-57-138.sslip.io` resolves to `<SERVER_IP>` automatically. Let's Encrypt happily issues a cert for it. No registration, no maintenance.

If CHIRAG later buys a real domain (e.g. `app.chirag.org.in`), point its A record at `<SERVER_IP>` and re-run the installer — it will swap to the new domain.

---

## Part 1 — Router port forwarding (5 min, do this first)

The CHIRAG HQ router must forward incoming traffic on ports 80 + 443 to the Ubuntu server. **Without this, the rest will not work.**

1. Find the server's **LAN IP** (on the server, run `ip -4 addr show | grep inet | grep -v 127`). It usually looks like `192.168.1.50`.
2. Log into the HQ router (typically `http://192.168.1.1` — admin / printed on a sticker).
3. Find **"Port Forwarding"** / **"Virtual Server"** / **"NAT"**. Add two rules:

   | External (WAN) port | Internal (LAN) IP | Internal (LAN) port | Protocol |
   |---|---|---|---|
   | 80  | `192.168.1.50` (your server's LAN IP) | 80  | TCP |
   | 443 | `192.168.1.50` | 443 | TCP |

4. **Test from outside the office** (use phone on mobile data, not Wi-Fi):
   ```
   http://<SERVER_IP>        ← should hit "It works!" or nginx default
   ```
   If it doesn't load:
   - Confirm your ISP isn't blocking inbound port 80 (some Indian residential ISPs do — call them and ask, or try port 8080 instead).
   - Recheck the router rules; some routers need a reboot after editing.

---

## Part 2 — Get the code onto the server (5 min)

On **your Mac**, from inside the project folder:

```bash
cd "/Users/prahladpratapsingh/Desktop/CHIRAG JAL SAKHI"

rsync -avz \
  --exclude node_modules --exclude .gradle --exclude build --exclude dist \
  --exclude '*.apk' --exclude '*.jks' --exclude 'android/app/build' \
  ./ root@<SERVER_IP>:/opt/jalsakhi/
```

(You'll be prompted for the server's root SSH password. If you'd rather use SSH keys, run `ssh-copy-id root@<SERVER_IP>` first — recommended for production.)

If the HQ server doesn't have `root` SSH enabled, use whatever sudo user it has, e.g. `ssh chirag@<SERVER_IP> "sudo mkdir -p /opt/jalsakhi && sudo chown chirag /opt/jalsakhi"` then `rsync ... chirag@<SERVER_IP>:/opt/jalsakhi/`.

---

## Part 3 — Run the one-command installer (15 min)

SSH to the server and run the installer:

```bash
ssh root@<SERVER_IP>
bash /opt/jalsakhi/deploy/onprem-setup.sh admin@chirag.org.in
```

The 2nd arg is your email — only used for Let's Encrypt expiry notifications. The installer auto-detects your public IP (`<SERVER_IP>`) and derives the sslip.io domain.

What you'll see (9 steps, each takes < 2 min):

```
════════ 0/9  Detecting public IP ════════
✓ Public IP: <SERVER_IP>
✓ Auto-derived domain: 103-88-57-138.sslip.io
════════ 1/9  Installing system packages ════════
✓ Docker installed
✓ Node v20.x
════════ 2/9  Configuring UFW firewall ════════
✓ Firewall: ssh + 80 + 443 only
════════ 3/9  Locating source code at /opt/jalsakhi ════════
✓ Source present
════════ 4/9  Configuring backend ════════
✓ Generated 96-char JWT secret
✓ Set PUBLIC_BASE_URL=https://103-88-57-138.sslip.io
════════ 5/9  Starting Postgres + API in Docker ════════
✓ Postgres ready
✓ Migrations + seed done
════════ 6/9  Building manager dashboard ════════
✓ Dashboard built → /var/www/jalsakhi
════════ 7/9  Configuring nginx ════════
✓ nginx serving on http://103-88-57-138.sslip.io/
════════ 8/9  Issuing Let's Encrypt certificate for 103-88-57-138.sslip.io ════════
Successfully received certificate.
════════ 9/9  Summary ════════
✅ Jal Sakhi is LIVE.
```

After it finishes, **smoke test from your Mac**:

```bash
curl -s https://103-88-57-138.sslip.io/api/health
# → {"ok":true,"time":"…"}
```

If you get a connection-refused at step 8 (certbot), the most common cause is **port forwarding not working from the public internet yet** — go back to Part 1 and verify.

---

## Part 4 — Rebuild the APK with the production URL (5 min)

On your **Mac**, in the project folder:

```bash
./build-apk.sh https://103-88-57-138.sslip.io/api
```

Output: `dist/jalsakhi-release-NEWSTAMP.apk`. WhatsApp it to KRPs. They install over the old version (same package + same keystore = clean upgrade).

The new APK has the URL baked in, so KRPs will go **directly to the login screen** — no Server-URL prompt.

---

## Part 5 — KRP rollout (the new password flow)

The old SMS/OTP flow is gone. New KRPs sign up themselves; you approve them in the dashboard.

**KRP first run:**
1. Install the new APK.
2. Tap **"New KRP? Create account"** on the login screen.
3. Fill: name, mobile number, password, village (dropdown — loaded from your server), optional note.
4. Submit → "Waiting for manager approval" screen.

**You (manager) approve them:**
1. Open `https://103-88-57-138.sslip.io/` → log in (`manager@chirag.org` / `chirag@2026` initially — change this!).
2. Sidebar shows **"Pending KRPs"** with a yellow badge count.
3. Click → see each KRP's name, phone, village, signup note.
4. **Approve** → KRP can now log in. Or **Reject** with a reason (visible to the KRP next time they try).

**Returning KRP login:**
- Identifier = their mobile number (10 digits) **OR** the manager email
- Password = whatever they set at signup (or `demo1234` for the seeded demo KRP)

---

## Part 6 — Change demo passwords (2 min, do this before going live)

```bash
# From your Mac — change manager:
curl -X POST https://103-88-57-138.sslip.io/api/auth/login \
  -H "content-type: application/json" \
  -d '{"identifier":"manager@chirag.org","password":"chirag@2026"}'
# Copy the "token" value from the response, then:
TOKEN="paste-the-token-here"
curl -X POST https://103-88-57-138.sslip.io/api/auth/password \
  -H "content-type: application/json" \
  -H "authorization: Bearer $TOKEN" \
  -d '{"oldPassword":"chirag@2026","newPassword":"<a-real-strong-password>"}'

# Repeat for admin@chirag.org (log in as admin, then change).
# Also delete or change the demo KRP password (login as +919999900001 / demo1234).
```

---

## Part 7 — Day-2 operations

### Backups (set up once)

```bash
# On the HQ server, as root:
mkdir -p /var/backups/jalsakhi
crontab -e
# Add this line (daily 02:00 IST = 20:30 UTC):
0 20 * * * docker compose -f /opt/jalsakhi/backend/docker-compose.yml exec -T db \
  pg_dump -U chirag jalsakhi | gzip > /var/backups/jalsakhi/jalsakhi-$(date +\%F).sql.gz
```

You also want to copy this off the HQ server — the safest cheap option is to plug a 1 TB USB drive into the server and `rsync` `/var/backups/jalsakhi/` and `/var/lib/docker/volumes/backend_uploads/_data/` to it weekly. Or push to S3 / Backblaze if HQ has reliable internet.

### Updating to a newer version

When you `rsync` new code from your Mac:
```bash
ssh root@<SERVER_IP> 'bash /opt/jalsakhi/deploy/onprem-setup.sh'
```
The installer is idempotent — it skips what's already done and rebuilds only what changed.

### Cert renewal

Let's Encrypt certs expire after 90 days. certbot installs a systemd timer that auto-renews 30 days before expiry. Verify with:
```bash
systemctl list-timers certbot.timer
```

### Power-cut recovery

You said the HQ has UPS, so brief outages are covered. After a full power loss, when the server comes back:
- Docker auto-starts via systemd → backend + Postgres come up automatically.
- nginx auto-starts.
- Smoke test: `curl -s https://103-88-57-138.sslip.io/api/health`.
- If anything is down: `docker compose -f /opt/jalsakhi/backend/docker-compose.yml up -d`

### Monitoring (cheap & simple)

From any machine with internet (your Mac, a 2nd server, whatever):
```bash
# In a cron:
*/15 * * * * curl -fs https://103-88-57-138.sslip.io/api/health \
  || echo "JAL SAKHI DOWN at $(date)" | mail -s "Alert" admin@chirag.org.in
```

For nicer monitoring: free Uptime Robot account — paste the health URL, get email/SMS alerts.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `certbot` fails with "Connection refused" | Router not forwarding 80 to server | Re-check Part 1; some ISPs block port 80 — call them |
| `certbot` fails with "DNS problem" | sslip.io hiccup | `dig 103-88-57-138.sslip.io` — should return `<SERVER_IP>`. If not, wait 30s, retry |
| Dashboard loads but API calls 502 | API container not running | `docker compose -f /opt/jalsakhi/backend/docker-compose.yml ps` then `up -d` |
| KRP app "Network error" | Phone has no internet OR cert mismatch | Test `https://103-88-57-138.sslip.io/api/health` on phone's mobile browser |
| KRP app "Login failed: Invalid credentials" | Wrong password or pending approval | Check `/approvals` in dashboard |
| Pending KRPs don't show up | Manager not logged in as `manager` or `admin` role | Confirm the logged-in user has manager role |
| Disk filling up | Photos accumulating | `du -sh /var/lib/docker/volumes/backend_uploads/_data/` — archive periodically |
| Power loss while writing | Postgres journal handles this | After boot, check `docker compose logs db` for "database system is ready" |

---

## Quick reference

```bash
# Live API logs
docker compose -f /opt/jalsakhi/backend/docker-compose.yml logs -f api

# Live nginx access log
tail -f /var/log/nginx/access.log

# Restart just the API (preserves database)
docker compose -f /opt/jalsakhi/backend/docker-compose.yml restart api

# Stop everything
docker compose -f /opt/jalsakhi/backend/docker-compose.yml down

# Bring everything back up
docker compose -f /opt/jalsakhi/backend/docker-compose.yml up -d

# Reset all data (DESTRUCTIVE — only for development)
docker compose -f /opt/jalsakhi/backend/docker-compose.yml down -v
bash /opt/jalsakhi/deploy/onprem-setup.sh
```

---

## What if Let's Encrypt fails?

If your ISP blocks inbound port 80 (some do for residential connections), `certbot --nginx` will fail. Two fallbacks:

**Option A — Self-signed certificate (works immediately, but app needs trust override):**
```bash
openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -keyout /etc/nginx/ssl/jalsakhi.key -out /etc/nginx/ssl/jalsakhi.crt \
  -subj "/CN=103-88-57-138.sslip.io"
# Then point nginx at these files instead.
```
The Android app's `network_security_config.xml` would need to add the cert as a trust anchor. Doable but fiddly.

**Option B — HTTP only on a non-standard port (simplest pilot):**
- Forward router port `8080` → server `8080`.
- Use `http://<SERVER_IP>:8080` (no TLS).
- Add this domain to the Android app's cleartext-allowed list (in `network_security_config.xml`) and rebuild.

For the pilot, ask CHIRAG IT to confirm port 80/443 inbound works first. If not, we go to Option B.
