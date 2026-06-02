-- Function to sync role from user_metadata to app_metadata
CREATE OR REPLACE FUNCTION public.handle_sync_user_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if role exists in user_metadata
  IF (new.raw_user_meta_data->>'role') IS NOT NULL THEN
    new.raw_app_meta_data := COALESCE(new.raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object('role', new.raw_user_meta_data->>'role');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on INSERT or UPDATE on auth.users
DROP TRIGGER IF EXISTS on_auth_user_role_sync ON auth.users;
CREATE TRIGGER on_auth_user_role_sync
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_sync_user_role();

-- Backfill existing users
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', raw_user_meta_data->>'role')
WHERE raw_user_meta_data->>'role' IS NOT NULL
  AND (raw_app_meta_data->>'role' IS NULL OR raw_app_meta_data->>'role' <> raw_user_meta_data->>'role');