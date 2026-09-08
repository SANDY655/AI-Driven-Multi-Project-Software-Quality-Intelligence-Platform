-- ==========================================
-- Add Development Tools and SLA schema
-- ==========================================

-- 1. Create Branches Table
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Branches RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view project branches" ON public.branches FOR SELECT 
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = branches.project_id AND project_members.user_id = auth.uid()));
CREATE POLICY "Users can create project branches" ON public.branches FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = branches.project_id AND project_members.user_id = auth.uid()));
CREATE POLICY "Users can update project branches" ON public.branches FOR UPDATE
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = branches.project_id AND project_members.user_id = auth.uid()));
CREATE POLICY "Users can delete project branches" ON public.branches FOR DELETE
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = branches.project_id AND project_members.user_id = auth.uid()));


-- 2. Create branch_task_links
CREATE TABLE IF NOT EXISTS public.branch_task_links (
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (branch_id, task_id)
);

-- 3. Create branch_bug_links
CREATE TABLE IF NOT EXISTS public.branch_bug_links (
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  bug_id UUID REFERENCES public.bugs(id) ON DELETE CASCADE,
  PRIMARY KEY (branch_id, bug_id)
);

-- 4. Create commit_bug_links (commit_task_links already exists)
CREATE TABLE IF NOT EXISTS public.commit_bug_links (
  commit_id UUID REFERENCES public.commits(id) ON DELETE CASCADE,
  bug_id UUID REFERENCES public.bugs(id) ON DELETE CASCADE,
  PRIMARY KEY (commit_id, bug_id)
);
