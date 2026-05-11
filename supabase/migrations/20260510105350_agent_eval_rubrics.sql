-- Hyperagent-inspired agent evaluation foundation.
-- These tables keep rubrics and run-level scores trace-backed without mutating
-- prompts, skills, workflows, or runtime behavior.

CREATE TABLE IF NOT EXISTS public.agent_eval_rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  agent_key TEXT NOT NULL,
  workflow_key TEXT,
  name TEXT NOT NULL,
  description TEXT,
  dimensions JSONB NOT NULL DEFAULT '[]'::jsonb,
  threshold NUMERIC(5, 2) NOT NULL DEFAULT 80,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_eval_rubrics_key_not_blank CHECK (length(trim(key)) > 0),
  CONSTRAINT agent_eval_rubrics_agent_key_not_blank CHECK (length(trim(agent_key)) > 0),
  CONSTRAINT agent_eval_rubrics_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT agent_eval_rubrics_dimensions_array CHECK (jsonb_typeof(dimensions) = 'array'),
  CONSTRAINT agent_eval_rubrics_has_dimensions CHECK (jsonb_array_length(dimensions) > 0),
  CONSTRAINT agent_eval_rubrics_threshold_range CHECK (threshold >= 0 AND threshold <= 100)
);

CREATE TABLE IF NOT EXISTS public.agent_run_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  rubric_id UUID NOT NULL REFERENCES public.agent_eval_rubrics(id) ON DELETE RESTRICT,
  rubric_key TEXT NOT NULL,
  agent_key TEXT NOT NULL,
  workflow_key TEXT,
  score NUMERIC(5, 2) NOT NULL,
  passed BOOLEAN NOT NULL,
  dimension_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  judge_model TEXT NOT NULL DEFAULT 'deterministic-agent-eval-v1',
  summary TEXT,
  failure_reasons TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_run_evaluations_rubric_key_not_blank CHECK (length(trim(rubric_key)) > 0),
  CONSTRAINT agent_run_evaluations_agent_key_not_blank CHECK (length(trim(agent_key)) > 0),
  CONSTRAINT agent_run_evaluations_score_range CHECK (score >= 0 AND score <= 100),
  CONSTRAINT agent_run_evaluations_dimension_scores_object CHECK (jsonb_typeof(dimension_scores) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_run_evaluations_run_rubric_uidx
  ON public.agent_run_evaluations(run_id, rubric_key);

CREATE INDEX IF NOT EXISTS agent_eval_rubrics_active_agent_idx
  ON public.agent_eval_rubrics(active, agent_key);

CREATE INDEX IF NOT EXISTS agent_run_evaluations_agent_created_idx
  ON public.agent_run_evaluations(agent_key, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_run_evaluations_rubric_created_idx
  ON public.agent_run_evaluations(rubric_key, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_run_evaluations_run_idx
  ON public.agent_run_evaluations(run_id);

ALTER TABLE public.agent_eval_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_run_evaluations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.agent_eval_rubrics IS 'Rubric definitions for evaluating agent and workflow output quality.';
COMMENT ON TABLE public.agent_run_evaluations IS 'Trace-linked agent run evaluations and coaching signals.';
COMMENT ON COLUMN public.agent_eval_rubrics.dimensions IS 'Array of rubric dimension objects with key, label, and optional weight.';
COMMENT ON COLUMN public.agent_run_evaluations.judge_model IS 'Judge implementation or model used for the score. V1 uses deterministic trace scoring unless an LLM judge is explicitly enabled.';

INSERT INTO public.agent_eval_rubrics (
  key,
  agent_key,
  workflow_key,
  name,
  description,
  dimensions,
  threshold,
  active,
  metadata
)
VALUES
  (
    'chief-of-staff-synthesis-quality',
    'chief-of-staff',
    'agent_war_room_standup',
    'Chief of Staff Synthesis Quality',
    'Checks whether Chief of Staff summaries are coherent, actionable, grounded in current traces, and explicit about approval gates.',
    '[
      {"key":"grounding","label":"Grounded in current traces","weight":0.25},
      {"key":"synthesis","label":"Clear executive synthesis","weight":0.25},
      {"key":"next_actions","label":"Specific next actions","weight":0.25},
      {"key":"approval_gates","label":"Approval gates are explicit","weight":0.25}
    ]'::jsonb,
    82,
    true,
    '{"source":"hyperagent_parity_v1","mutation_policy":"approval_gated"}'::jsonb
  ),
  (
    'warm-lead-capture-trace-completeness',
    'warm-lead-capture',
    'warm_lead_capture',
    'Warm Lead Capture Trace Completeness',
    'Checks whether warm-lead automation traces capture canonical source, test-data boundaries, cost linkage, and downstream handoff status.',
    '[
      {"key":"trace_completeness","label":"Run trace is complete","weight":0.3},
      {"key":"source_canonicalization","label":"Lead source is canonical","weight":0.25},
      {"key":"data_boundary","label":"Production and non-production data boundaries are clear","weight":0.25},
      {"key":"handoff_status","label":"Downstream handoff is visible","weight":0.2}
    ]'::jsonb,
    85,
    true,
    '{"source":"hyperagent_parity_v1","non_prod_data_rule":true}'::jsonb
  ),
  (
    'meeting-intake-follow-up-safety-isolation',
    'meeting-intake-follow-up',
    'meeting_intake_follow_up',
    'Meeting Intake and Follow-Up Safety Isolation',
    'Checks whether meeting intake work preserves channel boundaries, separates test from production records, and keeps outbound actions approval-gated.',
    '[
      {"key":"channel_isolation","label":"Channel and source isolation","weight":0.25},
      {"key":"test_data_boundary","label":"Synthetic/test records are isolated","weight":0.25},
      {"key":"approval_readiness","label":"Outbound actions require approval","weight":0.25},
      {"key":"traceability","label":"Trace links intake to follow-up","weight":0.25}
    ]'::jsonb,
    85,
    true,
    '{"source":"hyperagent_parity_v1","approval_required_for_outbound":true}'::jsonb
  ),
  (
    'inbox-follow-up-approval-readiness',
    'inbox-follow-up',
    'outreach_follow_up',
    'Inbox and Follow-Up Approval Readiness',
    'Checks whether follow-up drafts are attributable, client-safe, approval-ready, and clear about send-state.',
    '[
      {"key":"attribution","label":"Context and source attribution","weight":0.25},
      {"key":"client_safety","label":"Client-safe content handling","weight":0.25},
      {"key":"approval_package","label":"Approval package is complete","weight":0.25},
      {"key":"send_state","label":"Send state is unambiguous","weight":0.25}
    ]'::jsonb,
    84,
    true,
    '{"source":"hyperagent_parity_v1","send_requires_approval":true}'::jsonb
  ),
  (
    'research-source-register-source-quality',
    'research-source-register',
    'research_source_register',
    'Research and Source Register Source Quality',
    'Checks whether research outputs separate public and private material, preserve provenance, and identify weak or missing evidence.',
    '[
      {"key":"provenance","label":"Source provenance is preserved","weight":0.3},
      {"key":"privacy_boundary","label":"Private material is summarized safely","weight":0.25},
      {"key":"evidence_quality","label":"Evidence quality is assessed","weight":0.25},
      {"key":"source_gaps","label":"Gaps and assumptions are visible","weight":0.2}
    ]'::jsonb,
    86,
    true,
    '{"source":"hyperagent_parity_v1","source_protocol":true}'::jsonb
  )
ON CONFLICT (key) DO UPDATE
SET
  agent_key = EXCLUDED.agent_key,
  workflow_key = EXCLUDED.workflow_key,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  dimensions = EXCLUDED.dimensions,
  threshold = EXCLUDED.threshold,
  active = EXCLUDED.active,
  metadata = EXCLUDED.metadata,
  updated_at = now();
