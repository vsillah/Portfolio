-- Server-only, cross-instance abuse counters. HMAC keys contain no raw IP.
create table activation_private.abuse_buckets (
  bucket_key text primary key check (bucket_key ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null,
  hits integer not null check (hits > 0)
);
alter table activation_private.abuse_buckets enable row level security;
revoke all on activation_private.abuse_buckets from public, anon, authenticated;
grant select, insert, update, delete on activation_private.abuse_buckets to service_role;

-- Browser-visible codes are short lived and single-use. No Portfolio bearer is stored.
create table activation_private.handoff_codes (
  id uuid primary key default gen_random_uuid(),
  app_key text not null references public.activation_apps(app_key),
  auth_user_id uuid not null references auth.users(id),
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at > issued_at),
  consumed_at timestamptz
);
create index activation_handoff_expiry_idx on activation_private.handoff_codes(expires_at);
alter table activation_private.handoff_codes enable row level security;
revoke all on activation_private.handoff_codes from public, anon, authenticated;
grant select, insert, update, delete on activation_private.handoff_codes to service_role;

-- Opaque app session handles avoid exposing stable Portfolio Auth IDs to apps.
create table activation_private.app_session_handles (
  handle_hash text primary key check (handle_hash ~ '^[a-f0-9]{64}$'),
  app_key text not null references public.activation_apps(app_key),
  auth_user_id uuid not null references auth.users(id),
  expires_at timestamptz not null
);
create index activation_app_session_expiry_idx on activation_private.app_session_handles(expires_at);
alter table activation_private.app_session_handles enable row level security;
revoke all on activation_private.app_session_handles from public, anon, authenticated;
grant select, insert, update, delete on activation_private.app_session_handles to service_role;
