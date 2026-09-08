-- Add an embedding column to the tasks table for Gemini (768 dimensions)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Create a function to search for tasks
CREATE OR REPLACE FUNCTION match_tasks (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_project_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  task_display_id text,
  title text,
  description text,
  priority text,
  assigned_to uuid,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    tasks.id,
    tasks.task_display_id,
    tasks.title,
    tasks.description,
    tasks.priority,
    tasks.assigned_to,
    1 - (tasks.embedding <=> query_embedding) AS similarity
  FROM tasks
  WHERE 1 - (tasks.embedding <=> query_embedding) > match_threshold
    AND (filter_project_id IS NULL OR tasks.project_id = filter_project_id)
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
