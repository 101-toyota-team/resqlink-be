-- Add btree index on h3_index for spatial lookup performance
CREATE INDEX IF NOT EXISTS idx_providers_h3_index ON public.providers USING btree (h3_index);
