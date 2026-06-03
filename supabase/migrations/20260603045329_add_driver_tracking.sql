-- Re-add driver_id to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES drivers(id);
CREATE INDEX IF NOT EXISTS idx_bookings_driver_id ON bookings(driver_id);

-- Create driver_locations table
CREATE TABLE IF NOT EXISTS driver_locations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  driver_id uuid NOT NULL REFERENCES drivers(id),
  booking_id uuid REFERENCES bookings(id),
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  heading smallint,
  speed smallint,
  accuracy smallint,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_driver_locations_booking ON driver_locations(booking_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver ON driver_locations(driver_id, captured_at);

-- Update role trigger
CREATE OR REPLACE FUNCTION public.handle_sync_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
  v_provider_id TEXT;
BEGIN
  v_role := NEW.raw_user_meta_data->>'role';
  v_provider_id := NEW.raw_user_meta_data->>'provider_id';
  IF v_role IS NOT NULL AND v_role NOT IN ('user', 'driver', 'provider') THEN
    RAISE EXCEPTION 'Invalid role: %', v_role;
  END IF;
  IF NEW.raw_app_meta_data IS NULL THEN
    NEW.raw_app_meta_data := '{}'::jsonb;
  END IF;
  IF v_role IS NOT NULL THEN
    NEW.raw_app_meta_data := NEW.raw_app_meta_data || jsonb_build_object('role', v_role);
  END IF;
  IF v_provider_id IS NOT NULL THEN
    NEW.raw_app_meta_data := NEW.raw_app_meta_data || jsonb_build_object('provider_id', v_provider_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Update RLS policy
DROP POLICY IF EXISTS "Admins can view driver data" ON public.drivers;
CREATE POLICY "Admins and drivers can view driver data"
ON public.drivers FOR SELECT
USING (
  (SELECT auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  OR
  id = ((SELECT auth.jwt()) ->> 'sub')::uuid
);
