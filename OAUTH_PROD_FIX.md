# OAuth Production Fix

## Changes Made

1. **Updated callback handler** (`app/auth/callback/page.tsx`):
   - Removed console.logs that could cause issues
   - Changed from `router.push()` to `window.location.href` for redirects (ensures full page reload in production)
   - Added a small delay after setting session to ensure it's stored before redirecting
   - Simplified error handling

## Important: Verify Supabase Redirect URLs

The redirect URL in Supabase must **exactly match** your production URL. Make sure you have:

### In Supabase Dashboard:
1. Go to **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, ensure you have:
   - `https://YOUR-DOMAIN.vercel.app/auth/callback`
   - (Replace `YOUR-DOMAIN` with your actual Vercel domain)

### In Google OAuth Console:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, ensure you have:
   - `https://YOUR-SUPABASE-PROJECT.supabase.co/auth/v1/callback`
   - (This is the Supabase callback URL, not your site URL)

### Common Issues:

1. **404 errors for static assets**:
   - These might be from a corrupted build or caching issue
   - Try: Clear browser cache or hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)
   - If persistent: Redeploy on Vercel

2. **OAuth still not working**:
   - Verify the redirect URL in Supabase matches your production domain exactly (including `https://` and no trailing slash)
   - Check browser console for specific error messages
   - Verify Google OAuth client ID and secret are correctly set in Supabase

3. **"Unsupported provider" error**:
   - Ensure OAuth provider is enabled in Supabase Dashboard → Authentication → Providers

## Testing

After deployment:
1. Try logging in with Google OAuth
2. Check browser console for any errors
3. Verify session is established (check if user menu appears)
