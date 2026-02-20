-- ============================================================================
-- Migration: Attraction Campaigns System
-- Date: 2026-02-21
-- Purpose: Create tables for time-bound attraction campaigns (e.g. "Win Your
--          Money Back") that wrap across bundles/tiers with template-based
--          criteria personalized per client using audit data and value evidence.
--
-- Dependencies: offer_bundles, orders, user_profiles, guarantee_instances,
--               diagnostic_audits tables must exist.
--
-- Apply order: Run AFTER 2026_02_20_outcome_groups.sql
-- ============================================================================

-- ============================================================================
-- 1. attraction_campaigns — campaign definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS attraction_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,

  -- Type
  campaign_type TEXT NOT NULL DEFAULT 'win_money_back'
    CHECK (campaign_type IN ('win_money_back', 'free_challenge', 'bonus_credit')),

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),

  -- Time window
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  enrollment_deadline TIMESTAMPTZ,
  completion_window_days INTEGER NOT NULL DEFAULT 90,

  -- Eligibility
  min_purchase_amount NUMERIC(10,2) DEFAULT 0,

  -- Payout configuration (mirrors guarantee_templates pattern)
  payout_type TEXT NOT NULL DEFAULT 'refund'
    CHECK (payout_type IN ('refund', 'credit', 'rollover_upsell', 'rollover_continuity')),
  payout_amount_type TEXT NOT NULL DEFAULT 'full'
    CHECK (payout_amount_type IN ('full', 'partial', 'fixed')),
  payout_amount_value NUMERIC(10,2),
  rollover_bonus_multiplier NUMERIC(4,2) DEFAULT 1.0,

  -- Marketing assets
  hero_image_url TEXT,
  promo_copy TEXT,

  -- Metadata
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. campaign_eligible_bundles — which bundles/tiers qualify
-- ============================================================================
CREATE TABLE IF NOT EXISTS campaign_eligible_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  campaign_id UUID NOT NULL REFERENCES attraction_campaigns(id) ON DELETE CASCADE,
  bundle_id UUID NOT NULL REFERENCES offer_bundles(id) ON DELETE CASCADE,

  override_min_amount NUMERIC(10,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(campaign_id, bundle_id)
);

-- ============================================================================
-- 3. campaign_criteria_templates — template criteria at the campaign level
-- ============================================================================
CREATE TABLE IF NOT EXISTS campaign_criteria_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  campaign_id UUID NOT NULL REFERENCES attraction_campaigns(id) ON DELETE CASCADE,

  -- Template text (supports {{variable}} placeholders)
  label_template TEXT NOT NULL,
  description_template TEXT,

  -- Hormozi framework: action (do the work) vs result (get the outcome)
  criteria_type TEXT NOT NULL DEFAULT 'action'
    CHECK (criteria_type IN ('action', 'result')),

  -- How progress is tracked
  tracking_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (tracking_source IN (
      'manual',
      'onboarding_milestone',
      'chat_session',
      'video_watch',
      'diagnostic_completion',
      'custom_webhook'
    )),
  tracking_config JSONB DEFAULT '{}'::jsonb,

  -- Personalization: which audit/evidence field populates the target
  threshold_source TEXT,
  threshold_default TEXT,

  required BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. campaign_enrollments — client enrollment in a campaign
-- ============================================================================
CREATE TABLE IF NOT EXISTS campaign_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  campaign_id UUID NOT NULL REFERENCES attraction_campaigns(id) ON DELETE CASCADE,

  -- Client info
  client_email TEXT NOT NULL,
  client_name TEXT,
  user_id UUID REFERENCES user_profiles(id),

  -- Purchase link (nullable for manual enrollment before purchase)
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  bundle_id UUID REFERENCES offer_bundles(id) ON DELETE SET NULL,
  purchase_amount NUMERIC(10,2),

  -- How they were enrolled
  enrollment_source TEXT NOT NULL DEFAULT 'admin_manual'
    CHECK (enrollment_source IN ('auto_purchase', 'admin_manual', 'sales_conversation')),

  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN (
      'active',
      'criteria_met',
      'payout_pending',
      'refund_issued',
      'credit_issued',
      'rollover_applied',
      'expired',
      'withdrawn'
    )),

  -- Time window
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,

  -- Resolution
  guarantee_instance_id UUID REFERENCES guarantee_instances(id) ON DELETE SET NULL,
  resolution_notes TEXT,

  -- Prerequisite: audit data
  diagnostic_audit_id UUID,
  personalization_context JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. enrollment_criteria — personalized criteria per enrollment
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrollment_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  enrollment_id UUID NOT NULL REFERENCES campaign_enrollments(id) ON DELETE CASCADE,
  template_criterion_id UUID NOT NULL REFERENCES campaign_criteria_templates(id) ON DELETE CASCADE,

  -- Personalized content (templates resolved with client data)
  label TEXT NOT NULL,
  description TEXT,

  criteria_type TEXT NOT NULL DEFAULT 'action'
    CHECK (criteria_type IN ('action', 'result')),

  tracking_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (tracking_source IN (
      'manual',
      'onboarding_milestone',
      'chat_session',
      'video_watch',
      'diagnostic_completion',
      'custom_webhook'
    )),
  tracking_config JSONB DEFAULT '{}'::jsonb,

  -- The personalized threshold
  target_value TEXT,

  required BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. campaign_progress — per-criterion progress for each enrollment
-- ============================================================================
CREATE TABLE IF NOT EXISTS campaign_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  enrollment_id UUID NOT NULL REFERENCES campaign_enrollments(id) ON DELETE CASCADE,
  criterion_id UUID NOT NULL REFERENCES enrollment_criteria(id) ON DELETE CASCADE,

  -- Progress
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'met', 'not_met', 'waived')),
  progress_value NUMERIC(5,2) DEFAULT 0,
  current_value TEXT,

  -- Auto-tracking
  auto_tracked BOOLEAN NOT NULL DEFAULT false,
  auto_source_ref TEXT,

  -- Client self-report
  client_evidence TEXT,
  client_submitted_at TIMESTAMPTZ,

  -- Admin verification
  admin_verified_by UUID REFERENCES user_profiles(id),
  admin_verified_at TIMESTAMPTZ,
  admin_notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(enrollment_id, criterion_id)
);

-- ============================================================================
-- 7. Indexes
-- ============================================================================

-- attraction_campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_status
  ON attraction_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_slug
  ON attraction_campaigns(slug);
CREATE INDEX IF NOT EXISTS idx_campaigns_active_window
  ON attraction_campaigns(starts_at, ends_at) WHERE status = 'active';

-- campaign_eligible_bundles
CREATE INDEX IF NOT EXISTS idx_campaign_bundles_campaign
  ON campaign_eligible_bundles(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_bundles_bundle
  ON campaign_eligible_bundles(bundle_id);

-- campaign_criteria_templates
CREATE INDEX IF NOT EXISTS idx_criteria_templates_campaign
  ON campaign_criteria_templates(campaign_id);

-- campaign_enrollments
CREATE INDEX IF NOT EXISTS idx_enrollments_campaign
  ON campaign_enrollments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_email
  ON campaign_enrollments(client_email);
CREATE INDEX IF NOT EXISTS idx_enrollments_user
  ON campaign_enrollments(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enrollments_status
  ON campaign_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_order
  ON campaign_enrollments(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enrollments_deadline
  ON campaign_enrollments(deadline_at) WHERE status = 'active';

-- enrollment_criteria
CREATE INDEX IF NOT EXISTS idx_enrollment_criteria_enrollment
  ON enrollment_criteria(enrollment_id);

-- campaign_progress
CREATE INDEX IF NOT EXISTS idx_progress_enrollment
  ON campaign_progress(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_progress_criterion
  ON campaign_progress(criterion_id);
CREATE INDEX IF NOT EXISTS idx_progress_status
  ON campaign_progress(status);

-- ============================================================================
-- 8. Row Level Security
-- ============================================================================
ALTER TABLE attraction_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_eligible_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_criteria_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_progress ENABLE ROW LEVEL SECURITY;

-- attraction_campaigns: admins manage, public read active
DROP POLICY IF EXISTS "Admins can manage campaigns" ON attraction_campaigns;
CREATE POLICY "Admins can manage campaigns"
  ON attraction_campaigns FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Public can view active campaigns" ON attraction_campaigns;
CREATE POLICY "Public can view active campaigns"
  ON attraction_campaigns FOR SELECT
  USING (status = 'active');

-- campaign_eligible_bundles: admins manage, public read via active campaign
DROP POLICY IF EXISTS "Admins can manage campaign bundles" ON campaign_eligible_bundles;
CREATE POLICY "Admins can manage campaign bundles"
  ON campaign_eligible_bundles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Public can view eligible bundles for active campaigns" ON campaign_eligible_bundles;
CREATE POLICY "Public can view eligible bundles for active campaigns"
  ON campaign_eligible_bundles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM attraction_campaigns ac
      WHERE ac.id = campaign_id AND ac.status = 'active'
    )
  );

-- campaign_criteria_templates: admins manage, public read via active campaign
DROP POLICY IF EXISTS "Admins can manage criteria templates" ON campaign_criteria_templates;
CREATE POLICY "Admins can manage criteria templates"
  ON campaign_criteria_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Public can view criteria for active campaigns" ON campaign_criteria_templates;
CREATE POLICY "Public can view criteria for active campaigns"
  ON campaign_criteria_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM attraction_campaigns ac
      WHERE ac.id = campaign_id AND ac.status = 'active'
    )
  );

-- campaign_enrollments: admins manage all, clients read own
DROP POLICY IF EXISTS "Admins can manage enrollments" ON campaign_enrollments;
CREATE POLICY "Admins can manage enrollments"
  ON campaign_enrollments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Clients can view own enrollments" ON campaign_enrollments;
CREATE POLICY "Clients can view own enrollments"
  ON campaign_enrollments FOR SELECT
  USING (user_id = auth.uid());

-- enrollment_criteria: admins manage, clients read own
DROP POLICY IF EXISTS "Admins can manage enrollment criteria" ON enrollment_criteria;
CREATE POLICY "Admins can manage enrollment criteria"
  ON enrollment_criteria FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Clients can view own enrollment criteria" ON enrollment_criteria;
CREATE POLICY "Clients can view own enrollment criteria"
  ON enrollment_criteria FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaign_enrollments ce
      WHERE ce.id = enrollment_id AND ce.user_id = auth.uid()
    )
  );

-- campaign_progress: admins manage, clients read/update own
DROP POLICY IF EXISTS "Admins can manage progress" ON campaign_progress;
CREATE POLICY "Admins can manage progress"
  ON campaign_progress FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Clients can view own progress" ON campaign_progress;
CREATE POLICY "Clients can view own progress"
  ON campaign_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaign_enrollments ce
      WHERE ce.id = enrollment_id AND ce.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Clients can update own progress" ON campaign_progress;
CREATE POLICY "Clients can update own progress"
  ON campaign_progress FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM campaign_enrollments ce
      WHERE ce.id = enrollment_id AND ce.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaign_enrollments ce
      WHERE ce.id = enrollment_id AND ce.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 9. Triggers for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_campaign_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS campaigns_updated_at ON attraction_campaigns;
CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON attraction_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_updated_at();

DROP TRIGGER IF EXISTS criteria_templates_updated_at ON campaign_criteria_templates;
CREATE TRIGGER criteria_templates_updated_at
  BEFORE UPDATE ON campaign_criteria_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_updated_at();

DROP TRIGGER IF EXISTS enrollments_updated_at ON campaign_enrollments;
CREATE TRIGGER enrollments_updated_at
  BEFORE UPDATE ON campaign_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_updated_at();

DROP TRIGGER IF EXISTS enrollment_criteria_updated_at ON enrollment_criteria;
CREATE TRIGGER enrollment_criteria_updated_at
  BEFORE UPDATE ON enrollment_criteria
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_updated_at();

DROP TRIGGER IF EXISTS progress_updated_at ON campaign_progress;
CREATE TRIGGER progress_updated_at
  BEFORE UPDATE ON campaign_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_updated_at();
