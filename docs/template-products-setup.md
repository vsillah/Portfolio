# Template Products Setup

## Overview

Template products (chatbot, leadgen, eval, diagnostic, n8n Warm Lead Pack) link to source assets in the repo and install guides in Supabase Storage. This doc covers the API contract and the requirement that template folders be pushed to the repo.

## API Contract: Admin vs Public

`GET /api/products/[id]` serves both admin and public callers:

| Caller | asset_url | instructions_file_path |
|--------|-----------|------------------------|
| **Admin** (verified via `verifyAdmin`) | Returned | Returned |
| **Public** (unauthenticated or non-admin) | `null` | `null` |

- **Admin use:** Edit Product form in Admin → Content → Products needs both fields to display and edit.
- **Public use:** Store product pages must not expose repo links or install guides before purchase. Those are available after purchase via order APIs and the purchases/download page.

Do not strip these fields for admin requests. See `app/api/products/[id]/route.ts` for the implementation.

## Template Folders Must Be Pushed

Asset URLs (e.g. `https://github.com/vsillah/Portfolio/tree/main/client-templates/chatbot-template`) resolve only if the folders exist on GitHub.

**Required:** Keep `client-templates/` and `n8n-exports/` tracked in git and pushed. Do not add them to `.gitignore`.

If template folders are gitignored:
1. Run `npx tsx scripts/seed-template-products.ts` — seeds DB and uploads install guides
2. Asset URLs in the product catalog will 404 when users click them

**To fix 404s:** Remove template folders from `.gitignore`, then `git add client-templates/ n8n-exports/`, commit, and push.

## Seed Script

`scripts/seed-template-products.ts`:
- Inserts/updates template product rows
- Backfills `asset_url` (repo links)
- Uploads `INSTALL.md` from each template folder to Supabase Storage and sets `instructions_file_path`

Run: `npx tsx scripts/seed-template-products.ts`
