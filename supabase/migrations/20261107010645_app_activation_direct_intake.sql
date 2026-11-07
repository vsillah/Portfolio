-- Server-only direct intake replay key. The hash contains no email or bearer token.
alter table public.activation_interests add column intake_key_hash text
  check (intake_key_hash is null or intake_key_hash ~ '^[a-f0-9]{64}$');
create unique index activation_interests_intake_replay_idx
  on public.activation_interests(app_key, intake_key_hash) where intake_key_hash is not null;

-- An issued invitation is unique for an interest until explicitly revoked.
create unique index activation_invitations_one_issued_idx
  on public.activation_invitations(interest_id) where status = 'issued';
