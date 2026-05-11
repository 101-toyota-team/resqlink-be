-- Fix provider type indexing and h3 constraints
-- Add index on providers.provider_type for efficient type filtering
CREATE INDEX IF NOT EXISTS idx_providers_type ON providers (provider_type);

-- Add NOT NULL constraint on h3_index in providers (requires backfill first)
-- First check if there are any null values and either backfill or mark them
-- For now, set a default for any NULL values (empty string as placeholder, which won't match valid H3)
UPDATE providers SET h3_index = '' WHERE h3_index IS NULL;

-- Now add NOT NULL
ALTER TABLE providers ALTER COLUMN h3_index SET NOT NULL;

-- Fix bookings pickup_h3 to be consistent with providers.h3_index (VARCHAR(15))
-- This is a schema change that requires checking if any data exceeds 15 chars
-- For safety, we'll add a CHECK constraint limiting to 15 chars
ALTER TABLE bookings ADD CONSTRAINT chk_pickup_h3_length 
CHECK (char_length(pickup_h3) <= 15);