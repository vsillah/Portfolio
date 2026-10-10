-- Durable, privacy-safe evidence projection for Social Content source coverage.
-- This is not a product catalog: product identity and lifecycle are derived from
-- canonical Agent Ops, prototype, catalog, and approved-summary records.

CREATE TABLE IF NOT EXISTS public.social_topic_source_receipts (
  receipt_id TEXT PRIMARY KEY,
  source_group TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  product_identity TEXT NOT NULL,
  lifecycle_stage TEXT NOT NULL
    CHECK (lifecycle_stage IN (
      'insight',
      'in_development',
      'preview_deployed',
      'production_deployed',
      'publicly_cataloged'
    )),
  label TEXT NOT NULL,
  approved_summary TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (approval_status = 'approved'),
  privacy_classification TEXT NOT NULL
    CHECK (privacy_classification IN ('public_safe', 'client_safe_summary')),
  provenance TEXT NOT NULL,
  evidence_url TEXT,
  summary_sha256 TEXT NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL,
  approved_by TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  raw_content_included BOOLEAN NOT NULL DEFAULT false
    CHECK (raw_content_included = false),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_topic_source_receipts_product_idx
  ON public.social_topic_source_receipts(product_identity, lifecycle_stage, observed_at DESC);

CREATE INDEX IF NOT EXISTS social_topic_source_receipts_group_idx
  ON public.social_topic_source_receipts(source_group, observed_at DESC);

CREATE TABLE IF NOT EXISTS public.social_topic_source_scans (
  source_group TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('ready', 'blocked')),
  scanned_at TIMESTAMPTZ NOT NULL,
  last_successful_scan_at TIMESTAMPTZ,
  receipt_count INTEGER NOT NULL DEFAULT 0 CHECK (receipt_count >= 0),
  product_count INTEGER NOT NULL DEFAULT 0 CHECK (product_count >= 0),
  collector_failure TEXT,
  recovery_action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_topic_source_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_topic_source_scans ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.social_topic_source_receipts IS
  'Privacy-safe approved evidence receipts used to derive Social Content product lifecycle coverage; never stores raw conversations, transcripts, or secrets.';

COMMENT ON TABLE public.social_topic_source_scans IS
  'Latest collector health and recovery guidance for the read-only Social Content source coverage surface.';

GRANT SELECT, INSERT, UPDATE ON public.social_topic_source_receipts TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.social_topic_source_scans TO service_role;
