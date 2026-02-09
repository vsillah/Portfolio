-- App Prototypes Table
-- Tracks app prototypes through their lifecycle from concept to production
CREATE TABLE IF NOT EXISTS app_prototypes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  purpose TEXT NOT NULL, -- Why this prototype exists
  production_stage TEXT NOT NULL CHECK (production_stage IN ('Concept', 'Development', 'Beta', 'Production', 'Archived')),
  channel TEXT NOT NULL CHECK (channel IN ('Web', 'Mobile', 'Desktop', 'API')),
  product_type TEXT NOT NULL CHECK (product_type IN ('SaaS', 'Tool', 'Game', 'Utility', 'Other')),
  thumbnail_url TEXT,
  download_url TEXT,
  app_repo_url TEXT,
  deployment_platform TEXT,
  analytics_source TEXT,
  analytics_project_id TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prototype Demos (screenshots, videos, live demos)
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

-- Prototype Stage History (track stage changes)
CREATE TABLE IF NOT EXISTS prototype_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id UUID NOT NULL REFERENCES app_prototypes(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_by UUID REFERENCES user_profiles(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- Prototype Enrollments (users can sign up for beta testing)
CREATE TABLE IF NOT EXISTS prototype_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id UUID NOT NULL REFERENCES app_prototypes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  enrollment_type TEXT NOT NULL CHECK (enrollment_type IN ('beta', 'early_access')),
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(prototype_id, user_id)
);

-- Prototype Feedback
CREATE TABLE IF NOT EXISTS prototype_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id UUID NOT NULL REFERENCES app_prototypes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prototype Analytics
CREATE TABLE IF NOT EXISTS prototype_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id UUID NOT NULL REFERENCES app_prototypes(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('active-users', 'pageviews', 'downloads')),
  metric_value INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(prototype_id, metric_date, metric_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_app_prototypes_stage ON app_prototypes(production_stage);
CREATE INDEX IF NOT EXISTS idx_app_prototypes_channel ON app_prototypes(channel);
CREATE INDEX IF NOT EXISTS idx_app_prototypes_type ON app_prototypes(product_type);
CREATE INDEX IF NOT EXISTS idx_prototype_demos_prototype ON prototype_demos(prototype_id);
CREATE INDEX IF NOT EXISTS idx_prototype_demos_primary ON prototype_demos(is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_prototype_stage_history_prototype ON prototype_stage_history(prototype_id);
CREATE INDEX IF NOT EXISTS idx_prototype_enrollments_prototype ON prototype_enrollments(prototype_id);
CREATE INDEX IF NOT EXISTS idx_prototype_enrollments_user ON prototype_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_prototype_feedback_prototype ON prototype_feedback(prototype_id);
CREATE INDEX IF NOT EXISTS idx_prototype_analytics_prototype ON prototype_analytics(prototype_id);

-- Enable RLS
ALTER TABLE app_prototypes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prototype_demos ENABLE ROW LEVEL SECURITY;
ALTER TABLE prototype_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE prototype_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE prototype_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE prototype_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for app_prototypes
DROP POLICY IF EXISTS "Public can view prototypes" ON app_prototypes;
CREATE POLICY "Public can view prototypes"
  ON app_prototypes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage prototypes" ON app_prototypes;
CREATE POLICY "Admins can manage prototypes"
  ON app_prototypes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for prototype_demos
DROP POLICY IF EXISTS "Public can view demos" ON prototype_demos;
CREATE POLICY "Public can view demos"
  ON prototype_demos FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage demos" ON prototype_demos;
CREATE POLICY "Admins can manage demos"
  ON prototype_demos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for prototype_stage_history
DROP POLICY IF EXISTS "Public can view stage history" ON prototype_stage_history;
CREATE POLICY "Public can view stage history"
  ON prototype_stage_history FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage stage history" ON prototype_stage_history;
CREATE POLICY "Admins can manage stage history"
  ON prototype_stage_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for prototype_enrollments
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
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for prototype_feedback
DROP POLICY IF EXISTS "Public can view feedback" ON prototype_feedback;
CREATE POLICY "Public can view feedback"
  ON prototype_feedback FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can submit feedback" ON prototype_feedback;
CREATE POLICY "Users can submit feedback"
  ON prototype_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Admins can manage feedback" ON prototype_feedback;
CREATE POLICY "Admins can manage feedback"
  ON prototype_feedback FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for prototype_analytics
DROP POLICY IF EXISTS "Public can view analytics" ON prototype_analytics;
CREATE POLICY "Public can view analytics"
  ON prototype_analytics FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage analytics" ON prototype_analytics;
CREATE POLICY "Admins can manage analytics"
  ON prototype_analytics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to track stage changes
CREATE OR REPLACE FUNCTION track_prototype_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.production_stage != NEW.production_stage) THEN
    INSERT INTO prototype_stage_history (prototype_id, from_stage, to_stage, changed_by)
    VALUES (NEW.id, OLD.production_stage, NEW.production_stage, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to track stage changes
DROP TRIGGER IF EXISTS app_prototypes_stage_change ON app_prototypes;
CREATE TRIGGER app_prototypes_stage_change
  AFTER UPDATE ON app_prototypes
  FOR EACH ROW
  EXECUTE FUNCTION track_prototype_stage_change();

-- Trigger for updated_at
DROP TRIGGER IF EXISTS app_prototypes_updated_at ON app_prototypes;
CREATE TRIGGER app_prototypes_updated_at
  BEFORE UPDATE ON app_prototypes
  FOR EACH ROW
  EXECUTE FUNCTION update_store_updated_at();
