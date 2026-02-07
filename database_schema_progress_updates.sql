-- ============================================================================
-- Progress Update Templates & Log Schema
-- Templatized progress update messages sent to clients during implementation.
-- Auto-triggered on milestone status changes, delivered via Slack or email.
-- ============================================================================

-- ============================================================================
-- Progress Update Templates table
-- Message templates keyed by update_type + optional content_type / service_type.
-- Contains dual-format fields (email + Slack) with {{token}} placeholders.
-- ============================================================================
CREATE TABLE IF NOT EXISTS progress_update_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template matching criteria (same resolution pattern as onboarding_plan_templates)
  update_type TEXT NOT NULL CHECK (update_type IN (
    'milestone_completed',
    'ahead_of_schedule',
    'on_schedule',
    'behind_schedule',
    'project_delivery',
    'warranty_start'
  )),
  content_type TEXT CHECK (content_type IS NULL OR content_type IN (
    'product', 'project', 'video', 'publication', 'music',
    'lead_magnet', 'prototype', 'service'
  )),
  service_type TEXT CHECK (service_type IS NULL OR service_type IN (
    'training', 'speaking', 'consulting', 'coaching', 'workshop'
  )),

  -- Tone / personality variant
  tone TEXT NOT NULL DEFAULT 'casual' CHECK (tone IN (
    'casual', 'professional', 'celebratory'
  )),

  -- Email template fields (with {{token}} placeholders)
  email_subject TEXT NOT NULL,
  email_body TEXT NOT NULL,

  -- Slack template field (shorter, no signature, supports Slack mrkdwn)
  slack_body TEXT NOT NULL,

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Progress Update Log table
-- Tracks every progress update sent for audit and history.
-- ============================================================================
CREATE TABLE IF NOT EXISTS progress_update_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  client_project_id UUID REFERENCES client_projects(id) ON DELETE CASCADE,
  onboarding_plan_id UUID REFERENCES onboarding_plans(id) ON DELETE SET NULL,
  template_id UUID REFERENCES progress_update_templates(id) ON DELETE SET NULL,

  -- Update details
  update_type TEXT NOT NULL CHECK (update_type IN (
    'milestone_completed',
    'ahead_of_schedule',
    'on_schedule',
    'behind_schedule',
    'project_delivery',
    'warranty_start'
  )),
  channel TEXT NOT NULL CHECK (channel IN ('slack', 'email')),
  milestone_index INTEGER,  -- Which milestone triggered this update

  -- Rendered content (the actual message sent, for audit)
  rendered_subject TEXT,      -- Email subject (null for Slack)
  rendered_body TEXT NOT NULL, -- The message body that was sent

  -- Attachments and notes
  attachments JSONB DEFAULT '[]',  -- [{url, filename, content_type}]
  custom_note TEXT,                -- Optional personal note from admin

  -- Delivery tracking
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN (
    'pending',    -- Webhook fired, awaiting delivery
    'sent',       -- n8n confirmed delivery
    'failed',     -- Delivery failed
    'skipped'     -- Skipped (e.g., no channel configured)
  )),
  n8n_webhook_fired_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error_message TEXT,  -- Populated on failure

  -- Trigger source
  triggered_by TEXT DEFAULT 'admin' CHECK (triggered_by IN (
    'admin',       -- Triggered from admin dashboard
    'slack_cmd',   -- Triggered from Slack slash command
    'system'       -- Triggered automatically (future: scheduled)
  )),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_progress_update_templates_update_type
ON progress_update_templates(update_type);

CREATE INDEX IF NOT EXISTS idx_progress_update_templates_content_type
ON progress_update_templates(content_type)
WHERE content_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_progress_update_templates_active
ON progress_update_templates(is_active)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_progress_update_log_client_project
ON progress_update_log(client_project_id);

CREATE INDEX IF NOT EXISTS idx_progress_update_log_onboarding_plan
ON progress_update_log(onboarding_plan_id);

CREATE INDEX IF NOT EXISTS idx_progress_update_log_delivery_status
ON progress_update_log(delivery_status)
WHERE delivery_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_progress_update_log_created
ON progress_update_log(created_at DESC);

-- ============================================================================
-- Unique constraint: one active template per update_type + content_type + service_type
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_update_templates_unique_active
ON progress_update_templates(update_type, COALESCE(content_type, ''), COALESCE(service_type, ''))
WHERE is_active = true;

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================
ALTER TABLE progress_update_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_update_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies - Admin only
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage progress update templates" ON progress_update_templates;
CREATE POLICY "Admins can manage progress update templates"
  ON progress_update_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can manage progress update log" ON progress_update_log;
CREATE POLICY "Admins can manage progress update log"
  ON progress_update_log FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service role bypass for API routes (n8n callback, etc.)
DROP POLICY IF EXISTS "Service role can insert progress update log" ON progress_update_log;
CREATE POLICY "Service role can insert progress update log"
  ON progress_update_log FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update progress update log" ON progress_update_log;
CREATE POLICY "Service role can update progress update log"
  ON progress_update_log FOR UPDATE
  USING (true);

-- ============================================================================
-- Trigger for updated_at on progress_update_templates
-- ============================================================================
CREATE OR REPLACE FUNCTION update_progress_update_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS progress_update_templates_updated_at ON progress_update_templates;
CREATE TRIGGER progress_update_templates_updated_at
  BEFORE UPDATE ON progress_update_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_progress_update_templates_updated_at();

-- ============================================================================
-- Useful view: Progress update log with project context
-- ============================================================================
CREATE OR REPLACE VIEW progress_update_log_details AS
SELECT
  pul.*,
  cp.client_name,
  cp.client_email,
  cp.client_company,
  cp.product_purchased,
  cp.project_status,
  cp.slack_channel,
  put.update_type as template_update_type,
  put.tone as template_tone
FROM progress_update_log pul
LEFT JOIN client_projects cp ON pul.client_project_id = cp.id
LEFT JOIN progress_update_templates put ON pul.template_id = put.id;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE progress_update_templates IS 'Message templates for client progress updates, keyed by update_type with optional content_type/service_type matching. Contains dual-format (email + Slack) templates with {{token}} placeholders.';
COMMENT ON TABLE progress_update_log IS 'Audit log of every progress update sent to clients. Tracks rendered content, attachments, delivery status, and trigger source.';

COMMENT ON COLUMN progress_update_templates.update_type IS 'Type of update: milestone_completed, ahead_of_schedule, on_schedule, behind_schedule, project_delivery, warranty_start';
COMMENT ON COLUMN progress_update_templates.email_subject IS 'Email subject line with {{token}} placeholders';
COMMENT ON COLUMN progress_update_templates.email_body IS 'Email body with {{token}} placeholders (plain text or markdown)';
COMMENT ON COLUMN progress_update_templates.slack_body IS 'Slack message body with {{token}} placeholders (Slack mrkdwn format, no signature)';
COMMENT ON COLUMN progress_update_templates.tone IS 'Message tone: casual (default), professional, or celebratory';

COMMENT ON COLUMN progress_update_log.attachments IS 'JSON array: [{url, filename, content_type}] of files attached to the update';
COMMENT ON COLUMN progress_update_log.custom_note IS 'Optional personal note from admin injected into the message';
COMMENT ON COLUMN progress_update_log.triggered_by IS 'Source of the trigger: admin (dashboard), slack_cmd (slash command), system (automated)';
COMMENT ON COLUMN progress_update_log.milestone_index IS 'Index of the milestone in onboarding_plans.milestones that triggered this update';
