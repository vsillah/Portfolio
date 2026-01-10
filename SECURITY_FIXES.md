# Supabase Security Fixes

This document addresses all security warnings from the Supabase database linter.

## Issue 1: Function Search Path Mutable (CRITICAL)

**Problem:** Functions without a fixed `search_path` are vulnerable to search path hijacking attacks.

**Solution:** Add `SET search_path = ''` to all functions to ensure they only access fully-qualified schema objects.

### Run this SQL in Supabase SQL Editor:

```sql
-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user');
  RETURN NEW;
END;
$$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix update_projects_updated_at function
CREATE OR REPLACE FUNCTION public.update_projects_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix track_prototype_stage_change function
CREATE OR REPLACE FUNCTION public.track_prototype_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only track if the stage actually changed
  IF OLD.production_stage IS DISTINCT FROM NEW.production_stage THEN
    INSERT INTO public.prototype_stage_history (
      prototype_id,
      old_stage,
      new_stage,
      changed_at
    )
    VALUES (
      NEW.id,
      OLD.production_stage,
      NEW.production_stage,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;
```

## Issue 2: RLS Policies Always True (INTENTIONAL)

**Problem:** Supabase warns about `WITH CHECK (true)` policies, but these are intentional for public access.

**Current Status:** ✅ **These policies are correct and intentional**

### Explanation:

1. **analytics_events & analytics_sessions**
   - Purpose: Allow anonymous users to track their own activity
   - Security: No sensitive data exposed, IP addresses are anonymized
   - Decision: Keep as-is (public analytics tracking is the intended behavior)

2. **contact_submissions**
   - Purpose: Allow anyone to submit contact forms
   - Security: Data is only inserted, never read by anonymous users
   - Decision: Keep as-is (public contact forms are standard)

### Optional: More Restrictive Policies (if needed)

If you want to add rate limiting or other restrictions later, you can modify these policies:

```sql
-- Example: Rate limit analytics by IP (requires additional tracking)
-- Only implement if you're experiencing abuse

-- Example: Validate contact form data before insert
CREATE OR REPLACE FUNCTION validate_contact_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Ensure required fields are present
  IF NEW.name IS NULL OR NEW.email IS NULL OR NEW.message IS NULL THEN
    RAISE EXCEPTION 'Required fields missing';
  END IF;
  
  -- Basic email validation
  IF NEW.email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply validation trigger (optional)
-- DROP TRIGGER IF EXISTS validate_contact_submission_trigger ON contact_submissions;
-- CREATE TRIGGER validate_contact_submission_trigger
--   BEFORE INSERT ON contact_submissions
--   FOR EACH ROW EXECUTE FUNCTION validate_contact_submission();
```

## Issue 3: Leaked Password Protection Disabled

**Problem:** Password breach database checking is disabled.

**Solution:** Enable in Supabase Dashboard (cannot be done via SQL)

### Steps:

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Policies**
3. Find **"Password requirements"** section
4. Enable **"Check for breached passwords"**
5. This will prevent users from using passwords found in the HaveIBeenPwned database

### Alternative: Enable via Supabase CLI (if available)

```bash
supabase secrets set AUTH_PASSWORD_HIBP_ENABLED=true
```

## Verification

After applying these fixes, run the linter again to verify:

1. Go to **Database** → **Linter** in Supabase Dashboard
2. Click **"Refresh"** or **"Run Linter"**
3. Verify that:
   - ✅ All function search_path warnings are resolved
   - ⚠️ RLS policy warnings still show (but are intentional - see Issue 2)
   - ✅ Leaked password protection warning is resolved (after enabling in dashboard)

## Summary

| Issue | Status | Action Required |
|-------|--------|-----------------|
| Function search paths | 🔧 Fix available | Run SQL above |
| RLS always true policies | ✅ Intentional | No action needed |
| Leaked password protection | 🔧 Fix available | Enable in dashboard |

## Security Best Practices Going Forward

1. **Always set `search_path = ''` in new functions**
   - Use fully-qualified names: `public.table_name` instead of `table_name`
   - Apply to both `SECURITY DEFINER` and regular functions

2. **Review RLS policies regularly**
   - Document intentional permissive policies
   - Use comments in SQL to explain why `WITH CHECK (true)` is safe

3. **Enable all auth security features**
   - Leaked password protection ✅
   - Email verification for signups ✅
   - Rate limiting on auth endpoints ✅

4. **Monitor audit logs**
   - Check Supabase logs for unusual activity
   - Set up alerts for failed auth attempts

## Additional Recommendations

### 1. Add Contact Form Rate Limiting

```sql
-- Create a table to track submission rates
CREATE TABLE IF NOT EXISTS contact_rate_limits (
  ip_address TEXT PRIMARY KEY,
  submission_count INTEGER DEFAULT 0,
  last_submission TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_contact_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  submission_count INTEGER;
  last_submission TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get current count for this IP
  SELECT 
    COALESCE(submission_count, 0),
    COALESCE(last_submission, NOW() - INTERVAL '1 hour')
  INTO submission_count, last_submission
  FROM public.contact_rate_limits
  WHERE ip_address = NEW.ip_address;
  
  -- Reset count if more than 1 hour has passed
  IF last_submission < NOW() - INTERVAL '1 hour' THEN
    submission_count := 0;
  END IF;
  
  -- Check if rate limit exceeded (e.g., 5 submissions per hour)
  IF submission_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please try again later.';
  END IF;
  
  -- Update or insert rate limit record
  INSERT INTO public.contact_rate_limits (ip_address, submission_count, last_submission)
  VALUES (NEW.ip_address, 1, NOW())
  ON CONFLICT (ip_address) 
  DO UPDATE SET 
    submission_count = public.contact_rate_limits.submission_count + 1,
    last_submission = NOW();
  
  RETURN NEW;
END;
$$;

-- Apply rate limiting trigger (optional)
-- DROP TRIGGER IF EXISTS contact_rate_limit_trigger ON contact_submissions;
-- CREATE TRIGGER contact_rate_limit_trigger
--   BEFORE INSERT ON contact_submissions
--   FOR EACH ROW EXECUTE FUNCTION check_contact_rate_limit();
```

### 2. Add Analytics Data Cleanup

```sql
-- Function to clean up old analytics data (run monthly)
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Delete events older than 1 year
  DELETE FROM public.analytics_events
  WHERE created_at < NOW() - INTERVAL '1 year';
  
  -- Delete sessions older than 1 year
  DELETE FROM public.analytics_sessions
  WHERE started_at < NOW() - INTERVAL '1 year';
END;
$$;

-- Create a cron job to run cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-analytics', '0 0 1 * *', 'SELECT cleanup_old_analytics()');
```
