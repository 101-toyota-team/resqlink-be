-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_role_sync ON auth.users;
DROP FUNCTION IF EXISTS public.handle_sync_user_role();
DROP FUNCTION IF EXISTS auth.handle_sync_user_role();

-- Create the function in public schema
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
  IF v_role IS NOT NULL AND v_role NOT IN ('user', 'driver', 'provider') THEN
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

-- Create the trigger on auth.users
CREATE TRIGGER on_auth_user_role_sync
BEFORE INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_sync_user_role();

-- Backfill existing users
-- We only update users with valid roles to avoid triggering the validation error for 'admin' users.
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
  jsonb_strip_nulls(jsonb_build_object(
    'role', raw_user_meta_data->>'role',
    'provider_id', raw_user_meta_data->>'provider_id'
  ))
WHERE (raw_user_meta_data->>'role' IN ('user', 'driver', 'provider') OR raw_user_meta_data->>'role' IS NULL)
  AND (raw_user_meta_data->>'role' IS NOT NULL OR raw_user_meta_data->>'provider_id' IS NOT NULL);
