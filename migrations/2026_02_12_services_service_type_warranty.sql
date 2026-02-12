-- ============================================================================
-- Migration: Canonical service_type check constraints (all service types)
-- Date: 2026-02-12
-- Purpose: Single source of truth for allowed services.service_type values.
--          Ensures DB check constraints match API and UI (training, speaking,
--          consulting, coaching, workshop, warranty). Fixes 23514 violation
--          when creating/updating services with type 'warranty', and keeps
--          progress_update_templates / onboarding_plan_templates in sync.
--
-- Canonical list (used in app/api/services, admin + public services UI):
--   training, speaking, consulting, coaching, workshop, warranty
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. services.service_type (NOT NULL, one of the six)
-- ----------------------------------------------------------------------------
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_service_type_check;

ALTER TABLE services ADD CONSTRAINT services_service_type_check
  CHECK (service_type IN (
    'training',
    'speaking',
    'consulting',
    'coaching',
    'workshop',
    'warranty'
  ));

-- ----------------------------------------------------------------------------
-- 2. progress_update_templates.service_type (NULL or one of the six)
--    Only run if table exists (e.g. value_evidence_pipeline / progress updates not applied).
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'progress_update_templates') THEN
    ALTER TABLE progress_update_templates DROP CONSTRAINT IF EXISTS progress_update_templates_service_type_check;
    ALTER TABLE progress_update_templates
      ADD CONSTRAINT progress_update_templates_service_type_check
      CHECK (service_type IS NULL OR service_type IN (
        'training', 'speaking', 'consulting', 'coaching', 'workshop', 'warranty'
      ));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. onboarding_plan_templates.service_type (NULL or one of the six)
--    Only run if table exists.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'onboarding_plan_templates') THEN
    ALTER TABLE onboarding_plan_templates DROP CONSTRAINT IF EXISTS onboarding_plan_templates_service_type_check;
    ALTER TABLE onboarding_plan_templates
      ADD CONSTRAINT onboarding_plan_templates_service_type_check
      CHECK (service_type IS NULL OR service_type IN (
        'training', 'speaking', 'consulting', 'coaching', 'workshop', 'warranty'
      ));
  END IF;
END $$;
