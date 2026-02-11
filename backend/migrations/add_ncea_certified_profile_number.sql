-- Add NCEA Certified Profile Number for professionals
-- Run this migration against your database before deploying the backend change.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS ncea_certified_profile_number TEXT;

COMMENT ON COLUMN user_profiles.ncea_certified_profile_number IS 'NCEA certified profile number for registered professionals';
