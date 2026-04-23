-- Enable Supabase Realtime (Postgres logical replication → `supabase_realtime`
-- publication) for the two tables the admin Outreach page needs to track
-- end‑to‑end status of n8n CLG‑002 runs:
--
--   * contact_submissions : watches `last_n8n_outreach_status` flipping
--     pending → success / failed (set either by the outreach‑queue INSERT
--     trigger `trg_outreach_queue_n8n_success`, or by the
--     `/api/webhooks/n8n/outreach-generation-complete` webhook).
--   * outreach_queue      : watches INSERTs of the draft row n8n (or the
--     in-app path) creates at the end of a run.
--
-- REPLICA IDENTITY FULL ensures UPDATE / DELETE events carry the full old row,
-- which we need so the client can detect status transitions (old.status vs
-- new.status) and ignore no-op updates. Without FULL, only the primary key
-- is emitted for old rows.
--
-- This migration is idempotent: re-running is a no-op.

ALTER TABLE public.contact_submissions REPLICA IDENTITY FULL;
ALTER TABLE public.outreach_queue REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'contact_submissions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_submissions';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'outreach_queue'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.outreach_queue';
  END IF;
END $$;

COMMENT ON TABLE public.contact_submissions IS
  'Lead/contact records. Streamed via supabase_realtime for the admin outreach dashboard (last_n8n_outreach_status transitions).';

COMMENT ON TABLE public.outreach_queue IS
  'Per-message outreach rows (drafts + sent). Streamed via supabase_realtime so the admin dashboard sees newly-created drafts from n8n CLG-002 or the in-app OpenAI path.';
