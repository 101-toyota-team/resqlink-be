-- Simplify driver RLS policy - remove driver self-access check
DROP POLICY IF EXISTS "Admins or drivers themselves can view driver data" ON public.drivers;
CREATE POLICY "Admins can view driver data" 
ON public.drivers FOR SELECT 
USING (
  (SELECT auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
);
