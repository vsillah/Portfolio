-- Allow marking a prior audit_summary deck as "superseded" when regenerating a Gamma report
-- for the same diagnostic audit. The partial unique index on (diagnostic_audit_id) where
-- report_type='audit_summary' and status in ('generating','completed') prevents a second
-- active row, so we need a terminal status outside that set to retire the old row and
-- then insert a new one.

ALTER TABLE gamma_reports
DROP CONSTRAINT IF EXISTS gamma_reports_status_check;

ALTER TABLE gamma_reports
ADD CONSTRAINT gamma_reports_status_check
CHECK (status = ANY (ARRAY[
  'pending'::text,
  'generating'::text,
  'completed'::text,
  'failed'::text,
  'superseded'::text
]));

COMMENT ON CONSTRAINT gamma_reports_status_check ON gamma_reports IS
  'Allowed statuses. "superseded" is set when a newer row replaces this one (e.g. audit rerun).';
