# Set a password for your existing admin user (for storyboard capture)

If your admin account currently signs in only with Google, you can add email/password sign-in by sending a password recovery email. Once set, the storyboard capture pipeline can sign in **programmatically** — no browser needed.

## 1. Add the reset-password URL in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Authentication** → **URL Configuration**.
3. Under **Redirect URLs**, add (if not already there):
   - `http://localhost:3000/auth/reset-password` (for local dev)
   - `https://your-production-domain.com/auth/reset-password` (for production)
4. Save.

## 2. Request a password reset from the app

1. Start the app (e.g. `npm run dev`) and open the login page.
2. Click **Forgot password?** (or go to `/auth/forgot-password`).
3. Enter the **email address of your admin user** (the same one you use with Google).
4. Click **Send reset link**.

## 3. Set your new password from the email

1. Check that email inbox for the message from Supabase (subject is usually "Reset Your Password" or similar).
2. Click the link in the email. It will open your app at `/auth/reset-password`.
3. Enter a **new password** and **confirm**, then click **Set password**.
4. You'll be redirected to the login page.

## 4. Add credentials to `.env.local`

Add these two lines to your `.env.local` file:

```env
ADMIN_E2E_EMAIL=your-admin@example.com
ADMIN_E2E_PASSWORD=the-password-you-just-set
```

These are only used by the storyboard scripts, not by the app itself.

## 5. Run the pipeline

With the env vars set, the capture script handles authentication automatically:

```bash
npm run storyboard:assets          # schematics + screenshots
npm run storyboard:assets:all      # schematics + screenshots + video clips
```

The script calls Supabase `signInWithPassword` behind the scenes, writes a Playwright-compatible storage state file, and uses it for admin route captures. No browser login, no manual step.

You can also generate the auth state file standalone (for debugging):

```bash
npm run storyboard:assets:save-auth
```
