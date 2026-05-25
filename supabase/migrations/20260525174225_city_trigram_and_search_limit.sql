-- Add trigram index on city for fuzzy city name matching
CREATE INDEX IF NOT EXISTS idx_providers_city_trgm 
ON public.providers USING GIN (city gin_trgm_ops);

-- Update provider search: add city trigram matching + configurable limit
CREATE OR REPLACE FUNCTION search_providers_optimized(
  search_term TEXT,
  raw_term TEXT DEFAULT NULL,
  max_results INTEGER DEFAULT 20
)
RETURNS SETOF public.providers AS $$
DECLARE
  expanded_tsquery tsquery;
  raw_tsquery tsquery;
BEGIN
  IF raw_term IS NULL THEN raw_term := search_term; END IF;

  expanded_tsquery := websearch_to_tsquery('indonesian', unaccent(search_term));
  raw_tsquery := websearch_to_tsquery('indonesian', unaccent(raw_term));

  RETURN QUERY
  SELECT *
  FROM public.providers
  WHERE (
    fts_vector @@ expanded_tsquery 
    OR name % search_term 
    OR city % search_term
  )
    AND is_active = true
  ORDER BY 
    ts_rank(fts_vector, raw_tsquery) DESC,
    similarity(name, raw_term) DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Update hospital search: add city trigram matching + configurable limit
CREATE OR REPLACE FUNCTION search_hospitals_optimized(
  search_term TEXT,
  raw_term TEXT DEFAULT NULL,
  max_results INTEGER DEFAULT 20
)
RETURNS TABLE(hospital_id UUID, provider_id UUID) AS $$
DECLARE
  expanded_tsquery tsquery;
  raw_tsquery tsquery;
BEGIN
  IF raw_term IS NULL THEN raw_term := search_term; END IF;

  expanded_tsquery := websearch_to_tsquery('indonesian', unaccent(search_term));
  raw_tsquery := websearch_to_tsquery('indonesian', unaccent(raw_term));

  RETURN QUERY
  SELECT h.id, h.provider_id
  FROM public.hospitals h
  INNER JOIN public.providers p ON p.id = h.provider_id
  WHERE p.provider_type = 'rumah_sakit'
    AND (
      p.fts_vector @@ expanded_tsquery
      OR p.name % search_term
      OR p.city % search_term
      OR h.igd_email ILIKE '%' || search_term || '%'
    )
    AND p.is_active = true
  ORDER BY
    ts_rank(p.fts_vector, raw_tsquery) DESC,
    similarity(p.name, raw_term) DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;
