-- Gamma Reports: stores generated Gamma presentations with full context
CREATE TABLE IF NOT EXISTS gamma_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL CHECK (report_type IN (
    'value_quantification',
    'implementation_strategy',
    'audit_summary',
    'prospect_overview'
  )),
  title TEXT,
  contact_submission_id INTEGER REFERENCES contact_submissions(id),
  diagnostic_audit_id BIGINT REFERENCES diagnostic_audits(id),
  value_report_id UUID REFERENCES value_reports(id),
  proposal_id UUID REFERENCES proposals(id),
  gamma_generation_id TEXT,
  gamma_url TEXT,
  pdf_url TEXT,
  pptx_url TEXT,
  input_text TEXT,
  external_inputs JSONB DEFAULT '{}',
  gamma_options JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'generating', 'completed', 'failed'
  )),
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_gamma_reports_contact ON gamma_reports(contact_submission_id);
CREATE INDEX idx_gamma_reports_status ON gamma_reports(status);
CREATE INDEX idx_gamma_reports_type ON gamma_reports(report_type);
