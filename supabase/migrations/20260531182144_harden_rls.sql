-- Harden RLS for drivers and ambulances

-- 1. Drivers
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on drivers" ON drivers;

CREATE POLICY "Admins or drivers themselves can view driver data"
ON drivers
FOR SELECT
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR 
  (id = auth.uid())
);

-- 2. Ambulances
ALTER TABLE ambulances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on ambulances" ON ambulances;

CREATE POLICY "Authenticated users can view ambulances"
ON ambulances
FOR SELECT
TO authenticated
USING (true);
