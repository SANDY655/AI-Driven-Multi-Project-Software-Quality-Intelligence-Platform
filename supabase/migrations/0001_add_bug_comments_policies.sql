-- Migration: Add RLS policies for bug_comments and activity_log
-- Description: Allows project members to view and insert comments and activity logs for bugs within their projects.

-- ==========================================
-- 1. Bug Comments Policies
-- ==========================================

-- Allow project members to view comments
CREATE POLICY "Users can view comments for bugs in their projects" ON bug_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members 
      JOIN bugs ON bugs.project_id = project_members.project_id 
      WHERE bugs.id = bug_comments.bug_id 
      AND project_members.user_id = auth.uid()
    )
  );

-- Allow project members to insert comments
CREATE POLICY "Users can insert comments for bugs in their projects" ON bug_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members 
      JOIN bugs ON bugs.project_id = project_members.project_id 
      WHERE bugs.id = bug_comments.bug_id 
      AND project_members.user_id = auth.uid()
    )
  );

-- ==========================================
-- 2. Activity Log Policies
-- ==========================================

-- Enable RLS for activity_log (it might already be enabled, but let's be sure)
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Allow project members to view activity logs
CREATE POLICY "Users can view activity for bugs in their projects" ON activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members 
      JOIN bugs ON bugs.project_id = project_members.project_id 
      WHERE bugs.id = activity_log.bug_id 
      AND project_members.user_id = auth.uid()
    )
  );

-- Allow project members to insert activity logs
CREATE POLICY "Users can insert activity for bugs in their projects" ON activity_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members 
      JOIN bugs ON bugs.project_id = project_members.project_id 
      WHERE bugs.id = activity_log.bug_id 
      AND project_members.user_id = auth.uid()
    )
  );
