-- Agent Coordination Substrate
-- Adds a thin Agent Ops-native work layer for cross-runtime assignment,
-- handoffs, blockers, PR linkage, and gated merge/deploy progression.

CREATE TABLE IF NOT EXISTS public.agent_work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN (
      'proposed',
      'queued',
      'assigned',
      'in_progress',
      'blocked',
      'ready_for_review',
      'ready_for_merge',
      'merged',
      'deployed',
      'cancelled'
    )),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  owner_agent_key TEXT,
  owner_runtime TEXT NOT NULL DEFAULT 'manual'
    CHECK (owner_runtime IN ('codex', 'n8n', 'hermes', 'opencode', 'manual')),
  source_type TEXT,
  source_id TEXT,
  source_label TEXT,
  source_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  active_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  parent_work_item_id UUID REFERENCES public.agent_work_items(id) ON DELETE SET NULL,
  branch_name TEXT,
  worktree_path TEXT,
  pr_number INTEGER,
  pr_url TEXT,
  expected_files TEXT[] NOT NULL DEFAULT '{}',
  touched_files TEXT[] NOT NULL DEFAULT '{}',
  overlap_group TEXT,
  dependency_ids UUID[] NOT NULL DEFAULT '{}',
  blocker_summary TEXT,
  validation_summary TEXT,
  approval_id UUID REFERENCES public.agent_approvals(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS agent_work_items_status_idx
  ON public.agent_work_items(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS agent_work_items_owner_idx
  ON public.agent_work_items(owner_agent_key, owner_runtime, status);

CREATE INDEX IF NOT EXISTS agent_work_items_active_run_idx
  ON public.agent_work_items(active_run_id);

CREATE INDEX IF NOT EXISTS agent_work_items_source_run_idx
  ON public.agent_work_items(source_run_id);

ALTER TABLE public.agent_work_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.agent_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_handoffs ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.agent_handoffs
  ADD COLUMN IF NOT EXISTS work_item_id UUID REFERENCES public.agent_work_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS from_agent_key TEXT,
  ADD COLUMN IF NOT EXISTS to_agent_key TEXT,
  ADD COLUMN IF NOT EXISTS handoff_type TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS acceptance_criteria TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE INDEX IF NOT EXISTS agent_handoffs_work_item_idx
  ON public.agent_handoffs(work_item_id);

CREATE UNIQUE INDEX IF NOT EXISTS agent_handoffs_idempotency_key_idx
  ON public.agent_handoffs(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON TABLE public.agent_work_items IS
  'Durable Agent Ops-native work items for cross-runtime assignment, handoff, PR tracking, blockers, validation, and gated merge/deploy coordination.';

COMMENT ON COLUMN public.agent_work_items.status IS
  'Coordination status: proposed, queued, assigned, in_progress, blocked, ready_for_review, ready_for_merge, merged, deployed, or cancelled.';

COMMENT ON COLUMN public.agent_work_items.approval_id IS
  'Pending or decided approval checkpoint for gated merge/deploy progression.';

COMMENT ON COLUMN public.agent_handoffs.work_item_id IS
  'Optional Agent Coordination work item associated with this handoff.';
