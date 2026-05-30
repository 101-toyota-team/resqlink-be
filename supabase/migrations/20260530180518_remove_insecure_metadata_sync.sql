DROP TRIGGER IF EXISTS on_auth_user_role_sync ON auth.users;
DROP FUNCTION IF EXISTS public.handle_sync_user_role();
