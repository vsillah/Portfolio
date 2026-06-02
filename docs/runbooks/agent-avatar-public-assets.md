# Agent Avatar Public Assets

Agent avatar images must be publicly reachable in deployed admin surfaces. Staging deployments can be behind Vercel Deployment Protection, so static image requests to the staging host may return `401` even when the app itself is working.

The current app resolves deployed avatar URLs through `NEXT_PUBLIC_AGENT_AVATAR_ASSET_BASE_URL`. Production defaults to `https://amadutown.com`, while local development keeps same-origin paths unless the environment variable is set.

## Current Fast Path

The default public asset host is:

```text
https://amadutown.com
```

Use this path when the static assets are already deployed with the public production site.

## Blob Seed Path

Use Vercel Blob when avatar assets need a dedicated public object-storage host.

Dry run:

```bash
npm run agent-avatars:seed-blob
```

Write to the configured Blob store:

```bash
BLOB_READ_WRITE_TOKEN=... npm run agent-avatars:seed-blob -- --write
```

The script uploads files from:

```text
public/agent-avatars
```

It preserves stable pathnames such as:

```text
agent-avatars/baroque/chief-of-staff.png
```

The script uses public Blob objects, disables random suffixes, and allows overwrite so the application can keep resolving images by base URL plus pathname.

## Deployment Configuration

After a successful Blob seed, set:

```text
NEXT_PUBLIC_AGENT_AVATAR_ASSET_BASE_URL=<public Blob base URL>
```

Set it in the Vercel environments that should read from Blob. Do not change this variable for production unless the Blob URL has been verified.

## Validation

Check one representative image:

```bash
curl -I "$NEXT_PUBLIC_AGENT_AVATAR_ASSET_BASE_URL/agent-avatars/baroque/chief-of-staff.png"
```

Expected result:

```text
HTTP 200
content-type: image/png
```

Then verify avatar rendering in:

- `/admin/agents`
- `/admin/agents/standup`
- `/admin/agents/swarm-board`
- `/admin/social-content`

## Rollback

Unset `NEXT_PUBLIC_AGENT_AVATAR_ASSET_BASE_URL` to return production builds to the default `https://amadutown.com` host. Local development remains same-origin.
