# OAuth Production Issues - Troubleshooting

If you're getting console errors with Google OAuth in production, check these:

## Common Issues

### 1. Redirect URL Mismatch

**Supabase Dashboard:**
1. Go to Authentication → URL Configuration
2. Add your production callback URL:
   - `https://your-domain.vercel.app/auth/callback`

**Google Cloud Console:**
1. Go to APIs & Services → Credentials
2. Edit your OAuth 2.0 Client ID
3. In "Authorized redirect URIs", make sure you have:
   - `https://byoriebhtbysanjhimlu.supabase.co/auth/v1/callback`
   - (This is your Supabase callback, not your site callback)

### 2. Site URL Configuration in Supabase

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Set "Site URL" to your production domain:
   - `https://your-domain.vercel.app`

### 3. Check Console Errors

Common errors and fixes:

**Error: "redirect_uri_mismatch"**
- The redirect URI in Google Cloud Console doesn't match what Supabase is sending
- Fix: Use Supabase's callback URL in Google: `https://your-project.supabase.co/auth/v1/callback`

**Error: "invalid_client"**
- Client ID or Secret is wrong in Supabase
- Fix: Double-check credentials in Supabase → Authentication → Providers → Google

**Error: No tokens found in callback**
- The callback page isn't receiving the tokens
- Fix: Check that redirect URL is correctly configured

## Quick Test

1. Go to your production login page
2. Open browser console (F12)
3. Click Google login
4. Check what errors appear
5. After redirect back, check the URL - does it have `#access_token=...` in the hash?

If the URL has tokens in the hash but they're not being read, the callback page needs fixing.
If the URL doesn't have tokens, the Supabase/Google configuration needs fixing.
