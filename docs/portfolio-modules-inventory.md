# Portfolio Modules Inventory

Inventory of modules created for the portfolio that users can download or use on their own. Use this to track which modules live in-repo vs. spun off to their own repository, and to drive a user-facing “download on your own” list.

---

## 1. Template modules (client-templates)

| Module | In-repo path | Current asset URL | Spun-off repo (optional) | INSTALL |
|--------|--------------|-------------------|--------------------------|--------|
| **Chatbot Template** | `client-templates/chatbot-template/` | [Portfolio tree](https://github.com/vsillah/Portfolio/tree/main/client-templates/chatbot-template) | — | `client-templates/chatbot-template/INSTALL.md` |
| **Lead Generation Template** | `client-templates/leadgen-template/` | [Portfolio tree](https://github.com/vsillah/Portfolio/tree/main/client-templates/leadgen-template) | — | `client-templates/leadgen-template/INSTALL.md` |
| **Eval Template** | `client-templates/eval-template/` | [Portfolio tree](https://github.com/vsillah/Portfolio/tree/main/client-templates/eval-template) | — | `client-templates/eval-template/INSTALL.md` |
| **Diagnostic Template** | `client-templates/diagnostic-template/` | [Portfolio tree](https://github.com/vsillah/Portfolio/tree/main/client-templates/diagnostic-template) | — | `client-templates/diagnostic-template/INSTALL.md` |

- **Seeded as:** Template products in `products` (type `template`) via `scripts/seed-template-products.ts`.
- **User download:** After purchase, asset URL and install instructions are available via order/purchases APIs and the purchases page. For “download on their own” without purchase, you can link directly to the **Spun-off repo** (when set) or the **Current asset URL**).
- **Spun-off repo:** When you create a dedicated repo for a template, set the URL here and update `scripts/seed-template-products.ts` (and product `asset_url` if you want store to point to the new repo).

---

## 2. n8n workflow pack

| Module | In-repo path | Current asset URL | Spun-off repo (optional) | INSTALL |
|--------|--------------|-------------------|--------------------------|--------|
| **n8n Warm Lead Pack** | `n8n-exports/` | [Portfolio tree](https://github.com/vsillah/Portfolio/tree/main/n8n-exports) | — | `n8n-exports/INSTALL.md` |

- **Seeded as:** Template product “n8n Warm Lead Pack” in `products`.
- **Contents:** Facebook warm lead scraper, Google Contacts sync, LinkedIn warm lead scraper; all POST to ingest API. Ready for n8n Cloud import.
- **Spun-off repo:** If you extract to a dedicated repo, add the URL above and optionally update the seed script/product `asset_url`.

---

## 3. App prototypes (demos with optional repo/download links)

App prototypes are stored in `app_prototypes` and can have `app_repo_url` and `download_url`. These are the modules that can be “spun off” into their own repos and linked for user download.

| Prototype (title) | app_repo_url | download_url | Spun-off? |
|-------------------|--------------|--------------|-----------|
| InclusivO | https://github.com/vsillah/IncusivO | https://inclusivo-329708734708.us-west1.run.app/ | Yes (separate repo) |
| ManifestR | https://github.com/vsillah/manifestr | Google AI Studio app link | Yes (separate repo) |
| ReversR | https://github.com/vsillah/ReversR | Play Store link | Yes (separate repo) |

*(Table above is a snapshot; re-run the script below to refresh.)*

- **Source of truth:** Database table `app_prototypes`; managed in **Admin → Content → Prototypes**.
- **Public surface:** Prototypes appear on the site (e.g. `/prototypes`); `PrototypeCard` can show repo/download links when set.
- **To refresh this section:** run `npx tsx scripts/print-modules-inventory.ts` (requires Supabase env in `.env.local`).

---

## 4. Shared utilities (not standalone modules)

| Asset | Path | Notes |
|-------|------|--------|
| **shared** | `client-templates/shared/` | Common auth, Supabase, utils used by templates. Not a standalone product; copied via `copy-shared.sh` when using a template. |

---

## Summary: “Download on their own” list

For a user-facing list of modules users can download on their own (no purchase), you can include:

1. **Template modules** — Link to **Current asset URL** (Portfolio tree) or **Spun-off repo** if set.
2. **n8n Warm Lead Pack** — Same: current asset URL or spun-off repo.
3. **App prototypes** — For each prototype that has `app_repo_url` or `download_url`, show that link (and optionally mark as “spun off” when it points to a separate repo).

When a module is spun off to its own repository:

1. Create the new repo and push the module code.
2. Update this inventory: set **Spun-off repo** in the table above.
3. Optionally update `scripts/seed-template-products.ts` and product `asset_url` so the store points to the new repo.
4. For app prototypes, set `app_repo_url` (and optionally `download_url`) in Admin → Content → Prototypes.

---

## Module Sync (Admin UI)

**Admin → Configuration → Module Sync** lets you set each module’s spun-off GitHub repo URL, run a diff, and push portfolio changes to the spin-off repo via a GitHub Action. You can also discover new spin-off candidates (scan), create a GitHub repo, and add it as a custom module.

- **Config in UI:** Spun-off repo URL is stored in the database (`module_sync_config` for code-defined modules, `module_sync_custom` for custom modules) and edited on the Module Sync page. No need to edit code.
- **API:** `GET /api/admin/module-sync/modules` (list), `PATCH /api/admin/module-sync/modules/[id]` (save URL; custom modules can update name), `DELETE /api/admin/module-sync/modules/[id]` (remove custom module from list only; does not delete the GitHub repo), `GET /api/admin/module-sync/scan` (discover candidates), `POST /api/admin/module-sync/create-repo` (create GitHub repo and add custom module), `GET /api/admin/module-sync/diff?module=<id>`, `POST /api/admin/module-sync/push`. Admin-only.
- **Push to spin-off:** After running a diff, use **Push to spin-off** to trigger the GitHub Action `.github/workflows/sync-module-to-spinoff.yml`, which runs `git subtree push` from the portfolio repo to the spun-off repo. No custom blob/commit code in the app.
- **Discover spin-offs:** Use **Scan** to find portfolio paths that look like spin-off candidates. Then **Create repo & add module** to create the repo on GitHub and add it to the module list. Custom modules can be edited (name, URL) or **removed** (removes from list only; does not delete the GitHub repo). If the spun-off repo was deleted on GitHub, the diff shows "Repo not found or deleted on GitHub" and for custom modules you can **Remove from module list**.
- **Env (app):** `GITHUB_TOKEN` — must have **repo** scope (or create-repo + contents read + actions write) for diff, scan, create-repo, and push. Repos created via create-repo are created as the token owner. `GITHUB_REPO` — portfolio repo as `owner/repo`, required for push and scan.
- **Repo secret (portfolio repo):** `MODULE_SYNC_PUSH_TOKEN` — PAT with push access to the spin-off repo(s). The workflow uses it to push the subtree to the target repo.

## Standalone Verification (CI)

A GitHub Actions workflow automatically verifies that every template can `npm install && npm run build` in isolation — the same test a user would run after cloning a spin-off repo.

- **Workflow:** `.github/workflows/verify-standalone-templates.yml`
- **Triggers:**
  - **Automatic:** On push or PR to `main` when files under `client-templates/` change.
  - **Manual:** `workflow_dispatch` from the Actions tab; optionally pick a single template.
- **What it does:** For each template with a `package.json` (chatbot, leadgen, eval, diagnostic), copies it to an isolated directory, installs dependencies, and runs `npm run build`. Each template runs as a separate job so failures are isolated and clearly reported.
- **Local equivalent:** `bash scripts/verify-spinoff-standalone.sh --all` (or pass a single template path).

## Quick reference

- **Print full inventory (templates + app prototypes):** `npx tsx scripts/print-modules-inventory.ts`
- **Verify all templates build standalone:** `bash scripts/verify-spinoff-standalone.sh --all`
- **Verify one template:** `bash scripts/verify-spinoff-standalone.sh client-templates/chatbot-template`
- **Seed script for template products:** `npx tsx scripts/seed-template-products.ts`
- **Repo base used in seed:** `https://github.com/vsillah/Portfolio/tree/main`
- **Template product type in DB:** `products.type = 'template'`
- **Doc on template products:** [docs/template-products-setup.md](./template-products-setup.md)
- **Client templates overview:** [client-templates/README.md](../client-templates/README.md)
