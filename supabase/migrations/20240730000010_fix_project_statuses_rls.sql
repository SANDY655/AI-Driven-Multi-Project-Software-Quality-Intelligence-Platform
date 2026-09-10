-- Migration to fix RLS policy violation on project_statuses table
-- Issue: Trigger function initialize_default_statuses ran without SECURITY DEFINER,
-- causing default status insertion on project creation to fail RLS checks before
-- project_members entry was added.

-- 1. Update initialize_default_statuses to SECURITY DEFINER
CREATE OR REPLACE FUNCTION initialize_default_statuses()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO project_statuses (project_id, name, color, position, is_default)
    VALUES
        (NEW.id, 'todo', 'bg-slate-100 text-slate-800', 1, TRUE),
        (NEW.id, 'in_progress', 'bg-blue-100 text-blue-800', 2, TRUE),
        (NEW.id, 'done', 'bg-emerald-100 text-emerald-800', 3, TRUE);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop restrictive policies if existing
DROP POLICY IF EXISTS "Users can view project statuses" ON project_statuses;
DROP POLICY IF EXISTS "Users can manage project statuses" ON project_statuses;
DROP POLICY IF EXISTS "Users can create project statuses" ON project_statuses;
DROP POLICY IF EXISTS "Users can update project statuses" ON project_statuses;
DROP POLICY IF EXISTS "Users can delete project statuses" ON project_statuses;

-- 3. Re-create robust RLS policies for project_statuses allowing both members and project creators
CREATE POLICY "Users can view project statuses" ON project_statuses FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = project_statuses.project_id AND project_members.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM projects WHERE projects.id = project_statuses.project_id AND projects.created_by = auth.uid())
  );

CREATE POLICY "Users can create project statuses" ON project_statuses FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = project_statuses.project_id AND project_members.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM projects WHERE projects.id = project_statuses.project_id AND projects.created_by = auth.uid())
  );

CREATE POLICY "Users can update project statuses" ON project_statuses FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = project_statuses.project_id AND project_members.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM projects WHERE projects.id = project_statuses.project_id AND projects.created_by = auth.uid())
  );

CREATE POLICY "Users can delete project statuses" ON project_statuses FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = project_statuses.project_id AND project_members.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM projects WHERE projects.id = project_statuses.project_id AND projects.created_by = auth.uid())
  );
