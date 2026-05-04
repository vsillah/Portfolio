-- Source-Respecting LLM Protocol Schema
-- Run this in Supabase SQL editor after user_profiles exists.

-- ============================================================================
-- Helper
-- ============================================================================
CREATE OR REPLACE FUNCTION update_source_respecting_llm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Creators and Works
-- ============================================================================
CREATE TABLE IF NOT EXISTS source_creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  legal_name TEXT,
  categories TEXT[] NOT NULL DEFAULT '{}',
  rights_holder_types TEXT[] NOT NULL DEFAULT '{}',
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected', 'needs_review')),
  protected_identity BOOLEAN NOT NULL DEFAULT FALSE,
  payout_account_reference TEXT,
  public_bio TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_creator_portal_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES source_creators(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended', 'revoked')),
  can_view_earnings BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_receipts BOOLEAN NOT NULL DEFAULT TRUE,
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(creator_id, user_id)
);

CREATE TABLE IF NOT EXISTS licensed_works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES source_creators(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  rights_holder_type TEXT NOT NULL
    CHECK (rights_holder_type IN (
      'author',
      'publisher',
      'estate',
      'translator',
      'illustrator',
      'museum',
      'archive',
      'community_steward'
    )),
  ban_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (ban_status IN ('banned', 'challenged', 'restricted', 'not_banned', 'unknown')),
  source_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'upload', 'public_url', 'drive', 'archive', 'museum_record')),
  source_reference TEXT,
  chain_of_title_verified BOOLEAN NOT NULL DEFAULT FALSE,
  community_consent_required BOOLEAN NOT NULL DEFAULT FALSE,
  community_consent_verified BOOLEAN NOT NULL DEFAULT FALSE,
  sensitivity_flags TEXT[] NOT NULL DEFAULT '{}',
  review_status TEXT NOT NULL DEFAULT 'staged'
    CHECK (review_status IN ('staged', 'approved', 'blocked', 'disputed', 'revoked')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS license_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES licensed_works(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('active', 'expired', 'revoked', 'disputed', 'pending_review')),
  allowed_uses TEXT[] NOT NULL DEFAULT '{}',
  blocked_topics TEXT[] NOT NULL DEFAULT '{}',
  quote_limit_characters INTEGER CHECK (quote_limit_characters IS NULL OR quote_limit_characters >= 0),
  expires_at TIMESTAMPTZ,
  grant_document_reference TEXT,
  granted_by TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES licensed_works(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES source_creators(id) ON DELETE CASCADE,
  active_license_grant_id UUID REFERENCES license_grants(id) ON DELETE SET NULL,
  chunk_text TEXT,
  text_hash TEXT NOT NULL,
  citation_label TEXT NOT NULL,
  source_location TEXT,
  embedding_reference TEXT,
  sensitive_topics TEXT[] NOT NULL DEFAULT '{}',
  is_retrievable BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(work_id, text_hash)
);

-- ============================================================================
-- Receipts and Monthly Settlements
-- ============================================================================
CREATE TABLE IF NOT EXISTS answer_receipts (
  id TEXT PRIMARY KEY,
  query_hash TEXT NOT NULL,
  model_id TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  output_token_count INTEGER NOT NULL CHECK (output_token_count >= 0),
  net_query_revenue_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  creator_pool_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  operations_pool_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  reserve_pool_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  retrieved_chunk_ids TEXT[] NOT NULL DEFAULT '{}',
  cited_chunk_ids TEXT[] NOT NULL DEFAULT '{}',
  decisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  abuse_flags TEXT[] NOT NULL DEFAULT '{}',
  raw_receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS answer_receipt_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_receipt_id TEXT NOT NULL REFERENCES answer_receipts(id) ON DELETE CASCADE,
  source_chunk_id UUID REFERENCES source_chunks(id) ON DELETE SET NULL,
  source_chunk_external_id TEXT NOT NULL,
  creator_id UUID REFERENCES source_creators(id) ON DELETE SET NULL,
  creator_external_id TEXT NOT NULL,
  work_id UUID REFERENCES licensed_works(id) ON DELETE SET NULL,
  work_external_id TEXT NOT NULL,
  citation_label TEXT NOT NULL,
  supported_output_tokens INTEGER NOT NULL CHECK (supported_output_tokens >= 0),
  attribution_weight NUMERIC(12,6) NOT NULL CHECK (attribution_weight >= 0),
  accrued_payout_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monthly_creator_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES source_creators(id) ON DELETE SET NULL,
  creator_external_id TEXT NOT NULL,
  settlement_period TEXT NOT NULL CHECK (settlement_period ~ '^[0-9]{4}-[0-9]{2}$'),
  answer_receipt_ids TEXT[] NOT NULL DEFAULT '{}',
  attributed_chunk_count INTEGER NOT NULL DEFAULT 0 CHECK (attributed_chunk_count >= 0),
  attributed_token_count INTEGER NOT NULL DEFAULT 0 CHECK (attributed_token_count >= 0),
  accrued_payout_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  settlement_status TEXT NOT NULL DEFAULT 'simulation'
    CHECK (settlement_status IN ('simulation', 'pending', 'approved', 'paid', 'held_for_review')),
  hold_reason TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(creator_external_id, settlement_period)
);

CREATE TABLE IF NOT EXISTS creator_rights_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES source_creators(id) ON DELETE SET NULL,
  work_id UUID REFERENCES licensed_works(id) ON DELETE SET NULL,
  license_grant_id UUID REFERENCES license_grants(id) ON DELETE SET NULL,
  answer_receipt_id TEXT REFERENCES answer_receipts(id) ON DELETE SET NULL,
  dispute_type TEXT NOT NULL
    CHECK (dispute_type IN (
      'ownership',
      'misattribution',
      'unsafe_use',
      'revocation',
      'community_consent',
      'payout',
      'other'
    )),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'resolved', 'rejected')),
  summary TEXT NOT NULL,
  resolution_notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS creator_rights_model_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewed_at TIMESTAMPTZ NOT NULL,
  incumbent_model_id TEXT NOT NULL,
  recommended_model_id TEXT NOT NULL,
  recommendation TEXT NOT NULL CHECK (recommendation IN ('keep_incumbent', 'review_candidate_for_promotion')),
  quality_gate_passed BOOLEAN NOT NULL DEFAULT FALSE,
  license_governance_gate_passed BOOLEAN NOT NULL DEFAULT FALSE,
  review_packet JSONB NOT NULL DEFAULT '[]'::jsonb,
  candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_source_creators_verification_status ON source_creators(verification_status);
CREATE INDEX IF NOT EXISTS idx_source_creator_portal_accounts_user_status ON source_creator_portal_accounts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_source_creator_portal_accounts_creator_id ON source_creator_portal_accounts(creator_id);
CREATE INDEX IF NOT EXISTS idx_licensed_works_creator_id ON licensed_works(creator_id);
CREATE INDEX IF NOT EXISTS idx_licensed_works_review_status ON licensed_works(review_status);
CREATE INDEX IF NOT EXISTS idx_license_grants_work_status ON license_grants(work_id, status);
CREATE INDEX IF NOT EXISTS idx_source_chunks_work_id ON source_chunks(work_id);
CREATE INDEX IF NOT EXISTS idx_source_chunks_retrievable ON source_chunks(is_retrievable) WHERE is_retrievable = TRUE;
CREATE INDEX IF NOT EXISTS idx_answer_receipts_generated_at ON answer_receipts(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_answer_receipt_chunks_receipt_id ON answer_receipt_chunks(answer_receipt_id);
CREATE INDEX IF NOT EXISTS idx_answer_receipt_chunks_creator_external_id ON answer_receipt_chunks(creator_external_id);
CREATE INDEX IF NOT EXISTS idx_monthly_creator_payouts_period_status ON monthly_creator_payouts(settlement_period, settlement_status);
CREATE INDEX IF NOT EXISTS idx_creator_rights_disputes_status ON creator_rights_disputes(status);
CREATE INDEX IF NOT EXISTS idx_creator_rights_model_reviews_reviewed_at ON creator_rights_model_reviews(reviewed_at DESC);

-- ============================================================================
-- Triggers
-- ============================================================================
DROP TRIGGER IF EXISTS source_creators_updated_at ON source_creators;
CREATE TRIGGER source_creators_updated_at
  BEFORE UPDATE ON source_creators
  FOR EACH ROW EXECUTE FUNCTION update_source_respecting_llm_updated_at();

DROP TRIGGER IF EXISTS source_creator_portal_accounts_updated_at ON source_creator_portal_accounts;
CREATE TRIGGER source_creator_portal_accounts_updated_at
  BEFORE UPDATE ON source_creator_portal_accounts
  FOR EACH ROW EXECUTE FUNCTION update_source_respecting_llm_updated_at();

DROP TRIGGER IF EXISTS licensed_works_updated_at ON licensed_works;
CREATE TRIGGER licensed_works_updated_at
  BEFORE UPDATE ON licensed_works
  FOR EACH ROW EXECUTE FUNCTION update_source_respecting_llm_updated_at();

DROP TRIGGER IF EXISTS license_grants_updated_at ON license_grants;
CREATE TRIGGER license_grants_updated_at
  BEFORE UPDATE ON license_grants
  FOR EACH ROW EXECUTE FUNCTION update_source_respecting_llm_updated_at();

DROP TRIGGER IF EXISTS source_chunks_updated_at ON source_chunks;
CREATE TRIGGER source_chunks_updated_at
  BEFORE UPDATE ON source_chunks
  FOR EACH ROW EXECUTE FUNCTION update_source_respecting_llm_updated_at();

DROP TRIGGER IF EXISTS monthly_creator_payouts_updated_at ON monthly_creator_payouts;
CREATE TRIGGER monthly_creator_payouts_updated_at
  BEFORE UPDATE ON monthly_creator_payouts
  FOR EACH ROW EXECUTE FUNCTION update_source_respecting_llm_updated_at();

DROP TRIGGER IF EXISTS creator_rights_disputes_updated_at ON creator_rights_disputes;
CREATE TRIGGER creator_rights_disputes_updated_at
  BEFORE UPDATE ON creator_rights_disputes
  FOR EACH ROW EXECUTE FUNCTION update_source_respecting_llm_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE source_creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_creator_portal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE licensed_works ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE answer_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE answer_receipt_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_creator_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_rights_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_rights_model_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage source creators" ON source_creators;
CREATE POLICY "Admins can manage source creators" ON source_creators
  FOR ALL USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage source creator portal accounts" ON source_creator_portal_accounts;
CREATE POLICY "Admins can manage source creator portal accounts" ON source_creator_portal_accounts
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "Creators can view their own active portal account" ON source_creator_portal_accounts;
CREATE POLICY "Creators can view their own active portal account" ON source_creator_portal_accounts
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL AND user_id = (select auth.uid()) AND status = 'active');

DROP POLICY IF EXISTS "Creators can view their own source creator profile" ON source_creators;
CREATE POLICY "Creators can view their own source creator profile" ON source_creators
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM source_creator_portal_accounts portal
      WHERE portal.creator_id = source_creators.id
        AND portal.user_id = (select auth.uid())
        AND portal.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can manage licensed works" ON licensed_works;
CREATE POLICY "Admins can manage licensed works" ON licensed_works
  FOR ALL USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "Creators can view their own licensed works" ON licensed_works;
CREATE POLICY "Creators can view their own licensed works" ON licensed_works
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM source_creator_portal_accounts portal
      WHERE portal.creator_id = licensed_works.creator_id
        AND portal.user_id = (select auth.uid())
        AND portal.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can manage license grants" ON license_grants;
CREATE POLICY "Admins can manage license grants" ON license_grants
  FOR ALL USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "Creators can view grants for their own works" ON license_grants;
CREATE POLICY "Creators can view grants for their own works" ON license_grants
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM licensed_works work
      JOIN source_creator_portal_accounts portal ON portal.creator_id = work.creator_id
      WHERE work.id = license_grants.work_id
        AND portal.user_id = (select auth.uid())
        AND portal.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can manage source chunks" ON source_chunks;
CREATE POLICY "Admins can manage source chunks" ON source_chunks
  FOR ALL USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "Creators can view their own source chunks" ON source_chunks;
CREATE POLICY "Creators can view their own source chunks" ON source_chunks
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM source_creator_portal_accounts portal
      WHERE portal.creator_id = source_chunks.creator_id
        AND portal.user_id = (select auth.uid())
        AND portal.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can manage answer receipts" ON answer_receipts;
CREATE POLICY "Admins can manage answer receipts" ON answer_receipts
  FOR ALL USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage answer receipt chunks" ON answer_receipt_chunks;
CREATE POLICY "Admins can manage answer receipt chunks" ON answer_receipt_chunks
  FOR ALL USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "Creators can view their own attributed receipt chunks" ON answer_receipt_chunks;
CREATE POLICY "Creators can view their own attributed receipt chunks" ON answer_receipt_chunks
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM source_creator_portal_accounts portal
      WHERE portal.creator_id = answer_receipt_chunks.creator_id
        AND portal.user_id = (select auth.uid())
        AND portal.status = 'active'
        AND portal.can_view_receipts = TRUE
    )
  );

DROP POLICY IF EXISTS "Admins can manage monthly creator payouts" ON monthly_creator_payouts;
CREATE POLICY "Admins can manage monthly creator payouts" ON monthly_creator_payouts
  FOR ALL USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "Creators can view their own monthly payouts" ON monthly_creator_payouts;
CREATE POLICY "Creators can view their own monthly payouts" ON monthly_creator_payouts
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM source_creator_portal_accounts portal
      WHERE portal.creator_id = monthly_creator_payouts.creator_id
        AND portal.user_id = (select auth.uid())
        AND portal.status = 'active'
        AND portal.can_view_earnings = TRUE
    )
  );

DROP POLICY IF EXISTS "Admins can manage creator rights disputes" ON creator_rights_disputes;
CREATE POLICY "Admins can manage creator rights disputes" ON creator_rights_disputes
  FOR ALL USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "Creators can view their own disputes" ON creator_rights_disputes;
CREATE POLICY "Creators can view their own disputes" ON creator_rights_disputes
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM source_creator_portal_accounts portal
      WHERE portal.creator_id = creator_rights_disputes.creator_id
        AND portal.user_id = (select auth.uid())
        AND portal.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can manage creator rights model reviews" ON creator_rights_model_reviews;
CREATE POLICY "Admins can manage creator rights model reviews" ON creator_rights_model_reviews
  FOR ALL USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND role = 'admin'));

GRANT ALL ON source_creators TO service_role;
GRANT ALL ON source_creator_portal_accounts TO service_role;
GRANT ALL ON licensed_works TO service_role;
GRANT ALL ON license_grants TO service_role;
GRANT ALL ON source_chunks TO service_role;
GRANT ALL ON answer_receipts TO service_role;
GRANT ALL ON answer_receipt_chunks TO service_role;
GRANT ALL ON monthly_creator_payouts TO service_role;
GRANT ALL ON creator_rights_disputes TO service_role;
GRANT ALL ON creator_rights_model_reviews TO service_role;
