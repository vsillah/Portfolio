-- ============================================================================
-- Migration: Create missing tables (prototype sub-tables, social, discount tracking)
-- Date: 2026-02-10
-- Purpose: Targeted migration for tables present in backup but missing from current DB
-- Safe to run: All statements use IF NOT EXISTS / IF EXISTS
-- ============================================================================

-- ============================================================================
-- 1. user_discount_codes
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_discount_codes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  discount_code_id BIGINT NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, discount_code_id)
);

CREATE INDEX IF NOT EXISTS idx_user_discount_codes_user ON user_discount_codes(user_id);

ALTER TABLE user_discount_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own discount usage" ON user_discount_codes;
CREATE POLICY "Users can view their own discount usage"
  ON user_discount_codes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage discount usage" ON user_discount_codes;
CREATE POLICY "Admins can manage discount usage"
  ON user_discount_codes FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 2. social_shares
-- ============================================================================
CREATE TABLE IF NOT EXISTS social_shares (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'facebook', 'linkedin', 'other')),
  shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  discount_earned DECIMAL(10, 2) DEFAULT 0,
  share_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_social_shares_user ON social_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_social_shares_order ON social_shares(order_id);

ALTER TABLE social_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own shares" ON social_shares;
CREATE POLICY "Users can view their own shares"
  ON social_shares FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create shares" ON social_shares;
CREATE POLICY "Users can create shares"
  ON social_shares FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 3. prototype_demos
-- ============================================================================
CREATE TABLE IF NOT EXISTS prototype_demos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id UUID NOT NULL REFERENCES app_prototypes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  demo_type TEXT NOT NULL CHECK (demo_type IN ('video', 'screenshot', 'live_demo')),
  demo_url TEXT NOT NULL,
  thumbnail_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prototype_demos_prototype ON prototype_demos(prototype_id);
CREATE INDEX IF NOT EXISTS idx_prototype_demos_primary ON prototype_demos(is_primary) WHERE is_primary = true;

ALTER TABLE prototype_demos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view demos" ON prototype_demos;
CREATE POLICY "Public can view demos"
  ON prototype_demos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage demos" ON prototype_demos;
CREATE POLICY "Admins can manage demos"
  ON prototype_demos FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================================
-- 4. prototype_stage_history
-- ============================================================================
CREATE TABLE IF NOT EXISTS prototype_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id UUID NOT NULL REFERENCES app_prototypes(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_by UUID REFERENCES user_profiles(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_prototype_stage_history_prototype ON prototype_stage_history(prototype_id);

ALTER TABLE prototype_stage_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view stage history" ON prototype_stage_history;
CREATE POLICY "Public can view stage history"
  ON prototype_stage_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage stage history" ON prototype_stage_history;
CREATE POLICY "Admins can manage stage history"
  ON prototype_stage_history FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================================
-- 5. prototype_enrollments
-- ============================================================================
CREATE TABLE IF NOT EXISTS prototype_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id UUID NOT NULL REFERENCES app_prototypes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  enrollment_type TEXT NOT NULL CHECK (enrollment_type IN ('beta', 'early_access')),
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(prototype_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_prototype_enrollments_prototype ON prototype_enrollments(prototype_id);
CREATE INDEX IF NOT EXISTS idx_prototype_enrollments_user ON prototype_enrollments(user_id);

ALTER TABLE prototype_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their enrollments" ON prototype_enrollments;
CREATE POLICY "Users can view their enrollments"
  ON prototype_enrollments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can enroll themselves" ON prototype_enrollments;
CREATE POLICY "Users can enroll themselves"
  ON prototype_enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all enrollments" ON prototype_enrollments;
CREATE POLICY "Admins can view all enrollments"
  ON prototype_enrollments FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================================
-- 6. prototype_feedback
-- ============================================================================
CREATE TABLE IF NOT EXISTS prototype_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id UUID NOT NULL REFERENCES app_prototypes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prototype_feedback_prototype ON prototype_feedback(prototype_id);

ALTER TABLE prototype_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view feedback" ON prototype_feedback;
CREATE POLICY "Public can view feedback"
  ON prototype_feedback FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can submit feedback" ON prototype_feedback;
CREATE POLICY "Users can submit feedback"
  ON prototype_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Admins can manage feedback" ON prototype_feedback;
CREATE POLICY "Admins can manage feedback"
  ON prototype_feedback FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================================
-- 7. prototype_analytics
-- ============================================================================
CREATE TABLE IF NOT EXISTS prototype_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id UUID NOT NULL REFERENCES app_prototypes(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('active-users', 'pageviews', 'downloads')),
  metric_value INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(prototype_id, metric_date, metric_type)
);

CREATE INDEX IF NOT EXISTS idx_prototype_analytics_prototype ON prototype_analytics(prototype_id);

ALTER TABLE prototype_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view analytics" ON prototype_analytics;
CREATE POLICY "Public can view analytics"
  ON prototype_analytics FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage analytics" ON prototype_analytics;
CREATE POLICY "Admins can manage analytics"
  ON prototype_analytics FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
