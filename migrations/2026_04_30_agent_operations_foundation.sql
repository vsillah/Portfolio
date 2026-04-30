-- ============================================================================
-- Agent Operations foundation
-- Date: 2026-04-30
-- Purpose: Shared run tracing, audit events, artifacts, handoffs, approvals,
--          and cost linkage across Codex, n8n, Hermes, OpenCode, and manual work.
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  runtime TEXT NOT NULL CHECK (runtime IN ('codex', 'n8n', 'hermes', 'opencode', 'manual')),
  pod TEXT,
  description TEXT,
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  allowed_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_requires_approval BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_registry_id UUID REFERENCES agent_registry(id) ON DELETE SET NULL,
  agent_key TEXT,
  runtime TEXT NOT NULL CHECK (runtime IN ('codex', 'n8n', 'hermes', 'opencode', 'manual')),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'waiting_for_approval', 'completed', 'failed', 'cancelled', 'stale')),
  subject_type TEXT,
  subject_id TEXT,
  subject_label TEXT,
  current_step TEXT,
  trigger_source TEXT,
  triggered_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  stale_after TIMESTAMPTZ,
  outcome JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_run_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_key TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('queued', 'running', 'waiting_for_approval', 'completed', 'failed', 'cancelled', 'stale')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  tokens_in INTEGER CHECK (tokens_in IS NULL OR tokens_in >= 0),
  tokens_out INTEGER CHECK (tokens_out IS NULL OR tokens_out >= 0),
  cost_usd DECIMAL(12,4) CHECK (cost_usd IS NULL OR cost_usd >= 0),
  input_summary TEXT,
  output_summary TEXT,
  reasoning TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_run_steps_idempotency
  ON agent_run_steps (run_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS agent_run_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error')),
  message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_run_events_idempotency
  ON agent_run_events (run_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS agent_run_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL,
  title TEXT,
  ref_type TEXT,
  ref_id TEXT,
  url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_run_artifacts_idempotency
  ON agent_run_artifacts (run_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS agent_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  from_agent_key TEXT,
  to_agent_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'failed', 'cancelled')),
  summary TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  approval_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by_agent_key TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  decision_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE cost_events
  ADD COLUMN IF NOT EXISTS agent_run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agent_runs_status_started
  ON agent_runs (status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_runs_runtime_started
  ON agent_runs (runtime, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_runs_subject
  ON agent_runs (subject_type, subject_id);

CREATE INDEX IF NOT EXISTS idx_agent_run_steps_run_started
  ON agent_run_steps (run_id, started_at);

CREATE INDEX IF NOT EXISTS idx_agent_run_events_run_occurred
  ON agent_run_events (run_id, occurred_at);

CREATE INDEX IF NOT EXISTS idx_agent_run_artifacts_run_created
  ON agent_run_artifacts (run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cost_events_agent_run_id
  ON cost_events (agent_run_id)
  WHERE agent_run_id IS NOT NULL;

ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_run_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_run_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_run_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage agent_registry" ON agent_registry;
CREATE POLICY "Admins can manage agent_registry"
  ON agent_registry FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage agent_runs" ON agent_runs;
CREATE POLICY "Admins can manage agent_runs"
  ON agent_runs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage agent_run_steps" ON agent_run_steps;
CREATE POLICY "Admins can manage agent_run_steps"
  ON agent_run_steps FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage agent_run_events" ON agent_run_events;
CREATE POLICY "Admins can manage agent_run_events"
  ON agent_run_events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage agent_run_artifacts" ON agent_run_artifacts;
CREATE POLICY "Admins can manage agent_run_artifacts"
  ON agent_run_artifacts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage agent_handoffs" ON agent_handoffs;
CREATE POLICY "Admins can manage agent_handoffs"
  ON agent_handoffs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage agent_approvals" ON agent_approvals;
CREATE POLICY "Admins can manage agent_approvals"
  ON agent_approvals FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

INSERT INTO agent_registry (key, name, runtime, pod, description, risk_level, default_requires_approval)
VALUES
  ('codex-engineering', 'Codex Engineering Operator', 'codex', 'Product & Automation', 'Primary repo-aware engineering and implementation operator.', 'high', true),
  ('n8n-automation', 'n8n Automation Runtime', 'n8n', 'Product & Automation', 'Production workflow automation runtime for webhooks, schedules, and integrations.', 'medium', false),
  ('hermes-secondary', 'Hermes Secondary Runtime', 'hermes', 'Product & Automation', 'Secondary local runtime for gateway, critique, research, and parity experiments.', 'medium', true),
  ('opencode-evaluation', 'OpenCode Evaluation Runtime', 'opencode', 'Product & Automation', 'Deferred coding worker runtime for isolated review and implementation experiments.', 'high', true),
  ('manual-admin', 'Manual Admin Action', 'manual', 'Operations', 'Human-triggered administrative or approval action.', 'low', false)
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  runtime = EXCLUDED.runtime,
  pod = EXCLUDED.pod,
  description = EXCLUDED.description,
  risk_level = EXCLUDED.risk_level,
  default_requires_approval = EXCLUDED.default_requires_approval,
  updated_at = now();

COMMENT ON TABLE agent_runs IS 'Shared execution trace for agent and automation work across Codex, n8n, Hermes, OpenCode, and manual actions.';
COMMENT ON COLUMN agent_runs.runtime IS 'Execution runtime: codex, n8n, hermes, opencode, or manual.';
COMMENT ON COLUMN agent_runs.idempotency_key IS 'Optional stable key for retry-safe run creation.';
COMMENT ON COLUMN cost_events.agent_run_id IS 'Links usage cost to a shared agent run trace.';
