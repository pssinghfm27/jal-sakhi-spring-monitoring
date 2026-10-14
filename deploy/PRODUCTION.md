# 🚀 Jal Sakhi — Production deployment (VPS + dashboard)

Total time: **~90 minutes**, including waiting for DNS to propagate.
Cost: **~$4-5/month** (VPS) + **~$10/year** (domain, optional if you already own one).

This guide takes you from "I have an APK in WhatsApp" to a real production system that survives reboots, serves the dashboard, and reaches KRPs anywhere in India.

---

## What you'll end up with

```
                  https://chirag.example.org
                            │
                            ▼
                  ┌──────────────────┐
                  │      nginx       │
                  │   (HTTPS + LE)   │
                  └────────┬─────────┘
                           │
            ┌──────────────┼──────────────┬──────────────────┐
            ▼              ▼              ▼                  ▼
   /         /admin/      /api/         /uploads/        (TLS only)
   │           │            │              │
   ▼           ▼            ▼              ▼
 Manager    Connect-URL   Express          photos
 dashboard  + QR page     :8080           (served by API)
 (React)    (one HTML)        │
                              ▼
                         Postgres 15
                         (Docker volume)
```

All on **one $5 VPS**. Photos, database, secrets — all on infrastructure you control.

---

## Part A — Buy the infrastructure (15 min)

### A1. VPS (pick one)

| Provider | Plan | Cost | Datacenter near India |
|---|---|---|---|
| **DigitalOcean** (recommended for India) | Basic $4 droplet | $4/mo | Bangalore (BLR1) |
| **Linode / Akamai** | Nanode 1 GB | $5/mo | Mumbai |
| **Vultr** | Cloud Compute Regular 1 GB | $6/mo | Mumbai, Bangalore |
| **Hetzner** | CX22 | €4.51/mo | Europe only (~150ms latency to India) |
| **AWS Lightsail** | $5/mo plan | $5/mo | Mumbai (ap-south-1) |

For CHIRAG, **DigitalOcean Bangalore** is the simplest + closest. Sign up, create a "Droplet":
- **Image:** Ubuntu 22.04 LTS
- **Plan:** Basic Regular Intel, $4/mo
- **Region:** Bangalore (BLR1)
- **Authentication:** SSH key (paste your `~/.ssh/id_rsa.pub`; if you don't have one, run `ssh-keygen -t ed25519` first on your Mac)
- **Hostname:** `jalsakhi-prod`

After ~30 seconds you'll see a **public IPv4 address**. Note it. Example: `139.59.10.42`.

### A2. Domain (skip if you already have one)

You need a domain like `chirag.example.org`. Options:

- **Reuse a CHIRAG-owned domain** — easiest. Just create a new subdomain (e.g. `app.chirag.org.in`).
- **Buy a new one** — Cloudflare Registrar sells `.org` at cost (~$9/yr). Namecheap also works.

### A3. DNS — point the domain at your VPS

In your DNS provider's control panel, create one **A record**:

```
Type:   A
Name:   chirag         (or @ for root, app for subdomain — your choice)
Value:  139.59.10.42   (your VPS IP from A1)
TTL:    300            (5 min)
```

Wait 2-5 minutes, then verify from your Mac:
```bash
dig +short chirag.example.org
# should print: 139.59.10.42
```

If it doesn't, wait another 5 min. Most providers propagate in <1 min, some take 10+ min.

---

## Part B — One-command server install (10 min)

SSH into the VPS:
```bash
ssh root@chirag.example.org
```

On the VPS, paste this **one block** — it does everything:

```bash
# Get the Jal Sakhi source onto the VPS.
# If you've already pushed this folder to GitHub/GitLab, replace the URL.
# Otherwise, see "Pushing your local code" at the end of this doc.
git clone https://github.com/YOUR_ORG/jalsakhi.git /opt/jalsakhi   # OR upload via scp

# Run the one-shot setup
bash /opt/jalsakhi/deploy/vps-setup.sh chirag.example.org admin@chirag.org
```

What the script does, in order:

| Step | Time | What |
|---|---|---|
| 1/9 | ~2 min | apt-get docker, node 20, nginx, certbot, ufw |
| 2/9 | <1 s   | Firewall: SSH + 80 + 443 only |
| 3/9 | ~1 min | (re)clone repo to `/opt/jalsakhi` |
| 4/9 | <1 s   | Generate strong JWT secret, set `PUBLIC_BASE_URL=https://chirag.example.org`, turn off OTP dev-log |
| 5/9 | ~2 min | `docker compose up` Postgres + API, run migrations, seed demo data + sample springs |
| 6/9 | ~3 min | `npm install` + `npm run build` the React dashboard, drop dist/ into `/var/www/jalsakhi` |
| 7/9 | <1 s   | Drop in `deploy/nginx-jalsakhi.conf` (rewrites /api/, serves dashboard, serves /uploads/) |
| 8/9 | ~1 min | `certbot --nginx` — issues HTTPS cert via Let's Encrypt, sets up auto-renew |
| 9/9 |        | Prints all URLs and demo credentials |

After it finishes you can hit:

- `https://chirag.example.org/api/health` → `{ok:true,...}`
- `https://chirag.example.org/` → manager dashboard login
- `https://chirag.example.org/admin/` → URL+QR page

### B1. Add the SMS gateway

```bash
nano /opt/jalsakhi/backend/.env
# Set FAST2SMS_API_KEY=your-actual-key
docker compose -f /opt/jalsakhi/backend/docker-compose.yml restart api
```

Sign up at https://www.fast2sms.com to get a key. **For OTP only**, the cheapest plan (~₹1 per SMS, no minimums) is fine. Until you add the key, OTPs are printed to:
```bash
docker compose -f /opt/jalsakhi/backend/docker-compose.yml logs -f api
```
You can read them off the screen and tell the KRP by phone — useful for testing.

### B2. Change the demo passwords

```bash
# Open https://chirag.example.org/ — log in as manager@chirag.org / chirag@2026
# Then POST to /api/auth/password with your real password.
# (We'll add a UI for this in v0.2.)

# In the meantime, from your laptop:
curl -X POST https://chirag.example.org/api/auth/password \
  -H "content-type: application/json" \
  -d '{"email":"manager@chirag.org","oldPassword":"chirag@2026","newPassword":"YOUR_NEW_PASSWORD"}'
```

Do the same for `admin@chirag.org`.

---

## Part C — Rebuild the APK for production (5 min)

On your **Mac** (where you built the APK earlier):

```bash
cd "/Users/prahladpratapsingh/Desktop/CHIRAG JAL SAKHI"
./build-apk.sh https://chirag.example.org/api
```

The new APK lands in `dist/jalsakhi-release-NEWSTAMP.apk`.

Two things changed vs. the one you shared first:
- API URL is **baked in**, so KRPs no longer see the Server Setup screen — they go straight to OTP login.
- Built with HTTPS → satisfies Android 7+'s default network security policy with no exceptions.

**Re-share this APK** with KRPs. They install it over the old one (same package, signed with the same keystore = clean upgrade).

> If you want to keep the older APK working too (different URL), that's fine — it'll still ask KRPs to type the URL on first launch.

---

## Part D — Rolling out to KRPs (10 min)

1. **Send the new APK** via WhatsApp / Telegram broadcast.
2. **Tell them three things** in Hindi:
   > 1. नया APK install करें (पुराने के ऊपर ही install हो जाएगा)।
   > 2. App खोलें → Login screen पर अपना मोबाइल नंबर डालें।
   > 3. OTP आएगा SMS में, 6 अंक डालें।
3. **Watch the dashboard**: `https://chirag.example.org/` → after a KRP submits the first reading, you'll see it on the Map within ~10 seconds.

---

## Part E — Day-2 operations

### Backups (set up once)

```bash
# On the VPS, daily 02:00 IST pg_dump → /var/backups + ship to S3 (optional)
crontab -e
# add:
0 20 * * * docker compose -f /opt/jalsakhi/backend/docker-compose.yml exec -T db \
  pg_dump -U chirag jalsakhi | gzip > /var/backups/jalsakhi-$(date +\%F).sql.gz
```

To restore later:
```bash
gunzip < /var/backups/jalsakhi-2026-05-25.sql.gz | \
  docker compose -f /opt/jalsakhi/backend/docker-compose.yml exec -T db psql -U chirag jalsakhi
```

### Pushing code updates from your Mac to the VPS

If you make changes locally, push them to git, then on the VPS:
```bash
ssh root@chirag.example.org
cd /opt/jalsakhi && git pull
# Rebuild whichever layer changed:
docker compose -f backend/docker-compose.yml up -d --build       # backend
( cd web-dashboard && npm install && npm run build && rsync -a --delete dist/ /var/www/jalsakhi/ ) # dashboard
```

Or just re-run the whole installer — it's idempotent:
```bash
bash deploy/vps-setup.sh chirag.example.org admin@chirag.org
```

### Monitoring

The simplest possible: an uptime check from a second machine.
```bash
# From your Mac, in a daily cron or just a manual ping:
curl -fs https://chirag.example.org/api/health || echo "JAL SAKHI DOWN"
```

For more: tail logs whenever you suspect an issue.
```bash
docker compose -f /opt/jalsakhi/backend/docker-compose.yml logs --tail=200 api
journalctl -u nginx --since "1 hour ago"
```

### Renew Let's Encrypt cert

Certbot installs a systemd timer that auto-renews 30 days before expiry. Verify:
```bash
systemctl list-timers certbot.timer
```

### Shut down + reboot the VPS

Reboot is safe — Docker auto-starts via systemd, nginx too. After:
```bash
docker compose -f /opt/jalsakhi/backend/docker-compose.yml ps
# All 3 services should say "running"
```

---

## Pushing your local code to GitHub (one-time, if you haven't yet)

Currently the code only exists on your Mac. To let the VPS pull it:

```bash
cd "/Users/prahladpratapsingh/Desktop/CHIRAG JAL SAKHI"
git init && git add . && git commit -m "Initial CHIRAG Jal Sakhi"
# Create an empty repo on github.com/YOUR_ORG/jalsakhi first, then:
git remote add origin https://github.com/YOUR_ORG/jalsakhi.git
git push -u origin main
```

If you'd rather **not put it on GitHub**, you can `scp` it instead:
```bash
ssh root@chirag.example.org "mkdir -p /opt/jalsakhi"
rsync -avz --exclude node_modules --exclude .gradle --exclude build --exclude dist \
  "/Users/prahladpratapsingh/Desktop/CHIRAG JAL SAKHI/" \
  root@chirag.example.org:/opt/jalsakhi/
ssh root@chirag.example.org "bash /opt/jalsakhi/deploy/vps-setup.sh chirag.example.org admin@chirag.org"
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `certbot` fails: "DNS problem" | DNS not propagated yet | `dig chirag.example.org` from Mac — wait until it returns the VPS IP, then retry: `certbot --nginx -d chirag.example.org` |
| `502 Bad Gateway` from dashboard | API container not running | `docker compose -f /opt/jalsakhi/backend/docker-compose.yml ps` — start with `up -d` if down |
| KRP "Network error" on app | Wrong URL or DNS issue | On the Mac, `curl https://chirag.example.org/api/health` should work. If yes, KRP's phone has connectivity issue. |
| KRP "Login failed: Phone not registered" | KRP isn't in the `users` table | Insert via `docker compose exec -T db psql -U chirag jalsakhi -c "INSERT INTO users (phone, name, role, village_id) VALUES ('+91XXXX', 'Name', 'krp', (SELECT id FROM villages WHERE name='Lakhmar'));"` |
| OTPs not arriving | Fast2SMS key missing / dev mode | Check `.env` — `FAST2SMS_API_KEY` must be set, `OTP_DEV_LOG=false`. Restart `api`. |
| Dashboard map shows no markers | No springs seeded | `docker compose exec -T api npm run seed -- --csv /app/../docs/sample_springs.csv` |
| Disk filling up | Docker images / photos accumulating | `docker system prune -a` clears old images; archive `/var/lib/docker/volumes/backend_uploads/_data/` periodically |
| HTTPS shows old cert / "not secure" | Reverse proxy mis-rewrite | `nginx -t` then `systemctl reload nginx` |

---

## What "production-ready" still means

This setup is **good for 10-200 KRPs and a year or two of pilot**, but for a sustained programme add:

- **Off-server backups** — ship the nightly dump to S3 or Backblaze B2 ($0.005/GB/mo).
- **Monitoring** — UptimeRobot (free) pinging `/api/health` every 5 min; or Healthchecks.io.
- **App auto-update** — host the latest APK at `https://chirag.example.org/jalsakhi.apk` and have the app check `versionCode` on launch.
- **Manager UI for adding KRPs / springs** — currently you `INSERT INTO users` manually. ~1 day to build a `/krps` admin page.
- **Stronger keystore** — rotate the auto-generated `jalsakhi-release.jks` to a real one, store it in 1Password / encrypted backups.
- **Real domain at CHIRAG** — `app.chirag.org.in` looks more trustworthy than `chirag.example.org`.

Everything else in `docs/ARCHITECTURE.md` already holds — this guide is just the operational layer on top of it.
