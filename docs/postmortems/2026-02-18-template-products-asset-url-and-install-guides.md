# Postmortem: Template Product Asset URLs & Install Guides (2026-02-18)

## Summary

Three related issues with template products: (1) **Asset URL empty in admin** — Edit Product form showed empty Asset URL field despite seeded values in the DB. Root cause: `GET /api/products/[id]` always stripped `asset_url` and `instructions_file_path` from the response (intended for public users) but did so for admin requests too. (2) **Install instructions** — Extended the seed script to upload INSTALL.md from each template folder to Supabase Storage and set `instructions_file_path`. (3) **Asset URL 404 on GitHub** — Links like `client-templates/chatbot-template` returned 404. Root cause: `client-templates/` was in `.gitignore`, so the folder was never committed or pushed.

## What went well

- **Correct diagnosis** — Code inspection quickly identified the API stripping sensitive fields for all callers instead of only public ones.
- **Targeted fix** — Admin check added: when `verifyAdmin` succeeds, return full product including `asset_url` and `instructions_file_path`; otherwise retain the strip-for-public behavior.
- **Seed script extension** — Added `INSTALL_PATHS` mapping and backfill step to upload local INSTALL.md files to Supabase Storage; idempotent (only backfills when `instructions_file_path` is null).
- **Gitignore fix** — Removed `client-templates/` from `.gitignore` so the folder can be pushed and asset URLs work on GitHub.

## What could improve (addressed)

- **Shared API for admin vs public** — Addressed — The products API uses one route for both admin edit (needs `asset_url`, `instructions_file_path`) and public product view (must hide them). The strip logic assumed all callers were public. A clearer contract (e.g. “admin gets full, public gets sanitized”) or a separate admin endpoint could reduce future confusion.
- **Seed script not applied to remote** — Addressed: (1) "Important" note in seed script header; (2) `docs/template-products-setup.md` explains that template folders must be pushed and must not be gitignored.

## Action items

| Priority | Action | Owner |
|----------|--------|-------|
| Done | Add admin check to `GET /api/products/[id]` so admins receive full product including `asset_url` and `instructions_file_path`. | — |
| Done | Extend `scripts/seed-template-products.ts` to upload INSTALL.md from template folders to Supabase Storage and backfill `instructions_file_path`. | — |
| Done | Remove `client-templates/` from `.gitignore`. | — |
| User | Add, commit, and push `client-templates/` so asset URLs resolve on GitHub. | User |

## References

- Products API: `app/api/products/[id]/route.ts`
- Admin product edit page: `app/admin/content/products/[id]/page.tsx`
- Seed script: `scripts/seed-template-products.ts`
- Template products setup: `docs/template-products-setup.md`
- Storage upload path format: `product-{id}/instructions/install.md` in bucket `products`
- Template folders: `client-templates/*/INSTALL.md`, `n8n-exports/INSTALL.md`
- Rules: post-implementation-handoff, no-expose-errors-to-users
