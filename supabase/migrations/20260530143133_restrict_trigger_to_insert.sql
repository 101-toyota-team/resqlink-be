-- Restrict trigger to INSERT only to prevent privilege escalation via user_metadata updates
DROP TRIGGER IF EXISTS on_auth_user_role_sync ON auth.users;

CREATE TRIGGER on_auth_user_role_sync
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_sync_user_role();
