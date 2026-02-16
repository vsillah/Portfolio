# Value Evidence Pipeline — Finalize Setup

This guide walks you through finalizing the n8n workflows **WF-VEP-001** (Internal Evidence Extraction) and **WF-VEP-002** (Social Listening) so they run end-to-end with your portfolio app.

**How this guide works:** Each step says exactly *where* things happen (terminal, Supabase Dashboard, n8n, `.env`) and *what* you’re doing (e.g. “run SQL in Supabase” means copy the migration SQL and run it in Supabase’s SQL Editor—the terminal only prints the SQL, it doesn’t run it). If a step has more than one place (e.g. “run in terminal, then paste in Supabase”), that’s spelled out.

---

## Overview

| Workflow | n8n ID | Trigger | Purpose |
|----------|--------|---------|---------|
| **WF-VEP-001** | `aZEcdqbSTuu15z7R` | Webhook `POST /webhook/vep-001-extract` | Extract pain points from diagnostic audits + contact submissions → AI classify → POST to `/api/admin/value-evidence/ingest` |
| **WF-VEP-002** | `jrnaN1yp8nSDKJB9` | Webhook `POST /webhook/vep-002-social` | Scrape Reddit + Google Maps → POST raw to `/api/admin/value-evidence/ingest-market` → AI classify → POST to `/api/admin/value-evidence/ingest` |

---

## Step 1: Database

Migrations are **SQL that you run in Supabase**, not in your terminal. The terminal script only **shows** you the SQL; it does not run it against the database. You will always need to run the SQL yourself in the Supabase SQL Editor.

### 1.1 Value Evidence Pipeline migration

**What you’re doing:** Run the contents of `migrations/value_evidence_pipeline.sql` in Supabase so the new tables and seed data are created.

1. **Get the SQL** (pick one):
   - **Option A (simplest):** In your project, open `migrations/value_evidence_pipeline.sql`, select all (Cmd+A), and copy.
   - **Option B:** In a **terminal** (in your project folder), run:
     ```bash
     npx tsx scripts/run-migration.ts migrations/value_evidence_pipeline.sql
     ```
     The script will **print** the same SQL. Copy the entire SQL block from the output (from the first `--` to the last line before "MANUAL STEPS"). If you use Option B, after you run the SQL in Supabase you can go back to the terminal and press Enter to clear the prompt.

2. **Run it in Supabase:**
   - Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**.
   - Paste the SQL you copied.
   - Click **Run** (or Cmd+Enter). Fix any reported errors before continuing.

3. **Confirm:** In Supabase **Table Editor**, you should see: `pain_point_categories`, `pain_point_evidence`, `market_intelligence`, `industry_benchmarks`, `value_calculations`, `value_reports`, `content_pain_point_map`.

### 1.2 Proposal value assessment migration

**What you’re doing:** Add `value_report_id` and `value_assessment` to the existing `proposals` table.

1. **Get the SQL:** Open `migrations/proposal_value_assessment.sql`, select all, and copy. (Or run `npx tsx scripts/run-migration.ts migrations/proposal_value_assessment.sql` and copy the printed SQL.)
2. **Run it in Supabase:** SQL Editor → paste → Run.
3. **Confirm:** In Table Editor, open the `proposals` table and confirm columns `value_report_id` and `value_assessment` exist.

---

## Step 2: Next.js environment

**Where:** Your project file **`.env.local`** (and, for production, your host’s env, e.g. Vercel or Railway).  
**What you’re doing:** Adding or confirming three variables so the portfolio app can trigger the n8n workflows from the admin dashboard. The app does not call the ingest APIs directly; it only calls the n8n webhook URLs.

1. Open **`.env.local`** in your editor (project root).
2. Ensure these exist (add or edit as needed):

| Variable | Purpose |
|----------|---------|
| `N8N_INGEST_SECRET` | Shared secret for ingest endpoints (generate with `openssl rand -base64 32`) |
| `N8N_VEP001_WEBHOOK_URL` | Full webhook URL for WF-VEP-001, e.g. `https://n8n.amadutown.com/webhook/vep-001-extract` |
| `N8N_VEP002_WEBHOOK_URL` | Full webhook URL for WF-VEP-002, e.g. `https://n8n.amadutown.com/webhook/vep-002-social` |

3. **Confirm:** The webhook URLs must match the paths shown in n8n when each workflow is open (e.g. “Webhook Trigger” node shows the path). No terminal or Supabase step here—only editing and saving `.env.local`.

---

## Step 3: n8n credentials

**Where:** **n8n** (your n8n instance in the browser). Open **Settings → Credentials** (or add/select credentials when editing a node).  
**What you’re doing:** Creating credentials so the workflows can talk to Supabase, Anthropic, and (via variable) Apify. You’ll then assign each credential to the correct nodes inside the workflows.

### 3.1 Supabase (WF-VEP-001 only)

- **Where to get the key:** Supabase Dashboard → your project → **Settings → API** → copy the **service_role** key (secret).
- **Where to create the credential:** n8n → **Settings → Credentials** → Add credential → **Supabase API**.
- **What to enter:** Host = your Supabase project URL (e.g. `https://xxxx.supabase.co`); Service Role Key = the key you copied.
- **Where to assign it:** Open workflow **WF-VEP-001**. On the nodes **“Fetch Diagnostic Audits”** and **“Fetch Contact Messages”**, set the credential dropdown to this Supabase credential.

### 3.2 Anthropic (both workflows)

- **Where to get the key:** Your Anthropic account (API keys); value starts with `sk-ant-`.
- **WF-VEP-001 (AI Pain Point Classifier):** The classifier is a **native Anthropic node**. Create the credential in n8n → **Settings → Credentials** → Add credential → **Anthropic API**. Enter your API key and base URL `https://api.anthropic.com`; **Save** so n8n assigns it an ID. In the workflow, open **“AI Pain Point Classifier”** and set the credential to this **Anthropic account**.
- **WF-VEP-002 (AI Classify Social Content):** If that node uses HTTP Request with a header, use **HTTP Header Auth** (Name = e.g. `Anthropic API Key`; Header Name = `x-api-key`; Value = your key). Save, then assign it to **“AI Classify Social Content”**.
- **If you see “Found credential with no ID”:** The node is using a credential that was never saved or was corrupted. In **Settings → Credentials**, open the Anthropic credential, re-enter the key if needed, and **Save**. Then in the workflow, open **AI Pain Point Classifier**, clear the credential field and re-select your **Anthropic account** (or create a new Anthropic API credential, save it, then assign it to the node).

### 3.3 Apify (WF-VEP-002 only)

- **What you’re doing:** The Reddit and Google Maps nodes use an **n8n variable**, not a credential. You set that in Step 4 (`APIFY_API_TOKEN`). No credential to create here—just ensure Step 4 is done so the “Scrape Reddit” and “Scrape Google Maps” nodes can use `Authorization: Bearer {{ $env.APIFY_API_TOKEN }}`.

---

## Step 4: n8n environment variables

**Where:** **n8n** → **Settings → Variables** (or your n8n host’s environment configuration, if it uses env vars instead of the UI).  
**What you’re doing:** Giving n8n the secret and URLs it needs to call your portfolio’s ingest APIs and Apify. These are used inside the workflow nodes when they run.

1. In n8n, go to **Settings → Variables** (or the equivalent place your host uses for workflow variables).
2. Add or edit these three variables (names must match exactly):

| Variable | Example | Used by |
|----------|---------|--------|
| `N8N_INGEST_SECRET` | Same value as in your `.env.local` | Ingest HTTP nodes (auth) |
| `PORTFOLIO_BASE_URL` | `https://amadutown.com` | Base URL for ingest API calls |
| `APIFY_API_TOKEN` | `apify_api_...` | WF-VEP-002 Reddit + Google Maps scrapers |

3. **Critical:** Copy `N8N_INGEST_SECRET` from your `.env.local` and paste it here. It must match exactly between Next.js and n8n, or ingest requests will get 401 Unauthorized. No terminal or Supabase step—only n8n Settings.

### If you don’t have Variables (free self-hosted)

Use **Credentials** and **hardcoded URLs** instead.

1. **Apify token** — **Settings → Credentials** → Add → **HTTP Header Auth**. Name: e.g. `Apify API`. Header Name: `Authorization`. Value: `Bearer YOUR_APIFY_TOKEN`. Save. In WF-VEP-002, on **“Scrape Reddit”** and **“Scrape Google Maps”**, set **Authentication** to this credential and **remove** the manual Authorization header.
2. **Ingest secret** — **Settings → Credentials** → Add → **HTTP Header Auth**. Name: e.g. `Portfolio Ingest Secret`. Header Name: `Authorization`. Value: `Bearer YOUR_N8N_INGEST_SECRET` (from `.env.local`). Save. On **“POST to Ingest Endpoint”** (WF-VEP-001) and **“POST Raw to Market Intel”** (WF-VEP-002): set **Authentication** → **Generic Credential Type** → **Generic Auth Type**: **Header Auth** → select **Portfolio Ingest Secret**; remove manual auth headers. In **“Parse and POST Results”** (Code node), hardcode the same Bearer token in the `fetch()` call.
3. **Base URL** — In every node that uses `{{ $env.PORTFOLIO_BASE_URL }}`, replace with your real URL (e.g. `https://amadutown.com`). In the Code node’s `fetch()` URL, use the same base URL.

---

## Step 5: Fix ingest authentication in n8n

**Where:** **n8n** — inside the workflows, on the HTTP nodes that call your portfolio’s ingest APIs.  
**What you’re doing:** Your ingest APIs expect **Bearer token** in the `Authorization` header. The workflows may currently use a custom header (e.g. `x-ingest-secret`). You’re changing them so they send `Authorization: Bearer <secret>` instead. All of this is done in the n8n editor; no terminal or Supabase.

1. **WF-VEP-001**
   - Open the workflow, then open the **“POST to Ingest Endpoint”** node.
   - In **Headers:** Remove `x-ingest-secret` if it’s there.
   - Add (or set) a header: **Name** = `Authorization`, **Value** = `Bearer {{ $env.N8N_INGEST_SECRET }}`.
   - Leave `Content-Type: application/json` as is. Save the node.

2. **WF-VEP-002**
   - **“POST Raw to Market Intel” node:** Same as above: header `Authorization` = `Bearer {{ $env.N8N_INGEST_SECRET }}`; no `x-ingest-secret`. Save.
   - **“Parse and POST Results”** (Code node): This node uses `fetch()` to call the ingest API. In the code, ensure the request header is `'Authorization': 'Bearer ' + secret` (where `secret` is your n8n variable for `N8N_INGEST_SECRET`). Do not send `x-ingest-secret`. Save the node.

---

## Step 6: Fix ingest request body format

**Where:** **n8n** — inside the HTTP Request nodes that POST to your portfolio’s ingest and ingest-market APIs.  
**What you’re doing:** The API expects a specific JSON shape. You’re editing each node’s **Body / JSON body** so the payload matches (e.g. `evidence` array and `pain_point_category_name` for ingest; `items` array and `source_platform` / `content_text` for ingest-market). All edits are in the n8n node panels; no codebase or Supabase changes.

### 6.1 WF-VEP-001 — “POST to Ingest Endpoint”

- **Where:** WF-VEP-001 → **“POST to Ingest Endpoint”** node → Body / JSON body section.
- **What’s wrong (if present):** Body is a single flat object with `category`, `severity`, etc.
- **What’s required:** One JSON body per request with an **array** key `evidence` and field names as below.

```json
{
  "evidence": [
    {
      "pain_point_category_name": "<category slug>",
      "source_type": "<source_type>",
      "source_id": "<source_id>",
      "source_excerpt": "<excerpt>",
      "confidence_score": 0.5,
      "monetary_indicator": null,
      "contact_submission_id": null,
      "industry": null
    }
  ]
}
```

In that HTTP node:

- Set **Body** to JSON.
- In **JSON body**, build one object with key `evidence` and value an array of one element. Map from the previous node:
  - `pain_point_category_name` ← `$json.category`
  - `source_type` ← `$json.source_type`
  - `source_id` ← `$json.source_id`
  - `source_excerpt` ← `$json.source_excerpt`
  - `confidence_score` ← `$json.confidence_score`
  - `monetary_indicator` ← `$json.monetary_indicator`
  - `contact_submission_id` ← `$json.contact_submission_id`
  - `industry` ← `$json.industry`

So the body should be something like (syntax depends on your n8n version):

```json
{
  "evidence": [
    {
      "pain_point_category_name": "{{ $json.category }}",
      "source_type": "{{ $json.source_type }}",
      "source_id": "{{ $json.source_id }}",
      "source_excerpt": "{{ $json.source_excerpt }}",
      "confidence_score": {{ $json.confidence_score }},
      "monetary_indicator": {{ $json.monetary_indicator ?? 'null' }},
      "contact_submission_id": {{ $json.contact_submission_id ?? 'null' }},
      "industry": {{ $json.industry ? JSON.stringify($json.industry) : 'null' }}
    }
  ]
}
```

### 6.2 WF-VEP-002 — “POST Raw to Market Intel”

- **Where:** WF-VEP-002 → **“POST Raw to Market Intel”** node → Body / JSON body section.
- **What’s required:** Body must be `{ "items": [ ... ] }`. Each item must have `source_platform`, `content_text`, `content_type` (required); optionally `source_url`, `source_author`. Allowed `content_type`: `post`, `comment`, `review`, `question`, `article`, `other` (map `social_post` → `post` if needed).

In that node, send **one item per execution** in this form:

```json
{
  "items": [
    {
      "source_platform": "{{ $json.platform === 'reddit' ? 'reddit' : 'google_maps' }}",
      "content_text": "{{ $json.body }}",
      "content_type": "{{ $json.content_type === 'review' ? 'review' : 'post' }}",
      "source_url": "{{ $json.url || '' }}",
      "source_author": "{{ $json.author || '' }}"
    }
  ]
}
```

Adjust the conditional for `source_platform` / `content_type` to match the actual payload from your Extract nodes (e.g. `platform`, `content_type`).

---

## Step 7: WF-VEP-002 — “Parse and POST Results” (Code node)

**Where:** **n8n** → WF-VEP-002 → **“Parse and POST Results”** node (Code node that uses `fetch()` to call your ingest API).  
**What you’re doing:** Making sure this code sends the same URL, auth header, and body shape as the ingest endpoint expects (Step 5 and 6.1). All edits are in the Code node in n8n.

1. **URL:** Use `{{ $env.PORTFOLIO_BASE_URL }}/api/admin/value-evidence/ingest` (or the equivalent in code).
2. **Header:** Set `Authorization: Bearer <N8N_INGEST_SECRET>` (use the n8n variable; not `x-ingest-secret`).
3. **Body:** Same as Step 6.1: `{ evidence: [ { pain_point_category_name, source_type, source_id, source_excerpt, ... } ] }`. Use `pain_point_category_name` (not `category`). If the code builds the payload from the AI response, map `category` → `pain_point_category_name` and wrap the single object in `evidence: [ ... ]`.

---

## Step 8: Activate WF-VEP-002

**Where:** **n8n** — workflow list or the open workflow canvas.  
**What you’re doing:** Turning WF-VEP-002 **Active** so its webhook is registered and your app (or any client) can trigger it. No terminal or Supabase.

1. In n8n, open workflow **WF-VEP-002: Social Listening Pipeline** (or find it in the workflow list).
2. Turn the **Active** toggle to **On**. The webhook URL will then respond when called.

WF-VEP-001 is already active; no change needed there.

---

## Step 9: Trigger from the app

**Where:** **Your portfolio app in the browser** (logged in as admin), then **n8n** to confirm executions.  
**What you’re doing:** Using the admin UI to trigger the workflows so you can confirm the app → n8n link works. The app calls the webhook URLs from `.env.local`; n8n runs the workflow. No terminal or Supabase here.

1. In your app, log in as admin and go to **Value Evidence**: `/admin/value-evidence`.
2. Open the **Dashboard** tab.
3. Click **Run Internal Extraction** (this calls `N8N_VEP001_WEBHOOK_URL` → WF-VEP-001). Then click **Run Social Listening** (this calls `N8N_VEP002_WEBHOOK_URL` → WF-VEP-002).
4. **Confirm:** In n8n, open **Executions** (or the workflow’s run history). You should see new runs for each trigger. If the app shows success and n8n shows executions, the webhook and app config are correct. If ingest nodes fail with 401/400, go back to Steps 5–7.

### Webhook body for selected leads (Outreach “Push to Value Evidence”)

When the app triggers WF-VEP-001 for **selected leads** (from **Outreach → All Leads → Push to Value Evidence**), the webhook receives:

- `contact_submission_ids`: array of contact IDs to process (only these contacts are fetched).
- `enrichments` (optional): `{ [contactId]: { pain_points_freetext: "..." } }` — rep-supplied pain point text per contact for the classifier.

WF-VEP-001 should:

1. If `contact_submission_ids` is present and non-empty, fetch only those contacts (and their completed diagnostic audits) from Supabase; otherwise run a full extraction as before.
2. If `enrichments` is present, use the rep-supplied pain point text (e.g. as classifier input or pre-classified evidence) for the corresponding contact.
3. POST each evidence item to `/api/admin/value-evidence/ingest` with `contact_submission_id` set so the ingest API can update push status.

**Ingest callback:** After successfully inserting evidence rows, the ingest API updates `contact_submissions.last_vep_status` to `'success'` for each distinct `contact_submission_id` in the batch (only where status was `'pending'`). Lead cards in Outreach then show “Evidence: N” on next refresh.

---

## Step 10: Verify end-to-end

**Where:** **App (browser)** → **n8n (Executions / workflow runs)** → **App (Value Evidence pages)** → optionally **Supabase (Table Editor)**.  
**What you’re doing:** Running each workflow once and following the data path: app triggers n8n → n8n runs and calls your ingest APIs → app and Supabase show new rows. This confirms the full pipeline.

1. **WF-VEP-001**
   - **Prerequisite:** At least one completed diagnostic audit or contact submission with a message in your DB.
   - **App:** Dashboard → **Run Internal Extraction**.
   - **n8n:** Open the latest execution for WF-VEP-001. Confirm: Supabase nodes return rows → Prepare Text → AI Classifier → Parse → Filter → **POST to Ingest** (green, no 401/400).
   - **App:** Go to **Value Evidence → Pain Points** (or Dashboard). Confirm new evidence or higher counts.

2. **WF-VEP-002**
   - **App:** Dashboard → **Run Social Listening**.
   - **n8n:** Open the latest execution for WF-VEP-002. Confirm: Set params → Reddit + GMaps HTTP → Extract → Merge → Filter → **POST to ingest-market** (no 401/400) → Batch → AI Classify → **Parse and POST** to ingest (no 401/400).
   - **App:** **Value Evidence → Market Intel** and **Pain Points** — confirm new data.

3. **Optional:** In **Supabase → Table Editor**, open `pain_point_evidence` and `market_intelligence` and confirm new rows after each run.

---

## Troubleshooting

**Where:** Use this when a step fails (e.g. 401/400 in n8n, no data in the app). **What you’re doing:** Matching the symptom to the usual cause and fixing it in the place indicated (n8n headers/body, env vars, Supabase, or workflow Active toggle).

| Symptom | Check |
|--------|--------|
| 401 on ingest | `N8N_INGEST_SECRET` identical in Next.js and n8n; use header `Authorization: Bearer <secret>` (no `x-ingest-secret`). |
| 400 “evidence array is required” | Ingest body is `{ evidence: [ ... ] }` with at least one object; each has `pain_point_category_name`, `source_type`, `source_id`, `source_excerpt`. |
| 400 “items array is required” | Ingest-market body is `{ items: [ ... ] }`; each item has `source_platform`, `content_text`, `content_type`. |
| No data from WF-VEP-001 | Diagnostic audits with status `completed` and contact submissions with non-empty `message`, `quick_wins`, `full_report`, or `rep_pain_points`; Supabase credential has service role. When using “Push to Value Evidence” from Outreach, the webhook body must include `contact_submission_ids`; the workflow should fetch only those contacts. |
| Apify errors in WF-VEP-002 | `APIFY_API_TOKEN` set in n8n; actor names/inputs correct (e.g. `trudax~reddit-scraper-lite`, `compass~crawler-google-places`). |
| Webhook 404 | Workflow is **Active**; URL path matches (e.g. `/webhook/vep-001-extract`, `/webhook/vep-002-social`). |
| **Extraction stuck ("Extracting..." / "Push may have failed")** | See **Why extraction stays stuck** below. |
| **Classifier returns "Found credential with no ID"** | AI Pain Point Classifier uses a credential with no ID. In n8n → Settings → Credentials, re-save your **Anthropic API** credential (or create a new one), then in the workflow re-select **Anthropic account** on the **AI Pain Point Classifier** node. |

### Why extraction stays stuck

When you click **Push to Value Evidence** (or Retry), the app sets the lead’s status to `pending`, calls the WF-VEP-001 webhook, then waits for the n8n workflow to POST evidence to `/api/admin/value-evidence/ingest`. The UI only moves to **Evidence: N** or **Push failed** when ingest runs or you cancel. If it stays on "Extracting..." for many minutes, the pipeline is breaking somewhere after the app triggers n8n.

**Chain:** App (extract-leads) → **n8n webhook** → WF-VEP-001 runs → fetches contact/diagnostic data → AI classifier → **POST to Ingest** → App (ingest) sets `last_vep_status = success`.

**Check in this order:**

1. **Webhook reachable**  
   In `.env.local`, `N8N_VEP001_WEBHOOK_URL` must be the full URL (e.g. `https://n8n.amadutown.com/webhook/vep-001-extract`). From the same machine that runs Next.js, `curl -X POST "$N8N_VEP001_WEBHOOK_URL" -H "Content-Type: application/json" -d '{"contact_submission_ids":[YOUR_LEAD_ID]}'` should return 200 (or n8n’s normal webhook response), not connection/timeout errors.

2. **Workflow is Active**  
   In n8n, WF-VEP-001 must be **Active**. If it’s off, the webhook returns 404 and the app never gets a failure; the run simply never starts.

3. **Webhook body when pushing one lead**  
   The app sends `contact_submission_ids: [id]` (and optional `enrichments`). The workflow must use this to limit which contacts it fetches. If it ignores the body and runs a “full” extraction with different filters, it might not process that contact or might not include `contact_submission_id` in the evidence it sends to ingest.

4. **n8n execution runs and succeeds**  
   In n8n → **Executions**, trigger a push for one lead, then open the latest WF-VEP-001 run. Confirm: no red nodes; the **POST to Ingest** (or equivalent) node runs and returns 200. If it errors (401, 400, 500), fix auth/body per the table above.

5. **Ingest receives evidence with `contact_submission_id`**  
   The ingest API only sets `last_vep_status = success` for contacts that appear in the **evidence** payload (each item can have `contact_submission_id`). If the workflow POSTs evidence without `contact_submission_id`, or with a different ID, the lead you pushed will stay `pending`. In the workflow, ensure the body to ingest is `{ evidence: [ { ..., contact_submission_id: <id> } ] }` for the contact(s) you triggered.

6. **Same secret for ingest**  
   n8n must call the ingest endpoint with `Authorization: Bearer <N8N_INGEST_SECRET>` and that value must match `N8N_INGEST_SECRET` in the app’s env. Mismatch → 401 → ingest never runs → status stays `pending`.

**Quick test:** From **Value Evidence → Dashboard**, click **Run Internal Extraction** (no lead filter). If that run appears in n8n and completes and new evidence shows in Pain Points, the workflow and ingest are fine; the issue is likely step 3 or 5 (body/contact_submission_ids) when pushing a single lead from Outreach.

---

## (Optional) Workflow progress callbacks

**Where:** n8n workflows → add HTTP Request nodes that call your app.  
**What you're doing:** Enabling the progress bar and "last run" display in the Value Evidence Dashboard. The app records when you trigger a workflow and, if n8n calls these endpoints, shows stage completion and last run date/time.

1. **Apply the migration** — Run `migrations/2026_02_15_value_evidence_workflow_runs.sql` in Supabase SQL Editor. This creates the `value_evidence_workflow_runs` table.

2. **Trigger passes `run_id`** — When you click "Run Social Listening" or "Run Internal Extraction", the app inserts a row and includes `run_id` in the webhook body. Your n8n workflow receives this in `$json.run_id`.

3. **Report stage progress** — Add an HTTP Request node after each scraper/step in WF-VEP-002 (e.g. after Reddit scrape, after G2 scrape). POST to:
   ```
   {{ $env.PORTFOLIO_BASE_URL }}/api/admin/value-evidence/workflow-progress
   ```
   Body: `{ "run_id": "{{ $json.run_id }}", "workflow_id": "vep002", "stage": "reddit", "status": "complete", "items_count": 5 }`
   Headers: `Authorization: Bearer {{ $env.N8N_INGEST_SECRET }}`

4. **Report completion** — At the end of the workflow, add an HTTP Request node. POST to:
   ```
   {{ $env.PORTFOLIO_BASE_URL }}/api/admin/value-evidence/workflow-complete
   ```
   Body: `{ "run_id": "{{ $json.run_id }}", "workflow_id": "vep002", "status": "success", "items_inserted": 12 }`
   Headers: `Authorization: Bearer {{ $env.N8N_INGEST_SECRET }}`

   On error paths, use `"status": "failed"` and `"error_message": "..."`.

**Without callbacks:** The Dashboard still shows "Last triggered" and inferred stages from `market_intelligence` (count per platform, last scraped) for Social Listening.

---

## Summary checklist

**Where:** Use this after you’ve done the steps to confirm nothing was skipped. Each item maps to a place (Supabase, `.env.local`, n8n credentials, n8n variables, n8n nodes, n8n workflow toggle, app UI).

- [ ] Value Evidence + proposal value assessment + value_evidence_workflow_runs migrations applied; tables present in Supabase.
- [ ] `.env.local` has `N8N_INGEST_SECRET`, `N8N_VEP001_WEBHOOK_URL`, `N8N_VEP002_WEBHOOK_URL`.
- [ ] n8n: Supabase credential on both Supabase nodes (WF-VEP-001).
- [ ] n8n: Anthropic API credential (“Anthropic account”) on **AI Pain Point Classifier** (WF-VEP-001); HTTP Header Auth or native credential on **AI Classify Social Content** (WF-VEP-002) as configured.
- [ ] n8n: Variables `N8N_INGEST_SECRET`, `PORTFOLIO_BASE_URL`, `APIFY_API_TOKEN` set.
- [ ] n8n: Ingest nodes use **Authorization: Bearer** (no `x-ingest-secret`).
- [ ] n8n: Ingest body is `{ evidence: [ { pain_point_category_name, ... } ] }` (WF-VEP-001 and WF-VEP-002 Parse and POST).
- [ ] n8n: Ingest-market body is `{ items: [ { source_platform, content_text, content_type, ... } ] }`.
- [ ] WF-VEP-002 is **Active**.
- [ ] Tested “Run Internal Extraction” and “Run Social Listening” from `/admin/value-evidence`; new evidence visible in Pain Points / Market Intel.

After these steps, the Value Evidence Pipeline is fully set up and ready to use.
