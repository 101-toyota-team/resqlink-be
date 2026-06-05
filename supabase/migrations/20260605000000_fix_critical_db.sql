-- 3a. Enable RLS on driver_locations
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can do everything
CREATE POLICY "Admins can do everything on driver_locations"
ON public.driver_locations FOR ALL TO authenticated
USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- Policy: Drivers can insert their own locations
CREATE POLICY "Drivers can insert their own locations"
ON public.driver_locations FOR INSERT TO authenticated
WITH CHECK (driver_id = (auth.uid())::uuid);

-- Policy: Drivers can view their own locations
CREATE POLICY "Drivers can view their own locations"
ON public.driver_locations FOR SELECT TO authenticated
USING (driver_id = (auth.uid())::uuid);

-- Policy: Users can view locations for their active bookings
CREATE POLICY "Users can view driver locations for their bookings"
ON public.driver_locations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bookings
    WHERE bookings.id = driver_locations.booking_id
    AND bookings.user_id = auth.uid()
  )
);

-- 3b. Add missing Foreign Key to bookings.user_id
ALTER TABLE public.bookings
ADD CONSTRAINT bookings_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id);
