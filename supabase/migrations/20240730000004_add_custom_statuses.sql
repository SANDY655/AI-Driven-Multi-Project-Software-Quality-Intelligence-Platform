-- Add Custom Project Statuses
CREATE TABLE project_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  position INTEGER NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE project_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view project statuses" ON project_statuses FOR SELECT 
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = project_statuses.project_id AND project_members.user_id = auth.uid()));
CREATE POLICY "Users can manage project statuses" ON project_statuses FOR ALL
  USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = project_statuses.project_id AND project_members.user_id = auth.uid()));

-- Insert default statuses for existing projects using a trigger
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_project_created
    AFTER INSERT ON projects
    FOR EACH ROW EXECUTE FUNCTION initialize_default_statuses();

-- Backfill for existing projects
INSERT INTO project_statuses (project_id, name, color, position, is_default)
SELECT id, 'todo', 'bg-slate-100 text-slate-800', 1, TRUE FROM projects
UNION ALL
SELECT id, 'in_progress', 'bg-blue-100 text-blue-800', 2, TRUE FROM projects
UNION ALL
SELECT id, 'done', 'bg-emerald-100 text-emerald-800', 3, TRUE FROM projects;
