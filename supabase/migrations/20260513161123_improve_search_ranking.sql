-- Improve search ranking by accepting raw (unexpanded) query as an additional trigram similarity signal

CREATE OR REPLACE FUNCTION search_providers_optimized(
  search_term TEXT,
  raw_term TEXT DEFAULT NULL
)
RETURNS SETOF public.providers AS $$
DECLARE
  query tsquery;
BEGIN
  -- Use search_term for expanded fallback when raw_term is not provided
  IF raw_term IS NULL THEN raw_term := search_term; END IF;

  -- Convert expanded search term to a web-compatible tsquery
  query := websearch_to_tsquery('indonesian', unaccent(search_term));

  RETURN QUERY
  SELECT *
  FROM public.providers
  WHERE (fts_vector @@ query OR name % search_term)
    AND is_active = true
  ORDER BY 
    ts_rank(fts_vector, query) DESC,
    -- Trigram similarity against the raw (unexpanded) query boosts exact/near-exact name matches.
    -- E.g. searching "rs universitas indonesia" matches "RS Universitas Indonesia" with high
    -- trigram similarity (case-insensitive), while the expanded "Rumah Sakit universitas indonesia"
    -- has poor overlap with the abbreviation "RS".
    similarity(name, raw_term) DESC,
    similarity(name, search_term) DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql STABLE;
