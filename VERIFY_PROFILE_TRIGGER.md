# Verify Profile Creation Trigger

The 500 errors are happening because the user profile might not exist yet. Let's verify the trigger is working correctly.

## Step 1: Check if the trigger exists

Run this SQL in Supabase:

```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

If it returns nothing, the trigger doesn't exist. Create it with:

```sql
-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## Step 2: Manually create your profile (if it doesn't exist)

If you're already logged in but the profile doesn't exist, create it manually:

```sql
-- Replace with your actual user ID (get it from auth.users table)
-- You can find your user ID in Supabase Dashboard → Authentication → Users

-- First, find your user ID:
SELECT id, email FROM auth.users WHERE email = 'vsillah@gmail.com';

-- Then create the profile (replace USER_ID_HERE with the ID from above):
INSERT INTO user_profiles (id, email, role)
VALUES ('USER_ID_HERE', 'vsillah@gmail.com', 'user')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
```

## Step 3: Verify RLS policies are correct

Run this to check your policies:

```sql
SELECT * FROM pg_policies WHERE tablename = 'user_profiles';
```

You should see:
- "Users can view their own profile" (SELECT policy)
- "Users can update their own profile" (UPDATE policy)  
- "Admins can view all profiles" (SELECT policy)

If any are missing, run the SQL from FIX_RLS_POLICIES.md again.

## Step 4: Test

After creating your profile manually, refresh your browser. The 500 errors should stop because:
1. Your profile now exists
2. The RLS policy allows you to view your own profile
3. Future users will have profiles created automatically by the trigger
