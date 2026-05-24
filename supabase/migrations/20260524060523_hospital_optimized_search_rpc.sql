-- Create a search function for hospitals using parameterized queries
-- to avoid string interpolation in application code.
CREATE OR REPLACE FUNCTION search_hospitals_optimized(search_term TEXT)
RETURNS TABLE(id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT h.id
  FROM public.hospitals h
  INNER JOIN public.providers p ON p.id = h.provider_id
  WHERE p.provider_type = 'rumah_sakit'
    AND (
      p.name ILIKE '%' || search_term || '%'
      OR h.igd_email ILIKE '%' || search_term || '%'
    )
  ORDER BY 
    CASE 
      WHEN p.name ILIKE search_term THEN 0
      WHEN p.name ILIKE search_term || '%' THEN 1
      ELSE 2
    END,
    p.name ASC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql STABLE;
