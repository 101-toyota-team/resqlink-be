-- Remove driver_id index and column from bookings
DROP INDEX IF EXISTS idx_bookings_driver_id;
ALTER TABLE bookings DROP COLUMN IF EXISTS driver_id;
