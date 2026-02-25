# n8n HTTP Request → Dedicated Node Swap Guide

This guide documents swapping HTTP Request nodes for **dedicated n8n nodes** where a built-in or community node exists for the target API.

> **Status: ALL COMPLETED** — Swaps applied via MCP on both local (2026-02-22) and n8n Cloud (2026-02-22).

---

## Swap Summary — Local Instance

| Workflow | ID | Nodes Replaced | Target Node | Status |
|---|---|---|---|---|
| WF-WRM-003 | `LoeEICG3zLT0UWRm` | 2 HTTP → 1 Apify | `@apify/n8n-nodes-apify.apify` | Done |
| WF-WRM-001 | `SqbKwtEaOuuDFKa0` | 1 HTTP → 1 Apify | `@apify/n8n-nodes-apify.apify` | Done |
| WF-VEP-002 | `jrnaN1yp8nSDKJB9` | 4 HTTP → 2 Apify | `@apify/n8n-nodes-apify.apify` | Done |
| WF-WRM-002 | `nTB9TpPARa95g6dJ` | 1 HTTP → 1 Google Contacts | `n8n-nodes-base.googleContacts` | Done |

## Swap Summary — n8n Cloud

| Workflow | Cloud ID | Nodes Replaced | Target Node | Status |
|---|---|---|---|---|
| WF-CLG-001 | `RnHIZzuZS46ptKG2` | 1 HTTP → Hunter core | `n8n-nodes-base.hunter` | Done |
| WF-WRM-001 | `SGGvj8MavKXYcJZL` | 3 HTTP → 3 Apify | `@apify/n8n-nodes-apify.apify` | Done |
| WF-WRM-002 | `vrf24TfBytI1yWxA` | 1 HTTP → Google Contacts | `n8n-nodes-base.googleContacts` | Done |
| WF-WRM-003 | `oMUimdg7FTFDut9i` | 2 HTTP → 2 Apify | `@apify/n8n-nodes-apify.apify` | Done |
| WF-VEP-002 | `gUyOBZOknpAt41aF` | 2 HTTP → 2 Apify | `@apify/n8n-nodes-apify.apify` | Done |
| HeyGen Cold Email | `0Iw3n5H6wb2WZQFj` | 1 HTTP → 1 Apify | `@apify/n8n-nodes-apify.apify` | Done |
| Lead Research Agent | `uxsDWErRpICMxoRM` | 2 HTTP → 2 executeWorkflow | `n8n-nodes-base.executeWorkflow` | Done |

### Not Swappable (Stripe)

| Workflow | ID (Cloud) | HTTP Request Target | Why Not Swappable |
|---|---|---|---|
| WF-001 | `FSV0KKso1CbfgEXH` | `GET /v1/checkout/sessions/{id}` | Stripe node has no checkout session resource |
| WF-000B | `OFK9EyVsMKu5IT1B` | `POST /v1/checkout/sessions` | Stripe node has no checkout session resource |

---

## Post-Swap Checklist — n8n Cloud

- [ ] **Install Apify community node** — In n8n Cloud: Settings → Community Nodes → Install `@apify/n8n-nodes-apify`. Required for all Apify node swaps.
- [ ] **Assign Apify credential** — Open each Apify workflow in the n8n Cloud editor, click each Apify node, and assign the "Apify account" credential (API token).
- [ ] **Assign Hunter credential** — Open WF-CLG-001, click "Hunter.io Domain Search", assign the Hunter.io API credential.
- [ ] **Verify Google Contacts credential** — Open WF-WRM-002, click "Fetch Google Contacts", confirm the "Google Contacts account" OAuth2 credential is selected.
- [ ] **Verify executeWorkflow targets** — Open Lead Research Agent, click both "Trigger Outreach Gen" nodes, confirm workflowId `G4A9YUNCwokMhGA8` (WF-CLG-002) is correct.
- [ ] **Re-activate workflows** — All swapped workflows are currently inactive. Toggle them to active as needed.
- [ ] **Test run** — Execute each workflow manually and confirm the dedicated nodes return data.
- [ ] **Monitor** — Check the first few automated executions for errors.

## Post-Swap Checklist — Local Instance (completed)

- [x] **Assign Apify credential** — Done.
- [x] **Verify Google Contacts credential** — Done.
- [x] **Re-activate workflows** — Done.
- [x] **Test run** — Done.
- [x] **Monitor** — Done.

---

## What Changed

### WF-WRM-003: LinkedIn Warm Lead Scraper

**Before:** Triggers → Search LI Profiles (HTTP POST to `/runs`) → Fetch Dataset Items (HTTP GET) → Normalize → POST Ingest

**After:** Triggers → Run LI Profile Search (Apify node) → Normalize → POST Ingest

- **Node:** `Run LI Profile Search (Apify)` — type `@apify/n8n-nodes-apify.apify`
- **Actor:** `harvestapi~linkedin-profile-search`
- **Operation:** Run actor and get dataset (combines run + fetch in one step)
- **Input:** searchQuery, maxItems, profileScraperMode, currentJobTitles, locations

### WF-WRM-001: Facebook Warm Lead Scraper

**Before:** Should Run? → Search FB Posts (HTTP POST to `/run-sync-get-dataset-items`) → Normalize

**After:** Should Run? → Run FB Search (Apify node) → Normalize

- **Node:** `Run FB Search (Apify)` — type `@apify/n8n-nodes-apify.apify`
- **Actor:** `alien_force~facebook-scraper-pro`
- **Input:** function, keyword, results_limit, filter_by_recent_posts, cookies

### WF-VEP-002: Social Listening Pipeline

**Before:** Set Params → Scrape Reddit (HTTP) → Fetch Reddit Dataset (HTTP) → Extract Reddit  
           Set Params → Scrape Google Maps (HTTP) → Fetch GMaps Dataset (HTTP) → Extract GMaps

**After:** Set Params → Run Reddit Scraper (Apify) → Extract Reddit  
           Set Params → Run GMaps Scraper (Apify) → Extract GMaps

- **Reddit node:** `Run Reddit Scraper (Apify)` — actor `trudax~reddit-scraper-lite`
- **GMaps node:** `Run GMaps Scraper (Apify)` — actor `compass~crawler-google-places`
- **4 HTTP nodes removed, 2 Apify nodes added** (each combines run + fetch)

### WF-WRM-002: Google Contacts Sync

**Before:** Triggers → Fetch Google Contacts (HTTP GET to `people.googleapis.com/v1/people/me/connections`) → Normalize → POST Ingest

**After:** Triggers → Fetch Google Contacts (Google Contacts node, getAll) → Normalize → POST Ingest

- **Node:** `Fetch Google Contacts` — type `n8n-nodes-base.googleContacts`
- **Operation:** getAll (with `rawData: true`, limit 200)
- **Fields:** names, emailAddresses, phoneNumbers, organizations, locations
- **Credential:** `googleContactsOAuth2Api` (existing "Google Contacts account")
- **Code update:** Normalize Contacts code updated to iterate `$input.all()` instead of `raw.connections` array, since the Google Contacts node returns individual contact items

---

## Benefits of Dedicated Nodes

- **No `$env` in URLs:** Self-hosted n8n blocks `$env` in expressions. Dedicated nodes use credentials instead.
- **Simpler flow:** Apify "Run actor and get dataset" returns items directly — no separate "Fetch Dataset" step. Google Contacts node handles pagination internally.
- **Better error handling:** Built-in retries and clearer error messages.
- **Credential rotation:** Update token/OAuth in one place (Credentials) instead of every node.
- **No hardcoded tokens:** API tokens removed from URLs and headers; managed via credential.
- **Type safety:** n8n validates node parameters at design time, catching config errors before execution.

---

---

## n8n Cloud — Additional Swaps

### WF-CLG-001: Cold Lead Sourcing (Cloud: `RnHIZzuZS46ptKG2`)

**Before:** Build Hunter Request → Hunter.io Domain Search (HTTP GET to `api.hunter.io/v2/domain-search`) → Extract People

**After:** Build Hunter Request → Hunter.io Domain Search (Hunter core node) → Extract People

- **Node:** `Hunter.io Domain Search` — type `n8n-nodes-base.hunter`
- **Operation:** domainSearch
- **Parameters:** domain (expression), limit (expression), returnAll: false
- **Credential:** `hunterApi` (assign in editor)

### HeyGen Cold Email (Cloud: `0Iw3n5H6wb2WZQFj`)

**Before:** Get Profile data (HTTP POST to `api.apify.com/v2/acts/VhxlqQXRwhW8H5hNV/run-sync-get-dataset-items`) → Code

**After:** Get Profile data (Apify node) → Code

- **Node:** `Get Profile data` — type `@apify/n8n-nodes-apify.apify`
- **Actor:** `VhxlqQXRwhW8H5hNV` (LinkedIn profile scraper)
- **Note:** The "Apollo Apify Scraper" node calls `crawlee.dev/js` (not an Apify actor) — left as HTTP Request.

### Lead Research and Qualifying Agent (Cloud: `uxsDWErRpICMxoRM`)

**Before:** Route by Score → Trigger Outreach Gen (Hot) (HTTP POST to `n8n.amadutown.com/webhook/clg-outreach-gen`) and Trigger Outreach Gen (Warm) (same HTTP POST)

**After:** Route by Score → Trigger Outreach Gen (Hot) (executeWorkflow) and Trigger Outreach Gen (Warm) (executeWorkflow)

- **Node type:** `n8n-nodes-base.executeWorkflow`
- **Target workflow:** `G4A9YUNCwokMhGA8` (WF-CLG-002: Outreach Generation)
- **Benefit:** No network hop — direct sub-workflow call within n8n Cloud
