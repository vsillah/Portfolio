-- Model Usage And Token Efficiency Control Plane
-- Adds an auditable, read-first ledger for model usage attribution while
-- keeping existing cost_events as the Portfolio P&L rollup source.

CREATE TABLE IF NOT EXISTS public.model_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider TEXT NOT NULL
    CHECK (provider IN ('openai', 'anthropic', 'google', 'codex', 'claude_code', 'open_source', 'local', 'other')),
  runtime TEXT NOT NULL DEFAULT 'api'
    CHECK (runtime IN ('codex', 'n8n', 'hermes', 'opencode', 'manual', 'api', 'local', 'other')),
  model TEXT NOT NULL,
  task_category TEXT NOT NULL DEFAULT 'other'
    CHECK (task_category IN ('research', 'coding', 'qa', 'planning', 'social', 'video', 'outreach', 'automation', 'rag', 'client_ops', 'other')),
  agent_key TEXT,
  client_project_id UUID REFERENCES public.client_projects(id) ON DELETE SET NULL,
  client_label TEXT NOT NULL DEFAULT 'Portfolio',
  action_label TEXT NOT NULL DEFAULT 'Model usage transaction',
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cached_tokens INTEGER NOT NULL DEFAULT 0 CHECK (cached_tokens >= 0),
  reasoning_tokens INTEGER NOT NULL DEFAULT 0 CHECK (reasoning_tokens >= 0),
  total_tokens INTEGER NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  accepted_output_count INTEGER NOT NULL DEFAULT 0 CHECK (accepted_output_count >= 0),
  resolved_work_item_count INTEGER NOT NULL DEFAULT 0 CHECK (resolved_work_item_count >= 0),
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
  cost_basis TEXT NOT NULL DEFAULT 'inferred'
    CHECK (cost_basis IN ('metered', 'catalog_priced', 'subscription_prorated', 'local_estimated', 'inferred')),
  confidence TEXT NOT NULL DEFAULT 'medium'
    CHECK (confidence IN ('high', 'medium', 'low')),
  source_type TEXT NOT NULL DEFAULT 'model_usage_event',
  source_id TEXT,
  source_href TEXT,
  pricing_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  scrubbed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS model_usage_events_occurred_at_idx
  ON public.model_usage_events(occurred_at DESC);

CREATE INDEX IF NOT EXISTS model_usage_events_client_project_idx
  ON public.model_usage_events(client_project_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS model_usage_events_provider_model_idx
  ON public.model_usage_events(provider, model, occurred_at DESC);

CREATE INDEX IF NOT EXISTS model_usage_events_runtime_agent_idx
  ON public.model_usage_events(runtime, agent_key, occurred_at DESC);

CREATE INDEX IF NOT EXISTS model_usage_events_task_category_idx
  ON public.model_usage_events(task_category, occurred_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS model_usage_events_source_unique_idx
  ON public.model_usage_events(source_type, source_id)
  WHERE source_id IS NOT NULL;

ALTER TABLE public.model_usage_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.model_usage_subscription_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL
    CHECK (provider IN ('openai', 'anthropic', 'google', 'codex', 'claude_code', 'open_source', 'local', 'other')),
  runtime TEXT NOT NULL DEFAULT 'any'
    CHECK (runtime IN ('any', 'codex', 'n8n', 'hermes', 'opencode', 'manual', 'api', 'local', 'other')),
  account_label TEXT NOT NULL,
  monthly_cost_usd NUMERIC(12, 2) NOT NULL CHECK (monthly_cost_usd >= 0),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  allocation_basis TEXT NOT NULL DEFAULT 'token_share'
    CHECK (allocation_basis IN ('token_share', 'event_share', 'manual_weight')),
  confidence TEXT NOT NULL DEFAULT 'medium'
    CHECK (confidence IN ('high', 'medium', 'low')),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_end > period_start)
);

CREATE INDEX IF NOT EXISTS model_usage_subscription_period_idx
  ON public.model_usage_subscription_allocations(provider, runtime, period_start, period_end)
  WHERE active = true;

ALTER TABLE public.model_usage_subscription_allocations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.model_usage_events IS
  'Auditable model usage ledger for token, cost, confidence, task, agent, and client/project attribution. Provider writes and credential actions remain approval-gated outside this table.';

COMMENT ON COLUMN public.model_usage_events.cost_basis IS
  'How the event cost was derived: exact meter, pricing catalog, subscription allocation, local estimate, or inference.';

COMMENT ON COLUMN public.model_usage_events.pricing_snapshot IS
  'Historical pricing or allocation evidence used for auditability at the time the event was recorded.';

COMMENT ON TABLE public.model_usage_subscription_allocations IS
  'Read-only/admin-configured monthly subscription allocation rules for flat-rate or hard-to-meter model tools.';
