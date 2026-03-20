# Integration testing — environment matrix

How to run **Admin → Testing (E2E simulator)**, **Playwright**, and related checks against **real integrations** without mixing prod customer data with dev — **without** n8n Enterprise "Environments" (use **separate URLs/credentials per deploy** instead).

---

## 1. Deployment tiers (recommended policy)

| Tier | App URL example | Supabase | Chat / diagnostic (`MOCK_N8N`) | Outbound webhooks (`N8N_*`, etc.) | Stripe | Printful / fulfillment | Slack & comms |
|------|-----------------|----------|--------------------------------|-------------------------------------|--------|-------------------------|---------------|
| **A — Local** | `localhost:3000` | Dev project | Usually **`true`** → no transcript payload to n8n | **Unset** *or* **dev n8n workspace** URLs | N/A or test keys | N/A or sandbox store | N/A or test workspace / `#bot-test` |
| **B — Preview** | Vercel preview | Dev (preferred) | **`true`** unless explicitly testing RAG | **Unset** or dev n8n (never prod if DB is dev) | Test | Sandbox | Test |
| **C — Staging** | e.g. `staging.amadutown.com` | Staging DB | **`false`** if you need real RAG | **Dedicated n8n workspace** (clone workflows + **test** Slack/email) | **Test** | **Sandbox / test store** | **Test** workspace / channels |
| **D — Production smoke** | Production | Production | **`false`** (minimal) | **Production** n8n | **Live** (tiny / reversible) | **Live** only if unavoidable | **Prod** but **synthetic** payloads only |

**Rule of thumb:** If the **database is dev**, webhook URLs should **not** point at production n8n (or prod Slack) unless workflows are designed to **no-op** on non-prod signals — easier to use a **second n8n project** and test integrations there.

---

## 2. Env vars to align per tier

| Variable | Tier A–B (typical) | Tier C (staging integrations) | Tier D (prod smoke) |
|----------|--------------------|-------------------------------|---------------------|
| `MOCK_N8N` | `true` for privacy / speed | `false` to exercise real chat/diagnostic | `false` for narrow checks only |
| `N8N_DISABLE_OUTBOUND` | `true` — suppresses **all** outbound n8n webhook calls; payloads logged instead | `false` — real webhooks fire | `false` |
| `N8N_BASE_URL` + `N8N_*_WEBHOOK_URL` | Empty or **dev** cloud host | **Staging** n8n host + production-style paths | **Prod** n8n |
| `N8N_INGEST_SECRET` | Dev secret | Staging secret | Prod secret |
| `N8N_LEAD_WEBHOOK_URL` | Empty or dev webhook | Staging lead workflow | Prod lead workflow |
| Stripe keys | `sk_test_` / `pk_test_` | `sk_test_` | `sk_live_` only for intentional smoke |
| Printful | Omit or sandbox | Sandbox | Live only when needed |
| Slack (app or webhooks) | Test app / channel | Test app / channel | Prod app; post only to **private** test channels in smoke scripts |

**How `MOCK_N8N` and `N8N_DISABLE_OUTBOUND` interact:**

- `MOCK_N8N=true` — chat/diagnostic return mock responses (no fetch). Other triggers are unaffected.
- `N8N_DISABLE_OUTBOUND=true` — **all** outbound n8n calls are suppressed (chat returns mock responses; fire-and-forget triggers log and return success). This is the recommended default for Tier A–B.
- Both `true` — safest for local dev; no data leaves to n8n at all.

**Staging shortcut:** Set `NEXT_PUBLIC_APP_ENV=staging` on the staging deploy and **omit** both variables — they default to **off** (real n8n). Explicit `true`/`false` always wins. See `lib/n8n-runtime-flags.ts` and [Staging environment](./staging-environment.md). Confirm via `GET /api/health` (`deploymentTier`, `n8n.mockEnabled`, `n8n.outboundDisabled`).

---

## 3. Admin → Testing scenarios (`lib/testing/scenarios.ts`)

**Legend — "Real fire":** *Yes* = with default env (MOCK off, URLs set), the path typically calls external systems or n8n. *Conditional* = depends on env (e.g. MOCK skips n8n). *DB-only* = validates your API + Supabase only for that step.

| Scenario ID | Name (short) | Recommended tier | n8n / webhooks | LLM (chat/diag) | Stripe | Other integrations | Notes |
|-------------|--------------|------------------|----------------|-----------------|--------|-------------------|--------|
| `browse_and_buy` | Browse and Buy | **C** (full) / **A** with test keys | Usually none in UI path | — | **Test** mode | — | Checkout uses `stripe_test` in scenario |
| `chat_to_diagnostic` | Chat to Diagnostic | **C** for real AI; **A–B** with `MOCK_N8N=true` | **Conditional**: completion webhook if configured | **Conditional** | — | — | `waitForWebhook` diagnostic_completion |
| `service_inquiry` | Service Inquiry | **C** for lead webhook proof | **Conditional**: `lead_qualification` | — | — | — | Contact form + DB + optional n8n |
| `full_funnel` | Full Funnel | **C** | **Conditional** (diagnostic completion) | **Conditional** | — | — | Long run; combines chat + diagnostic + contact |
| `abandoned_cart` | Abandoned Cart | **A–C** | None expected | — | — | — | Mostly UI / cart |
| `support_escalation` | Support Escalation | **C** if testing real escalation side effects | May follow n8n path if not mocked | **Conditional** | — | Slack etc. if wired in workflow | Validates `chat_sessions.is_escalated` |
| `quick_browse` | Quick Browse | **A–D** | None | — | — | — | Safe **prod smoke** candidate (pages only) |
| `warm_lead_pipeline` | Warm Lead Pipeline | **C** strongly preferred | **Yes** (trigger → n8n scrape path) + ingest | Possible via enrichment / outreach gen | — | Email/Slack if n8n sends | Also **admin** approve/send — may hit real send paths |
| `standalone_audit_tool` | Standalone Audit Tool | **A–D** | None | — | — | — | Safe **prod smoke** candidate |
| `client_experience_walkthrough` | Client Experience | **A–C** | None in listed steps | — | — | — | Admin API + UI |
| `audit_from_meetings` | Audit from Meetings | **A–C** | None (page load) | — | — | — | Does not run "build audit" |
| **Populate Demo** preset | See seed rows below | **A–B** (dev DB) | **Conditional** | — | — | — | Uses `N8N_INGEST_SECRET` + admin token |

### Populate Demo / seed scenarios

| Scenario ID | n8n / external | Notes |
|-------------|----------------|-------|
| `seed_warm_leads`, `seed_cold_lead` | Ingest API → may enqueue internal processing | Uses bearer ingest secret |
| `seed_discovery_contact`, `seed_*` demo-seed | Add lead / demo-seed may call **lead qualification** webhook if `N8N_LEAD_WEBHOOK_URL` set | Point URL at **dev** n8n for integration proof |
| `service_inquiry` (in preset) | Same as table above | Public `/api/contact` |

---

## 4. Playwright (`e2e/*.spec.ts`)

| Suite | Typical integrations | Recommended tier |
|-------|----------------------|------------------|
| `admin-outreach.spec.ts` | **None** (API/UI; 401 acceptable) | **A–D** |
| `admin-sidebar-dashboard.spec.ts` | **None** | **A–D** |
| `admin-meeting-tasks.spec.ts` | **None** unless tests extended | **A–C** |
| `admin-guarantees.spec.ts` | **None** unless tests extended | **A–C** |

These are **good for fast regression**; they do **not** replace n8n/Stripe integration proof — use **Admin → Testing** on **Tier C** for that.

---

## 5. Vitest (`npm test`)

Most tests are **unit / pure** (e.g. Stripe interval helpers). They **do not** call n8n, Printful, or Slack. Integration proof stays with **Tier C** (or narrow **Tier D** smoke).

**Contract tests** (`lib/__tests__/n8n-*.test.ts`) verify that each n8n trigger function sends the correct payload shape to the correct webhook URL — using `vi.stubGlobal('fetch', ...)` so no real HTTP calls are made. These run on every `npm test` and catch payload regressions without needing a live n8n instance.

---

## 6. Prod smoke (Tier D) — implemented

A GitHub Actions workflow (`.github/workflows/prod-smoke.yml`) runs weekly (Monday 7 AM UTC, or on manual dispatch):

1. `GET /api/health` — verifies Supabase connectivity (200 = ok, 503 = unreachable).
2. `GET /` — homepage returns 200.
3. `GET /services`, `GET /store`, `GET /resources` — key pages return 200.
4. On failure: posts to Slack via `SLACK_WEBHOOK_URL` secret (if configured).

Full **`warm_lead_pipeline`** or **`full_funnel`** in **Tier D** is usually **not** weekly smoke — run on **Tier C** or release gates.

---

## 7. Phase 4 — Staging n8n workspace (future)

**Not implemented now.** Documented path for when revenue justifies the cost (~$24/mo):

1. Create a second n8n Cloud workspace.
2. Clone only **5–7 critical workflows** (lead qual, payment intake, outreach gen/send, diagnostic completion, onboarding).
3. Point test Slack, test email, and Stripe test mode in that workspace.
4. Run Admin → Testing scenarios against a preview deploy with staging n8n URLs.
5. Monthly sync cadence: export prod → diff → import to staging.

---

## 8. Related docs

- `docs/staging-environment.md` — Vercel staging project + env checklist
- `docs/regression-smoke-checklist.md` — manual critical paths
- `docs/n8n-cloud-migration-guide.md` — `N8N_BASE_URL` / cutover
- `docs/seed-demo-leads.md` — Populate Demo / demo seeds
- `.env.example` — variable names (includes `N8N_DISABLE_OUTBOUND`)

---

*Last updated: 2026-03-20 — Phase 1–3 implemented; Phase 4 documented.*
