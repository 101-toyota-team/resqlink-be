-- Backfill admin role from user_metadata to app_metadata
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
WHERE raw_user_meta_data->>'role' = 'admin'
  AND (raw_app_meta_data->>'role' IS NULL OR raw_app_meta_data->>'role' != 'admin');
