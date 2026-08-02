# Admin Validation Auth

Portfolio admin QA should not depend on Vambah repeatedly logging in through a shared browser tab.

This runbook separates three concerns:

- **Application auth flow:** Portfolio stores the requested path locally and asks Supabase OAuth to return to the current origin at `/auth/callback`.
- **Provider allow-list:** Supabase Auth must allow each origin that will receive OAuth callbacks.
- **Agent validation session:** Playwright and captain QA can reuse a local, gitignored storage-state file generated from an approved admin validation account.

## Current failure mode

When a Vercel preview login starts from:

```text
https://portfolio-git-*-vsillahs-projects.vercel.app/auth/login?redirect=/admin/...
```

Portfolio sends Supabase a preview-origin callback:

```text
https://portfolio-git-*-vsillahs-projects.vercel.app/auth/callback
```

If that callback is not in Supabase Auth's redirect allow-list, the OAuth round trip can fall back to the production site URL. The symptom is that Google sign-in succeeds but lands at:

```text
https://amadutown.com/#
```

instead of the preview deployment.

## Required Supabase Auth URLs

In Supabase Dashboard, open the active project, then:

```text
Authentication -> URL Configuration
```

Keep the production Site URL:

```text
https://amadutown.com
```

Add redirect URLs for every environment used for admin validation:

```text
https://amadutown.com/auth/callback
https://portfolio-staging-vsillahs-projects.vercel.app/**
https://*-vsillahs-projects.vercel.app/**
http://localhost:3000/**
http://localhost:3093/**
```

If another stable local port is used, add that exact origin with `/**` too.
Use exact callback URLs for production and wildcard URLs only for local or
preview environments.

Production Supabase URL changes are production settings. Apply them only through an explicit approval gate and record the resulting provider configuration evidence.

## Reusable admin validation session

Use an approved admin validation account with email/password enabled in Supabase Auth and stored in the normal credential source of truth. Do not commit the password or generated session file.

Do not depend on a shared human browser session or a specific password-manager extension for routine validation. If Chrome does not have the 1Password extension mounted in the active profile, agents should stop at the human login gate instead of hunting through 1Password or attempting to handle secrets manually.

Required local env, from 1Password or another approved secret source:

```bash
ADMIN_E2E_EMAIL=...
ADMIN_E2E_PASSWORD=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Generate a Playwright storage state for local validation:

```bash
npm run admin:auth:save
```

Generate one for a Vercel preview:

```bash
PLAYWRIGHT_BASE_URL=https://portfolio-git-example-vsillahs-projects.vercel.app npm run admin:auth:save
```

Run E2E against a preview without launching localhost:

```bash
PLAYWRIGHT_BASE_URL=https://portfolio-git-example-vsillahs-projects.vercel.app npm run test:e2e
```

By default, the session file is written to:

```text
.auth/portfolio-admin-storage-state.json
```

`.auth/` is gitignored because it contains live session tokens.

## Validation policy

- Use OAuth only for human browser checks and OAuth-specific regression checks.
- Use the generated admin storage state for repeated rendered captain QA.
- Keep publishing, scheduling, external-send, credential, and production-setting changes behind their existing human approval gates.
- If the generated session fails with `Loading profile...`, verify that the validation user has a matching `user_profiles` row with `role = admin` in the target Supabase project.
