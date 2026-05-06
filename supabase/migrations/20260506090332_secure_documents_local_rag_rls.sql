-- Security Advisor 0013: public.documents_local_rag is in an exposed schema.
-- This local RAG table is server/workflow managed, so enabling RLS without
-- anon/authenticated policies denies Data API access while preserving
-- service_role maintenance paths.

DO $$
BEGIN
  IF to_regclass('public.documents_local_rag') IS NOT NULL THEN
    ALTER TABLE public.documents_local_rag ENABLE ROW LEVEL SECURITY;

    COMMENT ON TABLE public.documents_local_rag IS
      'Local RAG document chunks. RLS is enabled to deny anon/authenticated Data API access; server-side service_role workflows manage retrieval and maintenance.';
  END IF;
END $$;
