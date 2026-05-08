-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Add a tsvector column for weighted Full-Text Search
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS fts_vector tsvector;

-- Create a function to compute the fts_vector
CREATE OR REPLACE FUNCTION providers_fts_trigger() RETURNS trigger AS $$
BEGIN
  NEW.fts_vector :=
    setweight(to_tsvector('indonesian', unaccent(coalesce(NEW.name, ''))), 'A') ||
    setweight(to_tsvector('indonesian', unaccent(coalesce(NEW.provider_type::text, ''))), 'B') ||
    setweight(to_tsvector('indonesian', unaccent(coalesce(NEW.city, ''))), 'C') ||
    setweight(to_tsvector('indonesian', unaccent(coalesce(NEW.address, ''))), 'D');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Create a trigger to update the fts_vector on insert or update
DROP TRIGGER IF EXISTS trg_providers_fts ON public.providers;
CREATE TRIGGER trg_providers_fts
  BEFORE INSERT OR UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION providers_fts_trigger();

-- Initialize fts_vector for existing rows
UPDATE public.providers SET fts_vector = 
  setweight(to_tsvector('indonesian', unaccent(coalesce(name, ''))), 'A') ||
  setweight(to_tsvector('indonesian', unaccent(coalesce(provider_type::text, ''))), 'B') ||
  setweight(to_tsvector('indonesian', unaccent(coalesce(city, ''))), 'C') ||
  setweight(to_tsvector('indonesian', unaccent(coalesce(address, ''))), 'D');

-- Create GIN indexes for FTS and Trigram Similarity
CREATE INDEX IF NOT EXISTS idx_providers_fts ON public.providers USING GIN (fts_vector);
CREATE INDEX IF NOT EXISTS idx_providers_name_trgm ON public.providers USING GIN (name gin_trgm_ops);

-- Create a robust search function that combines FTS and Trigram ranking
CREATE OR REPLACE FUNCTION search_providers_optimized(search_term TEXT)
RETURNS SETOF public.providers AS $$
DECLARE
  query tsquery;
BEGIN
  -- Convert search term to a web-compatible tsquery
  query := websearch_to_tsquery('indonesian', unaccent(search_term));

  RETURN QUERY
  SELECT *
  FROM public.providers
  WHERE (fts_vector @@ query OR name % search_term)
    AND is_active = true
  ORDER BY 
    ts_rank(fts_vector, query) DESC,
    similarity(name, search_term) DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql STABLE;
