-- ============================================================================
-- Migration: Fix RLS policies + sent_via CHECK constraint
-- Date: 2026-02-14
-- Purpose: Tighten RLS from overly permissive "authenticated" to admin-only,
--          and fix the sent_via CHECK constraint (NULL should not be in the IN list).
-- Dependencies: 2026_02_14_meeting_action_tasks.sql
-- ============================================================================

-- ============================================================================
-- 1. Fix meeting_action_tasks RLS — admin-only (matching project pattern)
-- ============================================================================

DROP POLICY IF EXISTS "Enable read for authenticated users" ON meeting_action_tasks;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON meeting_action_tasks;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON meeting_action_tasks;

CREATE POLICY "Admins can manage meeting action tasks"
  ON meeting_action_tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- 2. Fix client_update_drafts RLS — admin-only (matching project pattern)
-- ============================================================================

DROP POLICY IF EXISTS "Enable read for authenticated users" ON client_update_drafts;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON client_update_drafts;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON client_update_drafts;

CREATE POLICY "Admins can manage client update drafts"
  ON client_update_drafts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- 3. Fix sent_via CHECK constraint — NULL should not be in the IN list
--    (NULL is already allowed by the column being nullable; having NULL in
--     the IN list is a no-op that looks like a bug)
-- ============================================================================

ALTER TABLE client_update_drafts
  DROP CONSTRAINT IF EXISTS client_update_drafts_sent_via_check;

ALTER TABLE client_update_drafts
  ADD CONSTRAINT client_update_drafts_sent_via_check
  CHECK (sent_via IN ('email', 'slack'));
