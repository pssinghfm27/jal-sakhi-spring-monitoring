-- SPDX-License-Identifier: MIT
-- v0.3 — Spring management: bulk Excel upload, delta sync, upload history.
--
-- This adds the columns and tables the manager/admin spring-management UI
-- needs (Excel upload, edit, deactivate, history).

-- 1) updated_at on springs — used by KRP app's delta sync (GET /springs/master?since=...)
ALTER TABLE springs
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_springs_updated_at ON springs (updated_at);

-- Backfill any old rows so the column has sensible values
UPDATE springs SET updated_at = created_at WHERE updated_at IS NULL;

-- 2) updated_at on villages — for same reason (KRP signup form sees latest villages)
ALTER TABLE villages
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE villages SET updated_at = created_at WHERE updated_at IS NULL;

-- 3) spring_uploads — audit log of every bulk-upload run (filename, who, totals, errors)
CREATE TABLE IF NOT EXISTS spring_uploads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename        TEXT NOT NULL,
    uploaded_by     UUID REFERENCES users(id),
    total_rows      INTEGER NOT NULL DEFAULT 0,
    created_count   INTEGER NOT NULL DEFAULT 0,
    updated_count   INTEGER NOT NULL DEFAULT 0,
    error_count     INTEGER NOT NULL DEFAULT 0,
    errors          JSONB,                          -- array of {row, field, message}
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spring_uploads_user ON spring_uploads (uploaded_by, created_at DESC);

-- 4) Auto-bump updated_at on row UPDATE (so manual SQL edits also flow to KRP delta sync)
CREATE OR REPLACE FUNCTION bump_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_springs_updated_at ON springs;
CREATE TRIGGER trg_springs_updated_at
    BEFORE UPDATE ON springs
    FOR EACH ROW EXECUTE FUNCTION bump_updated_at();

DROP TRIGGER IF EXISTS trg_villages_updated_at ON villages;
CREATE TRIGGER trg_villages_updated_at
    BEFORE UPDATE ON villages
    FOR EACH ROW EXECUTE FUNCTION bump_updated_at();
