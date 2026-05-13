-- Improve search ranking: use raw (unexpanded) query for FTS ranking,
-- expanded query for the WHERE clause (broad matching).

CREATE OR REPLACE FUNCTION search_providers_optimized(
  search_term TEXT,
  raw_term TEXT DEFAULT NULL
)
RETURNS SETOF public.providers AS $$
DECLARE
  expanded_tsquery tsquery;
  raw_tsquery tsquery;
BEGIN
  IF raw_term IS NULL THEN raw_term := search_term; END IF;

  -- Tsquery from expanded query (e.g. "Rumah Sakit universitas indonesia") — used only for WHERE
  expanded_tsquery := websearch_to_tsquery('indonesian', unaccent(search_term));
  -- Tsquery from raw query (e.g. "rs universitas indonesia") — used for ranking (ts_rank)
  raw_tsquery := websearch_to_tsquery('indonesian', unaccent(raw_term));

  RETURN QUERY
  SELECT *
  FROM public.providers
  WHERE (fts_vector @@ expanded_tsquery OR name % search_term)
    AND is_active = true
  ORDER BY 
    ts_rank(fts_vector, raw_tsquery) DESC,
    similarity(name, raw_term) DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql STABLE;
