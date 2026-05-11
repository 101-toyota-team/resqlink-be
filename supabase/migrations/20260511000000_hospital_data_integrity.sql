-- Add provider_type column to hospitals table for data integrity
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS provider_type provider_type;

-- Backfill provider_type from providers table using existing FK relationship
UPDATE hospitals h
SET provider_type = p.provider_type
FROM providers p
WHERE h.provider_id = p.id;

-- Add NOT NULL constraint after backfill
ALTER TABLE hospitals ALTER COLUMN provider_type SET NOT NULL;

-- Add CHECK constraint to ensure only rumah_sakit can have hospital records
ALTER TABLE hospitals ADD CONSTRAINT chk_hospital_type
CHECK (provider_type = 'rumah_sakit');

-- Add index on provider_type for efficient filtering
CREATE INDEX IF NOT EXISTS idx_hospitals_provider_type ON hospitals (provider_type);
