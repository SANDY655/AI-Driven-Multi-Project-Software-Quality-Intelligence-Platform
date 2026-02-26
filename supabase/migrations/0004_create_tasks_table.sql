-- ==========================================
-- 4. Create Tasks Table
-- ==========================================

CREATE TABLE tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_display_id     TEXT UNIQUE NOT NULL,       -- e.g., "TASK-PRJ-001"
  task_number         INTEGER NOT NULL,           -- auto-increment per project
  project_id          UUID REFERENCES projects(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  priority            TEXT CHECK (priority IN ('low','medium','high','urgent')) DEFAULT 'medium',
  status              TEXT CHECK (status IN ('todo','in_progress','in_review','done')) DEFAULT 'todo',
  created_by          UUID REFERENCES profiles(id),
  assigned_to         UUID REFERENCES profiles(id),
  tags                TEXT[] DEFAULT '{}',
  due_date            TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- Tasks RLS Policies
-- ==========================================

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Tasks: Users can see, create, update tasks in their projects
CREATE POLICY "Users can view project tasks" ON tasks FOR SELECT 
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = tasks.project_id AND project_members.user_id = auth.uid()));
CREATE POLICY "Users can create project tasks" ON tasks FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = tasks.project_id AND project_members.user_id = auth.uid()));
CREATE POLICY "Users can update project tasks" ON tasks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = tasks.project_id AND project_members.user_id = auth.uid()));
CREATE POLICY "Users can delete project tasks" ON tasks FOR DELETE
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = tasks.project_id AND project_members.user_id = auth.uid()));

-- ==========================================
-- Task Comments & Activity
-- ==========================================

-- task_comments
CREATE TABLE task_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES profiles(id),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- task_activity_log
CREATE TABLE task_activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES profiles(id),
  action      TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activity_log ENABLE ROW LEVEL SECURITY;

-- Project members can view task comments and activity
CREATE POLICY "Users can view project task comments" ON task_comments FOR SELECT 
  USING (EXISTS (SELECT 1 FROM project_members JOIN tasks ON project_members.project_id = tasks.project_id WHERE tasks.id = task_comments.task_id AND project_members.user_id = auth.uid()));
CREATE POLICY "Users can view project task activity" ON task_activity_log FOR SELECT 
  USING (EXISTS (SELECT 1 FROM project_members JOIN tasks ON project_members.project_id = tasks.project_id WHERE tasks.id = task_activity_log.task_id AND project_members.user_id = auth.uid()));

-- Project members can insert tracking
CREATE POLICY "Users can insert task comments" ON task_comments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM project_members JOIN tasks ON project_members.project_id = tasks.project_id WHERE tasks.id = task_comments.task_id AND project_members.user_id = auth.uid()));
CREATE POLICY "Users can insert task activity" ON task_activity_log FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM project_members JOIN tasks ON project_members.project_id = tasks.project_id WHERE tasks.id = task_activity_log.task_id AND project_members.user_id = auth.uid()));
