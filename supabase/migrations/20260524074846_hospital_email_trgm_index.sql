-- Add a GIN trigram index on the hospital email field to optimize ILIKE searches
-- performed by the search_hospitals_optimized RPC.

CREATE INDEX IF NOT EXISTS idx_hospitals_igd_email_trgm 
ON public.hospitals USING gin (igd_email gin_trgm_ops);
