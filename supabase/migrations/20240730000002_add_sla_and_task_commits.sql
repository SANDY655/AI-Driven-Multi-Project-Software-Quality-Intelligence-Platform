-- Add resolved_at columns for SLA monitoring
ALTER TABLE public.bugs ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Create commit_task_links table
CREATE TABLE IF NOT EXISTS public.commit_task_links (
  commit_id   UUID REFERENCES commits(id) ON DELETE CASCADE,
  task_id     UUID REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (commit_id, task_id)
);
