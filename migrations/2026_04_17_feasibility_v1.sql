-- Feasibility assessment v1 — walking skeleton
-- Adds per-asset tech stack to content_offer_roles,
-- feasibility_assessment snapshots to gamma_reports + proposals,
-- and an admin-set client_verified_tech_stack on contact_submissions
-- for conflict resolution between BuiltWith and audit self-report.
--
-- See .cursor/plans/stack-aware_feasibility_assessment_8e7862c5.plan.md

-- Per-asset tech stack overlay (role-level, matches content_offer_roles granularity)
ALTER TABLE content_offer_roles
  ADD COLUMN IF NOT EXISTS tech_stack JSONB,
  ADD COLUMN IF NOT EXISTS integrations_required JSONB;

COMMENT ON COLUMN content_offer_roles.tech_stack IS
  'Per-asset tech stack declaration. Shape: { platform: string[], integrations: [{ system, direction, method }], client_infrastructure_required: string[], notes }. NULL inherits global defaults from lib/constants/our-tech-stack.ts.';

COMMENT ON COLUMN content_offer_roles.integrations_required IS
  'Deprecated passthrough (kept as nullable JSONB). Prefer embedding integrations inside tech_stack.integrations. Reserved for future per-asset integration overrides.';

-- Snapshot of computed feasibility assessment, attached to the Gamma report
-- that rendered it and to the proposal that surfaces it to the client.
-- JSONB shape defined by FeasibilityAssessment in lib/implementation-feasibility.ts.
ALTER TABLE gamma_reports
  ADD COLUMN IF NOT EXISTS feasibility_assessment JSONB;

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS feasibility_assessment JSONB;

COMMENT ON COLUMN gamma_reports.feasibility_assessment IS
  'Stack-aware feasibility snapshot produced at deck generation. Includes generated_at, inputs_hash, builtwith_credits_remaining, builtwith_credits_state, per-item fit, effort, tradeoffs. See lib/implementation-feasibility.ts.';

COMMENT ON COLUMN proposals.feasibility_assessment IS
  'Feasibility snapshot rendered to the client on the proposal view (via projectForClient). Regenerated when the admin resolves stack conflicts or regenerates the associated Gamma report.';

-- Admin-resolved client tech stack. Wins over both audit self-report and
-- BuiltWith when present. Written by the admin conflict resolver in
-- app/admin/sales/[auditId]/page.tsx.
ALTER TABLE contact_submissions
  ADD COLUMN IF NOT EXISTS client_verified_tech_stack JSONB;

COMMENT ON COLUMN contact_submissions.client_verified_tech_stack IS
  'Admin-resolved canonical client tech stack. Precedence: verified > enriched_tech_stack (audit) > website_tech_stack (BuiltWith). Shape: { technologies: [{ name, tag?, categories?, parent? }], resolved_at, resolved_by }.';
