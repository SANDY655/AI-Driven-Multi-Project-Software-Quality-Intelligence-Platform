-- Granular RLS policies for bugs based on project roles

-- First, drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can create project bugs" ON bugs;
DROP POLICY IF EXISTS "Users can update project bugs" ON bugs;
DROP POLICY IF EXISTS "Users can view project bugs" ON bugs;

-- 1. SELECT: All project members can view bugs
CREATE POLICY "Users can view project bugs" ON bugs FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_members.project_id = bugs.project_id 
      AND project_members.user_id = auth.uid()
    )
  );

-- 2. INSERT: Only Admin, PM, and Tester can create bugs
CREATE POLICY "Users can create project bugs" ON bugs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_members.project_id = bugs.project_id 
      AND project_members.user_id = auth.uid()
      AND project_members.project_role IN ('admin', 'pm', 'tester')
    )
  );

-- 3. UPDATE: 
-- Admins, PMs, and Testers can update any bug
-- Developers can also update bugs (mostly for status, though SQL-level restriction for specific columns is tricky, we'll enforce primary logic in UI)
CREATE POLICY "Project members can update bugs" ON bugs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_members.project_id = bugs.project_id 
      AND project_members.user_id = auth.uid()
      AND project_members.project_role IN ('admin', 'pm', 'tester', 'developer')
    )
  );

-- 4. DELETE: Only Admin and PM can delete bugs
CREATE POLICY "Users can delete project bugs" ON bugs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_members.project_id = bugs.project_id 
      AND project_members.user_id = auth.uid()
      AND project_members.project_role IN ('admin', 'pm')
    )
  );
