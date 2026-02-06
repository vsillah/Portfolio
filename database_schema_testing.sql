-- ============================================================================
-- E2E Testing Framework - Database Schema
-- ============================================================================
-- Tables for tracking automated test runs, client sessions, and error remediation
-- 
-- Run this in Supabase SQL Editor to set up the testing infrastructure

-- ============================================================================
-- Test Runs Table
-- ============================================================================
-- Tracks each test suite execution

CREATE TABLE IF NOT EXISTS test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT UNIQUE NOT NULL,  -- e.g., 'e2e_2026-02-05_001'
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Configuration
  config JSONB NOT NULL DEFAULT '{}',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  
  -- Results summary
  results JSONB,
  
  -- Stats
  clients_spawned INT NOT NULL DEFAULT 0,
  clients_completed INT NOT NULL DEFAULT 0,
  clients_failed INT NOT NULL DEFAULT 0,
  
  -- Metadata
  triggered_by TEXT,  -- 'admin_ui', 'api', 'ci_cd', 'scheduled'
  environment TEXT DEFAULT 'development',  -- 'development', 'staging', 'production'
  notes TEXT
);

-- Index for querying recent runs
CREATE INDEX IF NOT EXISTS idx_test_runs_started_at ON test_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status);

-- ============================================================================
-- Test Client Sessions Table
-- ============================================================================
-- Tracks each simulated client instance within a test run

CREATE TABLE IF NOT EXISTS test_client_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,  -- Unique ID for this client instance
  
  -- Persona and scenario
  persona JSONB NOT NULL,
  scenario TEXT NOT NULL,
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  
  -- Progress tracking
  steps_completed JSONB NOT NULL DEFAULT '[]',
  current_step INT DEFAULT 0,
  
  -- Errors
  errors JSONB NOT NULL DEFAULT '[]',
  
  -- Links to created test data (for cleanup)
  created_chat_session_id TEXT,
  created_contact_id BIGINT,
  created_diagnostic_id UUID,
  created_order_id UUID,
  
  -- Additional created resources
  created_resources JSONB DEFAULT '{}',
  
  -- Screenshots and artifacts
  screenshots JSONB DEFAULT '[]',
  network_har_url TEXT
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_test_client_sessions_run ON test_client_sessions(test_run_id);
CREATE INDEX IF NOT EXISTS idx_test_client_sessions_status ON test_client_sessions(status);
CREATE INDEX IF NOT EXISTS idx_test_client_sessions_scenario ON test_client_sessions(scenario);

-- ============================================================================
-- Test Errors Table
-- ============================================================================
-- Detailed error tracking for failed steps

CREATE TABLE IF NOT EXISTS test_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_id TEXT UNIQUE NOT NULL,  -- External reference ID
  
  test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  client_session_id UUID REFERENCES test_client_sessions(id) ON DELETE CASCADE,
  
  -- Timestamps
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Error details
  error_type TEXT NOT NULL
    CHECK (error_type IN ('api_error', 'validation_error', 'timeout', 'assertion', 'exception', 'network_error')),
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  
  -- Context
  scenario TEXT NOT NULL,
  step_index INT NOT NULL,
  step_type TEXT NOT NULL,
  step_config JSONB,  -- The step configuration that was being executed
  persona JSONB,
  
  -- Request/Response
  request_data JSONB,
  response_data JSONB,
  
  -- Expected vs Actual
  expected_value JSONB,
  actual_value JSONB,
  
  -- Code context (for remediation)
  likely_source_files TEXT[],
  relevant_code_snippets JSONB,
  
  -- Artifacts
  screenshot_url TEXT,
  network_har_url TEXT,
  db_snapshot JSONB,
  
  -- Remediation status
  remediation_status TEXT DEFAULT 'pending'
    CHECK (remediation_status IN ('pending', 'in_progress', 'fixed', 'ignored', 'wont_fix')),
  remediation_request_id UUID
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_test_errors_run ON test_errors(test_run_id);
CREATE INDEX IF NOT EXISTS idx_test_errors_type ON test_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_test_errors_remediation ON test_errors(remediation_status);

-- ============================================================================
-- Remediation Requests Table
-- ============================================================================
-- Tracks AI-assisted error remediation requests

CREATE TABLE IF NOT EXISTS test_remediation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id UUID REFERENCES test_runs(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Creator
  created_by TEXT,  -- Admin user ID
  
  -- Request details
  error_ids TEXT[] NOT NULL,
  options JSONB NOT NULL DEFAULT '{}',
  additional_notes TEXT,
  priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'analyzing', 'generating_fix', 'review_required', 'applied', 'failed', 'rejected')),
  
  -- Analysis results
  analysis JSONB,
  
  -- Generated fixes
  fixes JSONB,
  
  -- Output references
  github_pr_url TEXT,
  github_pr_number INT,
  cursor_task_id TEXT,
  n8n_execution_id TEXT,
  
  -- Outcome
  outcome TEXT
    CHECK (outcome IN ('success', 'partial', 'failed', 'rejected')),
  outcome_notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_remediation_status ON test_remediation_requests(status);
CREATE INDEX IF NOT EXISTS idx_remediation_priority ON test_remediation_requests(priority);
CREATE INDEX IF NOT EXISTS idx_remediation_created ON test_remediation_requests(created_at DESC);

-- ============================================================================
-- Remediation History Table
-- ============================================================================
-- Tracks which errors have been remediated and how

CREATE TABLE IF NOT EXISTS test_error_remediation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_id TEXT NOT NULL,
  remediation_request_id UUID REFERENCES test_remediation_requests(id) ON DELETE CASCADE,
  
  -- Fix details
  file_path TEXT NOT NULL,
  original_content TEXT,
  fixed_content TEXT,
  explanation TEXT,
  
  -- Line changes
  lines_added INT DEFAULT 0,
  lines_removed INT DEFAULT 0,
  
  -- Verification
  fix_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verified_by TEXT,
  verification_test_run_id UUID REFERENCES test_runs(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up fixes by error
CREATE INDEX IF NOT EXISTS idx_remediation_history_error ON test_error_remediation_history(error_id);

-- ============================================================================
-- Views
-- ============================================================================

-- View for easy test data cleanup
CREATE OR REPLACE VIEW test_data_for_cleanup AS
SELECT 
  tcs.test_run_id,
  tr.run_id,
  tcs.client_id,
  tcs.created_chat_session_id,
  tcs.created_contact_id,
  tcs.created_diagnostic_id,
  tcs.created_order_id,
  tcs.created_resources
FROM test_client_sessions tcs
JOIN test_runs tr ON tcs.test_run_id = tr.id
WHERE tr.status IN ('completed', 'failed', 'cancelled');

-- View for test run summary statistics
CREATE OR REPLACE VIEW test_run_summary AS
SELECT 
  tr.id,
  tr.run_id,
  tr.started_at,
  tr.completed_at,
  tr.status,
  tr.clients_spawned,
  tr.clients_completed,
  tr.clients_failed,
  CASE 
    WHEN tr.clients_spawned > 0 
    THEN ROUND((tr.clients_completed::DECIMAL / tr.clients_spawned) * 100, 2)
    ELSE 0 
  END as success_rate,
  EXTRACT(EPOCH FROM (tr.completed_at - tr.started_at)) as duration_seconds,
  (SELECT COUNT(*) FROM test_errors te WHERE te.test_run_id = tr.id) as total_errors,
  (SELECT COUNT(*) FROM test_errors te WHERE te.test_run_id = tr.id AND te.remediation_status = 'fixed') as fixed_errors
FROM test_runs tr
ORDER BY tr.started_at DESC;

-- View for error analysis
CREATE OR REPLACE VIEW test_error_analysis AS
SELECT 
  te.error_type,
  te.scenario,
  te.step_type,
  COUNT(*) as occurrence_count,
  COUNT(DISTINCT te.test_run_id) as affected_runs,
  MAX(te.occurred_at) as last_occurrence,
  ARRAY_AGG(DISTINCT te.error_id ORDER BY te.error_id) as error_ids
FROM test_errors te
GROUP BY te.error_type, te.scenario, te.step_type
ORDER BY occurrence_count DESC;

-- View for pending remediations
CREATE OR REPLACE VIEW pending_remediations AS
SELECT 
  trr.id,
  trr.priority,
  trr.created_at,
  trr.status,
  ARRAY_LENGTH(trr.error_ids, 1) as error_count,
  trr.analysis->'rootCause' as root_cause,
  trr.analysis->'confidence' as confidence
FROM test_remediation_requests trr
WHERE trr.status NOT IN ('applied', 'rejected', 'failed')
ORDER BY 
  CASE trr.priority 
    WHEN 'critical' THEN 1 
    WHEN 'high' THEN 2 
    WHEN 'medium' THEN 3 
    WHEN 'low' THEN 4 
  END,
  trr.created_at ASC;

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to generate unique run ID
CREATE OR REPLACE FUNCTION generate_test_run_id()
RETURNS TEXT AS $$
DECLARE
  today_str TEXT;
  run_count INT;
BEGIN
  today_str := TO_CHAR(NOW(), 'YYYY-MM-DD');
  
  SELECT COUNT(*) + 1 INTO run_count
  FROM test_runs
  WHERE run_id LIKE 'e2e_' || today_str || '%';
  
  RETURN 'e2e_' || today_str || '_' || LPAD(run_count::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to clean up test data older than N days
CREATE OR REPLACE FUNCTION cleanup_old_test_data(days_old INT DEFAULT 7)
RETURNS TABLE(
  deleted_runs INT,
  deleted_sessions INT,
  deleted_errors INT,
  deleted_remediations INT
) AS $$
DECLARE
  v_deleted_runs INT;
  v_deleted_sessions INT;
  v_deleted_errors INT;
  v_deleted_remediations INT;
BEGIN
  -- Delete old test errors
  WITH deleted AS (
    DELETE FROM test_errors
    WHERE test_run_id IN (
      SELECT id FROM test_runs 
      WHERE started_at < NOW() - (days_old || ' days')::INTERVAL
    )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted_errors FROM deleted;
  
  -- Delete old remediation history
  WITH deleted AS (
    DELETE FROM test_error_remediation_history
    WHERE remediation_request_id IN (
      SELECT id FROM test_remediation_requests
      WHERE created_at < NOW() - (days_old || ' days')::INTERVAL
    )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted_remediations FROM deleted;
  
  -- Delete old remediation requests
  DELETE FROM test_remediation_requests
  WHERE created_at < NOW() - (days_old || ' days')::INTERVAL;
  
  -- Delete old client sessions (cascades from test_runs)
  SELECT COUNT(*) INTO v_deleted_sessions
  FROM test_client_sessions
  WHERE test_run_id IN (
    SELECT id FROM test_runs 
    WHERE started_at < NOW() - (days_old || ' days')::INTERVAL
  );
  
  -- Delete old test runs
  WITH deleted AS (
    DELETE FROM test_runs
    WHERE started_at < NOW() - (days_old || ' days')::INTERVAL
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted_runs FROM deleted;
  
  RETURN QUERY SELECT v_deleted_runs, v_deleted_sessions, v_deleted_errors, v_deleted_remediations;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_client_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_remediation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_error_remediation_history ENABLE ROW LEVEL SECURITY;

-- Admin-only policies (assumes admin check function exists)
-- Uncomment and adjust based on your auth setup:

-- CREATE POLICY "Admin can manage test_runs"
--   ON test_runs FOR ALL
--   USING (is_admin(auth.uid()));

-- CREATE POLICY "Admin can manage test_client_sessions"
--   ON test_client_sessions FOR ALL
--   USING (is_admin(auth.uid()));

-- CREATE POLICY "Admin can manage test_errors"
--   ON test_errors FOR ALL
--   USING (is_admin(auth.uid()));

-- CREATE POLICY "Admin can manage test_remediation_requests"
--   ON test_remediation_requests FOR ALL
--   USING (is_admin(auth.uid()));

-- CREATE POLICY "Admin can manage test_error_remediation_history"
--   ON test_error_remediation_history FOR ALL
--   USING (is_admin(auth.uid()));

-- For now, allow service role full access (API routes use service role)
CREATE POLICY "Service role has full access to test_runs"
  ON test_runs FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to test_client_sessions"
  ON test_client_sessions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to test_errors"
  ON test_errors FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to test_remediation_requests"
  ON test_remediation_requests FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to test_error_remediation_history"
  ON test_error_remediation_history FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- Grants
-- ============================================================================

-- Grant usage to authenticated users (for admin UI)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON test_runs TO authenticated;
GRANT SELECT ON test_client_sessions TO authenticated;
GRANT SELECT ON test_errors TO authenticated;
GRANT SELECT ON test_remediation_requests TO authenticated;
GRANT SELECT ON test_error_remediation_history TO authenticated;
GRANT SELECT ON test_data_for_cleanup TO authenticated;
GRANT SELECT ON test_run_summary TO authenticated;
GRANT SELECT ON test_error_analysis TO authenticated;
GRANT SELECT ON pending_remediations TO authenticated;
