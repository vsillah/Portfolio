# Templatize Portfolio & n8n Offerings — Implementation Addendum

This addendum captures the agreed implementation scope (including install-instructions attachment) for templatizing portfolio and n8n offerings and surfacing them in the content section.

---

## 1. Deliverables summary

- **Create/extract template assets** (with manifests) and **seed template offerings as products** in the content section.
- Each template product has: **title**, **description**, **attachment to the asset** (URL and/or file), and a **downloadable install-instructions attachment**.

---

## 2. Schema and content model

### 2.1 Products table (templates)

- **Extend `products.type`**: add `'template'` to the CHECK constraint (migration).
- **New columns** (migration), for template-type products only:
  - `asset_url` TEXT — optional; link to repo, n8n JSON location, or external asset.
  - `instructions_file_path` TEXT — optional; path in Supabase Storage to a **downloadable install/setup guide** (e.g. PDF or markdown) for that template.
- **Existing**: `file_path` continues to hold an optional template zip (or other main file) in storage; `description` for catalog copy.

So each template product can have:
- **Description** (catalog copy)
- **Asset link**: `asset_url` (e.g. GitHub, n8n export path)
- **Template file**: `file_path` (optional zip/package in storage)
- **Install instructions**: `instructions_file_path` (downloadable setup guide in storage)

### 2.2 Admin products UI

- When `type === 'template'`:
  - Show **Asset URL** (optional).
  - Show **Instructions file**: upload or set path for the install guide; expose a "Download instructions" link when present.
  - Keep existing **File** upload for template zip (if used).
- Product types dropdown: add "Template" (value `template`).

### 2.3 Downloads

- **Public or gated download** for the install guide: reuse existing download pattern (e.g. `/api/downloads/[productId]` or a dedicated route) so that when the product is a template and `instructions_file_path` is set, that file is served as the "Setup guide" / "Install instructions" download.

---

## 3. Template assets to create or tag

| Asset | Action | Install instructions |
|-------|--------|----------------------|
| **client-templates/chatbot-template** | Add manifest (template_content_type, use_case, dependencies) | Create install guide (e.g. INSTALL.md or PDF), upload to storage, set `instructions_file_path` on product |
| **client-templates/leadgen-template** | Add manifest | Create install guide, upload, link |
| **client-templates/eval-template** | Add manifest | Create install guide, upload, link |
| **client-templates/diagnostic-template** | **Extract/create** new app template | Create install guide, upload, link |
| **n8n-exports** (WF-WRM-001/002/003) | Add manifest (n8n_workflow_pack, use_case: outreach) | Create install guide (env + import steps), upload, link |
| **Optional: schema_seed** (onboarding + progress) | Create SQL + API doc artifact | Create install guide, upload, link |

Each install guide should cover (as appropriate): prerequisites, env vars, DB setup, n8n import steps, app deploy steps, and link to the asset (repo or file).

---

## 4. Seed: template products in content section

Seed script (or migration + seed) inserts **product** rows with `type = 'template'` for:

1. **Chatbot template** — title, description, asset_url (repo path), instructions_file_path (after upload).
2. **Leadgen template** — same.
3. **Eval template** — same.
4. **Diagnostic template** — same (once created).
5. **n8n Warm Lead Pack** — title, description, asset_url (e.g. repo path to n8n-exports), instructions_file_path (install guide for the three workflows).
6. (Optional) **Schema/onboarding seed** — same if that artifact is created.

Seed should run only if no template products exist (or by idempotent slug/identifier) so it’s safe to re-run. Instructions files can be added to storage in a separate step (or seed references placeholder paths to be filled after upload).

---

## 5. Checklist (implementation order)

- [x] **Migration**: add `template` to `products.type` CHECK; add `asset_url`, `instructions_file_path` to `products`.
- [x] **Migration file on disk**: `migrations/2026_02_17_products_template_type_and_attachments.sql`.
- [x] **Admin products UI**: support type `template`, Asset URL, Instructions file upload/path, and optional template file; add "Template" to type dropdown.
- [x] **Download route**: `GET /api/products/[id]/instructions` returns signed URL for install guide (template products only).
- [x] **Manifests**: added to client-templates (chatbot, leadgen, eval, diagnostic) and n8n-exports (`template.json` / `manifest.json`).
- [x] **Install guides**: `INSTALL.md` created per template (client-templates/*/INSTALL.md, n8n-exports/INSTALL.md).
- [x] **Seed script**: `scripts/seed-template-products.ts` inserts five template product rows (idempotent).
- [ ] **Verification**: run migration, run seed, then in Admin → Content → Products upload install instructions for each template and set asset_url as needed.

---

## 6. Summary

- **Yes**: create the actual template components (including diagnostic + optional schema seed) and add manifests.
- **Yes**: create content (product records) and seed them into the content section with descriptions and attachments to the assets.
- **Yes**: each template offering has a **downloadable attachment with install instructions** (via `instructions_file_path` and the download route).
