-- ==========================================
-- Add Sprints Table and Epic Hierarchy
-- ==========================================

CREATE TABLE sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  status TEXT CHECK (status IN ('planned','active','completed')) DEFAULT 'planned',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sprints RLS Policies
ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view project sprints" ON sprints FOR SELECT 
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = sprints.project_id AND project_members.user_id = auth.uid()));
CREATE POLICY "Users can create project sprints" ON sprints FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = sprints.project_id AND project_members.user_id = auth.uid()));
CREATE POLICY "Users can update project sprints" ON sprints FOR UPDATE
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = sprints.project_id AND project_members.user_id = auth.uid()));
CREATE POLICY "Users can delete project sprints" ON sprints FOR DELETE
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = sprints.project_id AND project_members.user_id = auth.uid()));

-- Add to Tasks
ALTER TABLE tasks ADD COLUMN sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN parent_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
