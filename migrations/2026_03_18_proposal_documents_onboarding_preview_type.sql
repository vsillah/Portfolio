-- Add 'onboarding_preview' to proposal_documents.document_type CHECK constraint
-- so AI-generated onboarding preview PDFs can be attached to proposals.

ALTER TABLE proposal_documents
  DROP CONSTRAINT IF EXISTS proposal_documents_document_type_check;

ALTER TABLE proposal_documents
  ADD CONSTRAINT proposal_documents_document_type_check
    CHECK (document_type IN (
      'strategy_report',
      'opportunity_quantification',
      'proposal_package',
      'onboarding_preview',
      'other'
    ));
