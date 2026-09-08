-- ==========================================
-- Add Epics Table and Unify Agile Flow
-- ==========================================

-- 1. Create Epics Table
CREATE TABLE epics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('planned','in_progress','completed')) DEFAULT 'planned',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Epics RLS
ALTER TABLE epics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view project epics" ON epics FOR SELECT 
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = epics.project_id AND project_members.user_id = auth.uid()));
CREATE POLICY "Users can create project epics" ON epics FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = epics.project_id AND project_members.user_id = auth.uid()));
CREATE POLICY "Users can update project epics" ON epics FOR UPDATE
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = epics.project_id AND project_members.user_id = auth.uid()));
CREATE POLICY "Users can delete project epics" ON epics FOR DELETE
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = epics.project_id AND project_members.user_id = auth.uid()));

-- 2. Update Tasks
ALTER TABLE tasks ADD COLUMN epic_id UUID REFERENCES epics(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN story_points INTEGER DEFAULT 0;

-- 3. Update Bugs
ALTER TABLE bugs ADD COLUMN sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL;
ALTER TABLE bugs ADD COLUMN epic_id UUID REFERENCES epics(id) ON DELETE SET NULL;
ALTER TABLE bugs ADD COLUMN story_points INTEGER DEFAULT 0;
