-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. Create Tables
-- ==========================================

-- profiles: Extends Supabase auth.users
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  github_username TEXT,
  role          TEXT CHECK (role IN ('admin','tester','developer','project_manager')) DEFAULT 'developer',
  skills        TEXT[] DEFAULT '{}',
  current_workload INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- projects
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  project_code    TEXT UNIQUE NOT NULL,          -- e.g., "PRJ" for bug IDs
  created_by      UUID REFERENCES profiles(id),
  github_repo_url TEXT NOT NULL,
  github_owner    TEXT NOT NULL,
  github_repo     TEXT NOT NULL,
  github_details  JSONB DEFAULT '{}',            -- stars, forks, language, etc.
  webhook_secret  TEXT,
  status          TEXT CHECK (status IN ('active','archived')) DEFAULT 'active',
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- project_members: Many-to-many relationship
CREATE TABLE project_members (
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_role  TEXT CHECK (project_role IN ('admin','tester','developer','pm')) NOT NULL,
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

-- sla_configs
CREATE TABLE sla_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID REFERENCES projects(id) ON DELETE CASCADE,
  severity          TEXT CHECK (severity IN ('critical','high','medium','low')),
  response_hours    INTEGER NOT NULL,
  resolution_hours  INTEGER NOT NULL,
  UNIQUE (project_id, severity)
);

-- bugs
CREATE TABLE bugs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_display_id      TEXT UNIQUE NOT NULL,       -- e.g., "BUG-PRJ-001"
  bug_number          INTEGER NOT NULL,           -- auto-increment per project
  project_id          UUID REFERENCES projects(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  steps_to_reproduce  TEXT,
  expected_behavior   TEXT,
  actual_behavior     TEXT,
  severity            TEXT CHECK (severity IN ('critical','high','medium','low')) DEFAULT 'medium',
  priority            TEXT CHECK (priority IN ('P0','P1','P2','P3')) DEFAULT 'P2',
  status              TEXT CHECK (status IN ('open','in_progress','in_review','resolved','closed','reopened')) DEFAULT 'open',
  reported_by         UUID REFERENCES profiles(id),
  assigned_to         UUID REFERENCES profiles(id),
  tags                TEXT[] DEFAULT '{}',
  duplicate_of        UUID REFERENCES bugs(id),
  -- SLA fields
  response_deadline   TIMESTAMPTZ,
  resolution_deadline TIMESTAMPTZ,
  responded_at        TIMESTAMPTZ,
  resolved_at         TIMESTAMPTZ,
  is_response_breached  BOOLEAN DEFAULT FALSE,
  is_resolution_breached BOOLEAN DEFAULT FALSE,
  -- AI analysis
  ai_predicted_severity TEXT,
  ai_suggested_assignee UUID REFERENCES profiles(id),
  ai_confidence_score   FLOAT,
  ai_duplicate_candidates JSONB DEFAULT '[]',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- bug_attachments
CREATE TABLE bug_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id      UUID REFERENCES bugs(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  file_size   INTEGER,
  uploaded_by UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- bug_comments
CREATE TABLE bug_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id      UUID REFERENCES bugs(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES profiles(id),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- commits
CREATE TABLE commits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  sha             TEXT UNIQUE NOT NULL,
  message         TEXT NOT NULL,
  author_name     TEXT,
  github_username TEXT,
  branch          TEXT,
  files_changed   INTEGER DEFAULT 0,
  additions       INTEGER DEFAULT 0,
  deletions       INTEGER DEFAULT 0,
  url             TEXT,
  committed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- commit_bug_links
CREATE TABLE commit_bug_links (
  commit_id   UUID REFERENCES commits(id) ON DELETE CASCADE,
  bug_id      UUID REFERENCES bugs(id) ON DELETE CASCADE,
  PRIMARY KEY (commit_id, bug_id)
);

-- activity_log
CREATE TABLE activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id      UUID REFERENCES bugs(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES profiles(id),
  action      TEXT NOT NULL,             -- 'status_changed', 'assigned', 'commented', 'commit_linked'
  old_value   TEXT,
  new_value   TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ==========================================
-- 2. Row Level Security (RLS) setup
-- ==========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE bugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_comments ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read all profiles (needed for assignment) but update only their own
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- ==========================================
-- Helper Functions for RLS (SECURITY DEFINER bypasses recursion)
-- ==========================================
CREATE OR REPLACE FUNCTION get_user_projects()
RETURNS SETOF UUID AS $$
  SELECT project_id FROM project_members WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_project_creator(pid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM projects WHERE id = pid AND created_by = auth.uid());
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_project_admin(pid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM project_members WHERE project_id = pid AND user_id = auth.uid() AND project_role IN ('admin', 'pm'));
$$ LANGUAGE sql SECURITY DEFINER;

-- ==========================================
-- Projects Policies
-- ==========================================
CREATE POLICY "View projects" ON projects FOR SELECT 
  USING (created_by = auth.uid() OR id IN (SELECT get_user_projects()));

CREATE POLICY "Insert projects" ON projects FOR INSERT 
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Update projects" ON projects FOR UPDATE
  USING (is_project_admin(id));

-- ==========================================
-- Project Members Policies
-- ==========================================
CREATE POLICY "View members" ON project_members FOR SELECT 
  USING (user_id = auth.uid() OR project_id IN (SELECT get_user_projects()));

CREATE POLICY "Insert members" ON project_members FOR INSERT 
  WITH CHECK (is_project_creator(project_id) OR is_project_admin(project_id));

CREATE POLICY "Update members" ON project_members FOR UPDATE 
  USING (is_project_admin(project_id));

CREATE POLICY "Delete members" ON project_members FOR DELETE 
  USING (is_project_admin(project_id));

-- Bugs: Users can see, create, update bugs in their projects
CREATE POLICY "Users can view project bugs" ON bugs FOR SELECT 
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = bugs.project_id AND project_members.user_id = auth.uid()));
CREATE POLICY "Users can create project bugs" ON bugs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = bugs.project_id AND project_members.user_id = auth.uid()));
CREATE POLICY "Users can update project bugs" ON bugs FOR UPDATE
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = bugs.project_id AND project_members.user_id = auth.uid()));

-- ==========================================
-- 3. Database Triggers (Profile Auto-create)
-- ==========================================

-- Create a trigger function that handles new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url, github_username)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'user_name' -- GitHub stores username here
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
