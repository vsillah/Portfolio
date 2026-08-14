-- Replace the blanket fail-closed external submission check with a governed
-- per-provider gate. This migration does not enable any provider row.

ALTER TABLE public.social_comment_provider_capabilities
  DROP CONSTRAINT IF EXISTS social_comment_provider_capabilities_external_submission_off;

ALTER TABLE public.social_comment_provider_capabilities
  ADD CONSTRAINT social_comment_provider_capabilities_external_submission_governed
  CHECK (
    external_submission_enabled = false
    OR (
      capability_status = 'verified'
      AND supports_reply_submission = true
    )
  );
