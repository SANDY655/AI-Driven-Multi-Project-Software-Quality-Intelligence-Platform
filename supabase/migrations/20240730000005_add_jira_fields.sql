-- Add labels and environment to bugs
ALTER TABLE bugs ADD COLUMN labels jsonb DEFAULT '[]'::jsonb;
ALTER TABLE bugs ADD COLUMN environment text DEFAULT NULL;

-- Add labels to tasks
ALTER TABLE tasks ADD COLUMN labels jsonb DEFAULT '[]'::jsonb;
