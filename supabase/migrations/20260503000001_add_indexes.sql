-- Add indexes for optimization
CREATE INDEX IF NOT EXISTS idx_bookings_pickup_h3 ON bookings (pickup_h3);
CREATE INDEX IF NOT EXISTS idx_ambulances_provider_id ON ambulances (provider_id);
CREATE INDEX IF NOT EXISTS idx_drivers_provider_id ON drivers (provider_id);
CREATE INDEX IF NOT EXISTS idx_hospitals_provider_id ON hospitals (provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_ambulance_id ON bookings (ambulance_id);
CREATE INDEX IF NOT EXISTS idx_bookings_driver_id ON bookings (driver_id);
