ALTER TABLE diagnostic_audits
  ADD COLUMN IF NOT EXISTS agent_readiness JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS agent_readiness_assessment JSONB;

COMMENT ON COLUMN diagnostic_audits.agent_readiness IS
  'Raw Systems & Agent Readiness audit answers: system inventory, ownership, statefulness, auditability, permissions, API access, reversibility, and risk.';

COMMENT ON COLUMN diagnostic_audits.agent_readiness_assessment IS
  'Derived client agent/data readiness interpretation used by reports, proposals, and AI Ops roadmap recommendations.';
