-- Enable the pgvector extension to work with embedding vectors
CREATE EXTENSION IF NOT EXISTS vector;

-- Add an embedding column to the bugs table for Gemini (768 dimensions)
ALTER TABLE public.bugs ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Create a function to search for bugs
CREATE OR REPLACE FUNCTION match_bugs (
  query_embedding vector(768),
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
