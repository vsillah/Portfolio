-- Link video generation jobs to Gamma reports for companion video flow.
-- Apply after 2026_03_13_video_generation_jobs_thumbnail.sql.

ALTER TABLE video_generation_jobs
  ADD COLUMN IF NOT EXISTS gamma_report_id UUID REFERENCES gamma_reports(id);

CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_gamma_report
  ON video_generation_jobs(gamma_report_id);
