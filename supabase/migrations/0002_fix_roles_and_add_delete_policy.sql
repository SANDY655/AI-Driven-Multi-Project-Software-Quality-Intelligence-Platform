-- 1. Fix the project_role check constraint on project_members
-- Note: We drop the old constraint and add a new one including 'viewer'
ALTER TABLE project_members 
DROP CONSTRAINT project_members_project_role_check;

ALTER TABLE project_members 
ADD CONSTRAINT project_members_project_role_check 
CHECK (project_role IN ('admin', 'pm', 'developer', 'tester', 'viewer'));

-- 2. Add DELETE policy for projects
-- Only project creator or admins can delete projects
CREATE POLICY "Delete projects" ON projects FOR DELETE
  USING (is_project_admin(id) OR created_by = auth.uid());
