-- Remove driver-specific RLS policies
DROP POLICY IF EXISTS "Admins or drivers themselves can view driver data" ON public.drivers;

-- Update user role validation trigger function to exclude 'driver'
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
  -- Extract role and provider_id from user_metadata
  v_role := NEW.raw_user_meta_data->>'role';
  v_provider_id := NEW.raw_user_meta_data->>'provider_id';

  -- Validate role
  IF v_role IS NOT NULL AND v_role NOT IN ('user', 'provider') THEN
    RAISE EXCEPTION 'Invalid role: %', v_role;
  END IF;

  -- Sync to app_metadata
  -- Initialize raw_app_meta_data if null
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