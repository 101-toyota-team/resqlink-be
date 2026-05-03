-- Enable Row Level Security
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambulances ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Public read for most, authenticated write for bookings)

-- Providers: Anyone can read
CREATE POLICY "Allow public read access on providers" ON providers FOR SELECT USING (true);

-- Hospitals: Anyone can read
CREATE POLICY "Allow public read access on hospitals" ON hospitals FOR SELECT USING (true);

-- Ambulances: Anyone can read
CREATE POLICY "Allow public read access on ambulances" ON ambulances FOR SELECT USING (true);

-- Drivers: Anyone can read
CREATE POLICY "Allow public read access on drivers" ON drivers FOR SELECT USING (true);

-- Bookings: 
-- 1. Users can read their own bookings
CREATE POLICY "Users can view their own bookings" ON bookings FOR SELECT USING (auth.uid() = user_id);
-- 2. Users can create their own bookings
CREATE POLICY "Users can create their own bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
-- 3. Service role can do anything (default Supabase behavior, but explicit for clarity)
CREATE POLICY "Service role has full access" ON bookings FOR ALL USING (true) WITH CHECK (true);
