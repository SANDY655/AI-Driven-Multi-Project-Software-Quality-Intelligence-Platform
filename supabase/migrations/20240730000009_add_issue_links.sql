-- ==========================================
-- Add Issue Links / Dependencies
-- ==========================================
CREATE TABLE IF NOT EXISTS public.issue_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    source_id UUID NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('bug', 'task')),
    target_id UUID NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('bug', 'task')),
    relationship TEXT NOT NULL CHECK (relationship IN ('blocks', 'is_blocked_by', 'relates_to', 'duplicates')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_id, target_id, relationship)
);

ALTER TABLE public.issue_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view issue links" ON public.issue_links FOR SELECT USING (true);
CREATE POLICY "Users can insert issue links" ON public.issue_links FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete issue links" ON public.issue_links FOR DELETE USING (true);
