# App Prototype Demo Container - Database Setup

## Step 1: Create Database Tables

Run this SQL in Supabase SQL Editor:

```sql
-- Main prototypes table
CREATE TABLE IF NOT EXISTS app_prototypes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  purpose TEXT NOT NULL,
  production_stage VARCHAR(20) NOT NULL CHECK (production_stage IN ('Dev', 'QA', 'Pilot', 'Production')),
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('Web', 'Mobile')),
  product_type VARCHAR(20) NOT NULL CHECK (product_type IN ('Utility', 'Experience')),
  thumbnail_url TEXT,
  download_url TEXT,
  app_repo_url TEXT,
  deployment_platform VARCHAR(50),
  last_deployment_sync TIMESTAMP WITH TIME ZONE,
  deployment_webhook_id VARCHAR(255),
  analytics_source VARCHAR(50),
  analytics_api_key TEXT,
  analytics_project_id VARCHAR(255),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stage history tracking (audit trail)
CREATE TABLE IF NOT EXISTS prototype_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id UUID REFERENCES app_prototypes(id) ON DELETE CASCADE,
  old_stage VARCHAR(20),
  new_stage VARCHAR(20) NOT NULL,
  changed_by UUID REFERENCES user_profiles(id),
  change_reason TEXT,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Multiple demo URLs per prototype (for persona-based journeys)
CREATE TABLE IF NOT EXISTS prototype_demos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id UUID REFERENCES app_prototypes(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  demo_type VARCHAR(50) DEFAULT 'video',
  demo_url TEXT NOT NULL,
  persona_type VARCHAR(100),
  journey_focus TEXT,
  is_primary BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique partial index to ensure only one primary demo per prototype
CREATE UNIQUE INDEX IF NOT EXISTS idx_prototype_demos_one_primary 
ON prototype_demos(prototype_id) 
WHERE is_primary = true;

-- App analytics metrics (aggregated over time)
CREATE TABLE IF NOT EXISTS prototype_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id UUID REFERENCES app_prototypes(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  metric_type VARCHAR(50) NOT NULL,
  metric_value NUMERIC NOT NULL,
  metadata JSONB,
  source VARCHAR(50),
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(prototype_id, metric_date, metric_type, source)
);

-- Enrollment tracking
CREATE TABLE IF NOT EXISTS prototype_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  prototype_id UUID REFERENCES app_prototypes(id) ON DELETE CASCADE,
  enrollment_type VARCHAR(20) NOT NULL CHECK (enrollment_type IN ('Waitlist', 'Pilot', 'Production-Interest')),
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, prototype_id, enrollment_type)
);

-- Feedback system
CREATE TABLE IF NOT EXISTS prototype_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id UUID REFERENCES app_prototypes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback_text TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prototype_stage_history_prototype ON prototype_stage_history(prototype_id);
CREATE INDEX IF NOT EXISTS idx_prototype_stage_history_date ON prototype_stage_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_prototype_demos_prototype ON prototype_demos(prototype_id, display_order);
CREATE INDEX IF NOT EXISTS idx_prototype_analytics_prototype_date ON prototype_analytics(prototype_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_prototype_analytics_type ON prototype_analytics(metric_type, metric_date DESC);
```

## Step 2: Create Trigger for Stage History

```sql
CREATE OR REPLACE FUNCTION track_prototype_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.production_stage IS DISTINCT FROM NEW.production_stage THEN
    INSERT INTO prototype_stage_history (
      prototype_id,
      old_stage,
      new_stage,
      changed_at
    ) VALUES (
      NEW.id,
      OLD.production_stage,
      NEW.production_stage,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prototype_stage_change_trigger ON app_prototypes;

CREATE TRIGGER prototype_stage_change_trigger
  AFTER UPDATE ON app_prototypes
  FOR EACH ROW
  EXECUTE FUNCTION track_prototype_stage_change();
```

## Step 3: Set Up RLS Policies

```sql
ALTER TABLE app_prototypes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prototype_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE prototype_demos ENABLE ROW LEVEL SECURITY;
ALTER TABLE prototype_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE prototype_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE prototype_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view prototypes" ON app_prototypes;
CREATE POLICY "Anyone can view prototypes"
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

DROP POLICY IF EXISTS "Anyone can view stage history" ON prototype_stage_history;
CREATE POLICY "Anyone can view stage history"
  ON prototype_stage_history FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can view demos" ON prototype_demos;
CREATE POLICY "Anyone can view demos"
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

DROP POLICY IF EXISTS "Anyone can view production analytics" ON prototype_analytics;
CREATE POLICY "Anyone can view production analytics"
  ON prototype_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app_prototypes
      WHERE id = prototype_analytics.prototype_id AND production_stage = 'Production'
    )
  );

DROP POLICY IF EXISTS "Admins can view all analytics" ON prototype_analytics;
CREATE POLICY "Admins can view all analytics"
  ON prototype_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view their own enrollments" ON prototype_enrollments;
CREATE POLICY "Users can view their own enrollments"
  ON prototype_enrollments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create enrollments" ON prototype_enrollments;
CREATE POLICY "Users can create enrollments"
  ON prototype_enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view production feedback" ON prototype_feedback;
CREATE POLICY "Anyone can view production feedback"
  ON prototype_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app_prototypes
      WHERE id = prototype_feedback.prototype_id AND production_stage = 'Production'
    )
  );

DROP POLICY IF EXISTS "Pilot/Production users can submit feedback" ON prototype_feedback;
CREATE POLICY "Pilot/Production users can submit feedback"
  ON prototype_feedback FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      EXISTS (
        SELECT 1 FROM prototype_enrollments
        WHERE user_id = auth.uid() 
        AND prototype_id = prototype_feedback.prototype_id
        AND enrollment_type IN ('Pilot', 'Production-Interest')
      ) OR EXISTS (
        SELECT 1 FROM app_prototypes
        WHERE id = prototype_feedback.prototype_id AND production_stage = 'Production'
      )
    )
  );

DROP POLICY IF EXISTS "Users can update their own feedback" ON prototype_feedback;
CREATE POLICY "Users can update their own feedback"
  ON prototype_feedback FOR UPDATE
  USING (auth.uid() = user_id);
```

## Step 4: Create Storage Bucket for Thumbnails (Optional)

1. Go to Supabase Dashboard → Storage
2. Create bucket named `prototype-thumbnails`
3. Set to **Public** (thumbnails should be publicly accessible)
4. Add policy: "Anyone can read thumbnail files"
5. Add policy: "Admins can upload/manage thumbnails"

Storage Policy SQL:
```sql
DROP POLICY IF EXISTS "Anyone can read thumbnails" ON storage.objects;
CREATE POLICY "Anyone can read thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'prototype-thumbnails');

DROP POLICY IF EXISTS "Admins can upload thumbnails" ON storage.objects;
CREATE POLICY "Admins can upload thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'prototype-thumbnails' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can manage thumbnails" ON storage.objects;
CREATE POLICY "Admins can manage thumbnails"
ON storage.objects FOR ALL
USING (
  bucket_id = 'prototype-thumbnails' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```
