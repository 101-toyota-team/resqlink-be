-- Make ambulance_id nullable to support two-step booking (draft -> assign)
ALTER TABLE bookings ALTER COLUMN ambulance_id DROP NOT NULL;

-- Add 'draft' to the booking_status enum for draft bookings
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'draft';
