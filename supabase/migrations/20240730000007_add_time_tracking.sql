-- ==========================================
-- Add Time Tracking to Tasks and Bugs
-- ==========================================

-- Add original estimate and time spent (in minutes) to tasks
ALTER TABLE tasks ADD COLUMN original_estimate INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN time_spent INTEGER DEFAULT 0;

-- Add original estimate and time spent (in minutes) to bugs
ALTER TABLE bugs ADD COLUMN original_estimate INTEGER DEFAULT 0;
ALTER TABLE bugs ADD COLUMN time_spent INTEGER DEFAULT 0;
