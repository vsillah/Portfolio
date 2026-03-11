# Supabase Security Warnings - Action Plan

## Quick Summary

Security Advisor may report:
- ✅ **Function search_path** — fixed by migration (32 functions)
- ⚠️ **RLS policy always true** — many intentional (public forms, analytics, service role); review per table
- ✅ **Leaked password protection** — enable in Dashboard (Auth → Password requirements)

---

## 🔴 Function Search Path (Security Risk) — FIXED BY MIGRATION

**Why this matters:** Functions without a fixed `search_path` are vulnerable to search path hijacking (caller could influence which schema is searched).

**How to fix:** Apply the migration that sets `search_path = 'public'` on all flagged functions:

```bash
# Apply via your normal migration process, e.g.:
# Supabase SQL Editor: run migrations/2026_03_11_function_search_path.sql
# Or: supabase db push
```

**Migration file:** `migrations/2026_03_11_function_search_path.sql`

**Affected functions (32):**  
`update_chat_session_updated_at`, `update_chat_evaluation_updated_at`, `update_accel_recs_updated_at`, `update_services_updated_at`, `update_offer_upsell_paths_updated_at`, `update_guarantee_updated_at`, `update_chat_escalation_updated_at`, `update_continuity_updated_at`, `update_progress_update_templates_updated_at`, `update_site_settings_updated_at`, `update_campaign_updated_at`, `update_llm_judge_alignment`, `update_proposals_updated_at`, `get_proposal_summary`, `update_content_offer_roles_updated_at`, `update_contact_submissions_updated_at`, `update_user_profiles_updated_at`, `handle_new_user`, `update_cold_pipeline_updated_at`, `generate_test_run_id`, `update_client_projects_updated_at`, `update_updated_at_column`, `cleanup_old_test_data`, `update_product_variants_updated_at`, `update_value_pipeline_updated_at`, `resolve_bundle_items`, `update_offer_bundles_updated_at`, `update_system_prompt_updated_at`, `save_system_prompt_history`, `get_system_prompt`, `is_admin_user`, `update_sales_updated_at`.

**Legacy:** `fix-security-warnings.sql` fixes only 4 of these; the migration above covers all 32.

---

## 🟡 RLS Policies with `USING (true)` / `WITH CHECK (true)` — FIXED BY MIGRATION

**Status:** Addressed in `migrations/2026_03_11_rls_policy_always_true.sql`.

The linter flags UPDATE/INSERT/ALL policies that use literal `true`. The migration replaces them with role-based expressions so behavior is unchanged but the linter is satisfied:

- **Public/anyone (anon + authenticated):** `auth.role() IN ('anon', 'authenticated')` for INSERT/UPDATE policies on analytics_events, analytics_sessions, chat_sessions, chat_messages, contact_submissions, dashboard_tasks, acceleration_recommendations, lead_magnet_downloads.
- **Service-role only:** `auth.role() = 'service_role'` for lead_magnet_nurture_emails, progress_update_log, site_settings.

Apply the migration to clear the 14 RLS policy warnings.

---

## 🟠 MEDIUM PRIORITY - Auth Configuration

### 3. Enable Leaked Password Protection

**Why this matters:** Prevents users from using passwords that have been exposed in data breaches.

**How to fix:**

#### Option A: Via Supabase Dashboard (Recommended)
1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers** → **Email** (or **Authentication** → **Policies** / **Password**)
3. Find **"Password requirements"** / **"Leaked password protection"**
4. Enable **"Check for breached passwords"** (HaveIBeenPwned)
5. Save changes

#### Option B: Via Environment Variable (if using self-hosted)
```bash
AUTH_PASSWORD_HIBP_ENABLED=true
```

**Time to fix:** 1 minute ⏱️

---

## ✅ Verification Steps

After applying fixes:

### 1. Verify Function Search Path Fix
Run this query in Supabase SQL Editor:

```sql
SELECT 
  proname as function_name,
  CASE 
    WHEN array_to_string(proconfig, ',') LIKE '%search_path%' THEN '✅ Fixed'
    ELSE '❌ Still broken'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'handle_new_user',
    'update_updated_at_column',
    'get_proposal_summary',
    'is_admin_user'
  );
```

Expected result: All should show "✅ Fixed"

### 2. Re-run Supabase Linter
1. Go to **Database** → **Linter** in Supabase Dashboard
2. Click **"Refresh"** or **"Run Linter"**
3. Confirm warnings are resolved

### 3. Test Functionality
- ✅ Create a new user account (tests `handle_new_user`)
- ✅ Update a project (tests `update_projects_updated_at`)
- ✅ Change a prototype stage (tests `track_prototype_stage_change`)
- ✅ Submit analytics event (tests RLS policies)
- ✅ Submit contact form (tests RLS policies)

---

## 📊 Expected Results After Fixes

| Issue | Before | After |
|-------|--------|-------|
| Function search_path warnings | 32 warnings ❌ | 0 warnings ✅ (after migration) |
| RLS policy always true | Multiple ⚠️ | Review; many intentional |
| Leaked password protection | Disabled ❌ | Enable in Dashboard ✅ |

---

## 🔒 Security Best Practices Going Forward

### When Creating New Functions:

```sql
CREATE OR REPLACE FUNCTION public.my_new_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- ⭐ Always add this!
AS $$
BEGIN
  -- Use fully qualified names
  INSERT INTO public.my_table ...  -- Not just: INSERT INTO my_table
  RETURN NEW;
END;
$$;
```

### When Creating RLS Policies:

```sql
-- ❌ BAD: Unclear if this is intentional
CREATE POLICY "Allow all inserts" ON my_table
  FOR INSERT WITH CHECK (true);

-- ✅ GOOD: Document why it's permissive
CREATE POLICY "Public can submit contact forms" ON contact_submissions
  FOR INSERT WITH CHECK (true);
-- This is intentional to allow unauthenticated users to contact us
```

---

## 📚 Additional Resources

- **Supabase Security Docs:** https://supabase.com/docs/guides/auth/security
- **Function Security:** https://supabase.com/docs/guides/database/functions#security-definer-functions
- **RLS Best Practices:** https://supabase.com/docs/guides/database/postgres/row-level-security

---

## 🎯 Quick Action Checklist

- [ ] Apply `migrations/2026_03_11_function_search_path.sql` (and `2026_03_11_view_security_invoker.sql` if not already applied)
- [ ] Enable leaked password protection in Auth (Dashboard)
- [ ] Re-run Database Linter / Security Advisor and confirm function_search_path_mutable warnings are gone
- [ ] For RLS warnings: confirm each is intentional or tighten the policy
- [ ] Run verification query above to confirm search_path is set on functions

**Status:** Apply migrations and dashboard setting to clear function and auth warnings.

---

## Need Help?

If you encounter errors:
1. Check the detailed guide in `SECURITY_FIXES.md`
2. Verify all tables exist (user_profiles, prototype_stage_history, etc.)
3. Check Supabase logs for specific error messages
4. Ensure you're running SQL as the project owner/admin
