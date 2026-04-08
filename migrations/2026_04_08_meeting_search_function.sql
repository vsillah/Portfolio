-- Full-text search across meeting_records columns including jsonb fields
-- Used by the social content trigger meeting picker
CREATE OR REPLACE FUNCTION search_meeting_records(
  search_term text,
  date_from timestamptz DEFAULT NULL,
  date_to timestamptz DEFAULT NULL,
  result_limit int DEFAULT 10,
  result_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  meeting_type text,
  meeting_date timestamptz,
  created_at timestamptz,
  transcript text,
  structured_notes jsonb,
  duration_minutes int,
  raw_notes text,
  meeting_data jsonb,
  attendees jsonb,
  total_count bigint
)
LANGUAGE sql STABLE
AS $$
  WITH matched AS (
    SELECT m.*,
           count(*) OVER () AS total_count
    FROM meeting_records m
    WHERE (search_term IS NULL OR search_term = '' OR
           m.raw_notes ILIKE '%' || search_term || '%' OR
           m.meeting_type ILIKE '%' || search_term || '%' OR
           m.structured_notes::text ILIKE '%' || search_term || '%' OR
           m.meeting_data::text ILIKE '%' || search_term || '%')
      AND (date_from IS NULL OR m.meeting_date >= date_from)
      AND (date_to IS NULL OR m.meeting_date <= date_to)
    ORDER BY m.meeting_date DESC
    LIMIT result_limit
    OFFSET result_offset
  )
  SELECT
    matched.id,
    matched.meeting_type,
    matched.meeting_date,
    matched.created_at,
    matched.transcript,
    matched.structured_notes,
    matched.duration_minutes,
    matched.raw_notes,
    matched.meeting_data,
    matched.attendees,
    matched.total_count
  FROM matched;
$$;
