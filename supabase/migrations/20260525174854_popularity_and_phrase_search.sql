-- 1. Add booking_count column to providers
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS booking_count INTEGER NOT NULL DEFAULT 0;

-- 2. Backfill existing completed bookings
UPDATE public.providers p
SET booking_count = (
  SELECT COUNT(*)
  FROM public.bookings b
  WHERE b.provider_id = p.id
    AND b.status = 'completed'
);

-- 3. Create trigger function to update booking count on INSERT/UPDATE
CREATE OR REPLACE FUNCTION update_provider_booking_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.provider_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'completed') THEN
      UPDATE public.providers
      SET booking_count = booking_count + 1
      WHERE id = NEW.provider_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger for insert and status update
DROP TRIGGER IF EXISTS trg_bookings_booking_count ON public.bookings;
CREATE TRIGGER trg_bookings_booking_count
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_provider_booking_count();

-- 5. Update search_providers_optimized with popularity + phrase boost
CREATE OR REPLACE FUNCTION search_providers_optimized(
  search_term TEXT,
  raw_term TEXT DEFAULT NULL,
  max_results INTEGER DEFAULT 20
)
RETURNS SETOF public.providers AS $$
DECLARE
  expanded_tsquery tsquery;
  raw_tsquery tsquery;
  phrase_tsquery tsquery;
BEGIN
  IF raw_term IS NULL THEN raw_term := search_term; END IF;

  expanded_tsquery := websearch_to_tsquery('indonesian', unaccent(search_term));
  raw_tsquery := websearch_to_tsquery('indonesian', unaccent(raw_term));
  phrase_tsquery := phraseto_tsquery('indonesian', unaccent(raw_term));

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
    (
      ts_rank(fts_vector, raw_tsquery) * ln(COALESCE(booking_count, 0) + 2) +
      ts_rank(fts_vector, phrase_tsquery) * 2
    ) DESC,
    similarity(name, raw_term) DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. Update search_hospitals_optimized with popularity + phrase boost
CREATE OR REPLACE FUNCTION search_hospitals_optimized(
  search_term TEXT,
  raw_term TEXT DEFAULT NULL,
  max_results INTEGER DEFAULT 20
)
RETURNS TABLE(hospital_id UUID, provider_id UUID) AS $$
DECLARE
  expanded_tsquery tsquery;
  raw_tsquery tsquery;
  phrase_tsquery tsquery;
BEGIN
  IF raw_term IS NULL THEN raw_term := search_term; END IF;

  expanded_tsquery := websearch_to_tsquery('indonesian', unaccent(search_term));
  raw_tsquery := websearch_to_tsquery('indonesian', unaccent(raw_term));
  phrase_tsquery := phraseto_tsquery('indonesian', unaccent(raw_term));

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
    (
      ts_rank(p.fts_vector, raw_tsquery) * ln(COALESCE(p.booking_count, 0) + 2) +
      ts_rank(p.fts_vector, phrase_tsquery) * 2
    ) DESC,
    similarity(p.name, raw_term) DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;