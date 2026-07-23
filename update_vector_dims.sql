-- 1. Alter the column type to 1024 dimensions
ALTER TABLE public.bugs ALTER COLUMN embedding TYPE vector(1024);

-- 2. Drop the old search function
DROP FUNCTION IF EXISTS match_bugs;

-- 3. Recreate the search function with the new vector size
CREATE OR REPLACE FUNCTION match_bugs (
  query_embedding vector(1024),
  match_threshold float,
  match_count int,
  filter_project_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  bug_display_id text,
  title text,
  description text,
  severity text,
  priority text,
  assigned_to uuid,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    bugs.id,
    bugs.bug_display_id,
    bugs.title,
    bugs.description,
    bugs.severity,
    bugs.priority,
    bugs.assigned_to,
    1 - (bugs.embedding <=> query_embedding) AS similarity
  FROM bugs
  WHERE 1 - (bugs.embedding <=> query_embedding) > match_threshold
    AND (filter_project_id IS NULL OR bugs.project_id = filter_project_id)
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
