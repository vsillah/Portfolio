-- Captured public-form evidence only. No enrollment, suppression or sender writes.
-- inquiry_id is a provenance link to an email-deduplicated inquiry, NOT verified identity.
create table public.contact_sms_consent_evidence (
  evidence_key text primary key check (evidence_key ~ '^[a-f0-9]{64}$'),
  inquiry_id bigint not null references public.contact_submissions(id),
  submitted_phone text not null check (length(submitted_phone) between 1 and 40),
  normalized_phone text not null check (normalized_phone ~ '^\+[1-9][0-9]{7,14}$'),
  affirmative_selection boolean not null check (affirmative_selection = true),
  program text not null,
  scope text not null,
  disclosure_version text not null,
  disclosure_text text not null,
  privacy_path text not null check (privacy_path = '/legal/privacy'),
  terms_path text not null check (terms_path = '/legal/terms#sms'),
  source_route text not null check (source_route = '/#contact'),
  captured_at timestamptz not null default now(),
  capture_state text not null default 'pending_verification' check (capture_state = 'pending_verification'),
  send_eligible boolean not null default false check (send_eligible = false)
);
alter table public.contact_sms_consent_evidence enable row level security;
-- Revoke default privileges too: RLS alone must not be the public privacy boundary.
revoke all on public.contact_sms_consent_evidence from public, anon, authenticated, service_role;
grant select, insert on public.contact_sms_consent_evidence to service_role;
-- No public policies, no RPC, no update/delete grant. ON CONFLICT DO NOTHING retains
-- the original disclosure and database timestamp on concurrent/repeated submissions.
comment on table public.contact_sms_consent_evidence is
  'Unverified SMS consent evidence. Never use as enrollment, phone ownership, re-opt-in, or send authority. Existing suppression always remains authoritative.';
