-- SPDX-License-Identifier: MIT
-- v0.2 — remove SMS/OTP, add KRP signup + manager-approval flow.

-- 1) Approval status for users (KRPs need to be approved before login works).
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS approval_status TEXT
        CHECK (approval_status IN ('pending','approved','rejected'))
        DEFAULT 'approved';

-- 2) Who approved and when (audit trail for managers).
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejected_reason TEXT,
    ADD COLUMN IF NOT EXISTS signup_note TEXT;            -- KRP-provided note at signup

-- 3) KRPs now log in with phone + password. Ensure existing seed KRPs work:
--    set a known password so the demo account stays usable.
UPDATE users
   SET password_hash = COALESCE(password_hash,
        '$2a$10$gK0Qj4uPwS6jSe9bV.HQOe5d5tH0L0DZkbHPqI0Aq6QzKwFq0G3FK')  -- bcrypt of 'demo1234'
 WHERE role = 'krp' AND password_hash IS NULL;

-- 4) All pre-existing rows are by definition approved (legacy data, already trusted).
UPDATE users SET approval_status = 'approved' WHERE approval_status IS NULL;

-- 5) Helpful index for the dashboard's "pending KRPs" query.
CREATE INDEX IF NOT EXISTS idx_users_pending
    ON users (approval_status)
    WHERE approval_status = 'pending';

-- 6) The otp_codes table is no longer used; drop it.
DROP TABLE IF EXISTS otp_codes;

-- 7) Reminders are now in-dashboard only. The 'channel' column stays but only
--    'push' (in-dashboard) is used going forward; we keep 'sms' as a no-op
--    value for backward compatibility with old rows.
