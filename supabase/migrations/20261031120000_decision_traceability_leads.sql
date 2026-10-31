-- Isolated consented capture for the Dark Castle Decision Traceability Scorecard.
-- Apply to staging for validation. Production application remains a separate gate.
create table if not exists public.decision_traceability_leads (
  id uuid primary key default gen_random_uuid(),
  campaign text not null default 'dark_castle_decision_traceability_v1' check (campaign = 'dark_castle_decision_traceability_v1'),
  email text not null check (length(email) <= 254 and email = lower(email)),
  score smallint not null check (score between 0 and 8),
  weakest_dimension text not null check (weakest_dimension in ('reason', 'owner', 'threshold', 'evidence')),
  consent_version text not null check (consent_version = '2026-10-31.v1'),
  consented_at timestamptz not null default now(),
  source_path text not null default '/decision-traceability-scorecard' check (source_path = '/decision-traceability-scorecard'),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  submission_key uuid not null unique,
  created_at timestamptz not null default now(),
  unique (campaign, email)
);

create index if not exists decision_traceability_leads_created_at_idx on public.decision_traceability_leads (created_at desc);
alter table public.decision_traceability_leads enable row level security;
revoke all on public.decision_traceability_leads from public, anon, authenticated;
grant select, insert on public.decision_traceability_leads to service_role;

comment on table public.decision_traceability_leads is 'Explicit email consent for the Dark Castle scorecard. No answer text, IP, or provider-send authority is stored.';
