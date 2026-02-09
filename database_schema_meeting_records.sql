-- ========================================
-- Meeting Records Schema
-- ========================================
-- Purpose: Store structured meeting records with AI-extracted insights
-- Used by: WF-MCH (Meeting Complete Handler) and related workflows
-- Dependencies: client_projects table
-- Created: 2026-02-08

-- Drop existing table if it exists
DROP TABLE IF EXISTS public.meeting_records CASCADE;

-- Create meeting_records table
CREATE TABLE public.meeting_records (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign keys
    client_project_id UUID REFERENCES public.client_projects(id) ON DELETE SET NULL,
    
    -- Meeting metadata
    meeting_type TEXT NOT NULL CHECK (meeting_type IN ('discovery', 'onboarding', 'kickoff', 'progress_checkin', 'go_no_go', 'delivery_review')),
    meeting_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_minutes INTEGER,
    calendly_event_uri TEXT,
    
    -- Meeting content
    transcript TEXT,
    raw_notes TEXT,
    recording_url TEXT,
    
    -- AI-extracted structured data (stored as JSONB for flexibility)
    structured_notes JSONB,
    key_decisions JSONB,
    action_items JSONB,
    open_questions JSONB,
    risks_identified JSONB,
    meeting_data JSONB,
    
    -- Attendees
    attendees JSONB,
    
    -- Next steps
    next_meeting_type TEXT CHECK (next_meeting_type IN ('onboarding', 'kickoff', 'progress_checkin', 'go_no_go', 'delivery_review', NULL)),
    next_meeting_agenda JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_meeting_records_client_project_id ON public.meeting_records(client_project_id);
CREATE INDEX idx_meeting_records_meeting_type ON public.meeting_records(meeting_type);
CREATE INDEX idx_meeting_records_meeting_date ON public.meeting_records(meeting_date DESC);
CREATE INDEX idx_meeting_records_next_meeting_type ON public.meeting_records(next_meeting_type) WHERE next_meeting_type IS NOT NULL;

-- Enable RLS
ALTER TABLE public.meeting_records ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Enable read access for authenticated users" ON public.meeting_records
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON public.meeting_records
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.meeting_records
    FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_meeting_records_updated_at
    BEFORE UPDATE ON public.meeting_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.meeting_records TO authenticated;
GRANT ALL ON public.meeting_records TO service_role;

-- Comments for documentation
COMMENT ON TABLE public.meeting_records IS 'Stores structured meeting records with AI-extracted insights across the client lifecycle';
COMMENT ON COLUMN public.meeting_records.meeting_type IS 'Type of meeting: discovery, onboarding, kickoff, progress_checkin, go_no_go, delivery_review';
COMMENT ON COLUMN public.meeting_records.structured_notes IS 'AI-extracted summary and highlights';
COMMENT ON COLUMN public.meeting_records.key_decisions IS 'Array of key decisions made during the meeting';
COMMENT ON COLUMN public.meeting_records.action_items IS 'Array of action items with owner, due_date, status';
COMMENT ON COLUMN public.meeting_records.meeting_data IS 'Type-specific structured data extracted by AI based on meeting type';
COMMENT ON COLUMN public.meeting_records.next_meeting_type IS 'Suggested next meeting type in the lifecycle';
