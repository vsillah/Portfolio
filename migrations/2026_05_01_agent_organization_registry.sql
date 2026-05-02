-- ============================================================================
-- Agent organization registry
-- Date: 2026-05-01
-- Purpose: Map the target agent operating model to the shared agent_registry.
--          Workflow-level details live in lib/agent-organization.ts and the
--          Agent Operations admin console.
-- ============================================================================

INSERT INTO agent_registry (key, name, runtime, pod, description, risk_level, default_requires_approval, active)
VALUES
  ('chief-of-staff', 'Chief of Staff Agent', 'n8n', 'Chief of Staff', 'Cross-pod morning review, stale-run cleanup, escalation routing, and executive status.', 'medium', false, true),
  ('strategic-narrative', 'Strategic Narrative Agent', 'codex', 'Strategy & Narrative', 'Turns executive intent, market context, and operating proof into narrative strategy.', 'medium', true, false),
  ('proposal-business-model', 'Proposal & Business Model Agent', 'codex', 'Strategy & Narrative', 'Assembles offers, pricing logic, proposal framing, and value models.', 'medium', true, false),
  ('legacy-institution-builder', 'Legacy & Institution Builder', 'codex', 'Strategy & Narrative', 'Translates long-horizon institution-building ideas into durable artifacts and operating models.', 'medium', true, false),
  ('research-source-register', 'Research & Source Register Agent', 'n8n', 'Research & Knowledge', 'Collects, classifies, and retrieves source-backed evidence for decisions, content, and client work.', 'medium', true, true),
  ('private-knowledge-librarian', 'Private Knowledge Librarian', 'n8n', 'Research & Knowledge', 'Maintains RAG and private-knowledge retrieval paths without exposing raw private material.', 'medium', true, true),
  ('decision-journal', 'Decision Journal Agent', 'codex', 'Research & Knowledge', 'Captures durable decisions, rationale, source links, approvals, PRs, and rollback notes.', 'low', false, false),
  ('voice-content-architect', 'Voice & Content Architect', 'n8n', 'Content Production', 'Turns source-backed ideas into Vambah-aligned content structures and reusable assets.', 'medium', true, true),
  ('content-repurposing', 'Content Repurposing Agent', 'n8n', 'Content Production', 'Regenerates and adapts content assets across audio, image, and social variants.', 'medium', true, true),
  ('amadutown-brand', 'AmaduTown Brand Agent', 'codex', 'Content Production', 'Protects brand assets, visual consistency, and source-faithful public narrative.', 'medium', true, false),
  ('course-curriculum-builder', 'Course & Curriculum Builder', 'codex', 'Content Production', 'Builds course structures, lesson assets, facilitator guides, and deck-ready material.', 'medium', true, false),
  ('engineering-copilot', 'Engineering Copilot Agent', 'codex', 'Product & Automation', 'Implements, validates, ships, and monitors Portfolio changes through the integration-captain workflow.', 'high', true, true),
  ('automation-systems', 'Automation Systems Agent', 'n8n', 'Product & Automation', 'Operates the client, project, monitor, provisioning, and workflow automation backbone.', 'medium', false, true),
  ('agent-tooling-parity', 'Agent Tooling Parity Agent', 'codex', 'Product & Automation', 'Keeps Codex, Hermes, OpenCode, n8n, and future runtimes aligned on tools and safety gates.', 'medium', true, false),
  ('website-product-copy', 'Website & Product Copy Agent', 'n8n', 'Publishing & Follow-Up', 'Moves approved copy and social content toward publishing surfaces.', 'medium', true, true),
  ('inbox-follow-up', 'Inbox & Follow-Up Agent', 'n8n', 'Publishing & Follow-Up', 'Handles outreach sends, replies, Gmail drafts, nurture, meeting intake, and Slack follow-up.', 'medium', true, true)
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  runtime = EXCLUDED.runtime,
  pod = EXCLUDED.pod,
  description = EXCLUDED.description,
  risk_level = EXCLUDED.risk_level,
  default_requires_approval = EXCLUDED.default_requires_approval,
  active = EXCLUDED.active,
  updated_at = now();
