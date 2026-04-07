-- Prevent duplicate active audit_summary rows per diagnostic audit.
-- Allows a new row after a prior row is marked 'failed'.
CREATE UNIQUE INDEX IF NOT EXISTS idx_gamma_reports_one_active_audit_summary
  ON gamma_reports (diagnostic_audit_id)
  WHERE report_type = 'audit_summary'
    AND status IN ('generating', 'completed');
