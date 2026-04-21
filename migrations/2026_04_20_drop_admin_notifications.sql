-- Drop the unused admin_notifications table.
--
-- Original creation: migrations/2026_04_10_create_admin_notifications.sql
--
-- Rationale: the table was scaffolding for a notifications center that was
-- never built. Exactly one producer (value-evidence workflow-complete) ever
-- wrote to it, and the only UI consumer was a 2x2 amber dot in the admin
-- sidebar driven by a 30s polling hook. The Slack VEP webhook already
-- covers the same signal. Removing the table, route, hook, sidebar badge,
-- and insert call together eliminates ~200 LOC and the polling noise with
-- no user-visible regression.

DROP INDEX IF EXISTS idx_admin_notifications_unread;
DROP TABLE IF EXISTS admin_notifications;
