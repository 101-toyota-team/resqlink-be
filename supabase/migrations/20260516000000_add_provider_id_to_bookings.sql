ALTER TABLE bookings ADD COLUMN provider_id UUID REFERENCES providers(id);
