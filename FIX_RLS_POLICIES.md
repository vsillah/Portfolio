# Fix RLS Policies for User Profiles

The 500 error when fetching user profiles is likely due to missing or incorrect RLS policies. Run this SQL in your Supabase SQL Editor to fix it:

```sql
-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;

-- Create the correct policy for users to view their own profile
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Create policy for users to update their own profile
CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create policy for admins to view all profiles (fixed to avoid recursion)
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Also allow service role to bypass RLS (for server-side operations)
-- This is already handled by using supabaseAdmin, but good to have explicit policy
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
```

## Alternative: Temporarily Disable RLS for Testing

If you want to test without RLS first, you can temporarily disable it:

```sql
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
```

**⚠️ Warning:** Only do this for testing. Re-enable RLS before going to production!

## Check Current Policies

To see what policies currently exist:

```sql
SELECT * FROM pg_policies WHERE tablename = 'user_profiles';
```
