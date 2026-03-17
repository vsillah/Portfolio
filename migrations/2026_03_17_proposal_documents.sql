-- ============================================================================
-- Migration: proposal_documents
-- Date: 2026-03-17
-- Purpose: Attach reports/documents (e.g. strategy, opportunity quantification)
--          to proposals for pre-sign viewing and client portal.
-- Apply order: After proposals and gamma_reports exist.
-- ============================================================================

-- document_type: strategy_report | opportunity_quantification | proposal_package | other
-- Storage path convention: documents bucket, proposal-docs/{proposal_id}/{uuid}.pdf
CREATE TABLE IF NOT EXISTS proposal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'strategy_report',
    'opportunity_quantification',
    'proposal_package',
    'other'
  )),
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  source TEXT CHECK (source IN ('uploaded', 'generated')),
  gamma_report_id UUID REFERENCES gamma_reports(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_documents_proposal
  ON proposal_documents(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_documents_display_order
  ON proposal_documents(proposal_id, display_order);

COMMENT ON TABLE proposal_documents IS 'Documents (e.g. strategy/opportunity PDFs) attached to a proposal; shown on proposal page and in client portal.';
COMMENT ON COLUMN proposal_documents.file_path IS 'Path in documents bucket; convention: proposal-docs/{proposal_id}/{uuid}.pdf';
COMMENT ON COLUMN proposal_documents.source IS 'uploaded = admin upload; generated = from Gamma or other generator';
COMMENT ON COLUMN proposal_documents.gamma_report_id IS 'Set when source = generated and document is linked to a gamma_reports row';

-- RLS: admin only for all operations. Public read is via API (by-code, dashboard) using service role.
ALTER TABLE proposal_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage proposal_documents" ON proposal_documents;
CREATE POLICY "Admins can manage proposal_documents"
  ON proposal_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- No public SELECT policy: by-code and client dashboard APIs use supabaseAdmin to fetch rows.
