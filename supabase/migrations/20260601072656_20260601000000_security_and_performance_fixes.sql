-- Phase 1: Address Security and Performance Advisories

-- 1. Harden Security DEFINER on rls_auto_enable
-- Revoke execution privileges from public/anon/authenticated to prevent unauthorized use.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rls_auto_enable' AND pronamespace = 'public'::regnamespace) THEN
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
    END IF;
END $$;

-- 2. Fix Mutable Search Paths
-- Explicitly set search_path to 'public' for functions to prevent search path hijacking.
-- Note: We apply this to all overloaded signatures present in the database.
DO $$ 
DECLARE 
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.proname IN ('providers_fts_trigger', 'update_provider_booking_count', 'search_providers_optimized', 'search_hospitals_optimized')
    LOOP
        EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public', func_record.nspname, func_record.proname, func_record.args);
    END LOOP;
END $$;

-- 3. Optimize RLS Policies (Initplan Issue)
-- Wrap auth.<function>() calls in a subselect (SELECT auth.<function>()) so PostgreSQL 
-- caches the result per-query instead of re-evaluating it for every row.

DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings;
CREATE POLICY "Users can view their own bookings" 
ON public.bookings FOR SELECT 
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own bookings" ON public.bookings;
CREATE POLICY "Users can create their own bookings" 
ON public.bookings FOR INSERT 
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins or drivers themselves can view driver data" ON public.drivers;
CREATE POLICY "Admins or drivers themselves can view driver data" 
ON public.drivers FOR SELECT 
USING (
  ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin') OR 
  (id = (SELECT auth.uid()))
);

-- 4. Add Covering Indexes for Foreign Keys
-- This resolves the "Unindexed foreign keys" performance advisory.
CREATE INDEX IF NOT EXISTS idx_bookings_provider_id ON public.bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_drivers_current_ambulance_id ON public.drivers(current_ambulance_id);