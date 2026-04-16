-- Add 'offer_presentation' to gamma_reports report_type CHECK constraint
ALTER TABLE gamma_reports
  DROP CONSTRAINT gamma_reports_report_type_check;

ALTER TABLE gamma_reports
  ADD CONSTRAINT gamma_reports_report_type_check
  CHECK (report_type = ANY (ARRAY[
    'value_quantification',
    'implementation_strategy',
    'audit_summary',
    'prospect_overview',
    'offer_presentation'
  ]));
