# Plan: Limit API Calls Across All Workflows

**Implementation status (WF-WRM-001):** App endpoints and n8n gate are in place. GET `/api/admin/outreach/last-run`, POST `/api/admin/outreach/run-complete`, trigger-route 24h skip, and ingest audit update are implemented. WF-WRM-001 has been updated in n8n with Check Last Run → Should Run? → (true) Apify/Ingest/Run Complete, (false) Skip No Op. Remove any external cron or service that was calling the Wake webhook every ~10 minutes so only one run-on-wake or schedule triggers the workflow.

---

Extend API-call limiting to all n8n workflows that use external APIs. **Remove redundant 10-minute webhook runs**; keep a single run-on-wake (or schedule) per workflow. Enforce **one external API call per 24 hours** by checking the database for the last successful run and **skipping without errors** when within the 24-hour window.

---

## 1. Inventory: Workflows That Use External APIs

| Workflow | n8n ID | External APIs | Triggers | App trigger |
|----------|--------|---------------|----------|-------------|
| WF-WRM-001 Facebook | `SqbKwtEaOuuDFKa0` | Apify (facebook-scraper-pro) | Webhook, Weekly Schedule, **Webhook Wake** | `N8N_WRM001_WEBHOOK_URL` |
| WF-WRM-002 Google Contacts | `nTB9TpPARa95g6dJ` | Google People/Contacts | Webhook, Daily Schedule, **Webhook Wake** | `N8N_WRM002_WEBHOOK_URL` |
| WF-WRM-003 LinkedIn | `LoeEICG3zLT0UWRm` | Apify (LinkedIn actors) | Webhook, Weekly Schedule, **Webhook Wake** | `N8N_WRM003_WEBHOOK_URL` |
| WF-CLG-001 Cold Lead | `ItrvKM7BLuvcgJ7a` | Hunter.io, Trigger Enrichment (HTTP) | Schedule, **Webhook Wake** | — |
| WF-VEP-001 Evidence Extraction | `aZEcdqbSTuu15z7R` | AI classifier (HTTP) | Webhook | `N8N_VEP001_WEBHOOK_URL` |
| WF-VEP-002 Social Listening | `jrnaN1yp8nSDKJB9` | Apify (Reddit, GMaps), AI | Webhook | `N8N_VEP002_WEBHOOK_URL` |
| Lead Research Agent | `LZn83NWY2FIgABUl` | OpenRouter, RAG HTTP | Webhook (per lead) | `N8N_LEAD_WEBHOOK_URL` |

---

## 2. Cross-Cutting Strategies

### 2.1 Trigger strategy: remove 10-minute webhook runs, keep run-on-wake

- **Remove** the redundant 10-minute webhook runs (the trigger or external caller that was invoking the workflow every ~10 minutes). With only one API call per 24 hours, frequent wake-ups add no value and clutter execution history.
- **Keep** a single run-on-wake (or schedule) per workflow so the workflow still runs when needed (e.g. one Webhook Wake path, or the existing Weekly/Daily Schedule). The **24-hour gate** (section 2.2) ensures at most one external API call per 24 hours; one wake or schedule trigger is enough.

### 2.2 “Skip if last successful run &lt; 24 hours” (database check, no errors)

**Goal:** Perform **one API call per 24 hours** per workflow. When the Webhook Wake (or any trigger) fires, the workflow must:

1. **Check the database** for the timestamp of the **last successful run** for that workflow/source.
2. If the last successful run was **within the last 24 hours**: **skip** the external API call and any downstream steps that depend on it, and **exit successfully** (no error, no failed execution).
3. If the last successful run was **more than 24 hours ago** (or there is no prior successful run): proceed to call the external API, then record success so the next run can respect the 24-hour window.

**Implementation:**

- **App endpoint for “last run”:** Add an endpoint that n8n can call at the start of each workflow run, e.g.  
  `GET /api/admin/outreach/last-run?source=facebook`  
  (and equivalent for `google_contacts`, `linkedin`, and, if needed, a generic `workflow` param for VEP/CLG).  
  Response: `{ lastSuccessAt: "2026-02-11T12:00:00Z" | null, shouldRun: true | false }`  
  where `shouldRun` is `false` when `lastSuccessAt` is within the last 24 hours.

- **Database source of truth:** Use the existing **`warm_lead_trigger_audit`** table for warm lead workflows (WRM-001/002/003): “last successful run” = latest row with `source = <source>` and `status = 'success'`, ordered by `completed_at DESC` (or `triggered_at` if `completed_at` is null). For other workflows (CLG-001, VEP-001, VEP-002), either extend this table with a `workflow_id`/type or add a small **`workflow_last_run`** table: `(workflow_id, last_success_at)`. The endpoint reads from this and returns `lastSuccessAt` and a boolean `shouldRun` (true only when `lastSuccessAt` is null or &gt; 24 hours ago).

- **Recording success:** When a run **completes successfully** (after the external API call and any ingest), the app must record that success so the next run sees “last run within 24h.” Options:  
  - **Option A:** n8n calls a small **“run complete”** webhook on your app at the end of the workflow (e.g. `POST /api/admin/outreach/run-complete` with `{ source: "facebook" }`), and the app updates `warm_lead_trigger_audit` (set `status = 'success'`, `completed_at = now()`) or writes to `workflow_last_run`.  
  - **Option B:** The **ingest** endpoint (e.g. `POST /api/admin/outreach/ingest`) or the existing trigger audit update records success when it finishes processing (e.g. update the most recent `running` audit row for that source to `success` and `completed_at`).  
  Ensure the **same** source/workflow is used both when **reading** “last run” and when **writing** “run succeeded.”

- **In n8n (each API-heavy workflow):**  
  - **First node after trigger:** HTTP Request to the “last run” endpoint (e.g. `GET .../last-run?source=facebook`).  
  - **IF node:** If `shouldRun === false` (or equivalent: “last success within 24h”), take the **“skip” branch**: do **not** call the external API; optionally send a no-op to the next step or end the workflow. The workflow execution should still **succeed** (green), not fail.  
  - **Else:** Proceed to the existing “call external API” node(s), then ingest, then (if using Option A) call the “run complete” webhook so the app can record success.

- **Skip must be without errors:** When the workflow skips (because last run was within 24 hours), the run is considered **successful**. No error message, no red execution, no retries. Logging or a sticky note in n8n can say “Skipped: last run within 24h” for clarity.

**Summary for 2.2:** Keep Wake; one API call per 24 hours; database stores last successful run; if last success &lt; 24h ago → skip and succeed; if last success ≥ 24h or none → run API and record success.

### 2.3 Deduplication

- **Deduplication:** Ingest and lead logic continue to deduplicate by email, profile URL, etc. The 24-hour gate prevents **redundant API calls**; ingest prevents duplicate rows.

---

## 3. Per-Workflow Application of 2.2

- **WF-WRM-001, WRM-002, WRM-003:** Keep Webhook Wake. First step: GET last-run by `source` (facebook / google_contacts / linkedin). If `shouldRun === false`, skip Apify/Google/LinkedIn and finish successfully; else run as now and record success (via run-complete webhook or ingest/audit update).
- **WF-CLG-001:** Same idea: last-run by workflow/source; if within 24h skip Hunter.io (and downstream) and succeed; else run and record success.
- **WF-VEP-001, WF-VEP-002:** If you want the same 24h cap, add last-run check and skip AI/scrape when within 24h; else run and record success. Optional if these are only triggered on-demand.
- **Lead Research Agent:** Per-lead; 24h gate is less relevant unless you want “at most one qualification per lead per 24h.” Can leave as-is or add idempotency.

---

## 4. Implementation Order

1. **Backing data and endpoint**  
   - Ensure `warm_lead_trigger_audit` has a clear “success” meaning (e.g. `status = 'success'`, `completed_at` set). Add `workflow_last_run` if needed for non–warm-lead workflows.  
   - Implement `GET /api/admin/outreach/last-run?source=<source>` returning `{ lastSuccessAt, shouldRun }` (shouldRun = false when last success &lt; 24h ago).  
   - Implement success recording: either “run complete” webhook or update audit/table in ingest/trigger flow.

2. **n8n: warm lead workflows (WRM-001, WRM-002, WRM-003)**  
   - Remove the redundant 10-minute webhook trigger or the external caller that was invoking the Wake webhook every ~10 minutes; keep one run-on-wake or schedule.  
   - Add HTTP Request → GET last-run; add IF (shouldRun) → else skip external API and end successfully.  
   - Ensure successful runs call “run complete” or update audit so next run sees “last run within 24h.”

3. **n8n: CLG-001, VEP (if desired)**  
   - Same pattern: last-run check, skip without error when within 24h, record success when run completes.

4. **Docs**  
   - Document that redundant 10-minute webhook runs are removed, one run-on-wake (or schedule) is kept and that “one API call per 24 hours” is enforced via database check and skip-without-error behavior.

---

## 5. Summary

- **Triggers:** Remove redundant 10-minute webhook runs; keep one run-on-wake (or schedule) per workflow.
- **Rate limit:** One external API call per workflow per 24 hours.
- **Mechanism:** Database stores last successful run; workflow calls app “last run” endpoint; if last success &lt; 24h → skip and **succeed**; else run API and record success.
- **No errors on skip:** Skipped runs complete with success status, no failed executions or retries.
