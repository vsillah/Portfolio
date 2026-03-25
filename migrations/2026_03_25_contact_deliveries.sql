-- Contact deliveries: logs each delivery email sent from the contact detail page.
-- Also adds contact_submission_id to video_generation_jobs for direct prospect linking.

-- 1. contact_deliveries table
CREATE TABLE IF NOT EXISTS contact_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_submission_id BIGINT NOT NULL REFERENCES contact_submissions(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  asset_ids JSONB DEFAULT '[]',
  dashboard_token TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  sent_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_contact_deliveries_contact
  ON contact_deliveries(contact_submission_id);

CREATE INDEX IF NOT EXISTS idx_contact_deliveries_sent_at
  ON contact_deliveries(sent_at DESC);

-- 2. Add contact_submission_id to video_generation_jobs for direct prospect linking
ALTER TABLE video_generation_jobs
  ADD COLUMN IF NOT EXISTS contact_submission_id BIGINT REFERENCES contact_submissions(id);

CREATE INDEX IF NOT EXISTS idx_video_jobs_contact_submission
  ON video_generation_jobs(contact_submission_id);

-- 3. Backfill existing video jobs from gamma_report_id -> gamma_reports.contact_submission_id
UPDATE video_generation_jobs vj
SET contact_submission_id = gr.contact_submission_id
FROM gamma_reports gr
WHERE vj.gamma_report_id = gr.id
  AND gr.contact_submission_id IS NOT NULL
  AND vj.contact_submission_id IS NULL;
