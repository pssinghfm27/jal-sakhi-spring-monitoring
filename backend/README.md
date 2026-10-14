# Jal Sakhi — Backend API

Node.js 20 + Express + PostgreSQL 15. Self-hosts on any Linux VPS.

## What's inside

```
src/
├── server.js                # Express bootstrap + Swagger UI
├── config/env.js            # Env-var parsing
├── db/
│   ├── pool.js              # pg pool + withTx() helper
│   ├── migrate.js           # SQL migration runner
│   ├── seed.js              # Demo + CSV spring import
│   └── audit.js             # audit_log writer
├── middleware/
│   ├── auth.js              # JWT, role guards, asyncH()
│   ├── upload.js            # multer + size/MIME guards
│   └── errorHandler.js
├── routes/
│   ├── auth.js              # OTP request/verify + email login
│   ├── krp.js               # /krp/profile, /krp/springs
│   ├── springs.js           # master list + detail
│   ├── readings.js          # discharge + quality submit/list
│   ├── dashboard.js         # summary, map, trends, blocks, alerts, krp-perf
│   └── reminders.js
├── services/
│   ├── bis.js               # BIS 10500 ranges + green/amber/red classifier
│   ├── anomaly.js           # ±50% rolling-median anomaly detection
│   ├── healthScore.js       # 30/50/20 composite
│   ├── sms.js               # Fast2SMS (pluggable) + dev console fallback
│   ├── otp.js               # 6-digit OTP w/ hashed storage and throttling
│   └── reminders.js         # pre7 / due / overdue7 enqueue + sender
├── jobs/scheduler.js        # node-cron daily job
└── utils/{logger,errors}.js

migrations/001_init.sql      # full schema (users, villages, springs,
                             # discharge_readings, quality_readings,
                             # audit_log, reminders, otp_codes)
openapi.yaml                 # served at /docs (Swagger UI)
```

## Quick start (local, with Docker)

```bash
cp .env.example .env
# Generate a real JWT secret:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# Paste into .env as JWT_SECRET=…

docker compose up -d --build
# Wait ~5s for postgres, then:
docker compose exec api npm run migrate
docker compose exec api npm run seed
```

Visit:
- `http://localhost:8080/health`
- `http://localhost:8080/docs` (Swagger)

Demo credentials (set by seed):

| Role | Identifier | Password |
|---|---|---|
| Manager | `manager@chirag.org` | `chirag@2026` |
| Admin   | `admin@chirag.org`   | `chirag@2026` |
| KRP     | `+919999900001`      | request OTP — printed to API log in dev |

## Local dev without Docker

```bash
npm install
# Start a Postgres locally and set PG* env vars to match
npm run migrate
npm run seed                              # demo set only
npm run seed -- --csv ../docs/sample_springs.csv   # plus CSV import
npm run dev
```

## Importing your real spring master list

```bash
# CSV header must be exactly:
#   code,name_en,name_hi,village,gp,block,district,lat,lon,altitude_m,spring_type,project_name
npm run seed -- --csv /path/to/springs.csv
```
A sample file is provided at [`docs/sample_springs.csv`](../docs/sample_springs.csv).

## Production deployment

### 1. Provision a Linux VPS (Ubuntu 22.04+)
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx
```

### 2. Clone and configure
```bash
git clone <repo> /opt/jalsakhi && cd /opt/jalsakhi/backend
cp .env.example .env && nano .env   # set JWT_SECRET, FAST2SMS_API_KEY, PUBLIC_BASE_URL
docker compose up -d --build
docker compose exec api npm run migrate
docker compose exec api npm run seed -- --csv /opt/jalsakhi/docs/your_springs.csv
```

### 3. Front with nginx + Let's Encrypt
```nginx
# /etc/nginx/sites-available/jalsakhi
server {
    listen 80;
    server_name api.chirag.example.org;
    client_max_body_size 12M;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/jalsakhi /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.chirag.example.org
```

### 4. Backups
```bash
# Daily pg_dump cron
0 2 * * * docker compose -f /opt/jalsakhi/backend/docker-compose.yml exec -T db \
  pg_dump -U chirag jalsakhi | gzip > /var/backups/jalsakhi-$(date +\%F).sql.gz
```

## Anomaly & health-score logic

- **Anomaly** (per-reading flag): `|new - median(last 90d)| / median > 0.5`. Set on every insert; surfaces in `/dashboard/alerts`.
- **Health score** (0-100, per spring): `30% discharge stability + 50% BIS compliance + 20% sampling regularity`. See `services/healthScore.js`.
- **Map status**: green/amber/red derived from worst BIS class + sampling recency. See `routes/dashboard.js#GET /map`.

## Offline idempotency

Mobile clients should set `client_uuid` (a UUIDv4 generated locally) on every reading they POST. The DB has a `UNIQUE` constraint on `client_uuid`, so retried syncs after spotty connectivity will not create duplicates.

## Audit log

Every insert and versioned-edit writes a row to `audit_log` with the full `new_values` JSON, the `user_id`, and an optional `reason`. Synced records cannot be silently overwritten — edits create a new row with `supersedes_id` pointing at the prior version.

## Tests

```bash
npm test
```
(Tests stubbed — add to `tests/`.)

## Licence

MIT.
