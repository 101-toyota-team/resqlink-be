-- Add hospital data integrity constraints
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
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'chk_hospital_type' 
        AND conrelid = 'hospitals'::regclass
    ) THEN
        ALTER TABLE hospitals ADD CONSTRAINT chk_hospital_type 
        CHECK (provider_type = 'rumah_sakit');
    END IF;
END $$;

-- Add index on provider_type for efficient filtering
CREATE INDEX IF NOT EXISTS idx_hospitals_provider_type ON hospitals (provider_type);