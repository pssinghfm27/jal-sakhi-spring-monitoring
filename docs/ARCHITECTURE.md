# Architecture — CHIRAG Jal Sakhi

```
                      ┌────────────────────────┐
                      │  KRP Android app (Kt)  │
                      │  Room DB (offline)     │
                      │  WorkManager sync ─────┼────┐
                      └────────────────────────┘    │  multipart POST
                                                    ▼
┌──────────────────────┐    HTTPS+JWT      ┌──────────────────────────────┐
│  Manager Web (React) │ ◀──────────────▶  │   Express API (Node 20)      │
│  Leaflet + Recharts  │                   │   /auth /krp /springs        │
└──────────────────────┘                   │   /readings /dashboard       │
                                           │   /reminders                 │
                                           │                              │
                                           │   node-cron daily 06:30 IST  │
                                           │   ┌──────────────────────┐   │
                                           │   │  Reminder enqueue +  │   │
                                           │   │  Fast2SMS dispatch   │──┼──▶  Fast2SMS
                                           │   └──────────────────────┘   │
                                           └─────────────┬────────────────┘
                                                         │ SQL
                                                ┌────────▼─────────┐
                                                │  PostgreSQL 15   │
                                                │  villages,       │
                                                │  springs, users, │
                                                │  discharge,      │
                                                │  quality,        │
                                                │  audit_log,      │
                                                │  reminders, otp  │
                                                └──────────────────┘
```

## Data flow: a single reading

1. **KRP opens app** offline. Spring dropdown loads from local Room snapshot of `/springs/master`.
2. **Capture**: fused-location GPS (rejected if accuracy > 20 m), photo via CameraX, optional voice (≤30 s).
3. **Save local** to Room with `client_uuid = randomUUID()`, `synced_at = NULL`.
4. **WorkManager** wakes on connectivity → multipart POST to `/readings/{discharge|quality}` with `Authorization: Bearer <JWT>`.
5. **Backend** validates, runs `isXAnomaly()` against the 90-day rolling median, inserts (ON CONFLICT client_uuid DO UPDATE → idempotent), writes audit_log, returns the persisted row with `anomaly` flag.
6. **App** marks the row `synced_at = now()` and removes from sync queue.
7. **Manager dashboard** receives updated values on next refresh; map marker colour recomputes from the new latest quality.

## Status colour rules (map markers)

| Colour | Meaning |
|---|---|
| 🟢 Green | all BIS parameters in acceptable range AND last quality test < 90 days |
| 🟡 Amber | 1-2 parameters in permissible-but-not-acceptable range OR last test 90-120 days |
| 🔴 Red   | any parameter unsafe (outside permissible) OR last test > 120 days (or never) |

Implementation: `backend/src/services/bis.js#classifyQualityReading` + the recency overlay in `routes/dashboard.js#GET /map`.

## Health score (0-100, per spring)

- 30% **discharge stability**: `100 - CV(last 12 discharges) * 100`, clamped 0-100.
- 50% **BIS compliance**: latest 4 quality readings, each weighted green=1.0 / amber=0.6 / red=0.
- 20% **sampling regularity**: last test ≤ 90 d → 100, ≥ 180 d → 0, linear between.

See `backend/src/services/healthScore.js`.

## Offline idempotency

Every reading carries a client-generated `client_uuid`. Database has a `UNIQUE` constraint on that column. Retried syncs after network failures are safe — same UUID → no duplicate row.

## Audit & immutability

Synced records are never deleted or silently mutated. An edit creates a new row with:
- `supersedes_id` → original row
- `version = original.version + 1`
- `edit_reason` (mandatory text)

The audit log keeps full JSON snapshots of `new_values` for every insert and edit, indexed by `(table_name, record_id)`.

## Threat model & data sovereignty

- All persistent data lives on CHIRAG's own VPS + Postgres volume.
- Only third-party network calls: Fast2SMS for OTP and reminder SMS, and OpenStreetMap tile servers (browser-side, no PII).
- No telemetry, no analytics, no crash reporters in either client.
- JWT signed with HS256, secret only on the server. Tokens are short-ish (30 d) and can be revoked by deactivating the user (`users.active = false`).
- File uploads: MIME-whitelisted (jpeg/png/webp/audio), size-capped via `MAX_UPLOAD_MB`, served from `/uploads/` with `helmet` security headers.

## What's already built vs. what's next

| Layer | Status |
|---|---|
| Backend API | **Complete & runnable** (this commit) |
| Schema + migrations + seed | **Complete** |
| OpenAPI / Swagger UI | **Complete** |
| Docker + compose | **Complete** |
| Android app | Scaffolded — module layout & contracts locked, code next |
| Web dashboard | Scaffolded — page tree & brand tokens locked, code next |
| KRP training card | Not yet — see `docs/KRP_QUICK_CARD.md` for the spec |
