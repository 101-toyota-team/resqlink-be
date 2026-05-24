-- Upgrade hospital search to use Full-Text Search and trigram indexes
-- on the joined providers table, matching the provider search quality.

CREATE OR REPLACE FUNCTION search_hospitals_optimized(
  search_term TEXT,
  raw_term TEXT DEFAULT NULL
)
RETURNS TABLE(id UUID) AS $$
DECLARE
  expanded_tsquery tsquery;
  raw_tsquery tsquery;
BEGIN
  IF raw_term IS NULL THEN raw_term := search_term; END IF;

  expanded_tsquery := websearch_to_tsquery('indonesian', unaccent(search_term));
  raw_tsquery := websearch_to_tsquery('indonesian', unaccent(raw_term));

  RETURN QUERY
  SELECT h.id
  FROM public.hospitals h
  INNER JOIN public.providers p ON p.id = h.provider_id
  WHERE p.provider_type = 'rumah_sakit'
    AND (
      p.fts_vector @@ expanded_tsquery
      OR p.name % search_term
      OR h.igd_email ILIKE '%' || search_term || '%'
    )
    AND p.is_active = true
  ORDER BY
    ts_rank(p.fts_vector, raw_tsquery) DESC,
    similarity(p.name, raw_term) DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql STABLE;
