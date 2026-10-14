-- SPDX-License-Identifier: MIT
-- CHIRAG Jal Sakhi schema, v1.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ───────── villages ─────────
CREATE TABLE IF NOT EXISTS villages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    gp          TEXT,
    block       TEXT NOT NULL,
    district    TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (name, block, district)
);
CREATE INDEX IF NOT EXISTS idx_villages_block ON villages (block);

-- ───────── users (KRPs, managers, admins) ─────────
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone         TEXT UNIQUE,                     -- E.164, used by KRPs
    email         TEXT UNIQUE,                     -- used by managers/admins
    password_hash TEXT,                            -- managers/admins only
    name          TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('krp','manager','admin')),
    village_id    UUID REFERENCES villages(id) ON DELETE SET NULL,
    trained_on    DATE,
    active        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_village ON users (village_id);

-- ───────── springs (master list) ─────────
CREATE TABLE IF NOT EXISTS springs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code          TEXT UNIQUE,                     -- short human ID e.g. CHG-LKR-007
    name_en       TEXT NOT NULL,
    name_hi       TEXT NOT NULL,
    village_id    UUID NOT NULL REFERENCES villages(id) ON DELETE RESTRICT,
    lat           DOUBLE PRECISION NOT NULL,
    lon           DOUBLE PRECISION NOT NULL,
    altitude_m    INTEGER,
    spring_type   TEXT,                            -- depression / contact / fracture etc.
    project_name  TEXT,
    active        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_springs_village ON springs (village_id);
CREATE INDEX IF NOT EXISTS idx_springs_active ON springs (active);

-- ───────── discharge readings ─────────
CREATE TABLE IF NOT EXISTS discharge_readings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spring_id       UUID NOT NULL REFERENCES springs(id) ON DELETE CASCADE,
    krp_id          UUID NOT NULL REFERENCES users(id),
    client_uuid     UUID UNIQUE,                   -- for offline idempotency
    recorded_at     TIMESTAMPTZ NOT NULL,
    lat             DOUBLE PRECISION NOT NULL,
    lon             DOUBLE PRECISION NOT NULL,
    gps_accuracy_m  REAL NOT NULL,
    method          TEXT NOT NULL CHECK (method IN ('v_notch','volumetric','float')),
    duration_sec    INTEGER,
    discharge_lpm   REAL NOT NULL,                 -- litres per minute
    weather         TEXT NOT NULL CHECK (weather IN ('dry','light_rain','heavy_rain','post_monsoon')),
    photo_url       TEXT NOT NULL,
    voice_url       TEXT,
    notes           TEXT,
    version         INTEGER NOT NULL DEFAULT 1,
    supersedes_id   UUID REFERENCES discharge_readings(id),
    edit_reason     TEXT,
    anomaly         BOOLEAN NOT NULL DEFAULT false,
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_discharge_spring_time ON discharge_readings (spring_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_discharge_krp ON discharge_readings (krp_id);

-- ───────── water-quality readings (8 BIS parameters) ─────────
CREATE TABLE IF NOT EXISTS quality_readings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spring_id       UUID NOT NULL REFERENCES springs(id) ON DELETE CASCADE,
    krp_id          UUID NOT NULL REFERENCES users(id),
    client_uuid     UUID UNIQUE,
    recorded_at     TIMESTAMPTZ NOT NULL,
    lat             DOUBLE PRECISION NOT NULL,
    lon             DOUBLE PRECISION NOT NULL,

    ph              REAL,
    tds             REAL,                          -- mg/L
    turbidity       REAL,                          -- NTU
    hardness        REAL,                          -- mg/L as CaCO3
    alkalinity      REAL,                          -- mg/L as CaCO3
    chloride        REAL,                          -- mg/L
    iron            REAL,                          -- mg/L
    fecal_coliform  INTEGER,                       -- MPN/100ml

    kit_batch       TEXT,
    kit_expiry      DATE,
    photo_url       TEXT NOT NULL,

    version         INTEGER NOT NULL DEFAULT 1,
    supersedes_id   UUID REFERENCES quality_readings(id),
    edit_reason     TEXT,
    anomaly         BOOLEAN NOT NULL DEFAULT false,
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quality_spring_time ON quality_readings (spring_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_quality_krp ON quality_readings (krp_id);

-- ───────── audit log (immutable) ─────────
CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,
    table_name  TEXT NOT NULL,
    record_id   UUID NOT NULL,
    action      TEXT NOT NULL CHECK (action IN ('insert','update','delete','version')),
    old_values  JSONB,
    new_values  JSONB,
    user_id     UUID REFERENCES users(id),
    reason      TEXT,
    ts          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_log (table_name, record_id);

-- ───────── reminders ─────────
CREATE TABLE IF NOT EXISTS reminders (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spring_id   UUID NOT NULL REFERENCES springs(id) ON DELETE CASCADE,
    krp_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    due_date    DATE NOT NULL,
    kind        TEXT NOT NULL CHECK (kind IN ('pre7','due','overdue7')),
    status      TEXT NOT NULL CHECK (status IN ('pending','sent','failed','cancelled')) DEFAULT 'pending',
    channel     TEXT NOT NULL CHECK (channel IN ('sms','push','both')) DEFAULT 'sms',
    sent_at     TIMESTAMPTZ,
    error       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (spring_id, due_date, kind)
);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders (status, due_date);

-- ───────── OTP codes (short-lived) ─────────
CREATE TABLE IF NOT EXISTS otp_codes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone        TEXT NOT NULL,
    code_hash    TEXT NOT NULL,
    attempts     INTEGER NOT NULL DEFAULT 0,
    expires_at   TIMESTAMPTZ NOT NULL,
    consumed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_phone_exp ON otp_codes (phone, expires_at DESC);

-- ───────── migration log ─────────
CREATE TABLE IF NOT EXISTS schema_migrations (
    id          INTEGER PRIMARY KEY,
    filename    TEXT NOT NULL UNIQUE,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
