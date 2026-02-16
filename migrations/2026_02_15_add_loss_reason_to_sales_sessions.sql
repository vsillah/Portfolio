-- Add loss_reason column to sales_sessions for tracking why deals are lost
-- This enables the funnel analytics dashboard to break down lost deals by reason.

ALTER TABLE sales_sessions ADD COLUMN IF NOT EXISTS loss_reason TEXT;

-- Add CHECK constraint for valid loss reasons
DO $$ BEGIN
  ALTER TABLE sales_sessions
  ADD CONSTRAINT sales_sessions_loss_reason_check
  CHECK (loss_reason IS NULL OR loss_reason IN (
    'price', 'timing', 'feature_gap', 'competitor',
    'no_budget', 'no_need', 'ghosted', 'other'
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
