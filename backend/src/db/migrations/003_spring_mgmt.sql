-- 003_spring_mgmt.sql — Spring management enhancements
-- Adds: updated_at tracking, upload history, village management

-- Add updated_at to springs for delta sync
ALTER TABLE springs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE springs ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id);

-- Backfill: set updated_at = created_at for existing rows
UPDATE springs SET updated_at = created_at WHERE updated_at IS NULL;

-- Create index for delta sync queries
CREATE INDEX IF NOT EXISTS idx_springs_updated_at ON springs (updated_at);

-- Track spring upload history
CREATE TABLE IF NOT EXISTS spring_uploads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename      TEXT NOT NULL,
  uploaded_by   UUID REFERENCES users(id),
  total_rows    INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  error_count   INTEGER NOT NULL DEFAULT 0,
  errors        JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Add updated_at to villages too
ALTER TABLE villages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
UPDATE villages SET updated_at = created_at WHERE updated_at IS NULL;
