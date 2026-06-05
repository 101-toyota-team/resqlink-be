ALTER TABLE bookings ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES providers(id);
