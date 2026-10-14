# Deployment — CHIRAG Jal Sakhi

This document covers a single-VPS deployment. For a multi-node setup, externalise Postgres and put a load balancer in front of N API containers.

## Server sizing (recommended minimum)

| Resource | Spec |
|---|---|
| vCPU | 2 |
| RAM | 4 GB |
| Disk | 40 GB SSD (data) + 20 GB OS |
| Network | 100 Mbps unmetered |
| OS | Ubuntu 22.04 LTS |

A `t3.small` / `e2-small` / Hetzner CX22 will run the system comfortably for the entire CHIRAG geography. Backups should ship off-server (S3-compatible object store recommended).

## Steps

1. **Provision** the VPS, point DNS `api.chirag.example.org → VPS IP`.
2. **Install** Docker + Compose + nginx + certbot. See `backend/README.md`.
3. **Clone** repo, copy `.env`, generate JWT secret, set Fast2SMS key.
4. **Up**: `docker compose up -d --build`.
5. **Migrate + seed**: `docker compose exec api npm run migrate && npm run seed -- --csv …`.
6. **nginx** reverse proxy + Let's Encrypt cert (see backend README for the vhost file).
7. **Backups**: nightly `pg_dump | gzip` off-server.
8. **Smoke test**: `curl https://api.chirag.example.org/health` → `{ok:true,…}`.
9. **Hand off**: send the API URL + a demo OTP login to the field team.

## Updating

```bash
cd /opt/jalsakhi && git pull
cd backend && docker compose build --pull && docker compose up -d
docker compose exec api npm run migrate
```

Backwards-compatible schema changes are added as new files in `backend/migrations/` and the runner only applies un-applied IDs.

## Rollback

The schema is forward-only by design. Roll back the **container image** to the previous tag and run any reverse-migrations manually. For a worst-case recovery: stop the API, `psql` restore from the latest `pg_dump`, redeploy.

## Monitoring (lightweight, no SaaS)

- `docker compose logs -f api` for live logs.
- `pg_stat_activity` for query health.
- `nginx` access logs for traffic.
- A simple uptime check from a second region (e.g. `curl /health` from a cron on another VPS) is enough.

## Security checklist

- [ ] `JWT_SECRET` is 48+ random bytes (not the default).
- [ ] Database user `chirag` password changed from default.
- [ ] Postgres port 5432 **not** exposed publicly — bound to docker network only.
- [ ] nginx has `client_max_body_size 12M;` to match `MAX_UPLOAD_MB`.
- [ ] HTTPS forced (HSTS header).
- [ ] `helmet()` is on (it is, by default in `src/server.js`).
- [ ] `OTP_DEV_LOG=false` in production.
- [ ] Backup encryption-at-rest, off-server.
