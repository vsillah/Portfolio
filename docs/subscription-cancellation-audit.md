# Portfolio Subscription Cancellation Audit

Recurring audit tracker for paid apps, hosted services, model/API providers,
automation runtimes, design/media tools, and third-party integrations used by
Portfolio.

Authority boundary: this tracker never approves cancellation by itself. A tool
only becomes a cancellation candidate after two consecutive audit sessions with
no meaningful usage signal, or after clear redundancy plus a lower-risk
replacement path. Production changes require explicit approval in the form
`Cancel <tool/vendor> for Portfolio`.

## 2026-06-02 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- Initial checkout status was `codex/agent-avatar-blob-seed...origin/codex/agent-avatar-blob-seed` with no dirty files reported. This run only updates the subscription tracker artifacts plus automation notification/memory files.
- No prior automation memory file was present at `$CODEX_HOME/automations/portfolio-subscription-cancellation-monitor/memory.md`; this run used the checked-in audit/status files as continuity state. Action tracker feedback reported 51 open actions for this automation and no in-progress, blocked, done, or progress-note signals.
- Supabase remains active. Production `analytics_events` moved to 5184 with latest row at 2026-06-02T12:34:01Z, production `agent_runs` moved to 79 with latest row at 2026-06-01T13:00:03Z, local configured `analytics_events` moved to 2162 with latest row at 2026-06-02T00:13:52Z, and local configured `agent_runs` moved to 119 with latest row at 2026-05-31T14:46:10Z.
- n8n Cloud remains operational: direct API returned 85 workflows, 72 active workflows, and sampled successful executions `15931` through `15935` around 2026-06-02T12:00Z. Checked-in exports contain 46 JSON files, 45 top-level workflow objects, and 38 active top-level exports.
- Vercel remains active through CLI evidence: `vercel whoami` returned `vsillah`, and deployment listings returned current deployment URLs for both `portfolio` and `portfolio-staging`.
- Stripe remains a live revenue dependency: latest sampled successful payment intent still dates to 2026-04-06, while checkout/payment routes and Stripe packages remain in the repo.
- Read AI remains a keep item: authenticated connector returned six meetings in the 2026-05-01 through 2026-06-02 window, latest on 2026-06-01. No transcript, private participant detail, meeting URL, or raw meeting content is included here.
- No vendor crossed the approval-ready cancellation threshold. OpenRouter returned zero current-key usage again, Vapi returned zero sampled calls again, Resend had no local key, Calendly returned 401, Gemini/Google AI returned 403, Printful sync remained empty despite one API-visible draft order, and ElevenLabs still shows zero characters used in the current reset cycle.
- BuiltWith remains a protected watch item during the outreach/client-volume ramp. Fireflies remains resolved as canceled per Vambah's 2026-05-01 confirmation unless new paid-plan evidence appears.

Raw Findings

- Read-only provider checks ran on 2026-06-02. Secret values, raw account payloads, private meeting content, private exports, and raw logs are not included in this report.
- Repo/config footprint remains broad: `.env.example`, `.env.local`, `.env.staging.example`, `package.json`, app/api routes, lib integrations, n8n exports, migrations, admin Subscription Watch, credential docs, bakeoff docs, and operations docs continue to reference the monitored provider set.
- `.env.example` exposes expected configuration for Supabase, Vercel-adjacent runtime, Stripe, n8n, OpenAI, Anthropic, Apify, BuiltWith, Calendly, ElevenLabs, Gamma, Gemini/Google, HeyGen, Printful, Resend, Slack, Vapi, and related webhooks. `.env.local` additionally contains OpenRouter, Pinecone, Hunter, and Read AI tokens.
- `package.json` still includes active integration dependencies for Supabase, Stripe, Resend, Vercel Blob/Functions/Speed Insights, Google APIs, Playwright, and related client SDKs.
- n8n checked-in exports: 46 JSON files, 45 workflow objects, 38 active top-level exports. Export references include Slack, Gmail, Supabase, Calendly, Google, OpenAI, Anthropic, Apify, HeyGen, Vapi, Stripe, and Read-style meeting workflows.
- Supabase production aggregates: `analytics_events` 5184/latest 2026-06-02T12:34:01Z, `agent_runs` 79/latest 2026-06-01T13:00:03Z, `cost_events` 21/latest 2026-05-14T01:13:20Z, `orders` 26/latest 2026-03-19T14:54:19Z, `printful_sync_log` 0, `email_messages` 9/latest 2026-04-30T19:53:15Z, `meeting_records` 110/latest 2026-05-06T16:32:58Z, `gamma_reports` 6/latest 2026-05-02T01:20:15Z, `videos` 4/latest 2026-04-15T02:52:07Z, and `social_content_queue` 29/latest 2026-05-07T13:00:49Z.
- Supabase local configured aggregates: `analytics_events` 2162/latest 2026-06-02T00:13:52Z, `agent_runs` 119/latest 2026-05-31T14:46:10Z, `cost_events` 12/latest 2026-05-27T20:37:59Z, `orders` 1/latest 2026-04-06T19:35:41Z, `printful_sync_log` 0, `email_messages` 6/latest 2026-04-28T00:38:19Z, `meeting_records` 4/latest 2026-04-14T01:15:12Z, `gamma_reports` 4/latest 2026-04-16T14:56:34Z, `videos` 4/latest 2026-03-25T13:48:33Z, and `social_content_queue` 3/latest 2026-05-23T09:24:08Z.
- n8n Cloud API: `N8N_CLOUD_API_KEY` was valid and returned 85 workflows, 72 active workflows, and five sampled successful executions around 2026-06-02T12:00Z.
- Vercel CLI authentication was available as `vsillah`; deployment listings returned current deployments for both `portfolio` and `portfolio-staging`.
- Stripe API: payment intents were readable. Latest sampled successful payment intent remained 2026-04-06.
- OpenAI and Anthropic model listings were readable, with OpenAI returning 120 models and Anthropic returning 10 models.
- Read AI connector returned six meetings from the May 1-June 2 window, latest 2026-06-01; no private content or participant detail was copied into this tracker.
- Slack bot auth was readable and valid. Pinecone listed one ready `publications` index. Hunter remained on Free with 50 used calls and 75 available. Gamma v1.0 themes returned 50 themes with more pages. HeyGen voices returned 2348 voices; HeyGen avatars timed out once and should be retried before drawing a billing conclusion.
- OpenRouter API: current key again reports usage 0. Vapi API: default calls sample returned HTTP 200 with zero calls. ElevenLabs API: Creator subscription remained readable with 0 of 246,034 characters used before the 2026-06-19 reset.
- Printful API: orders endpoint was readable and returned one sampled draft order with 2026-04-06 timestamp; both sampled Supabase `printful_sync_log` tables remain empty.
- Resend local key was absent. Calendly returned 401 unauthenticated. Gemini/Google AI returned 403.

Discovered Subscription Inventory

| Status | Tool/vendor | Portfolio purpose | Latest evidence | Session inactivity status | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Green | Supabase | Core database, admin state, auth-adjacent data, RAG/storage paths | Production analytics and agent runs moved on 2026-06-02/2026-06-01 | Active | Keep |
| Green | n8n Cloud | Automation runtime and workflow orchestration | 85 workflows, 72 active, successful executions around 2026-06-02T12:00Z | Active | Keep; optimize weak workflows separately |
| Green | Vercel | Production/staging hosting | CLI authenticated and listed `portfolio` plus `portfolio-staging` deployments | Active | Keep |
| Green | Stripe | Checkout and revenue dependency | API readable; latest sampled successful payment intent 2026-04-06 | Revenue path quiet but dependency remains | Keep |
| Green | OpenAI | Model/API provider for app/admin workflows | Model list readable with 120 models | Active/configured | Keep/watch usage costs |
| Yellow | Anthropic | Model/API provider and transition watch item | Model list readable with 10 models | Billing transition unresolved | Watch until next receipt/bakeoff refresh |
| Green | Slack | Agent/admin notification routes | Bot auth valid | Active/configured | Keep |
| Green | Read AI | Meeting intelligence and transcript workflows | Six meetings in May 1-June 2 window; latest 2026-06-01 | Active enough | Keep |
| Yellow | Gamma | Report/deck generation provider | v1.0 themes readable with 50 themes and more pages | DB report rows quiet since 2026-05-02 | Keep/watch; verify credits |
| Yellow | HeyGen | Video/avatar generation provider | Voices readable; avatar list timed out once | Campaign-dependent | Keep/watch; verify quota and retry avatars |
| Green | Apify | Lead/social/evidence scraping actors | API readable; latest sampled actor runs still 2026-05-27 mixed succeeded/failed | Account active, actor-level mixed | Keep account; continue actor bakeoff |
| Yellow | OpenRouter | Alternate model routing/bakeoff | Key readable with usage 0 | Consecutive quiet evidence | Watch; deprecate only after spend and bakeoff check |
| Yellow | Vapi | Optional voice UX | Calls endpoint returned zero calls | Consecutive quiet evidence | Investigate billing/voice intent |
| Yellow | ElevenLabs | Voice/audio generation | Creator cycle 0/246,034 chars before 2026-06-19 reset | Consecutive quiet evidence | Review campaign need before reset |
| Yellow | Printful | Store/merch fulfillment | One API-visible draft order from 2026-04-06; sync log 0 | Sync inactive | Investigate dashboard/store strategy |
| Yellow | Resend | Optional outbound email provider | Local key absent; package/env references remain | Usage unresolved | Verify production env and billing |
| Yellow | Calendly | Scheduling and n8n booking triggers | API returned 401; links/workflows remain configured | Auth unresolved | Refresh token; keep for now |
| Yellow | Gemini / Google AI | Google AI/image/social workflow provider | Model-list check returned 403 | Auth/project unresolved | Resolve key/project status |
| Yellow | Pinecone | Publications/vector search | One ready serverless `publications` index | Traffic/billing unresolved | Compare dashboard traffic with Supabase/local RAG |
| Green | Hunter.io | Lead enrichment | API reports Free plan | Not a paid cancellation target | Keep/free-watch |
| Yellow | BuiltWith | Outreach/client stack enrichment | Local key present; standing decision protects it during outreach ramp | Watch item | Keep active during ramp |
| Green | Fireflies.ai | Historical meeting recaps only | No new paid-plan evidence | Resolved canceled | Keep out of active queue unless restarted |
| Yellow | Figma / Paper / Excalidraw / Canva | Design and diagram production | Repo/workflow-adjacent references only | Billing unknown | Investigate only if receipts/dashboard evidence appear |

Inactive-For-Two-Sessions Evidence

- OpenRouter: zero current-key usage again across consecutive provider sweeps. Still not an automatic cancellation action because active spend, dependency scope, and replacement intent are not confirmed.
- Vapi: zero sampled calls again, with prior visible call evidence still 2026-04-30. Investigate dashboard billing and production voice intent before deprecation.
- Printful: `printful_sync_log` remains empty in sampled Supabase projects, but the Printful API still shows one older draft order. Treat as merchandise strategy investigation, not subscription cancellation.
- Resend: local key remains absent while code/env references remain. Verify Vercel production env and billing before removing code paths.
- Calendly and Gemini/Google AI: auth or project readiness issues continue, but repo and workflow dependencies remain. Refresh/resolve credentials before any provider decision.
- ElevenLabs: current reset-cycle character usage is zero again. Review campaign plan and dashboard billing before proposing cancellation.
- Gamma and HeyGen: API catalog/theme access proves config readability, not meaningful paid usage. Verify dashboard credit/quota consumption before any renewal decision.

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor has approval-ready cancellation evidence in this daily run.**

Approval Needed

- No cancellation approval is needed or requested today.
- Future cancellation still requires the exact phrase `Cancel <tool/vendor> for Portfolio`, followed by verification, a branch, deprecation/replacement work, focused validation, and rollback notes.

Next Audit Focus

- Verify Vapi, Printful, Resend, Pinecone, ElevenLabs, Calendly, Gemini, HeyGen, Gamma, and Anthropic in dashboards where API evidence is quiet, auth-blocked, billing-incomplete, quota-incomplete, or subscription-transition dependent.
- Keep BuiltWith active during the outreach ramp and collect lead-prep/proposal outcome evidence before judging it.
- Keep Fireflies out of the active queue unless new paid-plan evidence appears; if a future receipt/dashboard signal appears, verify whether the canceled plan restarted.
- Continue the Apify actor-level replacement bakeoff before any account-level change.

## 2026-05-31 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- Initial checkout status was `codex/digest-agent-ops-backlog` with pre-existing dirty work in `docs/subscription-cancellation-audit.md`, `docs/subscription-status.json`, `package.json`, and untracked automation-digest files. This run only appends/synchronizes the subscription tracker artifacts plus automation notification/memory files.
- Action tracker feedback file existed but had no entry for `portfolio-subscription-cancellation-monitor`; no completed, dismissed, blocked, or in-progress action signal was applied.
- Supabase remains active. Production `analytics_events` moved to 5154 with latest row at 2026-05-31T04:05:27Z, local configured `agent_runs` moved to 116 with latest row at 2026-05-30T14:47:10Z, and production `agent_runs` remained at 78/latest 2026-05-29T13:00:04Z.
- n8n Cloud remains operational: direct API returned 85 workflows, 72 active workflows, and sampled successful executions `15721` through `15725` around 2026-05-31T12:00Z. Checked-in exports contain 46 workflow JSON objects with 30 active top-level exports.
- Vercel remains active through CLI evidence: `vercel whoami` returned `vsillah`, `portfolio` showed ready preview deployments about 2 hours old, and `portfolio-staging` showed ready production deployments from 2 days ago.
- Stripe remains a live revenue dependency: latest sampled successful charge/payment intent still dates to 2026-04-06, while checkout/payment routes and Stripe packages remain in the repo.
- Read AI remains a keep item: authenticated connector returned six May meetings through 2026-05-29. No transcript, private participant detail, or raw meeting content is included here.
- Gamma and HeyGen remain active media/design dependencies by API/config evidence: Gamma v1.0 themes were readable with 50 themes and more pages, HeyGen returned 1289 avatars and 2348 voices, and both remain wired into admin report/video workflows.
- No vendor crossed the approval-ready cancellation threshold. OpenRouter returned zero current-key usage again, Vapi returned zero sampled calls again, Resend had no local key, Calendly returned 401, Gemini/Google AI returned 403, Printful sync remained empty despite one API-visible draft order, and ElevenLabs still shows zero characters used in the current reset cycle.
- BuiltWith remains a protected watch item during the outreach/client-volume ramp. Fireflies remains resolved as canceled per Vambah's 2026-05-01 confirmation unless new paid-plan evidence appears.

Raw Findings

- Read-only provider checks ran on 2026-05-31. Secret values, raw account payloads, private meeting content, private exports, and raw logs are not included in this report.
- Supabase production aggregates: `analytics_events` 5154/latest 2026-05-31T04:05:27Z, `agent_runs` 78/latest 2026-05-29T13:00:04Z, `cost_events` 21/latest 2026-05-14T01:13:20Z, `orders` 26/latest 2026-03-19T14:54:19Z, `printful_sync_log` 0, `email_messages` 9/latest 2026-04-30T19:53:15Z, `meeting_records` 110/latest 2026-05-06T16:32:58Z, `gamma_reports` 6/latest 2026-05-02T01:20:15Z, `videos` 4/latest 2026-04-15T02:52:07Z, and `social_content_queue` 29/latest 2026-05-07T13:00:49Z.
- Supabase local configured aggregates: `analytics_events` 2142/latest 2026-05-30T01:48:57Z, `agent_runs` 116/latest 2026-05-30T14:47:10Z, `cost_events` 12/latest 2026-05-27T20:37:59Z, `orders` 1/latest 2026-04-06T19:35:41Z, `printful_sync_log` 0, `email_messages` 6/latest 2026-04-28T00:38:19Z, `meeting_records` 4/latest 2026-04-14T01:15:12Z, `gamma_reports` 4/latest 2026-04-16T14:56:34Z, `videos` 4/latest 2026-03-25T13:48:33Z, and `social_content_queue` 3/latest 2026-05-23T09:24:08Z.
- n8n Cloud API: `N8N_CLOUD_API_KEY` was valid and returned 85 workflows, 72 active workflows, and sampled successful executions `15721` through `15725` around 2026-05-31T12:00Z.
- Vercel CLI authentication was available as `vsillah`; deployment listings returned current activity for `portfolio` and recent ready production deployments for `portfolio-staging`.
- Stripe API: charges, payment intents, and checkout sessions were readable. Latest sampled successful charge/payment intent remained 2026-04-06; latest sampled checkout session remained 2026-02-23.
- Read AI connector: six May meetings were visible, latest sampled start time 2026-05-29; raw meeting content and participant detail were not copied into this tracker.
- Gamma API: repo-aligned v1.0 theme listing returned HTTP 200 with 50 themes and more pages; the older v0.2 themes endpoint returned 410 and should not be used for future probes.
- HeyGen API: avatar listing returned 1289 avatars and voice listing returned 2348 voices; billing/quota still requires dashboard verification.
- Anthropic API: model listing was readable again with 10 models after the prior run's 401; keep the subscription-transition watch item until billing is verified.
- OpenAI model listing, Slack bot auth, Pinecone index listing, Printful orders, Hunter account, Apify actor runs, OpenRouter key status, Vapi calls, ElevenLabs subscription, Calendly user lookup, and Gemini model listing were checked read-only.
- OpenRouter API: current key again reports usage 0. Vapi API: default calls sample returned HTTP 200 with zero calls. ElevenLabs API: Creator subscription remained readable with 0 of 246,034 characters used before the 2026-06-19 reset.
- Pinecone API: one ready serverless `publications` index remains visible in `aws/us-east-1`.
- Printful API: orders endpoint was readable and returned one sampled draft order with 2026-04-06 timestamp; both sampled Supabase `printful_sync_log` tables remain empty.
- Hunter.io API: sampled account remains Free with 50 used calls and 75 available.
- Apify API: five sampled actor runs remain latest on 2026-05-27, with mixed succeeded/failed status and low sampled costs.
- Resend local key was absent. Calendly returned 401 unauthenticated. Gemini/Google AI returned 403 permission denied.
- Local repo/config footprint remains broad: `package.json`, `.env.example`, `.env.staging.example`, credential docs, app/api routes, lib integrations, scripts, n8n exports, migrations, and the admin Subscription Watch surface all continue to reference the monitored provider set.

Derived Movement Since Prior Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | Production `analytics_events` moved 5151 -> 5154; local `agent_runs` moved 113 -> 116 | Active | Keep |
| n8n Cloud | 85 workflows, 72 active, five sampled successful executions at 2026-05-31T12:00Z | Active | Keep; optimize weak workflows separately |
| Vercel | CLI authenticated; `portfolio` had ready preview deployments about 2 hours old | Active hosting | Keep |
| Stripe | Latest sampled charge/payment intent remains succeeded on 2026-04-06 | Revenue dependency, quiet recent charge sample | Keep |
| Read.ai | Connector returned six May meetings through 2026-05-29 | Active enough | Keep |
| Gamma | Repo-aligned v1.0 themes endpoint readable with 50 themes and more pages | Active/report dependency, usage quiet in DB | Keep/watch |
| HeyGen | Avatars and voices readable | API readable, campaign-dependent | Keep; verify dashboard quota/billing |
| Apify | Latest sampled actor runs remain 2026-05-27 with mixed outcomes | Account active, actor-level mixed | Keep account; continue actor replacement bakeoff |
| Anthropic | Model listing readable again with 10 models | Auth recovered, billing transition unresolved | Watch; verify Claude/API spend before next cycle |
| OpenRouter | Zero current-key usage again | Consecutive quiet key evidence | Watch; deprecate only after bakeoff and spend check |
| Vapi | Default call sample returned zero calls again | Quiet | Investigate billing/voice UX before any deprecation |
| Printful | API-visible draft order latest 2026-04-06; app sync log still empty | Quiet sync, older order evidence | Investigate dashboard/store strategy |
| Resend | Local key absent; optional code/env references remain | Usage unresolved | Verify production env/billing |
| Calendly | API returned 401; scheduling links and n8n references remain | Auth unresolved | Refresh token; keep |
| Gemini / Google AI | Model-list check returned 403 | Auth/config unresolved | Resolve key/project status |
| ElevenLabs | Current cycle usage 0/246,034 characters again | Paid watch, current-cycle quiet | Review campaign need before next reset |
| Figma / Paper / Excalidraw / Canva | Only repo/workflow-adjacent references; no fresh billing evidence | Billing unknown | Investigate only if receipt/dashboard evidence appears |
| Fireflies.ai | No new paid-plan evidence found | Resolved canceled unless billing restarted | Keep out of active cancellation queue |

Inactive-For-Two-Sessions Evidence

- OpenRouter: zero current-key usage again across consecutive provider sweeps. Still not an automatic cancellation action because active spend, dependency scope, and replacement intent are not confirmed.
- Vapi: zero sampled calls again, with prior visible call evidence still 2026-04-30. Investigate dashboard billing and production voice intent before deprecation.
- Printful: `printful_sync_log` remains empty in sampled Supabase projects, but the Printful API still shows one older draft order. Treat as merchandise strategy investigation, not subscription cancellation.
- Resend: local key remains absent while code/env references remain. Verify Vercel production env and billing before removing code paths.
- Calendly and Gemini/Google AI: auth or project readiness issues continue, but repo and workflow dependencies remain. Refresh/resolve credentials before any provider decision.
- ElevenLabs: current reset-cycle character usage is zero again. Review campaign plan and dashboard billing before proposing cancellation.

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor has approval-ready cancellation evidence in this daily run.**

Approval Needed

- No cancellation approval is needed or requested today.
- Future cancellation still requires the exact phrase `Cancel <tool/vendor> for Portfolio`, followed by verification, a branch, deprecation/replacement work, focused validation, and rollback notes.

Next Audit Focus

- Verify Vapi, Printful, Resend, Pinecone, ElevenLabs, Calendly, Gemini, HeyGen, Gamma, and Anthropic in dashboards where API evidence is quiet, auth-blocked, billing-incomplete, quota-incomplete, or subscription-transition dependent.
- Keep BuiltWith active during the outreach ramp and collect lead-prep/proposal outcome evidence before judging it.
- Keep Fireflies out of the active queue unless new paid-plan evidence appears; if a future receipt/dashboard signal appears, verify whether the canceled plan restarted.
- Continue the Apify actor-level replacement bakeoff before any account-level change.

## 2026-05-30 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- Initial checkout status was `codex/digest-agent-ops-backlog` with pre-existing dirty work in `docs/subscription-cancellation-audit.md`, `docs/subscription-status.json`, `package.json`, and untracked automation-digest files. This run only appends/synchronizes the subscription tracker artifacts plus automation notification/memory files.
- `CODEX_HOME` was unset in the shell, so the literal `$CODEX_HOME/...` check missed the memory path at first; the canonical memory file existed under `/Users/vambahsillah/.codex/automations/portfolio-subscription-cancellation-monitor/memory.md` and was read before finalizing. Action tracker feedback existed but had no entry for `portfolio-subscription-cancellation-monitor`; no completed or dismissed actions were applied.
- Supabase remains active. Production `analytics_events` moved to 5151 with latest row at 2026-05-29T14:35:41Z, production `agent_runs` moved to 78 with latest row at 2026-05-29T13:00:04Z, local configured `analytics_events` moved to 2142 with latest row at 2026-05-30T01:48:57Z, and local configured `agent_runs` moved to 113 with latest row at 2026-05-29T14:46:19Z.
- n8n Cloud remains operational: direct API returned 85 workflows, 72 active workflows, and sampled successful executions `15622` through `15626` around 2026-05-30T12:00Z. Checked-in exports contain 46 workflow JSON files, 45 top-level JSON files, and 37 active top-level exports.
- Vercel remains active through CLI evidence: `vercel whoami` returned `vsillah`, `portfolio` showed a ready preview deployment at 2026-05-30T10:08:30Z plus ready production deployments on 2026-05-29, and `portfolio-staging` showed ready production deployments on 2026-05-29.
- Stripe remains a live revenue dependency: the latest sampled successful charge/payment-intent evidence still dates to 2026-04-06, while checkout/payment routes and Stripe packages remain in the repo.
- Read AI remains a keep item: the connector returned five May meetings with the latest sampled meeting on 2026-05-29. No transcript, private participant detail, or raw meeting content is included here.
- Gamma and HeyGen remain active media/design dependencies by API/config evidence: Gamma themes were readable with at least 50 themes and more pages, HeyGen returned 1289 avatars and 2348 voices, and both remain wired into admin report/video workflows.
- No vendor crossed the approval-ready cancellation threshold. OpenRouter returned zero current-key usage again, Vapi returned zero sampled calls again, Resend had no local key, Calendly returned 401, Gemini/Google AI returned 403, Printful sync remained empty despite one API-visible draft order, ElevenLabs still shows zero characters used in the current reset cycle, and Anthropic model listing returned 401 in this run after prior readable checks.
- BuiltWith remains a protected watch item during the outreach/client-volume ramp. Fireflies remains resolved as canceled per Vambah's 2026-05-01 confirmation unless new paid-plan evidence appears.

Raw Findings

- Read-only provider checks ran on 2026-05-30. Secret values, raw account payloads, private meeting content, private exports, and raw logs are not included in this report.
- Supabase production aggregates: `analytics_events` 5151/latest 2026-05-29T14:35:41Z, `agent_runs` 78/latest 2026-05-29T13:00:04Z, `cost_events` 21/latest 2026-05-14T01:13:20Z, `orders` 26/latest 2026-03-19T14:54:19Z, `printful_sync_log` 0, `email_messages` 9/latest 2026-04-30T19:53:15Z, `meeting_records` 110/latest 2026-05-06T16:32:58Z, `gamma_reports` 6/latest 2026-05-02T01:20:15Z, `videos` 4/latest 2026-04-15T02:52:07Z, and `social_content_queue` 29/latest 2026-05-07T13:00:49Z.
- Supabase local configured aggregates: `analytics_events` 2142/latest 2026-05-30T01:48:57Z, `agent_runs` 113/latest 2026-05-29T14:46:19Z, `cost_events` 12/latest 2026-05-27T20:37:59Z, `orders` 1/latest 2026-04-06T19:35:41Z, `printful_sync_log` 0, `email_messages` 6/latest 2026-04-28T00:38:19Z, `meeting_records` 4/latest 2026-04-14T01:15:12Z, `gamma_reports` 4/latest 2026-04-16T14:56:34Z, `videos` 4/latest 2026-03-25T13:48:33Z, and `social_content_queue` 3/latest 2026-05-23T09:24:08Z.
- n8n Cloud API: `N8N_CLOUD_API_KEY` was valid and returned 85 workflows, 72 active workflows, and sampled successful executions `15622` through `15626` around 2026-05-30T12:00Z.
- Vercel CLI authentication was available as `vsillah`; deployment listings returned current activity for both `portfolio` and `portfolio-staging`.
- Stripe API: charges, payment intents, and checkout sessions were readable. Latest sampled successful charge/payment intent remained 2026-04-06; latest sampled checkout session remained 2026-02-23.
- Read AI connector: five May meetings were visible, latest sampled start time 2026-05-29; raw meeting content and participant detail were not copied into this tracker.
- Gamma API: theme listing returned HTTP 200 with at least 50 themes and more pages.
- HeyGen API: avatar listing returned 1289 avatars and voice listing returned 2348 voices; billing/quota still requires dashboard verification.
- ElevenLabs API: Creator subscription remained readable with 0 of 246,034 characters used in the current reset cycle; next reset remains 2026-06-19T18:38:26Z.
- OpenRouter API: current key again reports usage 0.
- Vapi API: default calls sample returned HTTP 200 with zero calls; prior visible call evidence remains the 2026-04-30 `webCall`.
- Pinecone API: one ready serverless `publications` index remains visible in `aws/us-east-1`.
- Printful API: orders endpoint was readable and returned one sampled draft order with 2026-04-06 timestamp; both sampled Supabase `printful_sync_log` tables remain empty.
- Hunter.io API: sampled account remains Free with 50 used calls and 75 available.
- Slack bot auth and OpenAI model listing were readable. Anthropic model listing returned 401 in this run; prior model-list checks were readable. Resend local key was absent. Calendly returned 401 unauthenticated. Gemini/Google AI returned 403 permission denied.
- Local repo/config footprint remains broad: `package.json`, `.env.example`, `.env.staging.example`, credential docs, app/api routes, lib integrations, scripts, n8n exports, migrations, and the admin Subscription Watch surface all continue to reference the monitored provider set.

Derived Movement Since Prior Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | Production `analytics_events` moved 5145 -> 5151; production `agent_runs` moved 77 -> 78; local `analytics_events` moved 2139 -> 2142; local `agent_runs` moved 110 -> 113 | Active | Keep |
| n8n Cloud | 85 workflows, 72 active, five sampled successful executions at 2026-05-30T12:00Z | Active | Keep; optimize weak workflows separately |
| Vercel | CLI authenticated; portfolio and portfolio-staging listings showed ready deployments on 2026-05-29/30 | Active hosting | Keep |
| Stripe | Latest sampled charge/payment intent remains succeeded on 2026-04-06 | Revenue dependency, quiet recent charge sample | Keep |
| Read.ai | Connector returned five May meetings, latest sampled 2026-05-29 | Active enough | Keep |
| Gamma | API themes readable with at least 50 themes; `gamma_reports` latest production row remains 2026-05-02 | Active/report dependency, usage quiet in DB | Keep/watch |
| HeyGen | Avatars and voices readable; video-generation routes remain wired | API readable, campaign-dependent | Keep; verify dashboard quota/billing |
| Apify | Account evidence remains active from prior direct run samples; exports still include Apify nodes | Account active, actor-level mixed | Keep account; continue actor replacement bakeoff |
| OpenRouter | Zero current-key usage again | Consecutive quiet key evidence | Watch; deprecate only after bakeoff and spend check |
| Anthropic | Model listing returned 401 after prior readable checks | Auth degraded, repo/n8n references remain | Investigate API key status and subscription transition |
| Vapi | Default call sample returned zero calls again | Quiet | Investigate billing/voice UX before any deprecation |
| Printful | API-visible draft order latest 2026-04-06; app sync log still empty | Quiet sync, older order evidence | Investigate dashboard/store strategy |
| Resend | Local key absent; optional code/env references remain | Usage unresolved | Verify production env/billing |
| Calendly | API returned 401; scheduling links and n8n references remain | Auth unresolved | Refresh token; keep |
| Gemini / Google AI | Model-list check returned 403 | Auth/config unresolved | Resolve key/project status |
| ElevenLabs | Current cycle usage 0/246,034 characters again | Paid watch, current-cycle quiet | Review campaign need before next reset |
| Figma / Paper / Excalidraw / Canva | Only repo/workflow-adjacent references; no fresh billing evidence | Billing unknown | Investigate only if receipt/dashboard evidence appears |
| Fireflies.ai | No new paid-plan evidence found | Resolved canceled unless billing restarted | Keep out of active cancellation queue |

Inactive-For-Two-Sessions Evidence

- OpenRouter: zero current-key usage again across consecutive provider sweeps. Still not an automatic cancellation action because active spend, dependency scope, and replacement intent are not confirmed.
- Vapi: zero sampled calls again, with prior visible call evidence still 2026-04-30. Investigate dashboard billing and production voice intent before deprecation.
- Printful: `printful_sync_log` remains empty in sampled Supabase projects, but the Printful API still shows one older draft order. Treat as merchandise strategy investigation, not subscription cancellation.
- Resend: local key remains absent while code/env references remain. Verify Vercel production env and billing before removing code paths.
- Calendly and Gemini/Google AI: auth or project readiness issues continue, but repo and workflow dependencies remain. Refresh/resolve credentials before any provider decision.
- ElevenLabs: current reset-cycle character usage is zero again. Review campaign plan and dashboard billing before proposing cancellation.
- Anthropic: this run returned 401 for model listing; because prior checks were readable and repo dependencies remain, treat this as auth/subscription-transition investigation rather than cancellation evidence.

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor has approval-ready cancellation evidence in this daily run.**

Approval Needed

- No cancellation approval is needed or requested today.
- Future cancellation still requires the exact phrase `Cancel <tool/vendor> for Portfolio`, followed by verification, a branch, deprecation/replacement work, focused validation, and rollback notes.

Next Audit Focus

- Verify Vapi, Printful, Resend, Pinecone, ElevenLabs, Calendly, Gemini, HeyGen, Gamma, and Anthropic in dashboards where API evidence is quiet, auth-blocked, billing-incomplete, quota-incomplete, or changed since prior runs.
- Keep BuiltWith active during the outreach ramp and collect lead-prep/proposal outcome evidence before judging it.
- Keep Fireflies out of the active queue unless new paid-plan evidence appears; if a future receipt/dashboard signal appears, verify whether the canceled plan restarted.
- Continue the Apify actor-level replacement bakeoff before any account-level change.

## 2026-05-29 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- Initial checkout status was `codex/digest-agent-ops-backlog` with pre-existing dirty work in `docs/subscription-cancellation-audit.md`, `docs/subscription-status.json`, `package.json`, and untracked automation-digest files. This run only appends/synchronizes the subscription tracker artifacts plus automation notification/memory files.
- Action tracker feedback reported 51 open actions for `portfolio-subscription-cancellation-monitor`, with no in-progress, blocked, done, or progress-note signals. No completed or dismissed actions were applied.
- Supabase remains active. Production `analytics_events` moved to 5145 with latest row at 2026-05-29T03:20:19Z, production `agent_runs` moved to 77 with latest row at 2026-05-28T13:00:03Z, and local configured `agent_runs` moved to 110 with latest row at 2026-05-28T23:43:23Z.
- n8n Cloud remains operational: direct API returned 85 workflows, 72 active workflows, and sampled successful executions `15521` through `15525` around 2026-05-29T12:00Z. Checked-in exports remain 44 workflow JSON files plus the manifest, with 37 active exports.
- Vercel remains active through CLI evidence: `vercel whoami` returned `vsillah`, `portfolio` showed ready preview deployments about 2 hours old and ready production deployments within the prior day, and `portfolio-staging` showed ready production deployments within the prior day.
- Stripe remains a live revenue dependency: the latest sampled successful charge/payment-intent evidence still dates to 2026-04-06, while checkout/payment routes and Stripe packages remain in the repo.
- Read AI remains a keep item: the connector returned five May meetings through 2026-05-27, and the Slack transcript surface showed Read AI recap activity on 2026-05-27. No transcript, private participant detail, or raw meeting content is included here.
- No vendor crossed the approval-ready cancellation threshold. OpenRouter returned zero current-key usage again, Vapi returned zero sampled calls again, Resend had no local key, Calendly returned 401, Gemini/Google AI returned 403, Printful sync remained empty despite one API-visible draft order, and ElevenLabs still shows zero characters used in the current reset cycle.
- BuiltWith remains a protected watch item during the outreach/client-volume ramp. Fireflies remains resolved as canceled per Vambah's 2026-05-01 confirmation unless new paid-plan evidence appears; Slack history still contains older Fireflies recap residue, but this run found no paid-plan evidence.

Raw Findings

- Prior automation memory existed at `/Users/vambahsillah/.codex/automations/portfolio-subscription-cancellation-monitor/memory.md` and recorded the 2026-05-19 through 2026-05-28 monitor runs. This run used automation memory, checked-in tracker/status files, local repo references, n8n exports, read-only connector checks, and sanitized provider API summaries as continuity state.
- Read-only provider checks ran on 2026-05-29. Secret values, raw account payloads, private meeting content, private exports, and raw logs are not included in this report.
- Supabase production aggregates: `analytics_events` 5145/latest 2026-05-29T03:20:19Z, `agent_runs` 77/latest 2026-05-28T13:00:03Z, `cost_events` 21/latest 2026-05-14T01:13:20Z, `orders` 26/latest 2026-03-19T14:54:19Z, `printful_sync_log` 0, `email_messages` 9/latest 2026-04-30T19:53:15Z, `meeting_records` 110/latest 2026-05-06T16:32:58Z, `gamma_reports` 6/latest 2026-05-02T01:20:15Z, `videos` 4/latest 2026-04-15T02:52:07Z, and `social_content_queue` 29/latest 2026-05-07T13:00:49Z.
- Supabase local configured aggregates: `analytics_events` 2139/latest 2026-05-26T18:26:50Z, `agent_runs` 110/latest 2026-05-28T23:43:23Z, `cost_events` 12/latest 2026-05-27T20:37:59Z, `orders` 1/latest 2026-04-06T19:35:41Z, `printful_sync_log` 0, `email_messages` 6/latest 2026-04-28T00:38:19Z, `meeting_records` 4/latest 2026-04-14T01:15:12Z, `gamma_reports` 4/latest 2026-04-16T14:56:34Z, `videos` 4/latest 2026-03-25T13:48:33Z, and `social_content_queue` 3/latest 2026-05-23T09:24:08Z.
- n8n Cloud API: `N8N_CLOUD_API_KEY` was valid and returned 85 workflows, 72 active workflows, and sampled successful executions `15521` through `15525` around 2026-05-29T12:00Z.
- Vercel CLI authentication was available as `vsillah`; deployment listings returned current activity for both `portfolio` and `portfolio-staging`.
- Stripe API: charges, payment intents, and checkout sessions were readable. Latest sampled successful charge/payment intent remained 2026-04-06; latest sampled checkout session remained 2026-02-23.
- Apify API: five sampled actor runs included 2026-05-27 activity, with succeeded and failed statuses and low sampled run costs. Account-level usage remains active; actor-level quality remains mixed.
- ElevenLabs API: Creator subscription remained readable with 0 of 246,034 characters used in the current reset cycle; next reset remains 2026-06-19T18:38:26Z.
- OpenRouter API: current key again reports usage 0.
- Vapi API: default calls sample returned HTTP 200 with zero calls; prior visible call evidence remains the 2026-04-30 `webCall`.
- Pinecone API: one ready serverless `publications` index remains visible in `aws/us-east-1`.
- Printful API: orders endpoint was readable and returned one sampled draft order with 2026-04-06 timestamp; both sampled Supabase `printful_sync_log` tables remain empty.
- Hunter.io API: sampled account remains Free with 50 used calls and 75 available before the 2026-06-09 reset.
- HeyGen API: avatar catalog listing returned successfully with 1289 avatars; billing/quota still requires dashboard verification.
- Slack bot auth, Slack `#agent-ops`, Slack `#meeting-transcripts`, OpenAI model listing, Anthropic model listing, and Read AI connector listing were readable. Resend local key was absent. Calendly returned 401 unauthenticated. Gemini/Google AI returned 403 permission denied.
- Local repo/config footprint remains broad: `package.json`, `.env.example`, `.env.staging.example`, credential docs, app/api routes, lib integrations, scripts, n8n exports, migrations, and the admin Subscription Watch surface all continue to reference the monitored provider set.

Derived Movement Since Prior Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | Production `analytics_events` moved 5134 -> 5145; production `agent_runs` moved 76 -> 77; local `agent_runs` moved 106 -> 110 | Active | Keep |
| n8n Cloud | 85 workflows, 72 active, five sampled successful executions at 2026-05-29T12:00Z | Active | Keep; optimize weak workflows separately |
| Vercel | CLI authenticated; portfolio and portfolio-staging listings showed same-day/within-day ready deployments | Active hosting | Keep |
| Stripe | Latest sampled charge/payment intent remains succeeded on 2026-04-06 | Revenue dependency, quiet recent charge sample | Keep |
| Read.ai | Connector returned five May meetings through 2026-05-27; Slack transcript surface also shows May 27 Read AI recap activity | Active enough | Keep |
| Apify | Sampled actor runs include 2026-05-27 activity, mixed success/failure | Account active, actor-level mixed | Keep account; continue actor replacement bakeoff |
| HeyGen | Avatar API returned 1289 avatars | API readable, campaign-dependent | Keep; verify dashboard quota/billing |
| OpenRouter | Zero current-key usage again | Consecutive quiet key evidence | Watch; deprecate only after bakeoff and spend check |
| Vapi | Default call sample returned zero calls again | Quiet | Investigate billing/voice UX before any deprecation |
| Printful | API-visible draft order latest 2026-04-06; app sync log still empty | Quiet sync, older order evidence | Investigate dashboard/store strategy |
| Resend | Local key absent; optional code/env references remain | Usage unresolved | Verify production env/billing |
| Calendly | API returned 401; scheduling links and n8n references remain | Auth unresolved | Refresh token; keep |
| Gemini / Google AI | Model-list check returned 403 | Auth/config unresolved | Resolve key/project status |
| ElevenLabs | Current cycle usage 0/246,034 characters again | Paid watch, current-cycle quiet | Review campaign need before next reset |
| Fireflies.ai | Slack history contains older recap residue, but no paid-plan evidence was found | Resolved canceled unless billing restarted | Keep out of active cancellation queue |

Inactive-For-Two-Sessions Evidence

- OpenRouter: zero current-key usage again across consecutive provider sweeps. Still not an automatic cancellation action because active spend, dependency scope, and replacement intent are not confirmed.
- Vapi: zero sampled calls again, with prior visible call evidence still 2026-04-30. Investigate dashboard billing and production voice intent before deprecation.
- Printful: `printful_sync_log` remains empty in sampled Supabase projects, but the Printful API still shows one older draft order. Treat as merchandise strategy investigation, not subscription cancellation.
- Resend: local key remains absent while code/env references remain. Verify Vercel production env and billing before removing code paths.
- Calendly and Gemini/Google AI: auth or project readiness issues continue, but repo and workflow dependencies remain. Refresh/resolve credentials before any provider decision.
- ElevenLabs: current reset-cycle character usage is zero again. Review campaign plan and dashboard billing before proposing cancellation.

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor has approval-ready cancellation evidence in this daily run.**

Approval Needed

- No cancellation approval is needed or requested today.
- Future cancellation still requires the exact phrase `Cancel <tool/vendor> for Portfolio`, followed by verification, a branch, deprecation/replacement work, focused validation, and rollback notes.

Next Audit Focus

- Verify Vapi, Printful, Resend, Pinecone, ElevenLabs, Calendly, Gemini, and HeyGen in their dashboards where API evidence is quiet, auth-blocked, billing-incomplete, or quota-incomplete.
- Keep BuiltWith active during the outreach ramp and collect lead-prep/proposal outcome evidence before judging it.
- Keep Fireflies out of the active queue unless new paid-plan evidence appears; if a future receipt/dashboard signal appears, verify whether the canceled plan restarted.
- Continue the Apify actor-level replacement bakeoff before any account-level change.

## 2026-05-28 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- Initial checkout status was `main...origin/main` with no dirty tracked or untracked files. This run only updates the subscription tracker artifacts plus automation notification/memory files.
- Action tracker feedback reported 51 open actions for `portfolio-subscription-cancellation-monitor`, with no in-progress, blocked, done, or progress-note signals. No completed or dismissed actions were applied.
- Supabase remains active. Local configured `agent_runs` moved to 106 with latest row at 2026-05-28T03:20:13Z and local `cost_events` moved to 12 with latest row at 2026-05-27T20:37:59Z. Production `analytics_events` moved to 5134 with latest row at 2026-05-28T07:54:16Z, and production `agent_runs` moved to 76 with latest row at 2026-05-27T17:04:10Z.
- n8n Cloud remains operational through the connector: sampled executions `15420` through `15424` succeeded around 2026-05-28T12:00Z. Direct workflow-list API returned 403 in this run, so workflow counts remain based on prior readable API plus checked-in exports.
- Vercel remains active through CLI evidence: `vercel whoami` returned `vsillah`, `portfolio` showed ready production and preview deployments within the prior hour, and `portfolio-staging` showed ready production deployments within the prior day.
- Stripe remains a live revenue dependency even though the connector returned no charges after 2026-05-01; latest sampled successful payment evidence remains April 2026 from prior sweeps.
- Read AI is still a keep item: the authenticated connector returned May meetings through 2026-05-27, and the Slack transcript channel includes a Read AI recap on 2026-05-27. No transcript, private participant detail, or raw meeting content is included here.
- No vendor crossed the approval-ready cancellation threshold. OpenRouter returned zero current-key usage again, Vapi returned zero sampled calls again, Resend had no local key, Calendly returned 401, Gemini/Google AI returned 403, Printful sync remained empty despite one API-visible order from 2026-04-06, and ElevenLabs still shows zero characters used in the current reset cycle.
- BuiltWith remains a protected watch item during the outreach/client-volume ramp. Fireflies remains resolved as canceled per Vambah's 2026-05-01 confirmation unless new paid-plan evidence appears; Slack history did show a Fireflies recap after that date, but this run found no paid-plan evidence.

Raw Findings

- Prior automation memory existed at `/Users/vambahsillah/.codex/automations/portfolio-subscription-cancellation-monitor/memory.md` and recorded the 2026-05-19 through 2026-05-27 monitor runs. This run used automation memory, checked-in tracker/status files, local repo references, n8n exports, read-only connector checks, and sanitized provider API summaries as continuity state.
- Read-only provider checks ran on 2026-05-28. Secret values, raw account payloads, private meeting content, private exports, and raw logs are not included in this report.
- Supabase production aggregates: `analytics_events` 5134/latest 2026-05-28T07:54:16Z, `agent_runs` 76/latest 2026-05-27T17:04:10Z, `cost_events` 21/latest 2026-05-14T01:13:20Z, `orders` 26/latest 2026-03-19T14:54:19Z, `printful_sync_log` 0, `email_messages` 9/latest 2026-04-30T19:53:15Z, `meeting_records` 110/latest 2026-05-06T16:32:58Z, `gamma_reports` 6/latest 2026-05-02T01:20:15Z, `videos` 4/latest 2026-04-15T02:52:07Z, and `social_content_queue` 29/latest 2026-05-07T13:00:49Z.
- Supabase local configured aggregates: `analytics_events` 2139/latest 2026-05-26T18:26:50Z, `agent_runs` 106/latest 2026-05-28T03:20:13Z, `cost_events` 12/latest 2026-05-27T20:37:59Z, `orders` 1/latest 2026-04-06T19:35:41Z, `printful_sync_log` 0, `email_messages` 6/latest 2026-04-28T00:38:19Z, `meeting_records` 4/latest 2026-04-14T01:15:12Z, `gamma_reports` 4/latest 2026-04-16T14:56:34Z, `videos` 4/latest 2026-03-25T13:48:33Z, and `social_content_queue` 3/latest 2026-05-23T09:24:08Z.
- n8n Cloud connector: sampled executions `15420` through `15424` succeeded around 2026-05-28T12:00Z. Direct workflow-list API returned 403, so no workflow settings were changed and no workflow payloads were exposed.
- Vercel CLI authentication was available as `vsillah`; deployment listings returned current activity for both `portfolio` and `portfolio-staging`.
- Stripe connector search was readable but returned no charges after 2026-05-01; previous latest sampled successful charge/payment intent remains 2026-04-06.
- Apify API: the five sampled actor runs included 2026-05-27 activity, with succeeded and failed statuses and low sampled run costs. Account-level usage is active; actor-level quality remains mixed.
- ElevenLabs API: subscription remained readable with 0 of 246,034 characters used in the current reset cycle; next reset is 2026-06-19T18:38:26Z.
- OpenRouter API: current key again reports zero usage.
- Vapi API: default calls sample returned HTTP 200 with zero calls; prior visible call evidence remains the 2026-04-30 `webCall`.
- Pinecone API: one index remains visible.
- Printful API: orders endpoint was readable and returned one sampled order with latest timestamp 2026-04-06T20:21:48Z; both sampled Supabase `printful_sync_log` tables remain empty.
- Hunter.io API: sampled account usage showed 50 calls used and 75 available before the 2026-06-09 reset.
- Slack bot auth, OpenAI model listing, Anthropic model listing, and Read AI connector listing were readable. HeyGen avatar listing timed out in this run, while prior runs had readable HeyGen catalog evidence. Resend local key was absent. Calendly returned 401 unauthenticated. Gemini/Google AI returned 403 permission denied.
- Local repo/config footprint remains broad: `package.json`, `.env.example`, `.env.staging.example`, credential docs, app/api routes, lib integrations, scripts, n8n exports, migrations, and the admin Subscription Watch surface all continue to reference the monitored provider set.

Derived Movement Since Prior Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | Production `analytics_events` moved 5128 -> 5134; production `agent_runs` moved 74 -> 76; local `agent_runs` moved 103 -> 106 | Active | Keep |
| n8n Cloud | Five sampled successful executions at 2026-05-28T12:00Z | Active | Keep; direct workflow API 403 is an access issue, not inactivity |
| Vercel | CLI authenticated; portfolio and portfolio-staging listings showed same-day deployment activity | Active hosting | Keep |
| Stripe | No charges after 2026-05-01 via connector; prior successful charge/payment evidence remains April 2026 | Revenue dependency, quiet recent charge sample | Keep |
| Read.ai | Connector and Slack transcript surface show 2026-05-27 activity | Active enough | Keep |
| Apify | Sampled actor runs include 2026-05-27 activity, mixed success/failure | Account active, actor-level mixed | Keep account; continue actor replacement bakeoff |
| OpenRouter | Zero current-key usage again | Consecutive quiet key evidence | Watch; deprecate only after bakeoff and spend check |
| Vapi | Default call sample returned zero calls again | Quiet | Investigate billing/voice UX before any deprecation |
| Printful | API-visible sampled order latest 2026-04-06; app sync log still empty | Quiet sync, older order evidence | Investigate dashboard/store strategy |
| Resend | Local key absent; optional code/env references remain | Usage unresolved | Verify production env/billing |
| Calendly | API returned 401; scheduling links and n8n references remain | Auth unresolved | Refresh token; keep |
| Gemini / Google AI | Model-list check returned 403 | Auth/config unresolved | Resolve key/project status |
| ElevenLabs | Current cycle usage 0/246,034 characters again | Paid watch, current-cycle quiet | Review campaign need before next reset |
| Fireflies.ai | Slack history includes a May 15 recap, but no paid-plan evidence was found | Resolved canceled unless billing restarted | Keep out of active cancellation queue |

Inactive-For-Two-Sessions Evidence

- OpenRouter: zero current-key usage again across consecutive provider sweeps. Still not an automatic cancellation action because active spend, dependency scope, and replacement intent are not confirmed.
- Vapi: zero sampled calls again, with prior visible call evidence still 2026-04-30. Investigate dashboard billing and production voice intent before deprecation.
- Printful: `printful_sync_log` remains empty in sampled Supabase projects, but the Printful API still shows one older order. Treat as merchandise strategy investigation, not subscription cancellation.
- Resend: local key remains absent while code/env references remain. Verify Vercel production env and billing before removing code paths.
- Calendly and Gemini/Google AI: auth or project readiness issues continue, but repo and workflow dependencies remain. Refresh/resolve credentials before any provider decision.
- ElevenLabs: current reset-cycle character usage is zero again. Review campaign plan and dashboard billing before proposing cancellation.

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor has approval-ready cancellation evidence in this daily run.**

Approval Needed

- No cancellation approval is needed or requested today.
- Future cancellation still requires the exact phrase `Cancel <tool/vendor> for Portfolio`, followed by verification, a branch, deprecation/replacement work, focused validation, and rollback notes.

Next Audit Focus

- Verify Vapi, Printful, Resend, Pinecone, ElevenLabs, Calendly, and Gemini in their dashboards where API evidence is either quiet, auth-blocked, or billing-incomplete.
- Keep BuiltWith active during the outreach ramp and collect lead-prep/proposal outcome evidence before judging it.
- Keep Fireflies out of the active queue unless new paid-plan evidence appears; if a future receipt/dashboard signal appears, verify whether the canceled plan restarted.
- Continue the Apify actor-level replacement bakeoff before any account-level change.

## 2026-05-27 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- Initial checkout status was `main...origin/main` with no dirty tracked or untracked files. This run only updates the subscription tracker artifacts plus automation notification/memory files.
- Action tracker feedback reported 51 open actions for `portfolio-subscription-cancellation-monitor`, with no in-progress, blocked, done, or progress-note signals. No completed or dismissed actions were applied.
- Supabase remains active. Local configured `analytics_events` moved to 2139 with latest row at 2026-05-26T18:26:50Z, while local `agent_runs` stayed at 103 with latest row at 2026-05-26T09:13:14Z. Production `analytics_events` moved to 5128 with latest row at 2026-05-26T14:39:09Z, and production `agent_runs` moved to 74 with latest row at 2026-05-26T13:00:03Z.
- n8n Cloud remains operational: the API returned 77 workflows, 72 active workflows, and five sampled successful executions around 2026-05-27T12:00Z. The checked-in `n8n-exports` folder contains 44 top-level workflow JSON files plus the manifest, with 37 active exports.
- Vercel remains active through CLI evidence: `vercel whoami` returned `vsillah`, and both `portfolio` and `portfolio-staging` deployment listings returned current deployment activity. The latest `portfolio` deployment was queued and latest `portfolio-staging` deployment was building during the sample, with ready deployments also visible within the prior hour; treat that as deployment churn, not a subscription cancellation signal.
- Stripe remains a live revenue dependency: checkout sessions, charges, and payment intents were readable; latest sampled charge/payment intent remained paid/succeeded on 2026-04-06.
- Read AI is still a keep item: the authenticated connector returned three May meetings, with the latest sampled meeting starting 2026-05-26T17:55:50Z. No transcript, private participant detail, or raw meeting content is included here.
- No vendor crossed the approval-ready cancellation threshold. OpenRouter returned zero current-key usage again, Vapi returned zero sampled calls again, Printful sync remained empty, Resend had no local key, Calendly had no local access token, Gemini/Google AI remained blocked by project/key status, and ElevenLabs still shows zero characters used in the current reset cycle. These remain investigation/deprecation-packet items unless active billing and replacement scope are confirmed.
- BuiltWith remains a protected watch item during the outreach/client-volume ramp. Fireflies remains resolved as canceled per Vambah's 2026-05-01 confirmation unless new paid-plan evidence appears.

Raw Findings

- Prior automation memory existed at `/Users/vambahsillah/.codex/automations/portfolio-subscription-cancellation-monitor/memory.md` and recorded the 2026-05-19, 2026-05-23, 2026-05-24, 2026-05-25, and 2026-05-26 runs. This run used automation memory, checked-in tracker/status files, local repo references, n8n exports, read-only connector checks, and sanitized provider API summaries as continuity state.
- Read-only provider checks ran at 2026-05-27T12:34Z. Secret values, raw account payloads, private meeting content, private exports, and raw logs are not included in this report.
- Supabase production aggregates: `analytics_events` 5128, `agent_runs` 74, `documents_local_rag` 3434, `drive_video_queue` 35, `cost_events` 21, `printful_sync_log` 0, `orders` 26, `contact_submissions` 269, `meeting_records` 110, `gamma_reports` 6, `email_messages` 9, `outreach_queue` 9, `video_generation_jobs` 4, `diagnostic_audits` 29, and `social_content_queue` 29.
- Supabase local configured aggregates: `analytics_events` 2139, `agent_runs` 103, `documents_local_rag` 3434, `drive_video_queue` 35, `cost_events` 11, `printful_sync_log` 0, `orders` 1, `contact_submissions` 6, `meeting_records` 4, `gamma_reports` 4, `email_messages` 6, `outreach_queue` 6, `video_generation_jobs` 1, `diagnostic_audits` 8, and `social_content_queue` 3.
- n8n Cloud API: `N8N_CLOUD_API_KEY` was valid and returned 77 workflows, 72 active workflows, and sampled successful executions `15314` through `15318` at 2026-05-27T12:00Z.
- Vercel CLI authentication was available as `vsillah`; deployment listings returned current activity for both `portfolio` and `portfolio-staging`, including active queued/building items plus ready deployments within the prior hour.
- Stripe API: checkout sessions, charges, and payment intents were readable. Latest sampled charge was created 2026-04-06T19:37:14Z with paid/succeeded status; latest sampled payment intent was created 2026-04-06T19:35:48Z with succeeded status; latest sampled checkout session was created 2026-02-23T21:05:32Z with `payment` mode, `paid` payment status, and `complete` status.
- Apify API: account-level actor run sampling was readable; the five sampled runs included 2026-05-20 and 2026-05-15 activity, with four succeeded and one failed status.
- ElevenLabs API: subscription remains active on Creator with 0 of 246,034 characters used in the current reset cycle; next character reset is 2026-06-19T18:38:26Z.
- OpenRouter API: current key again reports zero usage.
- Vapi API: default calls sample returned 200 with zero calls; prior visible call evidence remains the 2026-04-30 `webCall`.
- Pinecone API: one ready serverless index named `publications` exists in `aws/us-east-1`.
- Printful API: two native stores remain visible; `printful_sync_log` remains empty in both sampled Supabase projects.
- Hunter.io API: account remains Free with 75 available calls and 50 used calls.
- HeyGen API: avatar catalog listing returned successfully with 1289 avatars; quota/billing still needs dashboard verification.
- Slack bot auth, OpenAI model listing, Anthropic model listing, and Read AI connector listing were readable. Calendly and Resend local keys were absent. Gemini/Google AI model-list check returned 403 with project/key permission status blocked.
- Local top-level n8n export footprint includes 44 workflow JSON files plus the manifest and 37 active exports. Relevant node types include 60 Supabase nodes, 61 HTTP request nodes, 40 Slack nodes, 32 webhook nodes, 18 OpenAI chat model nodes, 15 Gmail nodes, 5 Apify nodes, 4 OpenRouter chat model nodes, 4 Google Drive nodes, and 3 Pinecone vector-store nodes.

Derived Movement Since Prior Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | Local `analytics_events` moved 2136 -> 2139; production `analytics_events` moved 5125 -> 5128 and production `agent_runs` moved 73 -> 74 | Active | Keep; continue distinguishing production-history counts from local env samples |
| n8n Cloud | 77 workflows, 72 active, five sampled successful executions at 2026-05-27T12:00Z | Active | Keep; optimize weak workflows separately |
| Vercel | CLI authenticated; portfolio and portfolio-staging listings showed current queued/building plus ready deployment activity | Active hosting | Keep; re-poll deployment status separately if release verification needs settled state |
| Stripe | Latest sampled charge/payment intent remains succeeded on 2026-04-06 | Revenue dependency | Keep |
| Read.ai | Connector returned three May meetings, latest sampled 2026-05-26 | Active enough | Keep; no raw meeting content used |
| OpenRouter | Zero current-key usage again | Consecutive quiet key evidence | Watch; prepare deprecation packet only after bakeoff and spend check |
| Vapi | Default call sample returned zero calls again | Quiet | Investigate billing/voice UX before any deprecation |
| Printful | Two API stores visible; both sampled `printful_sync_log` tables remain empty | Quiet sync | Investigate store/order strategy |
| Resend | Local key absent; optional code/env references remain | Usage unresolved | Verify Vercel env/billing before deciding |
| Calendly | Local access token absent; scheduling references remain | Auth unresolved | Refresh token; keep |
| Gemini / Google AI | Model-list check returned 403 | Auth/config unresolved | Investigate key/project status before relying on it |
| ElevenLabs | Active Creator subscription, current cycle usage 0/246,034 characters | Paid watch, current-cycle quiet | Review against campaign plan before next reset |
| Apify | API readable; sampled account-level runs still include 2026-05-20 activity | Account active, actor-level mixed | Keep; pause/replace weak actor surfaces first |

Inactive-For-Two-Sessions Evidence

- OpenRouter: zero current-key usage again across consecutive provider sweeps. Still not an automatic cancellation action because active spend, dependency scope, and replacement intent are not confirmed.
- Vapi: zero sampled calls again, with prior visible call evidence still 2026-04-30. Investigate dashboard billing and production voice intent before deprecation.
- Printful: `printful_sync_log` remains empty while two stores are visible. Treat as merchandise strategy investigation, not subscription cancellation.
- Resend: local key remains absent while code/env references remain. Verify Vercel production env and billing before removing code paths.
- Calendly and Gemini/Google AI: auth or project readiness issues continue, but repo and workflow dependencies remain. Refresh/resolve credentials before any provider decision.
- ElevenLabs: current reset-cycle character usage is zero again. Review campaign plan and dashboard billing before proposing cancellation.

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor has approval-ready cancellation evidence in this daily run.**
- OpenRouter and Vapi remain the strongest deprecation-packet candidates if dashboard billing confirms active spend and the next model/voice bakeoff confirms no needed Portfolio role.
- Printful, Pinecone, Resend, Calendly auth, Gemini auth, and ElevenLabs remain decision/investigation items, not approved cancellation actions.
- BuiltWith is not a current cancellation candidate during the outreach/client-volume ramp.
- Fireflies.ai is already resolved/canceled and should not be re-opened unless new paid-plan evidence appears.
- No approval phrase was given in this run. Exact approval required for a cancellation workflow remains `Cancel <tool/vendor> for Portfolio`.

Next Audit Focus

- Review ElevenLabs current-cycle zero usage against the next planned social/audio/video campaign before the 2026-06-19 reset.
- Confirm OpenRouter's role in the next media/model bakeoff; if unused again and no active spend exists, prepare a deprecation packet rather than canceling automatically.
- Confirm Vapi dashboard billing and whether production voice UX is intended to stay enabled.
- Check Printful dashboard/order history and decide whether both stores remain strategically active.
- Verify whether Resend exists in Vercel production env or billing, and whether Gmail/n8n is the only real outbound path.
- Check Pinecone billing/API traffic and compare with the Supabase/local RAG replacement path.
- Restore or replace Calendly API access and re-run event-type usage checks.
- Resolve Gemini/Google AI key and project status before depending on Gemini image/social workflows.
- Continue the Apify actor-level replacement bakeoff by pausing or replacing weak surfaces before considering account-level changes.
- Keep BuiltWith active during the outreach/client-volume ramp and judge it only against lead prep, implementation strategy quality, proposal quality, and conversion outcomes.

## 2026-05-26 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- Initial checkout status was `codex/supabase-staging-rotation-evidence...origin/codex/supabase-staging-rotation-evidence` with only pre-existing untracked `tmp/`; this committed cleanup only updates the subscription tracker artifacts.
- Action tracker feedback reported 51 open actions for `portfolio-subscription-cancellation-monitor`, with no in-progress, blocked, done, or progress-note signals. No completed or dismissed actions were applied.
- Local configured Supabase moved again: `analytics_events` increased to 2136 with latest row at 2026-05-26T03:24:40Z, and `agent_runs` increased to 103 with latest row at 2026-05-26T09:13:14Z. Production Supabase showed fresh `agent_runs` movement to 73 with latest row at 2026-05-25T15:00:52Z, while production `analytics_events` remained 5125 with latest row at 2026-05-23T14:06:44Z.
- n8n Cloud remains operational: the API returned 77 workflows, 72 active workflows, and five sampled successful executions around 2026-05-26T12:00Z. The checked-in `n8n-exports` folder contains 45 workflow JSON files and 37 active exports.
- Vercel remains active through CLI evidence: `vercel whoami` returned `vsillah`, and both `portfolio` and `portfolio-staging` deployment listings returned current deployment URLs.
- Stripe remains a live revenue dependency: checkout sessions, charges, and payment intents were readable; latest sampled charge/payment intent remained paid/succeeded on 2026-04-06.
- Read AI is still a keep item: the direct local access token returned 401, but the authenticated connector returned three May meetings, latest sampled meeting starting 2026-05-15. Treat the local token as stale, not as inactivity.
- No vendor crossed the approval-ready cancellation threshold. OpenRouter returned zero current-key usage again, Vapi returned zero sampled calls again, Printful sync remained empty, Resend had no local key, Calendly returned 401 again, Gemini/Google AI remained blocked by project/key status, and ElevenLabs still shows zero characters used in the current reset cycle; these remain investigation/deprecation-packet items unless active billing and replacement scope are confirmed.
- BuiltWith remains a protected watch item during the outreach/client-volume ramp. Fireflies remains resolved as canceled per Vambah's 2026-05-01 confirmation unless new paid-plan evidence appears.

Raw Findings

- Prior automation memory existed at `/Users/vambahsillah/.codex/automations/portfolio-subscription-cancellation-monitor/memory.md` and recorded the 2026-05-19, 2026-05-23, 2026-05-24, and 2026-05-25 runs. This run used automation memory, checked-in tracker/status files, local repo references, n8n exports, read-only connector checks, and sanitized provider API summaries as continuity state.
- Read-only provider checks ran at 2026-05-26T12:33Z. Secret values, raw account payloads, private meeting content, private exports, and raw logs are not included in this report.
- Supabase production aggregates: `analytics_events` 5125, `agent_runs` 73, `documents_local_rag` 3434, `drive_video_queue` 35, `cost_events` 21, `printful_sync_log` 0, `orders` 26, `contact_submissions` 269, `meeting_records` 110, `gamma_reports` 6, `email_messages` 9, `outreach_queue` 9, `video_generation_jobs` 4, `diagnostic_audits` 29, and `social_content_queue` 29.
- Supabase local configured aggregates: `analytics_events` 2136, `agent_runs` 103, `documents_local_rag` 3434, `drive_video_queue` 35, `cost_events` 11, `printful_sync_log` 0, `orders` 1, `contact_submissions` 6, `meeting_records` 4, `gamma_reports` 4, `email_messages` 6, `outreach_queue` 6, `video_generation_jobs` 1, `diagnostic_audits` 8, and `social_content_queue` 3.
- n8n Cloud API: `N8N_CLOUD_API_KEY` was valid and returned 77 workflows, 72 active workflows, and sampled successful executions `15211` through `15215` at 2026-05-26T12:00Z.
- Vercel CLI authentication was available as `vsillah`; plain deployment listings returned current URLs for both `portfolio` and `portfolio-staging`.
- Stripe API: checkout sessions, charges, and payment intents were readable. Latest sampled charge was created 2026-04-06T19:37:14Z with paid/succeeded status; latest sampled payment intent was created 2026-04-06T19:35:48Z with succeeded status; latest sampled checkout session was created 2026-02-23T21:05:32Z with `payment` mode, `paid` payment status, and `complete` status.
- Apify API: account-level actor run sampling was readable; the five sampled runs included 2026-05-20 and 2026-05-15 activity, with four succeeded and one failed status.
- ElevenLabs API: subscription remains active on Creator with 0 of 246,034 characters used in the current reset cycle; next character reset is 2026-06-19T18:38:26Z.
- OpenRouter API: current key again reports zero usage.
- Vapi API: default calls sample returned 200 with zero calls; prior visible call evidence remains the 2026-04-30 `webCall`.
- Pinecone API: one ready serverless index named `publications` exists in `aws/us-east-1`.
- Printful API: two native stores remain visible; `printful_sync_log` remains empty in both sampled Supabase projects.
- Hunter.io API: account remains Free with 75 available calls and 50 used calls.
- HeyGen API: avatar catalog listing returned successfully with 1289 avatars; quota/billing still needs dashboard verification.
- Slack bot auth, OpenAI model listing, Anthropic model listing, and Read AI connector listing were readable. Read AI direct local token returned 401. Calendly direct check returned 401. Gemini/Google AI model-list check returned 403 with project/key status blocked. Resend local key was absent.
- Local top-level n8n export footprint includes 45 workflow JSON files and 37 active exports. Relevant node types include 60 Supabase nodes, 61 HTTP request nodes, 40 Slack nodes, 32 webhook nodes, 18 OpenAI chat model nodes, 15 Gmail nodes, 5 Apify nodes, 4 OpenRouter chat model nodes, 4 Google Drive nodes, and 3 Pinecone vector-store nodes.

Derived Movement Since Prior Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | Local `analytics_events` moved 2113 -> 2136 and local `agent_runs` moved 102 -> 103; production `agent_runs` moved 68 -> 73 | Active | Keep; continue distinguishing production-history counts from local env samples |
| n8n Cloud | 77 workflows, 72 active, five sampled successful executions at 2026-05-26T12:00Z | Active | Keep; optimize weak workflows separately |
| Vercel | CLI authenticated; portfolio and portfolio-staging listings returned current deployment URLs | Active hosting | Keep |
| Stripe | Latest sampled charge/payment intent remains succeeded on 2026-04-06 | Revenue dependency | Keep |
| OpenAI | Model list readable with 120 sampled models; code/cost references remain | Active | Keep; continue cost monitoring |
| Anthropic | Model list readable with 9 sampled models; code and n8n fallback/eval references remain | Watch | Decide after next receipt/bakeoff refresh |
| HeyGen | Avatar API works; billing/quota still not API-verified | Campaign-dependent active | Keep; verify dashboard quota/billing |
| Read.ai | Connector returned three May meetings; direct local token returned 401 | Active enough, local token stale | Keep; refresh local token only if needed for direct API automation |
| BuiltWith | Protected outreach-ramp decision remains | Protected watch | Keep during outreach/client-volume ramp |
| Fireflies.ai | No new paid evidence; previously confirmed canceled | Resolved canceled | Keep out of active queue |
| Vapi | Default call sample returned zero calls again | Quiet | Investigate billing/voice UX before any deprecation |
| Printful | Two API stores visible; both sampled `printful_sync_log` tables remain empty | Quiet sync | Investigate store/order strategy |
| Resend | Local key absent; optional code/env references remain | Usage unresolved | Verify Vercel env/billing before deciding |
| Pinecone | Ready `publications` serverless index remains | Active infrastructure exists, traffic unknown | Investigate billing/API traffic |
| Hunter.io | API reports Free plan with 75 available calls | Not a paid cancellation target | Keep/watch |
| OpenRouter | Zero current-key usage again | Consecutive quiet key evidence | Watch; prepare deprecation packet only after bakeoff and spend check |
| Apify | API readable; sampled account-level runs include 2026-05-20 activity | Account active, actor-level mixed | Keep; pause/replace weak actor surfaces first |
| ElevenLabs | Active Creator subscription, current cycle usage 0/246,034 characters | Paid watch, current-cycle quiet | Review against campaign plan before next reset |
| Calendly | Direct API check returned 401 again; scheduling references remain | Auth unresolved | Refresh token; keep |
| Gemini / Google AI | Model-list check returned 403; social image workflow references remain | Auth/config unresolved | Investigate key/project status before relying on it |
| Slack/Gmail/Google Drive | Slack auth readable; Gmail and Drive node/reference footprint remains in n8n exports and repo docs | Active integration surface | Keep; no paid cancellation signal from this run |
| Figma / Paper / Excalidraw / Canva | Only low local reference counts; no billing evidence gathered in this run | No paid evidence in repo | Investigate only if receipts/dashboard evidence appear |

Inactive-For-Two-Sessions Evidence

- OpenRouter: zero current-key usage again across consecutive provider sweeps. Still not an automatic cancellation action because active spend, dependency scope, and replacement intent are not confirmed.
- Vapi: zero sampled calls again, with prior visible call evidence still 2026-04-30. Investigate dashboard billing and production voice intent before deprecation.
- Printful: `printful_sync_log` remains empty while two stores are visible. Treat as merchandise strategy investigation, not subscription cancellation.
- Resend: local key remains absent while code/env references remain. Verify Vercel production env and billing before removing code paths.
- Calendly and Gemini/Google AI: consecutive auth or project failures continue, but repo and workflow dependencies remain. Refresh/resolve credentials before any provider decision.
- ElevenLabs: current reset-cycle character usage is zero again. Review campaign plan and dashboard billing before proposing cancellation.

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor has approval-ready cancellation evidence in this daily run.**
- OpenRouter and Vapi remain the strongest deprecation-packet candidates if dashboard billing confirms active spend and the next model/voice bakeoff confirms no needed Portfolio role.
- Printful, Pinecone, Resend, Calendly auth, Gemini auth, and ElevenLabs remain decision/investigation items, not approved cancellation actions.
- BuiltWith is not a current cancellation candidate during the outreach/client-volume ramp.
- Fireflies.ai is already resolved/canceled and should not be re-opened unless new paid-plan evidence appears.
- No approval phrase was given in this run. Exact approval required for a cancellation workflow remains `Cancel <tool/vendor> for Portfolio`.

Next Audit Focus

- Review ElevenLabs current-cycle zero usage against the next planned social/audio/video campaign before the 2026-06-19 reset.
- Confirm OpenRouter's role in the next media/model bakeoff; if unused again and no active spend exists, prepare a deprecation packet rather than canceling automatically.
- Confirm Vapi dashboard billing and whether production voice UX is intended to stay enabled.
- Check Printful dashboard/order history and decide whether both stores remain strategically active.
- Verify whether Resend exists in Vercel production env or billing, and whether Gmail/n8n is the only real outbound path.
- Check Pinecone billing/API traffic and compare with the Supabase/local RAG replacement path.
- Refresh Calendly token and re-run event-type usage checks.
- Resolve Gemini/Google AI key and project status before depending on Gemini image/social workflows.
- Continue the Apify actor-level replacement bakeoff by pausing or replacing weak surfaces before considering account-level changes.
- Keep BuiltWith active during the outreach/client-volume ramp and judge it only against lead prep, implementation strategy quality, proposal quality, and conversion outcomes.

## 2026-05-25 Weekly Report

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- The root checkout at `/Users/vambahsillah/Projects/Portfolio` was on `main` with pre-existing dirty subscription tracker files and untracked `tmp/`. This weekly report was prepared in the clean scoped worktree `/Users/vambahsillah/Projects/Portfolio.worktrees/subscription-weekly-2026-05-25` on branch `codex/subscription-weekly-2026-05-25`.
- Action tracker feedback reported 12 open actions for `portfolio-subscription-weekly-report`, with no in-progress, blocked, done, or progress-note signals. No completed or dismissed actions were re-raised.
- The 2026-05-25 daily monitor had already refreshed current read-only provider evidence. This weekly report uses that daily provider sweep, the durable tracker, the admin status JSON, repo references, automation memory, and sanitized automation notification state as its source set.
- Since the 2026-05-18 weekly report, core runtime evidence stayed active: local configured Supabase `agent_runs` moved from 76 to 102 and `analytics_events` moved from 2037 to 2113; n8n Cloud still reports 77 workflows, 72 active workflows, and successful sampled executions around 2026-05-25T12:00Z; Vercel CLI remains authenticated and can list both `portfolio` and `portfolio-staging`.
- Production Supabase was quieter in the latest sample, with `analytics_events` still at 5125 and latest production `agent_runs` still at 2026-05-22T13:00:03Z. This is a monitoring note, not a cancellation signal.
- Read.ai improved from the prior weekly auth-unresolved local-key state: the connector returned three May meetings again, latest sampled meeting starting 2026-05-15, so Read.ai stays a green keep item while meeting-intelligence workflows remain useful.
- Vapi also improved from the prior weekly missing-local-key state to API-readable evidence, but the default call sample still returned zero calls. It remains a yellow watch item requiring billing/dashboard review before any deprecation packet.
- ElevenLabs moved into a new reset cycle: active Creator subscription with 0 of 246,034 characters used and next reset on 2026-06-19T18:38:26Z. Treat this as a campaign decision gate, not an automatic cancellation.
- No vendor crossed the approval-ready cancellation threshold. BuiltWith remains a protected watch item during the outreach/client-volume ramp. Fireflies remains resolved as canceled per Vambah's 2026-05-01 confirmation unless new paid-plan evidence appears.

Raw Findings

- Weekly automation memory existed at `/Users/vambahsillah/.codex/automations/portfolio-subscription-weekly-report/memory.md` and recorded the 2026-05-18 PR #313 handoff.
- Daily monitor evidence from 2026-05-25 was already present in the root tracker/status files; this weekly run preserved those root changes and staged the weekly roll-up from a separate worktree.
- Action tracker feedback file existed at `/Users/vambahsillah/.codex/automation-notifications/automation-action-feedback.json`; the weekly report entry had 12 open actions, 0 in-progress, 0 blocked, 0 done, and no progress notes.
- Read-only provider evidence used by this report was sanitized: no secret values, raw account payloads, raw meeting content, private exports, or full logs are included.
- Current confirmed monthly run-rate remains $791.02 against the $300 target, with expected next-cycle run-rate $684.77 if the Anthropic transition adjustment holds. This receipt-backed snapshot was last refreshed on 2026-05-06 and should be treated as transitional until the next settled receipt pass.
- Current budget line items remain: BuiltWith $307 watch, Anthropic $106.25 watch, OpenAI / ChatGPT Pro $106.25 keep, n8n Cloud $63.75 keep, Apify $39 keep/watch, HeyGen $30.81 keep, Gamma $25 keep/watch, Supabase $25.27 keep, ElevenLabs $23.38 watch, Vercel $21.25 keep, Read.ai $20.98 keep, Calendly $12.75 keep, and Google Cloud $9.33 keep.

Active Keep Items

| Tool/vendor | Status color | Billing/receipt signal | Operational usage signal | Repo dependency/risk | Recommendation | Exact next action |
| --- | --- | --- | --- | --- | --- | --- |
| Supabase | Green | Prior $25.27 receipt; core data plane | Local configured `agent_runs` 102 and `analytics_events` 2113; production quiet since latest sample | Core database, auth-adjacent records, admin reports, RAG/source state | Keep | Continue distinguishing local-project movement from production-history samples |
| n8n Cloud | Green | Prior $63.75 Cloud Pro receipt | 77 workflows, 72 active, successful sampled executions around 2026-05-25T12:00Z | Automation runtime and connector orchestration | Keep | Optimize weak workflows; do not cancel account-level service |
| Vercel | Green | Prior $21.25 Pro receipt; CLI authenticated | `portfolio` and `portfolio-staging` listings returned current deployment URLs; connector scope still 403 | Core production/staging hosting and deployment checks | Keep | Continue verifying both Vercel contexts during release work |
| Stripe | Green | API readable; latest sampled paid/succeeded charge/payment intent remains 2026-04-06 | Checkout sessions, charges, and payment intents readable | Revenue and checkout dependency | Keep | Monitor revenue health; no subscription action |
| OpenAI / ChatGPT Pro | Green | Prior $106.25 ChatGPT Pro receipt | OpenAI model list readable; repo/cost references remain | Primary premium AI plan and model workflows | Keep | Continue cost monitoring and model-role review |
| Gamma | Green | Prior $25 Gamma Pro receipt | Latest production report remains 2026-05-02; admin/report code active | Deck/report generation surface | Keep/watch | Compare Gamma against Codex/PPTX alternatives during next report cycle |
| HeyGen | Green | Prior $30.81 Creator receipt; API billing not verified | Avatar catalog readable; video/campaign code references remain | Presenter/avatar video workflows | Keep | Verify quota/billing in dashboard before the next campaign |
| Read.ai | Green | Prior $20.98 Read Pro receipt | Connector returned three May meetings, latest sampled 2026-05-15 | Meeting transcript and recap workflows | Keep | Use connector evidence as usage signal; verify billing only for a cost-cut decision |
| Slack | Green | Workspace billing not checked in this run | Bot auth readable; Slack/n8n references remain heavy | Notifications, internal ops, n8n workflows | Keep | No subscription action |
| Apify | Green | Prior $39 monthly receipt; account API readable | Current five-run sample mixed and not newer than 2026-05-13; actor-level bakeoff still active | Lead enrichment, social listening, review capture | Keep account-level subscription | Continue actor-level replacement bakeoff and disable weak surfaces first |
| Calendly | Yellow | Prior $12.75 Standard receipt; direct API 401 again | Scheduling links/references and n8n Calendly triggers remain | Discovery, onboarding, kickoff, renewal scheduling | Keep, auth-refresh needed | Refresh Calendly token and rerun event-type usage checks |
| Google Cloud | Green | Prior $9.33 receipt | Low-cost infrastructure references remain | Supporting cloud infrastructure | Keep | Recheck only during next receipt refresh |
| Hunter.io | Green | API reports Free plan, 75 available calls and 50 used calls | Low reference count; no paid-plan evidence | Optional lead/contact enrichment | Keep/watch | Recheck only if paid-plan evidence appears |

Watch Items

| Tool/vendor | Status color | Billing/receipt signal | Operational usage signal | Repo dependency/risk | Recommendation | Exact next action |
| --- | --- | --- | --- | --- | --- | --- |
| BuiltWith | Yellow | Standing decision: keep active during outreach/client-volume ramp; largest tracked budget lever at $307 | Judge against lead prep, audits, implementation strategies, proposals, client outcomes, and conversion evidence | Outreach and client-prep enrichment | Keep as protected watch item | Compare BuiltWith-enriched work against actual sales prep and conversion outcomes |
| Anthropic | Yellow | Prior $106.25 Claude Max receipt; expected to drop if ChatGPT switch holds | Anthropic model list readable; fallback/eval references remain | LLM fallback/evaluation paths and any Claude workflow still in use | Watch through next receipt/bakeoff refresh | Confirm whether the ChatGPT switch removed the Anthropic line from the next settled cycle |
| ElevenLabs | Yellow | Active Creator subscription; 0 of 246,034 characters used in current cycle; next reset 2026-06-19 | Current cycle quiet; social/audio campaign dependency may still exist | Voiceover/audio generation for social content and media | Watch through campaign decision | Review current-cycle zero usage against the next planned social/audio/video campaign before 2026-06-19 |
| OpenRouter | Yellow | Current key returned usage 0 again; paid spend not confirmed | Consecutive quiet key evidence; 106 local references remain | Potential model-router or bakeoff fallback | Watch; prepare deprecation packet only after bakeoff and spend check | Confirm OpenRouter role in the next media/model bakeoff and verify active spend |
| Vapi | Yellow | Dashboard billing still needs verification; API key present and default call sample returned zero calls | Consecutive zero sampled calls; prior visible call remains 2026-04-30 | Voice/audit experience if production voice UX is enabled | Investigate billing and intended voice UX | Check Vapi dashboard billing and decide whether the voice path should stay enabled |

Unresolved Items

| Tool/vendor | Status color | Billing/receipt signal | Operational usage signal | Repo dependency/risk | Recommendation | Exact next action |
| --- | --- | --- | --- | --- | --- | --- |
| Printful | Yellow | API shows two native stores; billing/order history not verified | `printful_sync_log` remains empty in sampled Supabase projects | Merchandise/order fulfillment if store strategy is active | Investigate before deprecation | Check Printful dashboard orders and decide whether both native stores remain strategically active |
| Resend | Yellow | `RESEND_API_KEY` absent locally; production env and billing not verified | Optional code/env/webhook references remain; Gmail/n8n is visible outbound path | Transactional email if enabled in production | Verify production env and billing before deciding | Check Vercel production env/billing for Resend and confirm whether Gmail/n8n is the real outbound channel |
| Pinecone | Yellow | API returned one ready serverless `publications` index; billing/API traffic not available | RAG references and 323 local references remain; Supabase/local RAG also exists | Publication/RAG search path if Pinecone is live vector store | Investigate traffic and replacement path | Check Pinecone usage/billing dashboard before any replacement or cancellation packet |
| Gemini / Google AI | Yellow | Model-list check returned 403 again | Social image workflow references remain; current key/project status unusable from sample | Gemini/image generation and RAG chatbot experiments if active | Investigate key/project status | Resolve Google AI key/project permissions before depending on Gemini workflows |
| Figma / Paper / Excalidraw / Canva | Yellow | No billing evidence gathered in repo/API run | Low local references: Figma 2, Paper 24, Excalidraw 4, Canva 4 | Design and visual production if active outside repo | Investigate only if receipts/dashboard evidence appear | Check receipts or dashboards only when spend evidence appears |

Resolved/Canceled Items

| Tool/vendor | Status color | Billing/receipt signal | Operational usage signal | Repo dependency/risk | Recommendation | Exact next action |
| --- | --- | --- | --- | --- | --- | --- |
| Fireflies.ai | Green | Already canceled per Vambah confirmation on 2026-05-01; no new paid-plan evidence appeared | Only one local reference remains | No active Portfolio dependency identified | Keep out of active cancellation queue | No action unless a new receipt, dashboard signal, or code dependency appears |

Derived Movement Since Prior Weekly Report

| Tool/vendor | Prior weekly state | Latest weekly state | Movement | Recommendation |
| --- | --- | --- | --- | --- |
| Supabase | Local `agent_runs` 76 and `analytics_events` 2037 in 2026-05-18 weekly sample | Local `agent_runs` 102 and `analytics_events` 2113; production quiet since latest sample | Active local movement; production quiet note | Keep |
| n8n Cloud | 77 workflows, 72 active, latest success 2026-05-18 | 77 workflows, 72 active, sampled successful executions around 2026-05-25T12:00Z | Stable active | Keep |
| Read.ai | Local key absent/auth unresolved in 2026-05-18 weekly report | Connector returned three May meetings, latest 2026-05-15 | Improved evidence; now green keep in admin status | Keep |
| Vapi | Local key absent/auth unresolved in 2026-05-18 weekly report | API-readable but zero sampled calls | Evidence improved, usage still quiet | Dashboard billing/UX decision needed |
| ElevenLabs | Active Creator pre-reset at 18,068 of 164,102 characters used, reset 2026-05-19 | New cycle active Creator at 0 of 246,034 characters used, next reset 2026-06-19 | Reset-cycle rollover; current-cycle quiet | Review campaign plan |
| Apify | Latest sampled actor run succeeded on 2026-05-15 | Current five-run sample mixed/not newer than 2026-05-13; prior 2026-05-20 and bakeoff evidence remain | Account stays active, actor-level value mixed | Keep account, disable weak actors first |
| Calendly | 401 auth blocker | 401 auth blocker again | Auth issue persists | Refresh token; keep |
| Gemini / Google AI | 403 permission blocker | 403 permission blocker again | Auth/project issue persists | Resolve key/project permissions |
| OpenRouter | Current key usage 0 | Current key usage 0 again | Consecutive quiet evidence | Watch; verify spend and bakeoff role |
| BuiltWith | Protected outreach-ramp watch | Protected outreach-ramp watch | No decision change | Keep watch |
| Fireflies.ai | Resolved/canceled | Resolved/canceled | No decision change | Keep out of active queue |

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor has approval-ready cancellation evidence in this weekly run.**
- OpenRouter and Vapi remain the strongest deprecation-packet candidates only if dashboard billing confirms active spend and the next bakeoff/UX decision confirms no needed Portfolio role.
- Printful, Pinecone, Resend, Calendly auth, Gemini auth, and ElevenLabs remain decision/login-access items, not approved cancellation actions.
- BuiltWith is not a current cancellation candidate during the outreach/client-volume ramp.
- Fireflies.ai is already resolved/canceled and should not be re-opened unless new paid-plan evidence appears.
- No approval phrase was given in this run. Exact approval required for cancellation remains `Cancel <tool/vendor> for Portfolio`.

Next Audit Focus

- Review ElevenLabs current-cycle zero usage against the next planned social/audio/video campaign before 2026-06-19.
- Confirm OpenRouter's role in the next media/model bakeoff and verify active spend before preparing any deprecation packet.
- Check Vapi dashboard billing and decide whether production voice UX should stay enabled.
- Check Printful dashboard order history and decide whether both native stores remain strategically active.
- Verify whether Resend exists in Vercel production env/billing, and whether Gmail/n8n is the real outbound path.
- Check Pinecone billing/API traffic against the Supabase/local RAG replacement path.
- Refresh Calendly token and rerun event-type usage checks.
- Resolve Gemini/Google AI key/project permissions before relying on image/social workflows.
- Continue the Apify actor-level replacement bakeoff by pausing weak/no-run/failing actor surfaces before considering account-level changes.
- Keep BuiltWith active during the outreach ramp and judge it only against lead-prep and conversion evidence.

## 2026-05-25 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- Initial checkout status was `main...origin/main` with only pre-existing untracked `tmp/`; this run only updated the subscription tracker artifacts and automation notification/memory files.
- Action tracker feedback reported 51 open actions for `portfolio-subscription-cancellation-monitor`, with no in-progress, blocked, done, or progress-note signals. No completed or dismissed actions were applied.
- Local configured Supabase activity moved: `analytics_events` increased to 2113 with latest row at 2026-05-25T02:43:42Z, and `agent_runs` increased to 102 with latest row at 2026-05-25T10:18:53Z. Production Supabase stayed quiet since the prior sample: `analytics_events` remained 5125 with latest row at 2026-05-23T14:06:44Z, and `agent_runs` remained 68 with latest row at 2026-05-22T13:00:03Z.
- n8n Cloud remains operational: the API returned 77 workflows, 72 active workflows, and five sampled successful executions around 2026-05-25T12:00Z.
- Vercel remains active through CLI evidence: `vercel whoami` returned `vsillah` and both `portfolio` and `portfolio-staging` deployment listings returned current URLs. The Vercel connector still returned a scope 403, so CLI remains the usable read-only evidence path.
- Stripe remains a live revenue dependency: checkout sessions, charges, and payment intents were readable; latest sampled charge/payment intent remained paid/succeeded on 2026-04-06, and latest sampled checkout session remained a paid completed payment-mode session from 2026-02-23.
- Read AI connector returned three May meetings again, with the latest sampled meeting starting 2026-05-15, so Read AI remains active enough for meeting-intelligence workflow evidence.
- No vendor crossed the approval-ready cancellation threshold. OpenRouter returned zero current-key usage again, Vapi returned zero sampled calls again, Printful sync remained empty, Resend had no local key, Calendly returned 401 again, Gemini returned 403 again, and ElevenLabs still shows zero characters used in the current reset cycle; these remain investigation/deprecation-packet items unless active billing and replacement scope are confirmed.
- BuiltWith remains a protected watch item during the outreach/client-volume ramp. Fireflies remains resolved as canceled per Vambah's 2026-05-01 confirmation unless new paid-plan evidence appears.

Raw Findings

- Prior automation memory existed at `/Users/vambahsillah/.codex/automations/portfolio-subscription-cancellation-monitor/memory.md` and recorded the 2026-05-19, 2026-05-23, and 2026-05-24 runs. This run used automation memory, checked-in tracker/status files, local repo references, n8n exports, connector checks, and sanitized provider API summaries as continuity state.
- Read-only provider checks ran at 2026-05-25T12:33Z. Secret values, raw account payloads, private meeting content, and raw logs are not included in this report.
- Supabase production aggregates: `analytics_events` 5125, `agent_runs` 68, `documents_local_rag` 3434, `drive_video_queue` 35, `cost_events` 21, `printful_sync_log` 0, `orders` 26, `contact_submissions` 269, `meeting_records` 110, `gamma_reports` 6, `email_messages` 9, `outreach_queue` 9, `video_generation_jobs` 4, `diagnostic_audits` 29, and `social_content_queue` 29.
- Supabase local configured aggregates: `analytics_events` 2113, `agent_runs` 102, `documents_local_rag` 3434, `drive_video_queue` 35, `cost_events` 11, `printful_sync_log` 0, `orders` 1, `contact_submissions` 6, `meeting_records` 4, `gamma_reports` 4, `email_messages` 6, `outreach_queue` 6, `video_generation_jobs` 1, `diagnostic_audits` 8, and `social_content_queue` 3.
- n8n Cloud API: `N8N_CLOUD_API_KEY` was valid and returned 77 workflows, 72 active workflows, and sampled successful executions `15103` through `15107` at 2026-05-25T12:00Z.
- Vercel CLI authentication was available as `vsillah`; plain deployment listings returned current URLs for both `portfolio` and `portfolio-staging`. The Vercel connector project deployment lookup returned 403 for the linked team scope.
- Stripe API: checkout sessions, charges, and payment intents were readable. Latest sampled charge was created 2026-04-06T19:37:14Z with paid/succeeded status; latest sampled payment intent was created 2026-04-06T19:35:48Z with succeeded status; latest sampled checkout session was created 2026-02-23T21:05:32Z with `payment` mode, `paid` payment status, and `complete` status.
- Apify API: account-level actor run sampling was readable; the five sampled runs were dated 2026-04-29, 2026-05-06, and 2026-05-13, with mixed failed/succeeded status. Prior 2026-05-20 account-level activity remains in the tracker history.
- ElevenLabs API: subscription remains active on Creator with 0 of 246,034 characters used in the current reset cycle; next character reset is 2026-06-19T18:38:26Z.
- OpenRouter API: current key again reports zero usage.
- Vapi API: default calls sample returned 200 with zero calls; prior visible call evidence remains the 2026-04-30 `webCall`.
- Pinecone API: one ready serverless index named `publications` exists in `aws/us-east-1`.
- Printful API: two native stores remain visible: AmaduTown Store and Personal orders; `printful_sync_log` remains empty in both sampled Supabase projects.
- Hunter.io API: account remains Free with 75 available calls and 50 used calls.
- HeyGen API: avatar catalog listing returned successfully with 1289 avatars; quota/billing still needs dashboard verification.
- Slack bot auth, OpenAI model listing, Anthropic model listing, and Read AI meeting listing were readable. Gemini model-list check returned 403. Calendly direct check returned 401. Resend local key was absent.
- Local reference counts, excluding subscription tracker files and lockfile/media/tmp noise: Supabase 4477, n8n 5287, Vercel 731, Stripe 615, OpenAI 782, Anthropic 258, Gamma 1252, HeyGen 766, Read.ai/Read AI 135, Vapi/VAPI 189, Printful 420, Resend 154, Pinecone 323, BuiltWith 279, Fireflies 1, Apify 405, Hunter 71, OpenRouter 106, ElevenLabs 188, Calendly 598, Slack 2036, Gmail 577, Gemini 92, Google AI 6, Perplexity 54, Figma 2, Paper 24, Excalidraw 4, and Canva 4.
- Local top-level n8n export footprint includes 45 workflow JSON files and 29 exports marked active by the checked-in export text. Relevant node types include 76 Supabase nodes, 81 HTTP request nodes, 51 Slack nodes, 43 webhook nodes, 35 OpenAI chat model nodes, 19 Gmail nodes, 7 OpenRouter chat model nodes, 7 Google Drive nodes, 6 Pinecone vector-store nodes, 2 Calendly triggers, and 1 Stripe trigger.

Derived Movement Since Prior Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | Local `analytics_events` moved 2100 -> 2113 and `agent_runs` moved 90 -> 102; production `analytics_events` and `agent_runs` stayed stable | Local active, production quiet since prior sample | Keep; continue distinguishing production-history counts from local env samples |
| n8n Cloud | 77 workflows, 72 active, five sampled successful executions at 2026-05-25T12:00Z | Active | Keep; retire/replace stale legacy key only after runtime ownership is clear |
| Vercel | CLI authenticated; portfolio and portfolio-staging listings returned current deployment URLs; connector scope returned 403 | Active hosting | Keep; use CLI evidence when connector auth is blocked |
| Stripe | Latest sampled charge/payment intent remains succeeded on 2026-04-06 | Revenue dependency | Keep |
| OpenAI | Model list readable with 120 sampled models; code/cost/event references remain | Active | Keep; continue cost monitoring |
| Anthropic | Model list readable with 9 sampled models; code and n8n fallback/eval references remain | Watch | Decide after next receipt/bakeoff refresh |
| Gamma | Latest production report remains 2026-05-02; admin/report code active | Active enough | Keep; watch deck alternatives |
| HeyGen | Avatar API works; billing/quota still not API-verified | Campaign-dependent active | Keep; verify dashboard quota/billing |
| Read.ai | Connector returned three May meetings, latest 2026-05-15 | Active enough | Keep while meeting transcript workflow remains useful |
| BuiltWith | Protected outreach-ramp decision remains | Protected watch | Keep during outreach/client-volume ramp |
| Fireflies.ai | No new paid evidence; previously confirmed canceled | Resolved canceled | Keep out of active queue |
| Vapi | Default call sample returned zero calls again | Quiet | Investigate billing/voice UX before any deprecation |
| Printful | Two API stores visible; both sampled `printful_sync_log` tables remain empty | Quiet sync | Investigate store/order strategy |
| Resend | Local key absent; optional code/env references remain | Usage unresolved | Verify Vercel env/billing before deciding |
| Pinecone | Ready `publications` serverless index remains | Active infrastructure exists, traffic unknown | Investigate billing/API traffic |
| Hunter.io | API reports Free plan with 75 available calls | Not a paid cancellation target | Keep/watch |
| OpenRouter | Zero current-key usage again | Consecutive quiet key evidence | Watch; prepare deprecation packet only after bakeoff and spend check |
| Apify | API readable; sampled account-level runs were mixed and not newer than 2026-05-13 in this sample | Account active, actor-level mixed | Keep; pause/replace weak actor surfaces first |
| ElevenLabs | Active Creator subscription, current cycle usage 0/246,034 characters | Paid watch, current-cycle quiet | Review against campaign plan before next reset |
| Calendly | Direct API check returned 401 again; scheduling references remain | Auth unresolved | Refresh token; keep |
| Gemini / Google AI | Model-list check returned 403; social image workflow references remain | Auth/config unresolved | Investigate key/project status before relying on it |
| Slack | Bot auth readable; Slack/n8n references remain heavy | Active integration | Keep |
| Figma / Paper / Excalidraw / Canva | Only low local reference counts; no billing evidence gathered in this run | No paid evidence in repo | Investigate only if receipts/dashboard evidence appear |

Inactive-For-Two-Sessions Evidence

- OpenRouter: zero current-key usage again across consecutive provider sweeps. Still not an automatic cancellation action because active spend, dependency scope, and replacement intent are not confirmed.
- Vapi: zero sampled calls again, with prior visible call evidence still 2026-04-30. Investigate dashboard billing and production voice intent before deprecation.
- Printful: `printful_sync_log` remains empty while two stores are visible. Treat as merchandise strategy investigation, not subscription cancellation.
- Resend: local key remains absent while code/env references remain. Verify Vercel production env and billing before removing code paths.
- Calendly and Gemini: consecutive auth failures continue, but repo and workflow dependencies remain. Refresh credentials before any provider decision.
- ElevenLabs: current reset-cycle character usage is zero again. Review campaign plan and dashboard billing before proposing cancellation.

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor has approval-ready cancellation evidence in this daily run.**
- OpenRouter and Vapi remain the strongest deprecation-packet candidates if dashboard billing confirms active spend and the next model/voice bakeoff confirms no needed Portfolio role.
- Printful, Pinecone, Resend, Calendly auth, Gemini auth, and ElevenLabs remain decision/investigation items, not approved cancellation actions.
- No approval phrase was given in this run. Exact approval required for a cancellation workflow remains `Cancel <tool/vendor> for Portfolio`.

Next Audit Focus

- Review ElevenLabs current-cycle zero usage against the next planned social/audio/video campaign before the 2026-06-19 reset.
- Confirm OpenRouter's role in the next media/model bakeoff; if unused again and no active spend exists, prepare a deprecation packet rather than canceling automatically.
- Confirm Vapi dashboard billing and whether production voice UX is intended to stay enabled.
- Check Printful dashboard/order history and decide whether both stores remain strategically active.
- Verify whether Resend exists in Vercel production env or billing, and whether Gmail/n8n is the only real outbound path.
- Check Pinecone billing/API traffic and compare with the Supabase/local RAG replacement path.
- Refresh Calendly token and re-run event-type usage checks.
- Check Gemini/Google AI key and project status before depending on Gemini image/social workflows.
- Continue the Apify actor-level replacement bakeoff by pausing or replacing weak surfaces before considering account-level changes.
- Keep BuiltWith active during the outreach/client-volume ramp and judge it only against lead prep, implementation strategy quality, proposal quality, and conversion outcomes.

## 2026-05-24 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- Initial checkout status was `codex/auth-deep-link-redirect` with pre-existing dirty work in `components/ProtectedRoute.tsx`, `lib/auth.ts`, `docs/subscription-cancellation-audit.md`, `docs/subscription-status.json`, and untracked `tmp/`. This run only updated the subscription tracker artifacts and automation notification/memory files.
- Action tracker feedback reported 51 open actions for `portfolio-subscription-cancellation-monitor`, with no in-progress, blocked, done, or progress-note signals. No completed or dismissed actions were applied.
- Core runtime signals still moved: local configured Supabase `analytics_events` increased to 2100 with latest row at 2026-05-24T11:18:17Z; local `agent_runs` stayed at 90 with latest row at 2026-05-23T09:24:16Z; production `analytics_events` increased to 5125 with latest row at 2026-05-23T14:06:44Z; production `agent_runs` stayed at 68 with latest row at 2026-05-22T13:00:03Z.
- n8n Cloud remains operational: the API returned 77 workflows, 72 active workflows, and five sampled successful executions around 2026-05-24T12:00Z.
- Vercel remains active through CLI evidence: `vercel whoami` returned `vsillah` and both `portfolio` and `portfolio-staging` deployment listings returned current URLs. The local `.vercel/project.json` has linked project/org ids; no Vercel settings were changed.
- Stripe remains a live revenue dependency: checkout sessions, charges, and payment intents were readable; latest sampled charge/payment intent remained paid/succeeded on 2026-04-06, and latest sampled checkout session remained a paid completed payment-mode session from 2026-02-23.
- Read AI connector returned three May meetings again, with the latest sampled meeting starting 2026-05-15, so Read AI remains active enough for meeting-intelligence workflow evidence.
- No vendor crossed the approval-ready cancellation threshold. OpenRouter returned zero current-key usage again, Vapi returned zero sampled calls again, Printful sync remained empty, Resend had no local key, Calendly returned 401 again, Gemini returned 403 again, and ElevenLabs still shows zero characters used in the current reset cycle; these remain investigation/deprecation-packet items unless active billing and replacement scope are confirmed.
- BuiltWith remains a protected watch item during the outreach/client-volume ramp. Fireflies remains resolved as canceled per Vambah's 2026-05-01 confirmation unless new paid-plan evidence appears.

Raw Findings

- Prior automation memory existed at `/Users/vambahsillah/.codex/automations/portfolio-subscription-cancellation-monitor/memory.md` and recorded the 2026-05-19 and 2026-05-23 runs. This run used automation memory, checked-in tracker/status files, local repo references, n8n exports, connector checks, and sanitized provider API summaries as continuity state.
- Read-only provider checks ran at 2026-05-24T12:34Z. Secret values, raw account payloads, and raw logs are not included in this report.
- Supabase production aggregates: `analytics_events` 5125, `agent_runs` 68, `documents_local_rag` 3434, `drive_video_queue` 35, `cost_events` 21, `printful_sync_log` 0, `orders` 26, `contact_submissions` 269, `meeting_records` 110, `gamma_reports` 6, `email_messages` 9, `outreach_queue` 9, `video_generation_jobs` 4, `diagnostic_audits` 29, and `social_content_queue` 29.
- Supabase local configured aggregates: `analytics_events` 2100, `agent_runs` 90, `documents_local_rag` 3434, `drive_video_queue` 35, `cost_events` 11, `printful_sync_log` 0, `orders` 1, `contact_submissions` 6, `meeting_records` 4, `gamma_reports` 4, `email_messages` 6, `outreach_queue` 6, `video_generation_jobs` 1, `diagnostic_audits` 8, and `social_content_queue` 3.
- n8n Cloud API: `N8N_CLOUD_API_KEY` was valid and returned 77 workflows, 72 active workflows, and sampled successful executions `15004` through `15008` at 2026-05-24T12:00Z.
- Vercel CLI authentication was available as `vsillah`; plain deployment listings returned current URLs for both `portfolio` and `portfolio-staging`.
- Stripe API: checkout sessions, charges, and payment intents were readable. Latest sampled charge was created 2026-04-06T19:37:14Z with paid/succeeded status; latest sampled payment intent was created 2026-04-06T19:35:48Z with succeeded status; latest sampled checkout session was created 2026-02-23T21:05:32Z with `payment` mode, `paid` payment status, and `complete` status.
- Apify API: account-level actor run sampling was readable; the five sampled runs were dated 2026-04-29, 2026-05-06, and 2026-05-13, with mixed failed/succeeded status. Prior 2026-05-20 account-level activity remains in the tracker history.
- ElevenLabs API: subscription remains active on Creator with 0 of 246,034 characters used in the current reset cycle; next character reset is 2026-06-19T18:38:26Z.
- OpenRouter API: current key again reports zero usage.
- Vapi API: default calls sample returned 200 with zero calls; prior visible call evidence remains the 2026-04-30 `webCall`.
- Pinecone API: one ready serverless index named `publications` exists in `aws/us-east-1`.
- Printful API: two native stores remain visible: AmaduTown Store and Personal orders; `printful_sync_log` remains empty in both sampled Supabase projects.
- Hunter.io API: account remains Free with 75 available calls and 50 used calls.
- HeyGen API: avatar catalog listing returned successfully with 1289 avatars; quota/billing still needs dashboard verification.
- Slack bot auth, OpenAI model listing, Anthropic model listing, and Read AI meeting listing were readable. Gemini model-list check returned 403. Calendly direct check returned 401. Resend local key was absent.
- Local reference counts, excluding subscription tracker files and lockfile/media/tmp noise: Supabase 970, n8n 4151, Vercel 545, Stripe 355, OpenAI 432, Anthropic 224, Gamma 514, HeyGen 365, Read.ai/Read AI 119, Vapi/VAPI 206, Printful 240, Resend 70, Pinecone 166, BuiltWith 154, Fireflies 1, Apify 199, Hunter 32, OpenRouter 60, ElevenLabs 52, Calendly 314, Slack 1062, Gmail 270, Gemini 51, Google Cloud/service references 46, Perplexity 28, Figma 2, Paper 8, Excalidraw 3, and Canva 0.
- Local top-level n8n export footprint includes 46 workflow JSON files and 38 exports marked active. Relevant node types include 64 Supabase nodes, 61 HTTP request nodes, 41 Slack nodes, 33 webhook nodes, 20 OpenAI chat model nodes, 15 Gmail nodes, 5 OpenRouter chat model nodes, 5 Apify nodes, and 3 Pinecone vector-store nodes.

Derived Movement Since Prior Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | Local `analytics_events` moved 2091 -> 2100; production `analytics_events` moved 5120 -> 5125; agent run counts stayed stable | Active | Keep; continue distinguishing production-history counts from local env samples |
| n8n Cloud | 77 workflows, 72 active, five sampled successful executions at 2026-05-24T12:00Z | Active | Keep; retire/replace stale legacy key only after runtime ownership is clear |
| Vercel | CLI authenticated; portfolio and portfolio-staging listings returned current deployment URLs | Active hosting | Keep |
| Stripe | Latest sampled charge/payment intent remains succeeded on 2026-04-06 | Revenue dependency | Keep |
| OpenAI | Model list readable with 120 sampled models; code/cost/event references remain | Active | Keep; continue cost monitoring |
| Anthropic | Model list readable with 9 sampled models; code and n8n fallback/eval references remain | Watch | Decide after next receipt/bakeoff refresh |
| Gamma | Latest production report remains 2026-05-02; admin/report code active | Active enough | Keep; watch deck alternatives |
| HeyGen | Avatar API works; billing/quota still not API-verified | Campaign-dependent active | Keep; verify dashboard quota/billing |
| Read.ai | Connector returned three May meetings, latest 2026-05-15 | Active enough | Keep while meeting transcript workflow remains useful |
| BuiltWith | Protected outreach-ramp decision remains | Protected watch | Keep during outreach/client-volume ramp |
| Fireflies.ai | No new paid evidence; previously confirmed canceled | Resolved canceled | Keep out of active queue |
| Vapi | Default call sample returned zero calls again | Quiet | Investigate billing/voice UX before any deprecation |
| Printful | Two API stores visible; both sampled `printful_sync_log` tables remain empty | Quiet sync | Investigate store/order strategy |
| Resend | Local key absent; optional code/env references remain | Usage unresolved | Verify Vercel env/billing before deciding |
| Pinecone | Ready `publications` serverless index remains | Active infrastructure exists, traffic unknown | Investigate billing/API traffic |
| Hunter.io | API reports Free plan with 75 available calls | Not a paid cancellation target | Keep/watch |
| OpenRouter | Zero current-key usage again | Consecutive quiet key evidence | Watch; prepare deprecation packet only after bakeoff and spend check |
| Apify | API readable; sampled account-level runs were mixed and not newer than 2026-05-13 in this sample | Account active, actor-level mixed | Keep; pause/replace weak actor surfaces first |
| ElevenLabs | Active Creator subscription, current cycle usage 0/246,034 characters | Paid watch, current-cycle quiet | Review against campaign plan before next reset |
| Calendly | Direct API check returned 401 again; scheduling references remain | Auth unresolved | Refresh token; keep |
| Gemini / Google AI | Model-list check returned 403; social image workflow references remain | Auth/config unresolved | Investigate key/project status before relying on it |
| Slack | Bot auth readable; Slack/n8n references remain heavy | Active integration | Keep |
| Figma / Paper / Excalidraw / Canva | Only low local reference counts; no billing evidence gathered in this run | No paid evidence in repo | Investigate only if receipts/dashboard evidence appear |

Inactive-For-Two-Sessions Evidence

- OpenRouter: zero current-key usage again across consecutive provider sweeps. Still not an automatic cancellation action because active spend, dependency scope, and replacement intent are not confirmed.
- Vapi: zero sampled calls again, with prior visible call evidence still 2026-04-30. Investigate dashboard billing and production voice intent before deprecation.
- Printful: `printful_sync_log` remains empty while two stores are visible. Treat as merchandise strategy investigation, not subscription cancellation.
- Resend: local key remains absent while code/env references remain. Verify Vercel production env and billing before removing code paths.
- Calendly and Gemini: consecutive auth failures continue, but repo and workflow dependencies remain. Refresh credentials before any provider decision.
- ElevenLabs: current reset-cycle character usage is zero again. Review campaign plan and dashboard billing before proposing cancellation.

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor has approval-ready cancellation evidence in this daily run.**
- OpenRouter and Vapi remain the strongest deprecation-packet candidates if dashboard billing confirms active spend and the next model/voice bakeoff confirms no needed Portfolio role.
- Printful, Pinecone, Resend, Calendly auth, Gemini auth, and ElevenLabs remain decision/investigation items, not approved cancellation actions.
- No approval phrase was given in this run.

Next Audit Focus

- Review ElevenLabs current-cycle zero usage against the next planned social/audio/video campaign before the 2026-06-19 reset.
- Confirm OpenRouter's role in the next media/model bakeoff; if unused again and no active spend exists, prepare a deprecation packet rather than canceling automatically.
- Confirm Vapi dashboard billing and whether production voice UX is intended to stay enabled.
- Check Printful dashboard/order history and decide whether both stores remain strategically active.
- Verify whether Resend exists in Vercel production env or billing, and whether Gmail/n8n is the only real outbound path.
- Check Pinecone billing/API traffic and compare with the Supabase/local RAG replacement path.
- Refresh Calendly token and re-run event-type usage checks.
- Check Gemini/Google AI key and project status before depending on Gemini image/social workflows.
- Continue the Apify actor-level replacement bakeoff by pausing or replacing weak surfaces before considering account-level changes.
- Keep BuiltWith active during the outreach/client-volume ramp and judge it only against lead prep, implementation strategy quality, proposal quality, and conversion outcomes.

## 2026-05-23 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- Initial checkout status was `codex/social-pilot-packet-layout...origin/codex/social-pilot-packet-layout` with only pre-existing untracked `tmp/`; no unrelated dirty work was modified.
- Action tracker feedback reported 51 open actions for `portfolio-subscription-cancellation-monitor`, with no in-progress, blocked, done, or progress-note signals. No completed or dismissed actions were applied.
- Core runtime signals moved again: local configured Supabase `analytics_events` increased to 2091 with latest row at 2026-05-23T09:40:21Z, local configured `agent_runs` increased to 90 with latest row at 2026-05-23T09:24:16Z, production Supabase `analytics_events` increased to 5120 with latest row at 2026-05-23T04:48:09Z, and production `agent_runs` increased to 68 with latest row at 2026-05-22T13:00:03Z.
- n8n Cloud remains operational: the API returned 77 workflows, 72 active workflows, and five sampled successful executions around 2026-05-23T12:00Z.
- Vercel remains active through CLI evidence: `vercel whoami` returned `vsillah` and both `portfolio` and `portfolio-staging` deployment listings returned current URLs. The Vercel connector project lookup returned 403, so CLI remains the usable read-only evidence path for this run.
- Stripe remains a live revenue dependency: checkout sessions, charges, and payment intents were readable; latest sampled charge/payment intent remained paid/succeeded on 2026-04-06, and latest sampled checkout session remained a paid completed payment-mode session from 2026-02-23.
- Read AI connector access returned three May meetings, with the latest sampled meeting starting 2026-05-15, so Read AI remains active enough for meeting-intelligence workflow evidence.
- No vendor crossed the approval-ready cancellation threshold. OpenRouter returned zero current-key usage again, Vapi returned zero sampled calls again, Printful sync remained empty, Resend had no local key, Calendly returned 401 again, and Gemini returned 403 again; these remain investigation/deprecation-packet items unless active billing and replacement scope are confirmed.
- BuiltWith remains a protected watch item during the outreach/client-volume ramp. Fireflies remains resolved as canceled per Vambah's 2026-05-01 confirmation unless new paid-plan evidence appears.

Raw Findings

- Prior daily automation memory existed at `/Users/vambahsillah/.codex/automations/portfolio-subscription-cancellation-monitor/memory.md` and recorded the 2026-05-19 run. This run used automation memory, checked-in tracker/status files, local repo references, n8n exports, connector checks, and sanitized provider API summaries as continuity state.
- Read-only provider checks ran at 2026-05-23T12:33Z. Secret values, raw account payloads, and raw logs are not included in this report.
- Supabase production aggregates: `analytics_events` 5120, `agent_runs` 68, `documents_local_rag` 3434, `drive_video_queue` 35, `cost_events` 21, `printful_sync_log` 0, `orders` 26, `contact_submissions` 269, `meeting_records` 110, `gamma_reports` 6, `email_messages` 9, `outreach_queue` 9, `video_generation_jobs` 4, `diagnostic_audits` 29, and `social_content_queue` 29.
- Supabase local configured aggregates: `analytics_events` 2091, `agent_runs` 90, `documents_local_rag` 3434, `drive_video_queue` 35, `cost_events` 11, `printful_sync_log` 0, `orders` 1, `contact_submissions` 6, `meeting_records` 4, `gamma_reports` 4, `email_messages` 6, `outreach_queue` 6, `video_generation_jobs` 1, `diagnostic_audits` 8, and `social_content_queue` 3.
- n8n Cloud API: `N8N_CLOUD_API_KEY` was valid and returned 77 workflows, 72 active workflows, and sampled successful executions `14905` through `14909` at 2026-05-23T12:00Z.
- Vercel CLI authentication was available as `vsillah`; plain deployment listings returned current URLs for both `portfolio` and `portfolio-staging`. Vercel connector project lookup for `.vercel/project.json` ids returned 403.
- Stripe API: checkout sessions, charges, and payment intents were readable. Latest sampled charge was created 2026-04-06T19:37:14Z with paid/succeeded status; latest sampled payment intent was created 2026-04-06T19:35:48Z with succeeded status; latest sampled checkout session was created 2026-02-23T21:05:32Z with `payment` mode, `paid` payment status, and `complete` status.
- Apify API: account-level actor run sampling returned recent activity, including a succeeded run on 2026-05-20T13:01:29Z, a failed run on 2026-05-20T13:00:45Z, and succeeded sampled runs on 2026-05-15.
- ElevenLabs API: subscription remains active on Creator with 0 of 246,034 characters used in the current reset cycle; next character reset is 2026-06-19T18:38:26Z.
- OpenRouter API: current key again reports zero usage.
- Vapi API: default calls sample returned 200 with zero calls; prior visible call evidence remains the 2026-04-30 `webCall`.
- Pinecone API: one ready serverless index named `publications` exists in `aws/us-east-1`.
- Printful API: two native stores remain visible: AmaduTown Store and Personal orders; `printful_sync_log` remains empty in both sampled Supabase projects.
- Hunter.io API: account remains Free with 75 available calls and 50 used calls.
- HeyGen API: avatar catalog listing returned successfully with 1289 avatars; quota/billing still needs dashboard verification.
- Slack bot auth, OpenAI model listing, Anthropic model listing, and Read AI meeting listing were readable. Gemini model-list check returned 403. Calendly direct check returned 401. Resend local key was absent.
- Local reference counts, excluding subscription tracker files: Supabase 4046, n8n 4420, Vercel 696, Stripe 564, OpenAI 754, Anthropic 243, Gamma 997, HeyGen 632, Read.ai/Read AI 200, Vapi/VAPI 283, Printful 419, Resend 125, Pinecone 297, BuiltWith 222, Fireflies 1, Apify 249, Hunter 49, OpenRouter 87, ElevenLabs 123, Calendly 462, Slack 1417, Gmail 470, Gemini 56, Google Cloud 21, Perplexity 42, Figma 2, Paper 22, Excalidraw 3, and Canva 12.
- Local top-level n8n export footprint includes 46 workflow JSON files and 38 exports marked active. Relevant node types include 64 Supabase nodes, 61 HTTP request nodes, 41 Slack nodes, 33 webhook nodes, 20 OpenAI chat model nodes, 17 Gmail/Gmail-trigger nodes, 12 Google Drive/Docs/Sheets nodes, 5 Apify nodes, 3 Pinecone vector-store nodes, 2 Calendly triggers, 1 Stripe trigger, 1 Slack trigger, and 1 Anthropic node.

Derived Movement Since Prior Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | Local configured `analytics_events` moved 2040 -> 2091 and `agent_runs` moved 77 -> 90; production `analytics_events` moved 5061 -> 5120 and `agent_runs` moved 64 -> 68 | Active | Keep; continue distinguishing production-history counts from local env samples |
| n8n Cloud | 77 workflows, 72 active, five sampled successful executions at 2026-05-23T12:00Z | Active | Keep; retire/replace stale legacy key only after runtime ownership is clear |
| Vercel | CLI authenticated; portfolio and portfolio-staging listings returned current deployment URLs; connector lookup returned 403 | Active hosting | Keep; use CLI evidence when connector auth is blocked |
| Stripe | Latest sampled charge/payment intent remains succeeded on 2026-04-06 | Revenue dependency | Keep |
| OpenAI | Model list readable with 120 sampled models; code/cost/event references remain | Active | Keep; continue cost monitoring |
| Anthropic | Model list readable with 9 sampled models; code and n8n fallback/eval references remain | Watch | Decide after next receipt/bakeoff refresh |
| Gamma | Latest production report remains 2026-05-02; admin/report code active | Active enough | Keep; watch deck alternatives |
| HeyGen | Avatar API works; billing/quota still not API-verified | Campaign-dependent active | Keep; verify dashboard quota/billing |
| Read.ai | Connector returned three May meetings, latest 2026-05-15 | Active enough | Keep while meeting transcript workflow remains useful |
| BuiltWith | Protected outreach-ramp decision remains | Protected watch | Keep during outreach/client-volume ramp |
| Fireflies.ai | No new paid evidence; previously confirmed canceled | Resolved canceled | Keep out of active queue |
| Vapi | Default call sample returned zero calls again | Quiet | Investigate billing/voice UX before any deprecation |
| Printful | Two API stores visible; both sampled `printful_sync_log` tables remain empty | Quiet sync | Investigate store/order strategy |
| Resend | Local key absent; optional code/env references remain | Usage unresolved | Verify Vercel env/billing before deciding |
| Pinecone | Ready `publications` serverless index remains | Active infrastructure exists, traffic unknown | Investigate billing/API traffic |
| Hunter.io | API reports Free plan with 75 available calls | Not a paid cancellation target | Keep/watch |
| OpenRouter | Zero current-key usage again | Consecutive quiet key evidence | Watch; prepare deprecation packet only after bakeoff and spend check |
| Apify | Latest sampled account-level runs include 2026-05-20 activity | Account active, actor-level mixed | Keep; pause/replace weak actor surfaces first |
| ElevenLabs | Active Creator subscription, current cycle usage 0/246,034 characters | Paid watch, current-cycle quiet | Review against campaign plan before next reset |
| Calendly | Direct API check returned 401 again; scheduling references remain | Auth unresolved | Refresh token; keep |
| Gemini / Google AI | Model-list check returned 403; social image workflow references remain | Auth/config unresolved | Investigate key/project status before relying on it |
| Slack | Bot auth readable; Slack/n8n references remain heavy | Active integration | Keep |
| Figma / Paper / Excalidraw / Canva | Only low local reference counts; no billing evidence gathered in this run | No paid evidence in repo | Investigate only if receipts/dashboard evidence appear |

Inactive-For-Two-Sessions Evidence

- OpenRouter: zero current-key usage again across consecutive provider sweeps. Still not an automatic cancellation action because active spend, dependency scope, and replacement intent are not confirmed.
- Vapi: zero sampled calls again, with prior visible call evidence still 2026-04-30. Investigate dashboard billing and production voice intent before deprecation.
- Printful: `printful_sync_log` remains empty while two stores are visible. Treat as merchandise strategy investigation, not subscription cancellation.
- Resend: local key remains absent while code/env references remain. Verify Vercel production env and billing before removing code paths.
- Calendly and Gemini: consecutive auth failures continue, but repo and workflow dependencies remain. Refresh credentials before any provider decision.
- ElevenLabs: current reset-cycle character usage is zero after a prior active Creator subscription signal. Review campaign plan and dashboard billing before proposing cancellation.

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor has approval-ready cancellation evidence in this daily run.**
- OpenRouter and Vapi are the strongest deprecation-packet candidates if dashboard billing confirms active spend and the next model/voice bakeoff confirms no needed Portfolio role.
- Printful, Pinecone, Resend, Calendly auth, Gemini auth, and ElevenLabs remain decision/investigation items, not approved cancellation actions.
- No approval phrase was given in this run.

Next Audit Focus

- Review ElevenLabs current-cycle zero usage against the next planned social/audio/video campaign before the 2026-06-19 reset.
- Confirm OpenRouter's role in the next media/model bakeoff; if unused again and no active spend exists, prepare a deprecation packet rather than canceling automatically.
- Confirm Vapi dashboard billing and whether production voice UX is intended to stay enabled.
- Check Printful dashboard/order history and decide whether both stores remain strategically active.
- Verify whether Resend exists in Vercel production env or billing, and whether Gmail/n8n is the only real outbound path.
- Check Pinecone billing/API traffic and compare with the Supabase/local RAG replacement path.
- Refresh Calendly token and re-run event-type usage checks.
- Check Gemini/Google AI key and project status before depending on Gemini image/social workflows.
- Continue the Apify actor-level replacement bakeoff by pausing or replacing weak actor surfaces before considering account-level changes.
- Keep BuiltWith active during the outreach/client-volume ramp and judge it only against lead prep, implementation strategy quality, proposal quality, and conversion outcomes.

## 2026-05-19 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- Initial checkout status was `automation/vercel-autoresearch-notify-guard...origin/automation/vercel-autoresearch-notify-guard` with only untracked `.tmp/`; no unrelated dirty work was modified.
- Action tracker feedback reported 31 open actions for `portfolio-subscription-cancellation-monitor`, with no in-progress, blocked, done, or progress-note signals. No completed or dismissed actions were applied.
- Core runtime signals moved again: local configured Supabase `analytics_events` increased to 2040 with latest row at 2026-05-19T12:00:32Z, local configured `agent_runs` increased to 77 with latest row at 2026-05-18T15:14:53Z, and n8n Cloud reported 77 workflows, 72 active workflows, and five successful sampled executions at 2026-05-19T12:00Z.
- Production Supabase remained readable but quieter since yesterday's production sample: `agent_runs` stayed at 64 with latest row at 2026-05-18T13:00:03Z, `analytics_events` stayed at 5061 with latest row at 2026-05-17T20:04:55Z, and `printful_sync_log` remained empty.
- Vercel CLI remained authenticated as `vsillah` and listed current deployment URLs for both `portfolio` and `portfolio-staging`.
- Stripe remains a live revenue dependency: checkout sessions, charges, and payment intents were readable; the latest sampled charge/payment intent remained paid/succeeded on 2026-04-06, and the latest sampled checkout session remained a paid completed payment-mode session from 2026-02-23.
- Read AI connector access returned current meeting metadata for three May meetings, including a 2026-05-15 Zoom meeting, so Read AI is no longer classified as an auth-blocked usage check in this run.
- No vendor crossed the cancellation threshold. OpenRouter returned zero current-key usage again, Vapi returned zero sampled calls again, Printful sync remained empty, Resend had no local key, Calendly returned 401 again, and Gemini returned 403 again, but none has both confirmed active spend and an approved replacement/deprecation packet.
- BuiltWith remains a protected watch item during the outreach/client-volume ramp. Fireflies remains resolved as canceled per Vambah's 2026-05-01 confirmation unless new paid-plan evidence appears.

Raw Findings

- Prior daily automation memory file at `/Users/vambahsillah/.codex/automations/portfolio-subscription-cancellation-monitor/memory.md` was empty or missing, so this run used the checked-in tracker/status files plus the current provider sweep as continuity state.
- Read-only provider checks ran at 2026-05-19T12:35Z. Secret values, raw account payloads, and raw logs are not included in this report.
- Supabase production aggregates: `analytics_events` 5061, `meeting_records` 110, `orders` 26, `gamma_reports` 6, `social_content_queue` 29, `drive_video_queue` 35, `email_messages` 9, `documents_local_rag` 3434, `printful_sync_log` 0, `cost_events` 21, `video_generation_jobs` 4, `diagnostic_audits` 29, `outreach_queue` 9, `contact_submissions` 269, and `agent_runs` 64.
- Supabase local configured aggregates: `analytics_events` 2040, `agent_runs` 77, `documents_local_rag` 3434, `drive_video_queue` 35, `cost_events` 11, `printful_sync_log` 0, `orders` 1, `contact_submissions` 6, `meeting_records` 4, `gamma_reports` 4, `email_messages` 6, and `outreach_queue` 6.
- n8n Cloud API: `N8N_CLOUD_API_KEY` was valid and returned 77 workflows, 72 active workflows, and sampled successful executions `14500` through `14504` at 2026-05-19T12:00Z.
- Vercel CLI authentication was available as `vsillah`; plain deployment listings returned current URLs for both `portfolio` and `portfolio-staging`.
- Stripe API: checkout sessions, charges, and payment intents were readable. Latest sampled charge was created 2026-04-06T19:37:14Z with paid/succeeded status; latest sampled payment intent was created 2026-04-06T19:35:48Z with succeeded status; latest sampled checkout session was created 2026-02-23T21:05:32Z with `payment` mode, `paid` payment status, and `complete` status.
- Apify API: account-level actor run sampling remains active with latest sampled runs succeeded on 2026-05-15; plan-name parsing was inconclusive in this API response, so prior Starter-plan evidence remains the billing signal.
- ElevenLabs API: subscription remains active on Creator with 18,068 of 164,102 characters used; next character reset is 2026-05-19T18:38:26Z.
- OpenRouter API: current key again reports zero usage.
- Vapi API: default calls sample returned 200 with zero calls; prior visible call evidence remains the 2026-04-30 `webCall`.
- Pinecone API: one ready serverless index named `publications` exists in `aws/us-east-1`.
- Printful API: two native stores remain visible: AmaduTown Store and Personal orders; `printful_sync_log` remains empty in both sampled Supabase projects.
- Hunter.io API: account remains Free with 75 available calls and 50 used calls.
- HeyGen API: avatar catalog listing returned successfully with 1289 avatars; quota/billing still needs dashboard verification.
- Slack bot auth, OpenAI model listing, Anthropic model listing, and Read AI meeting listing were readable. Gemini model-list check returned 403. Calendly direct check returned 401. Resend local key was absent.
- Local reference counts, excluding subscription tracker files: Supabase 5018, n8n 5432, Vercel 777, Stripe 729, OpenAI 856, Anthropic 280, Gamma 1272, HeyGen 791, Read.ai/Read AI 124, Vapi/VAPI 1140, Printful 520, Resend 159, Pinecone 324, BuiltWith 263, Fireflies 1, Apify 382, Hunter 67, OpenRouter 102, ElevenLabs 211, Calendly 600, Slack 1693, Gmail 617, Gemini 94, Google Cloud 27, Perplexity 54, Figma 2, Paper 19, Excalidraw 4, and Canva 16.
- Local top-level n8n export footprint includes 45 workflow JSON files and 37 exports marked active. Relevant node types include 60 Supabase nodes, 40 Slack nodes, 25 OpenAI/OpenAI-chat/embedding nodes, 17 Gmail/Gmail-trigger nodes, 12 Google Drive/Docs/Sheets nodes, 5 Apify nodes, 3 Pinecone vector-store nodes, 2 Calendly triggers, 1 Stripe trigger, 1 Slack trigger, and 1 Anthropic node.

Derived Movement Since Prior Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | Local configured `analytics_events` moved from 2037 in the 2026-05-18 weekly sample to 2040 with latest row 2026-05-19T12:00:32Z; local configured `agent_runs` moved from 76 to 77 | Active | Keep; continue distinguishing production-history counts from local env samples |
| n8n Cloud | 77 workflows, 72 active, five sampled successful executions at 2026-05-19T12:00Z | Active | Keep; retire/replace stale legacy key only after runtime ownership is clear |
| Vercel | CLI authenticated; portfolio and portfolio-staging listings returned current deployment URLs | Active hosting | Keep |
| Stripe | Latest sampled charge/payment intent remains succeeded on 2026-04-06 | Revenue dependency | Keep |
| OpenAI | Model list readable; code/cost/event references remain | Active | Keep; continue cost monitoring |
| Anthropic | Model list readable; code and n8n fallback/eval references remain | Watch | Decide after next receipt/bakeoff refresh |
| Gamma | Latest production report remains 2026-05-02; admin/report code active | Active enough | Keep; watch deck alternatives |
| HeyGen | Avatar API works; billing/quota still not API-verified | Campaign-dependent active | Keep; verify dashboard quota/billing |
| Read.ai | Connector returned three May meetings | Active enough | Keep while meeting transcript workflow remains useful |
| BuiltWith | Protected outreach-ramp decision remains | Protected watch | Keep during outreach/client-volume ramp |
| Fireflies.ai | No new paid evidence; previously confirmed canceled | Resolved canceled | Keep out of active queue |
| Vapi | Default call sample returned zero calls again | Quiet | Investigate billing/voice UX |
| Printful | Two API stores visible; both sampled `printful_sync_log` tables remain empty | Quiet sync | Investigate store/order strategy |
| Resend | Local key absent; optional code/env references remain | Usage unresolved | Verify Vercel env/billing before deciding |
| Pinecone | Ready `publications` serverless index remains | Active infrastructure exists | Investigate billing/API traffic |
| Hunter.io | API reports Free plan with 75 available calls | Not a paid cancellation target | Keep/watch |
| OpenRouter | Zero current-key usage again | Consecutive quiet key evidence | Watch; prepare deprecation packet only after bakeoff and spend check |
| Apify | Latest sampled actor runs remain 2026-05-15 and prior actor-level evidence remains current | Account active, actor-level mixed | Keep; pause/replace weak actor surfaces first |
| ElevenLabs | Active Creator subscription; reset date 2026-05-19 | Paid, low recent movement | Review against campaign plan |
| Calendly | Direct API check returned 401 again; scheduling references remain | Auth unresolved | Refresh token; keep |
| Gemini / Google AI | Model-list check returned 403; social image workflow references remain | Auth/config unresolved | Investigate key/project status before relying on it |
| Slack | Bot auth readable; Slack/n8n references remain heavy | Active integration | Keep |

Inactive-For-Two-Sessions Evidence

- OpenRouter: zero current-key usage again across consecutive provider sweeps. Still not an automatic cancellation candidate because active spend and replacement scope are not confirmed.
- Vapi: zero sampled calls again, with prior visible call evidence still 2026-04-30. Investigate dashboard billing and production voice intent before deprecation.
- Printful: `printful_sync_log` remains empty while two stores are visible. Treat as merchandise strategy investigation, not subscription cancellation.
- Resend: local key remains absent while code/env references remain. Verify Vercel production env and billing before removing code paths.
- Calendly and Gemini: consecutive auth failures continue, but repo and workflow dependencies remain. Refresh credentials before any provider decision.

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor meets the cancellation threshold in this daily run.**
- OpenRouter, Vapi, Printful, Pinecone, Resend, Calendly auth, Gemini auth, and ElevenLabs remain decision/investigation items, not approved cancellation actions.
- No approval phrase was given in this run.

Next Audit Focus

- Review ElevenLabs after the 2026-05-19 reset window against the next planned social/audio/video campaign.
- Treat Read AI as currently usable through the connector, but verify dashboard billing before any cost-cut decision.
- Refresh Calendly token and re-run event-type usage checks.
- Confirm OpenRouter's role in the next media/model bakeoff; if unused again and no active spend exists, prepare a deprecation packet rather than canceling automatically.
- Confirm Vapi dashboard billing and whether production voice UX is intended to stay enabled.
- Check Printful dashboard/order history and decide whether both stores remain strategically active.
- Verify whether Resend exists in Vercel production env or billing, and whether Gmail/n8n is the only real outbound path.
- Check Pinecone billing/API traffic and compare with the Supabase/local RAG replacement path.
- Check Gemini/Google AI key and project status before depending on Gemini image/social workflows.
- Continue the Apify actor-level replacement bakeoff by pausing or replacing weak actor surfaces before considering account-level changes.

## 2026-05-18 Weekly Report

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- The checkout at `/Users/vambahsillah/Projects/Portfolio` was clean on `main`; this report was prepared on `codex/subscription-weekly-2026-05-18` so the weekly tracker update remains scoped.
- Action tracker feedback reported 7 open actions for `portfolio-subscription-weekly-report`, with no in-progress, blocked, done, or progress-note signals. No completed or dismissed actions were re-raised.
- Since the 2026-05-11 weekly report, n8n Cloud remains operational with 77 workflows, 72 active workflows, and a successful execution started at 2026-05-18T13:00:58Z.
- Supabase read-only evidence from the locally configured project shows active movement: `agent_runs` is now 76 with the latest row at 2026-05-17T14:14:51Z, and `analytics_events` has a latest row at 2026-05-17T22:32:02Z. Historic production-count comparisons in prior daily runs remain in the audit history.
- Stripe remains a live revenue dependency: sampled charges and payment intents remain readable, with the latest sampled charge/payment intent still succeeded on 2026-04-06 and the latest sampled checkout session still a paid completed payment-mode session from 2026-02-23.
- Vercel CLI remains authenticated as `vsillah` and listed current deployment URLs for both `portfolio` and `portfolio-staging`.
- No vendor crossed the cancellation threshold. BuiltWith remains a protected watch item during the outreach/client-volume ramp. Fireflies remains resolved as canceled per Vambah's 2026-05-01 confirmation unless new paid-plan evidence appears.

Raw Findings

- Weekly automation memory existed at `/Users/vambahsillah/.codex/automations/portfolio-subscription-weekly-report/memory.md`; last week's PR #216 was merged on 2026-05-11T13:24:14Z.
- Read-only provider checks ran at 2026-05-18T13:25Z. Secret values, raw account payloads, and raw logs are not included in this report.
- n8n Cloud API: `N8N_CLOUD_API_KEY` was valid and returned 77 workflows, 72 active workflows, and latest execution `14410` succeeded from 2026-05-18T13:00:58Z to 2026-05-18T13:01:00Z.
- Supabase REST checks against the locally configured project returned `agent_runs` 76, `analytics_events` 2037, `documents_local_rag` 3434, `drive_video_queue` 35, `cost_events` 11, `printful_sync_log` 0, `orders` 1, and `contact_submissions` 6. Latest movement in this sample was `analytics_events` at 2026-05-17T22:32:02Z and `agent_runs` at 2026-05-17T14:14:51Z.
- Stripe API: checkout sessions, charges, and payment intents were readable. Latest sampled charge was created 2026-04-06T19:37:14Z with paid/succeeded status; latest sampled payment intent was created 2026-04-06T19:35:48Z with succeeded status; latest sampled checkout session was created 2026-02-23T21:05:32Z with `payment` mode, `paid` payment status, and `complete` status.
- Apify API: account-level actor run sampling remains active with latest sampled run succeeded from 2026-05-15T14:03:10Z to 2026-05-15T14:03:36Z. Plan-name parsing was inconclusive in this API response, so prior Starter-plan evidence remains the billing signal.
- ElevenLabs API: subscription remains active on Creator with 18,068 of 164,102 characters used; next character reset remains 2026-05-19T18:38:26Z.
- OpenRouter API: current key again reports zero usage.
- Pinecone API: one ready serverless index named `publications` exists in `aws/us-east-1`.
- Printful API: two native stores remain visible: AmaduTown Store and Personal orders; `printful_sync_log` remains empty in the sampled Supabase project.
- Hunter.io API: account remains Free with 75 available calls and reset date 2026-06-09.
- HeyGen API: avatar catalog listing returned successfully with 1289 avatars; quota/billing still needs dashboard verification.
- Slack bot auth, OpenAI model listing, and Anthropic model listing were readable. Gemini model-list check returned 403. Calendly direct check returned 401. Read AI, Resend, and Vapi local keys were absent for this run.

Derived Movement Since Prior Weekly Report

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | `agent_runs` moved from 33 at the 2026-05-11 weekly report to 76 in the current local-project sample; daily production-history rows also moved through 2026-05-16 | Active | Keep; continue distinguishing production-history counts from local env samples |
| n8n Cloud | 77 workflows, 72 active, latest successful execution on 2026-05-18 | Active | Keep; retire/replace stale legacy key only after runtime ownership is clear |
| Vercel | CLI authenticated; portfolio and portfolio-staging listings returned current deployment URLs | Active hosting | Keep |
| Stripe | Latest sampled charge/payment intent remains succeeded on 2026-04-06 | Revenue dependency | Keep |
| OpenAI | Model list readable; code/cost/event references remain | Active | Keep; continue cost monitoring |
| Anthropic | Model list readable; receipt-backed run-rate still includes Anthropic until the next settled receipt proves the ChatGPT switch held | Watch | Decide after next receipt/bakeoff refresh |
| Gamma | Latest receipt-backed status remains keep; report/admin code remains active | Active enough | Keep; watch deck alternatives |
| HeyGen | Avatar API works; billing/quota still not API-verified | Campaign-dependent active | Keep; verify dashboard quota/billing |
| Read.ai | Local API key absent; prior receipt and meeting workflow references remain | Auth unresolved | Keep; refresh auth/API access |
| BuiltWith | Protected outreach-ramp decision remains | Protected watch | Keep during outreach/client-volume ramp |
| Fireflies.ai | No new paid evidence; previously confirmed canceled | Resolved canceled | Keep out of active queue |
| Vapi | Local key absent this run; prior visible call evidence remains 2026-04-30 and prior API samples were quiet | Quiet/auth unresolved | Investigate billing/voice UX |
| Printful | Two native stores visible; sync log still empty in sampled project | Quiet sync | Investigate store/order strategy |
| Resend | Local key absent; optional code/env references remain | Usage unresolved | Verify Vercel env/billing before deciding |
| Pinecone | Ready `publications` serverless index remains | Active infrastructure exists | Investigate billing/API traffic |
| Hunter.io | API reports Free plan with 75 available calls | Not a paid cancellation target | Keep/watch |
| OpenRouter | Zero current-key usage again | Consecutive quiet key evidence | Watch; prepare deprecation packet only after bakeoff and spend check |
| Apify | Latest sampled actor run succeeded on 2026-05-15; prior Starter-plan and actor bakeoff evidence remain | Account active, actor-level mixed | Keep; pause/replace weak actor surfaces first |
| ElevenLabs | Active Creator subscription; reset date 2026-05-19 | Paid, low recent movement | Review against imminent campaign usage |
| Calendly | Direct API check returned 401 again; scheduling references remain | Auth unresolved | Refresh token; keep |
| Gemini / Google AI | Model-list check returned 403 again; social image workflow references remain | Auth/config unresolved | Investigate key/project status before relying on it |
| Slack | Bot auth readable; Slack/n8n references remain heavy | Active integration | Keep |

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor meets the cancellation threshold in this weekly run.**
- OpenRouter, Vapi, Printful, Pinecone, Resend, Read.ai auth, Calendly auth, Gemini auth, and ElevenLabs remain decision/investigation items, not approved cancellation actions.
- No approval phrase was given in this run.

Next Audit Focus

- Review ElevenLabs before the 2026-05-19 reset/renewal window against the next planned social/audio/video campaign.
- Refresh Read AI auth/API access before using meeting-intelligence usage as provider evidence.
- Refresh Calendly token and re-run event-type usage checks.
- Confirm OpenRouter's role in the next media/model bakeoff and verify active spend before preparing any deprecation packet.
- Confirm Vapi dashboard billing and whether production voice UX is intended to stay enabled; restore read-only API evidence if the key should exist.
- Check Printful dashboard/order history and decide whether both native stores remain strategically active.
- Verify whether Resend exists in Vercel production env or billing, and whether Gmail/n8n is the only real outbound path.
- Check Pinecone billing/API traffic and compare with the Supabase/local RAG replacement path.
- Check Gemini/Google AI key and project status before depending on Gemini image/social workflows.
- Continue the Apify actor-level replacement bakeoff by pausing or replacing weak actor surfaces before considering account-level changes.

## 2026-05-18 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- Initial checkout status was clean on `main`. The checkout briefly moved to `codex/subscription-weekly-2026-05-18` during the audit and then returned to clean `main`; no unrelated dirty work was modified.
- Core runtime signals moved again: Supabase production `agent_runs` increased to 64 with the latest row at 2026-05-18T13:00:03Z, `analytics_events` increased to 5061 with the latest row at 2026-05-17T20:04:55Z, and n8n Cloud reported 77 workflows, 72 active workflows, and a successful execution started at 2026-05-18T13:00:58Z.
- Vercel remains operationally active: CLI auth was available as `vsillah`, and both `portfolio` and `portfolio-staging` listed recent Ready deployments.
- Stripe remains a live revenue dependency: checkout sessions, charges, and payment intents were readable; the latest sampled charge/payment intent remained paid/succeeded on 2026-04-06, and the latest sampled checkout session remained a paid completed payment-mode session from 2026-02-23.
- No vendor crossed the cancellation threshold. OpenRouter returned zero current-key usage again, and Vapi returned zero sampled calls through `VAPI_PRIVATE_KEY`, but neither has confirmed active spend plus an approved replacement/deprecation packet.
- BuiltWith remains a protected watch item during the outreach/client-volume ramp. Fireflies remains resolved as canceled per Vambah's 2026-05-01 confirmation unless new paid-plan evidence appears.

Raw Findings

- Prior daily automation memory existed at `/Users/vambahsillah/.codex/automations/portfolio-subscription-cancellation-monitor/memory.md` and recorded the 2026-05-17 run. The current checked-in docs did not include a 2026-05-17 daily section, so this run used automation memory plus live provider checks as continuity state.
- Action tracker feedback file was available, but it had no entry for `portfolio-subscription-cancellation-monitor`; no completed, dismissed, blocked, or in-progress tracker actions were applied.
- Read-only provider checks ran at 2026-05-18T13:26Z. Secret values, raw account payloads, and raw logs are not included in this report.
- Supabase production aggregates: `analytics_events` 5061, `meeting_records` 110, `orders` 26, `gamma_reports` 6, `social_content_queue` 29, `drive_video_queue` 35, `email_messages` 9, `documents_local_rag` 3434, `printful_sync_log` 0, `cost_events` 21, `video_generation_jobs` 4, `diagnostic_audits` 29, `outreach_queue` 9, `contact_submissions` 269, and `agent_runs` 64.
- n8n Cloud API: `N8N_CLOUD_API_KEY` was valid and returned 77 workflows, 72 active workflows, and a successful execution started at 2026-05-18T13:00:58Z.
- Apify API: account still reports Starter; latest account-level actor run sample remained a succeeded run started at 2026-05-15T14:03:10Z.
- ElevenLabs API: subscription remains active on Creator with 18,068 of 164,102 characters used; next character reset remains 2026-05-19T18:38:26Z.
- OpenRouter API: current key again reports zero usage.
- Vapi API: default calls sample returned 200 with zero calls; prior visible call evidence remains the 2026-04-30 `webCall`.
- Pinecone API: one ready serverless index named `publications` exists in `aws/us-east-1`.
- Printful API: two native stores remain visible; `printful_sync_log` remains empty.
- Hunter.io API: account remains Free with 75 available calls and 50 used calls.
- HeyGen API: avatar catalog listing returned successfully with 1289 avatars; quota/billing still needs dashboard verification.
- Slack bot auth was readable. OpenAI and Anthropic model-list endpoints were readable. Gemini model-list check returned 403. Read AI direct check was skipped because no local API key was present. Calendly direct check returned 401. Resend local key was absent.
- Local reference counts, excluding subscription tracker files: Supabase 3798, n8n 4197, Vercel 532, Stripe 523, OpenAI 751, Anthropic 240, Gamma 914, HeyGen 547, Read.ai/Read AI 171, Vapi 143, Printful 356, Resend 153, Pinecone 302, BuiltWith 228, Fireflies 1, Apify 360, Hunter 65, OpenRouter 95, ElevenLabs 90, Calendly 480, Slack 1461, Gmail 556, Gemini 86, Google Cloud 20, Perplexity 54, Figma 2, Paper 11, Excalidraw 4, and Canva 1.
- Local top-level n8n export footprint includes 45 workflow JSON files and 37 exports marked active. Relevant node types include 60 Supabase nodes, 41 Slack nodes, 28 OpenAI/OpenAI-chat nodes, 17 Gmail nodes, 12 Google nodes, 5 Apify nodes, 3 Pinecone vector-store nodes, 3 Perplexity nodes, 2 Calendly triggers, 1 Stripe trigger, and 1 Anthropic node.

Derived Movement Since Prior Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | `agent_runs` increased from 63 to 64; `analytics_events` increased from 5052 to 5061 | Active | Keep |
| n8n Cloud | Successful execution on 2026-05-18 with 72 active workflows | Active | Keep; retire/replace stale legacy key only after runtime ownership is clear |
| Vercel | CLI authenticated; production and staging listings show recent Ready deployments | Active hosting | Keep |
| Stripe | Latest sampled charge/payment intent remains succeeded on 2026-04-06 | Revenue dependency | Keep |
| OpenAI | Model list readable; code/cost/event references remain | Active | Keep; continue cost monitoring |
| Anthropic | Model list readable; code and n8n fallback/eval references remain | Watch | Decide after next receipt/bakeoff refresh |
| Gamma | Latest report remains 2026-05-02; admin/report code active | Active enough | Keep; watch deck alternatives |
| HeyGen | Avatar API works; billing/quota still not API-verified | Campaign-dependent active | Keep; verify dashboard quota/billing |
| Read.ai | Local API key absent; meeting rows/docs remain | Auth unresolved | Keep; refresh auth/API access |
| BuiltWith | Protected outreach-ramp decision remains | Protected watch | Keep during outreach/client-volume ramp |
| Fireflies.ai | No new paid evidence; previously confirmed canceled | Resolved canceled | Keep out of active queue |
| Vapi | Default call sample returned zero calls | Quiet | Investigate billing/voice UX |
| Printful | Two API stores visible; `printful_sync_log` still empty | Quiet sync | Investigate store/order strategy |
| Resend | Local key absent; optional code/env references remain | Usage unresolved | Verify Vercel env/billing before deciding |
| Pinecone | Ready `publications` serverless index remains | Active infrastructure exists | Investigate billing/API traffic |
| Hunter.io | API reports Free plan with 75 available calls | Not a paid cancellation target | Keep/watch |
| OpenRouter | Zero current-key usage again | Consecutive quiet key evidence | Watch; prepare deprecation packet only after bakeoff |
| Apify | Starter plan; latest account-level run sample 2026-05-15 and prior actor-level evidence remains current | Account active, actor-level mixed | Keep; pause/replace weak actor surfaces first |
| ElevenLabs | Active Creator subscription; reset date 2026-05-19 | Paid, low recent movement | Review against campaign plan |
| Calendly | Direct API check returned 401 again; scheduling references remain | Auth unresolved | Refresh token; keep |
| Gemini / Google AI | Model-list check returned 403; social image workflow references remain | Auth/config unresolved | Investigate key/project status before relying on it |
| Slack | Bot auth readable; Slack/n8n references remain heavy | Active integration | Keep |

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor meets the cancellation threshold in this daily run.**
- OpenRouter, Vapi, Printful, Pinecone, Resend, Read.ai auth, Calendly auth, Gemini auth, and ElevenLabs remain decision/investigation items, not approved cancellation actions.
- No approval phrase was given in this run.

Next Audit Focus

- Review ElevenLabs before/around the 2026-05-19 reset window against the next planned social/audio/video campaign.
- Refresh Read AI auth/API access before using meeting-intelligence usage as provider evidence.
- Refresh Calendly token and re-run event-type usage checks.
- Confirm OpenRouter's role in the next media/model bakeoff; if unused again and no active spend exists, prepare a deprecation packet rather than canceling automatically.
- Confirm Vapi dashboard billing and whether production voice UX is intended to stay enabled.
- Check Printful dashboard/order history and decide whether both stores remain strategically active.
- Verify whether Resend exists in Vercel production env or billing, and whether Gmail/n8n is the only real outbound path.
- Check Pinecone billing/API traffic and compare with the Supabase/local RAG replacement path.
- Check Gemini/Google AI key and project status before depending on Gemini image/social workflows.
- Continue the Apify actor-level replacement bakeoff by pausing or replacing weak actor surfaces before considering account-level changes.

## 2026-05-17 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- The checkout at `/Users/vambahsillah/Projects/Portfolio` was on `codex/open-brain-lighten-packet` with unrelated dirty work in `app/admin/agents/open-brain/page.tsx` and `docs/design/amadutown-color-palette-audit.md`; this run preserved those files and only updated the subscription tracker, automation memory, and sanitized pending notification.
- Core runtime signals remain active: n8n Cloud reported 77 workflows, 72 active workflows, and a successful execution started at 2026-05-17T12:00:52Z; Vercel CLI returned current deployment listings for both `portfolio` and `portfolio-staging`; Supabase production counts stayed readable with latest `agent_runs` and `contact_submissions` rows from 2026-05-15.
- Stripe remains a live revenue dependency: checkout sessions, charges, and payment intents were readable; the latest sampled charge/payment intent remained paid/succeeded on 2026-04-06, and the latest sampled checkout session remained a paid completed payment-mode session from 2026-02-23.
- No vendor crossed the cancellation threshold. OpenRouter returned zero current-key usage again and Vapi returned no sampled calls again, but neither has confirmed active spend plus an approved replacement/deprecation packet.
- Apify account evidence remains active: Starter plan remains visible and the latest account-level actor run sample was a succeeded run started 2026-05-15.
- BuiltWith remains a protected watch item during the outreach/client-volume ramp. Fireflies remains resolved as canceled per Vambah's 2026-05-01 confirmation unless new paid-plan evidence appears.

Raw Findings

- Prior automation memory file was missing at `$CODEX_HOME/automations/portfolio-subscription-cancellation-monitor/memory.md`; this run creates it. The durable tracker and admin status JSON were used as continuity state.
- Action tracker feedback file was available, but it had no entry for `portfolio-subscription-cancellation-monitor`; no completed, dismissed, blocked, or in-progress tracker actions were applied.
- Read-only provider checks ran at 2026-05-17T12:33Z. Secret values, raw account payloads, and raw logs are not included in this report.
- Supabase production aggregates: `analytics_events` 5052, `meeting_records` 110, `orders` 26, `gamma_reports` 6, `social_content_queue` 29, `drive_video_queue` 35, `email_messages` 9, `documents_local_rag` 3434, `printful_sync_log` 0, `cost_events` 21, `video_generation_jobs` 4, `diagnostic_audits` 29, `outreach_queue` 9, `contact_submissions` 269, and `agent_runs` 63.
- Supabase latest usage signals: latest `agent_runs` row remains 2026-05-15, latest `contact_submissions` row remains 2026-05-15, latest `analytics_events` row remains 2026-05-15, latest `cost_events` row remains 2026-05-14, latest Gamma report remains 2026-05-02, latest social content row remains 2026-05-07, latest video generation job remains 2026-04-15, latest meeting record remains 2026-05-06, and `printful_sync_log` remains empty.
- n8n Cloud API: `N8N_CLOUD_API_KEY` was valid and returned 77 workflows, 72 active workflows, and a successful execution started at 2026-05-17T12:00:52Z.
- Vercel CLI authentication was available as `vsillah`; deployment listings returned current entries for both `portfolio` and `portfolio-staging`, including ready production deployments within the last hour.
- Stripe API: checkout sessions, charges, and payment intents were readable. Latest sampled charge was created 2026-04-06T19:37:14Z with paid/succeeded status; latest sampled payment intent was created 2026-04-06T19:35:48Z with succeeded status; latest sampled checkout session was created 2026-02-23T21:05:32Z with `payment` mode, `paid` payment status, and `complete` status.
- Apify API: account still reports Starter; latest account-level actor run sample returned a succeeded run started at 2026-05-15T14:03:10Z.
- ElevenLabs API: subscription remains active on Creator with 18,068 of 164,102 characters used; next character reset remains 2026-05-19T18:38:26Z.
- OpenRouter API: current key again reports zero usage.
- Vapi API: default calls sample returned 200 with zero calls; prior visible call evidence remains the 2026-04-30 `webCall`.
- Pinecone API: one ready serverless index named `publications` exists in `aws/us-east-1`.
- Printful API: two native stores remain visible; `printful_sync_log` remains empty.
- Hunter.io API: account remains Free with 75 available calls.
- HeyGen API: avatar catalog listing returned successfully with 1289 avatars; quota/billing still needs dashboard verification.
- Slack bot auth was readable. OpenAI and Anthropic model-list endpoints were readable. Gemini model-list check returned 403. Read AI direct reports check returned 404 with the available token, so the correct endpoint/auth path still needs verification. Calendly direct check returned 401.
- Local reference counts, excluding subscription tracker files: Supabase 3459, n8n 3407, Vercel 557, Stripe 477, OpenAI 727, Anthropic 240, Gamma 876, HeyGen 611, Read.ai/Read AI 144, Vapi 189, Printful 315, Resend 129, Pinecone 273, BuiltWith 193, Fireflies 1, Apify 247, Hunter 43, OpenRouter 85, ElevenLabs 103, Calendly 416, Slack 1264, Gmail 455, Gemini 51, Google Cloud 20, Perplexity 42, Figma 2, Paper 18, Excalidraw 3, and Canva 4.
- Local n8n export footprint includes 46 workflow JSON files. Relevant node types include 84 Supabase nodes, 76 HTTP Request nodes, 53 Slack nodes, 39 OpenAI chat model nodes, 19 Gmail nodes, 18 Google Drive/Docs/Sheets nodes, 10 Apify nodes, 9 OpenRouter chat nodes, 6 Pinecone vector-store nodes, 6 Perplexity tool nodes, 6 OpenAI base nodes, 2 Calendly triggers, 1 Stripe trigger, 1 Slack trigger, and 1 Anthropic node.

Derived Movement Since Prior Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | Counts unchanged from 2026-05-16; latest operational rows remain 2026-05-15 | Active but quiet today | Keep |
| n8n Cloud | Successful execution on 2026-05-17 with 72 active workflows | Active | Keep; retire/replace stale legacy key only after runtime ownership is clear |
| Vercel | CLI authenticated; current deployment listings returned for both projects | Active hosting | Keep |
| Stripe | Latest sampled charge/payment intent remains succeeded on 2026-04-06 | Revenue dependency | Keep |
| OpenAI | Model list readable; code/cost/event references remain | Active | Keep; continue cost monitoring |
| Anthropic | Model list readable; code and n8n fallback/eval references remain | Watch | Decide after next receipt/bakeoff refresh |
| Gamma | Latest report remains 2026-05-02; admin/report code active | Active enough | Keep; watch deck alternatives |
| HeyGen | Avatar API works; billing/quota still not API-verified | Campaign-dependent active | Keep; verify dashboard quota/billing |
| Read.ai | Direct reports check returned 404 with available token; meeting rows/docs remain | Auth/API-route unresolved | Keep; refresh auth/API route |
| BuiltWith | Protected outreach-ramp decision remains | Protected watch | Keep during outreach/client-volume ramp |
| Fireflies.ai | No new paid evidence; previously confirmed canceled | Resolved canceled | Keep out of active queue |
| Vapi | Default call sample returned zero calls again | Consecutive quiet sample | Investigate billing/voice UX |
| Printful | Two API stores visible; `printful_sync_log` still empty | Quiet sync | Investigate store/order strategy |
| Resend | Local key absent; optional code/env references remain | Usage unresolved | Verify Vercel env/billing before deciding |
| Pinecone | Ready `publications` serverless index remains | Active infrastructure exists | Investigate billing/API traffic |
| Hunter.io | API reports Free plan with 75 available calls | Not a paid cancellation target | Keep/watch |
| OpenRouter | Zero current-key usage again | Consecutive quiet key evidence | Watch; prepare deprecation packet only after bakeoff |
| Apify | Starter plan; latest account-level run sample 2026-05-15 | Account active, actor-level mixed | Keep; pause/replace weak actor surfaces first |
| ElevenLabs | Active Creator subscription; reset date 2026-05-19 | Paid, low recent movement | Review before renewal against campaign plan |
| Calendly | Direct API check returned 401 again; scheduling references remain | Auth unresolved | Refresh token; keep |
| Gemini / Google AI | Model-list check returned 403; social image workflow references remain | Auth/config unresolved | Investigate key/project status before relying on it |
| Slack | Bot auth readable; Slack/n8n references remain heavy | Active integration | Keep |

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor meets the cancellation threshold in this daily run.**
- OpenRouter, Vapi, Printful, Pinecone, Resend, Read.ai auth/API route, Calendly auth, Gemini auth, and ElevenLabs remain decision/investigation items, not approved cancellation actions.
- No approval phrase was given in this run.

Inactive-For-Two-Sessions Evidence

- OpenRouter has repeated zero current-key usage signals, but no confirmed active spend and no approved replacement/deprecation packet.
- Vapi has repeated zero default-call samples, but billing and intended production voice UX remain unresolved.
- Printful sync remains empty across runs, but two stores remain visible and dashboard order strategy is not verified.
- Read.ai, Calendly, and Gemini remain auth/API-blocked checks, which is not the same as confirmed inactivity.

Replacement / Deprecation Options

- OpenRouter: prepare a small model-routing deprecation packet only after the media/model bakeoff confirms OpenAI/Anthropic/Gemini or local workflows cover the same surfaces.
- Vapi: disable or hide optional website voice UX only after confirming no active campaign depends on it and documenting the replacement path.
- Printful: pause sync/merchandise surfaces only after checking dashboard order history and deciding whether both stores remain strategically active.
- Pinecone: compare traffic and billing against Supabase/local RAG before any vector-store migration.
- Resend: confirm Vercel production env and billing before choosing Gmail/n8n-only email delivery.

Risk Notes / Exact Approval Needed

- Cancellation or deprecation still requires a current-chat approval phrase in the form `Cancel <tool/vendor> for Portfolio`.
- Dashboard or payment-owner verification is still needed for ElevenLabs renewal timing, Vapi billing, Printful order history, Pinecone billing/API traffic, Resend production usage, Read AI auth/API route, Calendly auth, and Gemini/Google AI project status.
- The admin Subscription Watch page remains read-only and should treat this as a yellow investigation queue, not a cancellation queue.

Next Audit Focus

- Review ElevenLabs before the 2026-05-19 reset/renewal window against the next planned social/audio/video campaign.
- Refresh Read AI auth/API access and confirm the correct reports/meetings endpoint.
- Refresh Calendly token and re-run event-type usage checks.
- Confirm OpenRouter's role in the next media/model bakeoff; if unused again and no active spend exists, prepare a deprecation packet rather than canceling automatically.
- Confirm Vapi dashboard billing and whether production voice UX is intended to stay enabled.
- Check Printful dashboard/order history and decide whether both stores remain strategically active.
- Verify whether Resend exists in Vercel production env or billing, and whether Gmail/n8n is the only real outbound path.
- Check Pinecone billing/API traffic and compare with the Supabase/local RAG replacement path.
- Check Gemini/Google AI key and project status before depending on Gemini image/social workflows.
- Continue the Apify actor-level replacement bakeoff by pausing or replacing weak actor surfaces before considering account-level changes.

## 2026-05-16 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- The checkout at `/Users/vambahsillah/Projects/Portfolio` was clean on `codex/standup-multiselect-agents`; no unrelated dirty work needed preservation.
- Core runtime signals moved again: Supabase production `agent_runs` increased to 63 with the latest row at 2026-05-15T14:00:27Z, `contact_submissions` increased to 269 with the latest row at 2026-05-15T13:19:58Z, and n8n Cloud reported 77 workflows, 72 active workflows, and a successful execution started at 2026-05-16T12:00:52Z.
- Stripe remains a live revenue dependency: checkout sessions, charges, and payment intents were readable; the latest sampled charge/payment intent remained paid/succeeded on 2026-04-06, and the latest sampled checkout session remained a paid completed payment-mode session from 2026-02-23.
- No vendor crossed the cancellation threshold. OpenRouter returned zero current-key usage again, and Vapi returned no calls in the current default call sample, but neither has confirmed active spend plus an approved replacement/deprecation packet.
- Apify account evidence is active: Starter plan remains visible and the latest account-level actor run sample was a succeeded run started 2026-05-15.
- BuiltWith remains a protected watch item during the outreach/client-volume ramp. Fireflies remains resolved as canceled per Vambah's 2026-05-01 confirmation unless new paid-plan evidence appears.

Raw Findings

- Prior automation memory file was missing at `$CODEX_HOME/automations/portfolio-subscription-cancellation-monitor/memory.md`; this run creates it. The durable tracker and admin status JSON were used as continuity state.
- Action tracker feedback file was available, but it had no entry for `portfolio-subscription-cancellation-monitor`; no completed, dismissed, blocked, or in-progress tracker actions were applied.
- Read-only provider checks ran at 2026-05-16T12:33Z. Secret values, raw account payloads, and raw logs are not included in this report.
- Supabase production aggregates: `analytics_events` 5052, `meeting_records` 110, `orders` 26, `gamma_reports` 6, `social_content_queue` 29, `drive_video_queue` 35, `email_messages` 9, `documents_local_rag` 3434, `printful_sync_log` 0, `cost_events` 21, `video_generation_jobs` 4, `diagnostic_audits` 29, `outreach_queue` 9, `contact_submissions` 269, and `agent_runs` 63.
- Supabase latest usage signals: latest `agent_runs` row at 2026-05-15, latest `contact_submissions` row at 2026-05-15, latest `analytics_events` row at 2026-05-15, latest `cost_events` row remains 2026-05-14, latest Gamma report remains 2026-05-02, latest social content row remains 2026-05-07, latest video generation job remains 2026-04-15, latest meeting record remains 2026-05-06, and `printful_sync_log` remains empty.
- n8n Cloud API: `N8N_CLOUD_API_KEY` was valid and returned 77 workflows, 72 active workflows, and a successful execution started at 2026-05-16T12:00:52Z.
- Vercel CLI authentication was available as `vsillah`; plain deployment listings returned current deployment URLs for both `portfolio` and `portfolio-staging`.
- Stripe API: checkout sessions, charges, and payment intents were readable. Latest sampled charge was created 2026-04-06T19:37:14Z with paid/succeeded status; latest sampled payment intent was created 2026-04-06T19:35:48Z with succeeded status; latest sampled checkout session was created 2026-02-23T21:05:32Z with `payment` mode, `paid` payment status, and `complete` status.
- Apify API: account still reports Starter; latest account-level actor run sample returned a succeeded run started at 2026-05-15T14:03:10Z.
- ElevenLabs API: subscription remains active on Creator with 18,068 of 164,102 characters used; next character reset remains 2026-05-19T18:38:26Z.
- OpenRouter API: current key again reports zero usage.
- Vapi API: default calls sample returned 200 with zero calls; prior visible call evidence remains the 2026-04-30 `webCall`.
- Pinecone API: one ready serverless index named `publications` exists in `aws/us-east-1`.
- Printful API: two native stores remain visible; `printful_sync_log` remains empty.
- Hunter.io API: account remains Free with 50 available calls.
- HeyGen API: avatar catalog listing returned successfully with 1289 avatars; quota/billing still needs dashboard verification.
- Slack bot auth was readable. OpenAI and Anthropic model-list endpoints were readable. Gemini model-list check returned 403. Read AI direct check was skipped because no local API key was present. Calendly direct check returned 401.
- Local reference counts, excluding subscription tracker files: Supabase 3974, n8n 3800, Vercel 661, Stripe 546, OpenAI 751, Anthropic 242, Gamma 986, HeyGen 621, Read.ai/Read AI 294, Vapi 271, Printful 408, Resend 122, Pinecone 291, BuiltWith 216, Fireflies 1, Apify 247, Hunter 43, OpenRouter 86, ElevenLabs 122, Calendly 453, Slack 1376, Gmail 467, Gemini 55, Google Cloud 21, Perplexity 42, Figma 2, Paper 22, Excalidraw 3, and Canva 2.
- Local n8n export footprint includes 46 workflow JSON files and 38 exports marked active. Relevant node types include 64 Supabase nodes, 58 HTTP Request nodes, 41 Slack nodes, 27 OpenAI/OpenAI-chat/embedding nodes, 17 Gmail/Gmail-trigger nodes, 10 Google Drive/Docs/Sheets nodes, 5 Apify nodes, 3 Pinecone vector-store nodes, 3 Perplexity nodes, 2 Calendly triggers, 1 Stripe trigger, 1 Slack trigger, and 1 Anthropic node.

Derived Movement Since Prior Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | `agent_runs` increased from 56 to 63; `contact_submissions` increased from 268 to 269 | Active | Keep |
| n8n Cloud | Successful execution on 2026-05-16 with 72 active workflows | Active | Keep; retire/replace stale legacy key only after runtime ownership is clear |
| Vercel | CLI authenticated; deployment listings returned URLs for both projects | Active hosting | Keep |
| Stripe | Latest sampled charge/payment intent remains succeeded on 2026-04-06 | Revenue dependency | Keep |
| OpenAI | Model list readable; code/cost/event references remain | Active | Keep; continue cost monitoring |
| Anthropic | Model list readable; code and n8n fallback/eval references remain | Watch | Decide after next receipt/bakeoff refresh |
| Gamma | Latest report remains 2026-05-02; admin/report code active | Active enough | Keep; watch deck alternatives |
| HeyGen | Avatar API works; billing/quota still not API-verified | Campaign-dependent active | Keep; verify dashboard quota/billing |
| Read.ai | Local API key absent; meeting rows/docs remain | Auth unresolved | Keep; refresh auth/API access |
| BuiltWith | Protected outreach-ramp decision remains | Protected watch | Keep during outreach/client-volume ramp |
| Fireflies.ai | No new paid evidence; previously confirmed canceled | Resolved canceled | Keep out of active queue |
| Vapi | Default call sample returned zero calls | Quiet | Investigate billing/voice UX |
| Printful | Two API stores visible; `printful_sync_log` still empty | Quiet sync | Investigate store/order strategy |
| Resend | Local key absent; optional code/env references remain | Usage unresolved | Verify Vercel env/billing before deciding |
| Pinecone | Ready `publications` serverless index remains | Active infrastructure exists | Investigate billing/API traffic |
| Hunter.io | API reports Free plan with 50 available calls | Not a paid cancellation target | Keep/watch |
| OpenRouter | Zero current-key usage again | Consecutive quiet key evidence | Watch; prepare deprecation packet only after bakeoff |
| Apify | Starter plan; latest account-level run sample 2026-05-15 | Account active, actor-level mixed | Keep; pause/replace weak actor surfaces first |
| ElevenLabs | Active Creator subscription; reset date 2026-05-19 | Paid, low recent movement | Review before renewal against campaign plan |
| Calendly | Direct API check returned 401 again; scheduling references remain | Auth unresolved | Refresh token; keep |
| Gemini / Google AI | Model-list check returned 403; social image workflow references remain | Auth/config unresolved | Investigate key/project status before relying on it |
| Slack | Bot auth readable; Slack/n8n references remain heavy | Active integration | Keep |

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor meets the cancellation threshold in this daily run.**
- OpenRouter, Vapi, Printful, Pinecone, Resend, Read.ai auth, Calendly auth, Gemini auth, and ElevenLabs remain decision/investigation items, not approved cancellation actions.
- No approval phrase was given in this run.

Next Audit Focus

- Review ElevenLabs before the 2026-05-19 reset/renewal window against the next planned social/audio/video campaign.
- Refresh Read AI auth/API access before using meeting-intelligence usage as provider evidence.
- Refresh Calendly token and re-run event-type usage checks.
- Confirm OpenRouter's role in the next media/model bakeoff; if unused again and no active spend exists, prepare a deprecation packet rather than canceling automatically.
- Confirm Vapi dashboard billing and whether production voice UX is intended to stay enabled.
- Check Printful dashboard/order history and decide whether both stores remain strategically active.
- Verify whether Resend exists in Vercel production env or billing, and whether Gmail/n8n is the only real outbound path.
- Check Pinecone billing/API traffic and compare with the Supabase/local RAG replacement path.
- Check Gemini/Google AI key and project status before depending on Gemini image/social workflows.
- Continue the Apify actor-level replacement bakeoff by pausing or replacing weak actor surfaces before considering account-level changes.

## 2026-05-15 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- The checkout at `/Users/vambahsillah/Projects/Portfolio` was on `codex/agent-ops-paper-parity` with the upstream branch reported as gone. Existing dirty subscription tracker changes from the 2026-05-14 run were present, plus untracked `.codex/` and `.codex_tmp/`; this run preserved those unrelated local items and only updated the subscription tracker, automation memory, and sanitized pending notification.
- Core runtime signals moved again: Supabase production `agent_runs` increased to 56 with the latest row at 2026-05-14T14:15:45Z, `analytics_events` increased to 5049 with the latest row at 2026-05-14T18:45:34Z, and n8n Cloud reported 77 workflows, 72 active workflows, and a successful execution started at 2026-05-15T12:00:52Z.
- Stripe remains a live revenue dependency: checkout sessions, charges, and payment intents were readable; the latest sampled charge/payment intent remained paid/succeeded on 2026-04-06, and the latest sampled checkout session remained a paid completed payment-mode session from 2026-02-23.
- No vendor crossed the cancellation threshold. OpenRouter returned zero current-key usage again, and Vapi returned no calls in the current default call sample, but neither has confirmed active spend plus an approved replacement/deprecation packet.
- Apify account evidence improved slightly: Starter plan remains visible and the latest account-level actor run sample was a succeeded run started 2026-05-13. Actor-level weak surfaces still need pause/replace work before any account-level cancellation decision.
- BuiltWith remains a protected watch item during the outreach/client-volume ramp. Fireflies remains resolved as canceled per Vambah's 2026-05-01 confirmation unless new paid-plan evidence appears.

Raw Findings

- Prior automation memory file was missing at `$CODEX_HOME/automations/portfolio-subscription-cancellation-monitor/memory.md`; this run creates it. The durable tracker and admin status JSON were used as continuity state.
- Action tracker feedback reported 21 open actions for `portfolio-subscription-cancellation-monitor`, with no in-progress, blocked, done, or progress-note signals. No completed or dismissed action was re-raised from tracker feedback.
- Read-only provider checks ran at 2026-05-15T12:34Z. Secret values, raw account payloads, and raw logs are not included in this report.
- Supabase production aggregates: `analytics_events` 5049, `meeting_records` 110, `orders` 26, `gamma_reports` 6, `social_content_queue` 29, `drive_video_queue` 35, `email_messages` 9, `documents_local_rag` 3434, `printful_sync_log` 0, `cost_events` 21, `video_generation_jobs` 4, `diagnostic_audits` 29, `outreach_queue` 9, `contact_submissions` 268, and `agent_runs` 56.
- Supabase latest usage signals: latest `analytics_events` row at 2026-05-14, latest `agent_runs` row at 2026-05-14, latest `cost_events` row remains 2026-05-14, latest Gamma report remains 2026-05-02, latest social content row remains 2026-05-07, latest video generation job remains 2026-04-15, latest meeting record remains 2026-05-06, and `printful_sync_log` remains empty.
- n8n Cloud API: the older `N8N_API_KEY` returned 403 again, but `N8N_CLOUD_API_KEY` was valid and returned 77 workflows, 72 active workflows, and a successful execution started at 2026-05-15T12:00:52Z.
- Vercel CLI authentication was available; the current CLI no longer accepted `vercel ls <project> --json`, but plain `vercel ls portfolio` and `vercel ls portfolio-staging` returned current deployment URLs for both projects.
- Stripe API: checkout sessions, charges, and payment intents were readable. Latest sampled charge was created 2026-04-06T19:37:14Z with paid/succeeded status; latest sampled payment intent was created 2026-04-06T19:35:48Z with succeeded status; latest sampled checkout session was created 2026-02-23T21:05:32Z with `payment` mode, `paid` payment status, and `complete` status.
- Apify API: account still reports Starter; latest account-level actor run sample returned a succeeded run started 2026-05-13T13:01:31Z. The prior actor-level sample through 2026-05-06 remains the current replacement-analysis evidence.
- ElevenLabs API: subscription remains active on Creator with 18,068 of 164,102 characters used; next character reset remains 2026-05-19T18:38:26Z.
- OpenRouter API: current key again reports zero usage.
- Vapi API: default calls sample returned 200 with zero calls; prior visible call evidence remains the 2026-04-30 `webCall`.
- Pinecone API: one ready serverless index named `publications` exists in `aws/us-east-1`.
- Printful API: two native stores remain visible; `printful_sync_log` remains empty.
- Hunter.io API: account remains Free with 75 available calls.
- HeyGen API: avatar catalog listing returned successfully with 1289 avatars; quota/billing still needs dashboard verification.
- Slack bot auth was readable. OpenAI and Anthropic model-list endpoints were readable. Gemini model-list check returned 403. Gamma key was present locally, but no safe billing/usage endpoint was checked. Resend key was absent locally.
- Read AI and Calendly direct checks both returned 401 again.
- Local reference counts, excluding subscription tracker files: Supabase 4873, n8n 4629, Vercel 639, Stripe 638, OpenAI 811, Anthropic 273, Gamma 1222, HeyGen 724, Read.ai/Read AI 379, Vapi 332, Printful 504, Resend 146, Pinecone 317, BuiltWith 248, Fireflies 1, Apify 375, Hunter 65, OpenRouter 99, ElevenLabs 157, Calendly 584, Slack 1620, Gmail 546, Gemini 88, Google Cloud 23, Perplexity 54, Figma 2, Paper 23, Excalidraw 4, and Canva 2.
- Local n8n export node footprint includes 90 Supabase nodes, 98 Slack nodes, 36 OpenAI nodes, 29 Gmail nodes, 29 Google nodes, 21 Apify nodes, 8 OpenRouter nodes, 6 Pinecone nodes, 37 Calendly references, 12 Stripe references, 4 Anthropic references, 5 Perplexity references, 3 Gemini references, 7 HeyGen references, 6 Hunter references, and 1 ElevenLabs reference.

Derived Movement Since Prior Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | `agent_runs` increased from 47 to 56; `analytics_events` increased from 5041 to 5049 | Active | Keep |
| n8n Cloud | Successful execution on 2026-05-15 with 72 active workflows | Active | Keep; retire/replace stale `N8N_API_KEY` if safe |
| Vercel | CLI authenticated; plain deployment listings returned URLs for both projects | Active hosting | Keep |
| Stripe | Latest sampled charge/payment intent remains succeeded on 2026-04-06 | Revenue dependency | Keep |
| OpenAI | Model list readable; code/cost/event references remain | Active | Keep; continue cost monitoring |
| Anthropic | Model list readable; code and n8n fallback/eval references remain | Watch | Decide after next receipt/bakeoff refresh |
| Gamma | Latest report remains 2026-05-02; admin/report code active | Active enough | Keep; watch deck alternatives |
| HeyGen | Avatar API works; billing/quota still not API-verified | Campaign-dependent active | Keep; verify dashboard quota/billing |
| Read.ai | Direct API check returned 401 again; meeting rows/docs remain | Auth unresolved | Keep; refresh auth |
| BuiltWith | Protected outreach-ramp decision remains | Protected watch | Keep during outreach/client-volume ramp |
| Fireflies.ai | No new paid evidence; previously confirmed canceled | Resolved canceled | Keep out of active queue |
| Vapi | Default call sample returned zero calls; prior visible call remains 2026-04-30 | Quiet | Investigate billing/voice UX |
| Printful | Two API stores visible; `printful_sync_log` still empty | Quiet sync | Investigate store/order strategy |
| Resend | Local key absent; optional code/env references remain | Usage unresolved | Verify Vercel env/billing before deciding |
| Pinecone | Ready `publications` serverless index remains | Active infrastructure exists | Investigate billing/API traffic |
| Hunter.io | API reports Free plan with 75 available calls | Not a paid cancellation target | Keep/watch |
| OpenRouter | Zero current-key usage again | Consecutive quiet key evidence | Watch; prepare deprecation packet only after bakeoff |
| Apify | Starter plan; latest account-level run sample 2026-05-13 and prior actor evidence through 2026-05-06 | Account active, actor-level mixed | Keep; pause/replace weak actor surfaces first |
| ElevenLabs | Active Creator subscription; reset date 2026-05-19 | Paid, low recent movement | Review before renewal against campaign plan |
| Calendly | Direct API check returned 401 again; scheduling references remain | Auth unresolved | Refresh token; keep |
| Gemini / Google AI | Repo/n8n references remain; model-list check returned 403 | Auth/config unresolved | Investigate key/project status before relying on it |
| Slack | Bot auth readable; Slack/n8n references remain heavy | Active integration | Keep |

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor meets the cancellation threshold in this daily run.**
- OpenRouter, Vapi, Printful, Pinecone, Resend, Read.ai auth, Calendly auth, Gemini auth, and ElevenLabs remain decision/investigation items, not approved cancellation actions.
- No approval phrase was given in this run.

Next Audit Focus

- Refresh Read AI and Calendly auth before using those providers as usage evidence.
- Retire or rotate the stale n8n API key only after confirming which runtime still references it; `N8N_CLOUD_API_KEY` is the working read-only evidence path.
- Confirm OpenRouter's role in the next media/model bakeoff; if unused again and no active spend exists, prepare a deprecation packet rather than canceling automatically.
- Verify whether Resend exists in Vercel production env or billing, and whether Gmail/n8n is the only real outbound path.
- Confirm Vapi dashboard billing and whether production voice UX is intended to stay enabled.
- Check Pinecone billing/API traffic and compare with the Supabase/local RAG replacement path.
- Check Printful dashboard/order history and decide whether both stores remain strategically active.
- Check Gemini/Google AI key and project status before depending on Gemini image/social workflows.
- Review ElevenLabs renewal before 2026-05-19T18:38:26Z against the next planned social/audio/video campaign.
- Continue the Apify actor-level replacement bakeoff by pausing or replacing weak actor surfaces before considering account-level changes.

## 2026-05-14 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- The checkout at `/Users/vambahsillah/Projects/Portfolio` was clean on `codex/agent-ops-paper-parity` tracking `origin/codex/agent-ops-paper-parity`; no unrelated dirty work needed preservation. Because the checkout was not `main`, this run kept changes limited to the existing subscription tracker files.
- Core runtime signals moved again: Supabase production `agent_runs` increased to 47 with the latest row at 2026-05-14T01:13:06Z, `cost_events` increased to 21 with the latest row at 2026-05-14T01:13:20Z, and n8n Cloud reported 77 workflows, 72 active workflows, and a successful execution started at 2026-05-14T12:00:52Z.
- Stripe remains a live revenue dependency: checkout sessions, charges, and payment intents were readable; the latest sampled charge was paid/succeeded on 2026-04-06, and the latest sampled checkout session remains a paid completed payment-mode session from 2026-02-23.
- No vendor crossed the cancellation threshold. OpenRouter has another zero-usage current-key signal, but there is still no confirmed active spend and no approved model-routing replacement/deprecation packet, so it remains watch/investigate rather than cancel.
- Vapi, Printful, Pinecone, Resend, Read.ai auth, Calendly auth, and ElevenLabs renewal timing remain the unresolved decision queue. They need dashboard, billing-owner, or replacement-path evidence before any cancellation/deprecation packet is safe.
- BuiltWith remains a protected watch item during the outreach/client-volume ramp. Fireflies remains resolved as canceled per Vambah's 2026-05-01 confirmation unless new paid-plan evidence appears.

Raw Findings

- Prior automation memory file was missing at `$CODEX_HOME/automations/portfolio-subscription-cancellation-monitor/memory.md`; it is being created by this run. The durable tracker and admin status JSON were used as continuity state.
- Action tracker feedback reported 21 open actions for `portfolio-subscription-cancellation-monitor`, with no in-progress, blocked, done, or progress-note signals. No completed or dismissed action was re-raised from tracker feedback.
- Read-only provider checks ran at 2026-05-14T12:34Z. Secret values, raw account payloads, and raw logs are not included in this report.
- Supabase production aggregates: `analytics_events` 5041, `meeting_records` 110, `orders` 26, `gamma_reports` 6, `social_content_queue` 29, `drive_video_queue` 35, `email_messages` 9, `documents_local_rag` 3434, `printful_sync_log` 0, `cost_events` 21, `video_generation_jobs` 4, `diagnostic_audits` 29, `outreach_queue` 9, `contact_submissions` 268, and `agent_runs` 47.
- Supabase latest usage signals: latest `agent_runs` row at 2026-05-14, latest `cost_events` row at 2026-05-14, latest `analytics_events` row at 2026-05-13, latest Gamma report remains 2026-05-02, latest social content row remains 2026-05-07, latest video generation job remains 2026-04-15, latest meeting record remains 2026-05-06, and `printful_sync_log` remains empty.
- n8n Cloud API: the older `N8N_API_KEY` returned 403, but `N8N_CLOUD_API_KEY` was valid and returned 77 workflows, 72 active workflows, and a successful execution started at 2026-05-14T12:00:52Z.
- Vercel CLI authentication was available as `vsillah`; listing returned current deployment URLs for both `portfolio` and `portfolio-staging`.
- Stripe API: account-level KYC read was blocked by restricted-key permissions, but checkout sessions, charges, and payment intents were readable. Latest sampled charge was created 2026-04-06T19:37:14Z with paid/succeeded status; latest sampled payment intent was created 2026-04-06T19:35:48Z with succeeded status; latest sampled checkout session was created 2026-02-23T21:05:32Z with `payment` mode, `paid` payment status, and `complete` status.
- Apify API: account still reports Starter; latest account-level actor run sample returned a succeeded run from 2026-04-13. The prior actor-level sample through 2026-05-06 remains the current replacement-analysis evidence.
- ElevenLabs API: subscription remains active on Creator with 18,068 of 164,102 characters used; next character reset returned 2026-05-19T18:38:26Z.
- OpenRouter API: current key again reports zero usage.
- Vapi API: latest returned call remains a 2026-04-30 `webCall` with ended status.
- Pinecone API: one ready serverless index named `publications` exists in `aws/us-east-1`.
- Printful API: two native stores remain visible; `printful_sync_log` remains empty.
- Hunter.io API: account remains Free with 75 available calls and reset date 2026-06-09.
- HeyGen API: avatar catalog listing returned successfully with 1289 avatars; quota/billing still needs dashboard verification.
- Slack bot auth was readable. OpenAI and Anthropic model-list endpoints were readable. Gamma key was present locally, but no safe billing/usage endpoint was checked. Resend key was absent locally.
- Read AI and Calendly direct checks both returned 401 again.
- Local reference counts, excluding subscription tracker files: Supabase 3481, n8n 3393, Vercel 557, Stripe 470, OpenAI 687, Anthropic 221, Gamma 835, HeyGen 567, Read.ai/Read AI 145, Vapi 111, Printful 317, Resend 127, Pinecone 236, BuiltWith 184, Fireflies 1, Apify 249, Hunter 26, OpenRouter 86, ElevenLabs 95, Calendly 403, Slack 1252, Gmail 434, Gemini 51, Google Cloud 20, and Perplexity 42.
- Local n8n export node footprint includes 60 Supabase nodes, 40 Slack nodes, 25 OpenAI/OpenAI-chat nodes, 17 Gmail/Gmail-trigger nodes, 12 Google Drive/Docs/Sheets nodes, 4 OpenRouter chat nodes, 5 Apify nodes, 3 Pinecone vector-store nodes, 2 Calendly triggers, 1 Stripe trigger, 1 Slack trigger, 1 Anthropic node, and 3 Perplexity tool nodes.

Derived Movement Since Prior Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | `agent_runs` increased from 36 to 47; `cost_events` increased from 14 to 21 | Active | Keep |
| n8n Cloud | Successful execution on 2026-05-14 with 72 active workflows | Active | Keep; retire/replace stale `N8N_API_KEY` if safe |
| Vercel | CLI authenticated; deployment URLs listed for both projects | Active hosting | Keep |
| Stripe | Latest sampled charge/payment intent succeeded on 2026-04-06 | Revenue dependency | Keep |
| OpenAI | Model list readable; code/cost/event references remain | Active | Keep; continue cost monitoring |
| Anthropic | Model list readable; code and n8n fallback/eval references remain | Watch | Decide after next receipt/bakeoff refresh |
| Gamma | Latest report remains 2026-05-02; admin/report code active | Active enough | Keep; watch deck alternatives |
| HeyGen | Avatar API works; billing/quota still not API-verified | Campaign-dependent active | Keep; verify dashboard quota/billing |
| Read.ai | Direct API check returned 401 again; meeting rows/docs remain | Auth unresolved | Keep; refresh auth |
| BuiltWith | Protected outreach-ramp decision remains | Protected watch | Keep during outreach/client-volume ramp |
| Fireflies.ai | No new paid evidence; previously confirmed canceled | Resolved canceled | Keep out of active queue |
| Vapi | Latest API-visible call remains 2026-04-30 | Quiet | Investigate billing/voice UX |
| Printful | Two API stores visible; `printful_sync_log` still empty | Quiet sync | Investigate store/order strategy |
| Resend | Local key absent; optional code/env references remain | Usage unresolved | Verify Vercel env/billing before deciding |
| Pinecone | Ready `publications` serverless index remains | Active infrastructure exists | Investigate billing/API traffic |
| Hunter.io | API reports Free plan | Not a paid cancellation target | Keep/watch |
| OpenRouter | Zero current-key usage again | Consecutive quiet key evidence | Watch; prepare deprecation packet only after bakeoff |
| Apify | Starter plan; latest account-level run sample 2026-04-13 and prior actor evidence through 2026-05-06 | Account active, actor-level mixed | Keep; pause/replace weak actor surfaces first |
| ElevenLabs | Active Creator subscription; reset date 2026-05-19 | Paid, low recent movement | Review before renewal against campaign plan |
| Calendly | Direct API check returned 401 again; scheduling references remain | Auth unresolved | Refresh token; keep |
| Slack | Bot auth readable; Slack/n8n references remain heavy | Active integration | Keep |

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor meets the cancellation threshold in this daily run.**
- OpenRouter, Vapi, Printful, Pinecone, Resend, Read.ai auth, Calendly auth, and ElevenLabs remain decision/investigation items, not approved cancellation actions.
- No approval phrase was given in this run.

Next Audit Focus

- Refresh Read AI and Calendly auth before using those providers as usage evidence.
- Retire or rotate the stale n8n API key only after confirming which runtime still references it; `N8N_CLOUD_API_KEY` is the working read-only evidence path.
- Confirm OpenRouter's role in the next media/model bakeoff; if unused again and no active spend exists, prepare a deprecation packet rather than canceling automatically.
- Verify whether Resend exists in Vercel production env or billing, and whether Gmail/n8n is the only real outbound path.
- Confirm Vapi dashboard billing and whether production voice UX is intended to stay enabled.
- Check Pinecone billing/API traffic and compare with the Supabase/local RAG replacement path.
- Check Printful dashboard/order history and decide whether both stores remain strategically active.
- Review ElevenLabs renewal before 2026-05-19T18:38:26Z against the next planned social/audio/video campaign.
- Continue the Apify actor-level replacement bakeoff by pausing or replacing weak actor surfaces before considering account-level changes.

## 2026-05-13 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- The checkout at `/Users/vambahsillah/Projects/Portfolio` was clean on `main`
  tracking `origin/main`; no unrelated dirty work needed preservation.
- Core runtime signals moved again: n8n Cloud reported 77 workflows, 72 active
  workflows, and an execution started at 2026-05-13T12:00:44Z; Supabase
  production `agent_runs` increased to 36 with the latest row at
  2026-05-12T13:00:03Z; Vercel returned READY production deployments for both
  `portfolio` and `portfolio-staging` at 2026-05-13T12:29:19Z.
- Stripe remains a live revenue dependency: the account check was readable,
  charges are enabled, and the latest sampled checkout session remains a paid
  payment-mode session from 2026-02-23.
- No vendor crossed the cancellation threshold. OpenRouter still has
  consecutive zero-usage evidence for the current key, but there is still no
  confirmed active spend or approved replacement path, so it remains
  watch/investigate rather than a cancellation candidate.
- Vapi, Printful, Pinecone, Resend, Read.ai auth, and Calendly auth remain the
  unresolved decision queue. They need dashboard/auth or billing-owner evidence
  before any deprecation packet is safe.
- BuiltWith remains a protected watch item during the outreach/client-volume
  ramp. Fireflies remains resolved as canceled per Vambah's 2026-05-01
  confirmation unless new paid-plan evidence appears.

Raw Findings

- Prior automation memory file was missing at
  `$CODEX_HOME/automations/portfolio-subscription-cancellation-monitor/memory.md`.
  The durable tracker, memory registry notes, and admin status JSON were used as
  continuity state.
- Action tracker feedback reported 12 open actions for
  `portfolio-subscription-cancellation-monitor`, with no in-progress, blocked,
  done, or progress-note signals. No completed or dismissed action was
  re-raised from tracker feedback.
- Read-only provider checks ran at 2026-05-13T12:33Z. Secret values, raw
  account payloads, and raw logs are not included in this report.
- Supabase production aggregates: `analytics_events` 5030, `meeting_records`
  110, `orders` 26, `gamma_reports` 6, `social_content_queue` 29,
  `drive_video_queue` 35, `email_messages` 9, `documents_local_rag` 3434,
  `printful_sync_log` 0, `cost_events` 14, `video_generation_jobs` 4,
  `diagnostic_audits` 29, `outreach_queue` 9, `contact_submissions` 268, and
  `agent_runs` 36.
- Supabase latest usage signals: latest `agent_runs` row at 2026-05-12,
  latest `cost_events` row at 2026-05-11, latest Gamma report remains
  2026-05-02, latest social content row remains 2026-05-07, latest video
  generation job remains 2026-04-15, and `printful_sync_log` remains empty.
- n8n Cloud API: 77 workflows, 72 active workflows, and latest sampled
  execution started at 2026-05-13T12:00:44Z.
- Vercel CLI authentication was available as `vsillah`; project metadata for
  `portfolio` and `portfolio-staging` updated at 2026-05-13T12:32:36Z and
  2026-05-13T12:32:34Z, and the latest sampled deployments for both projects
  were READY at 2026-05-13T12:29:19Z.
- Stripe API: account is readable with charges enabled; the latest sampled
  checkout session was created 2026-02-23T21:05:32Z with `payment` mode and
  `paid` payment status.
- Apify API: account still reports `STARTER`; the prior actor-level sample
  through 2026-05-06 remains the current replacement-analysis evidence.
- ElevenLabs API: subscription remains active on Creator with 18,068 of 164,102
  characters used; next character reset returned 2026-05-19T18:38:26Z.
- OpenRouter API: current key still reports zero usage.
- Vapi API: latest returned call remains a 2026-04-30 `webCall` with ended
  status.
- Pinecone API: one ready serverless index named `publications` exists in
  `aws/us-east-1`.
- Printful API: two native stores remain visible; `printful_sync_log` remains
  empty.
- Hunter.io API: account remains Free with quota data visible and reset date
  2026-06-09.
- HeyGen API: avatar listing returned successfully; a quota endpoint probe
  returned 404, so billing/quota status still needs dashboard or provider-page
  verification.
- Read AI and Calendly direct checks both returned 401 again.
- Local reference counts, excluding subscription tracker files: Supabase 3305,
  n8n 3350, Vercel 505, Stripe 450, OpenAI 519, Anthropic 219, Gamma 909,
  HeyGen 597, Read.ai/Read AI 93, Vapi 113, Printful 324, Resend 129,
  Pinecone 267, BuiltWith 190, Fireflies 1, Apify 247, Hunter 43, OpenRouter
  74, ElevenLabs 104, Calendly 432, Slack 1290, Gmail 453, Gemini 49, Google
  Cloud 20, and Perplexity 42.
- Local n8n export node footprint includes 64 Supabase nodes, 42 Slack nodes,
  30 OpenAI chat nodes, 17 Gmail nodes, 12 Google nodes, 5 OpenRouter nodes,
  5 Apify nodes, 3 Pinecone vector-store nodes, 2 Calendly triggers, 1 Stripe
  trigger, and 1 Anthropic node.

Derived Movement Since Prior Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | `agent_runs` increased from 35 to 36; analytics remained at 5030 | Active | Keep |
| n8n Cloud | Successful execution on 2026-05-13 with 72 active workflows | Active | Keep |
| Vercel | Both Portfolio projects returned fresh metadata and READY deployments on 2026-05-13 | Active | Keep |
| Stripe | Charges enabled; latest sampled checkout session is paid | Revenue dependency | Keep |
| OpenAI | Code, cost/event, and n8n nodes remain | Active | Keep; continue cost monitoring |
| Anthropic | Code and n8n fallback/eval references remain | Watch | Decide after next receipt/bakeoff refresh |
| Gamma | Latest report remains 2026-05-02; admin/report code active | Active enough | Keep; watch deck alternatives |
| HeyGen | Avatar API works; quota/billing endpoint did not resolve | Campaign-dependent active | Keep; verify dashboard quota/billing |
| Read.ai | Direct API check returned 401 again; meeting rows/docs remain | Auth unresolved | Keep; refresh auth |
| BuiltWith | Protected outreach-ramp decision remains | Protected watch | Keep during outreach/client-volume ramp |
| Fireflies.ai | No new paid evidence; previously confirmed canceled | Resolved canceled | Keep out of active queue |
| Vapi | Latest API-visible call remains 2026-04-30 | Quiet | Investigate billing/voice UX |
| Printful | Two API stores visible; `printful_sync_log` still empty | Quiet sync | Investigate store/order strategy |
| Resend | Local key absent; optional code/env references remain | Usage unresolved | Verify Vercel env/billing before deciding |
| Pinecone | Ready `publications` serverless index remains | Active infrastructure exists | Investigate billing/API traffic |
| Hunter.io | API reports Free plan | Not a paid cancellation target | Keep/watch |
| OpenRouter | Zero current-key usage again | Consecutive quiet key evidence | Watch; prepare deprecation packet only after bakeoff |
| Apify | Starter plan remains; actor-level analysis is still mixed | Account active, actor-level quiet | Keep; pause/replace weak actor surfaces first |
| ElevenLabs | Active Creator subscription; reset date 2026-05-19 | Paid, low recent movement | Review before renewal against campaign plan |
| Calendly | Direct API check returned 401 again; scheduling references remain | Auth unresolved | Refresh token; keep |

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor meets the cancellation threshold in this daily run.**
- No approval phrase was given in this run.

Next Audit Focus

- Refresh Read AI and Calendly auth before using those providers as usage
  evidence.
- Confirm OpenRouter's role in the next media/model bakeoff; if unused again
  and no active spend exists, prepare a deprecation packet rather than canceling
  automatically.
- Verify whether Resend exists in Vercel production env or billing, and whether
  Gmail/n8n is the only real outbound path.
- Confirm Vapi dashboard billing and whether production voice UX is intended to
  stay enabled.
- Check Pinecone billing/API traffic and compare with the Supabase/local RAG
  replacement path.
- Check Printful dashboard/order history and decide whether both stores remain
  strategically active.
- Review ElevenLabs renewal before 2026-05-19T18:38:26Z against the next
  planned social/audio/video campaign.
- Continue the Apify actor-level replacement bakeoff by pausing or replacing
  weak actor surfaces before considering account-level changes.

## 2026-05-12 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- The checkout at `/Users/vambahsillah/Projects/Portfolio` was clean on `main`
  tracking `origin/main`; no unrelated dirty work needed preservation.
- Core runtime signals still moved: n8n Cloud reported 77 workflows, 72 active
  workflows, and a successful execution at 2026-05-12T12:00:44Z; Supabase
  production `agent_runs` increased to 35 with the latest row at
  2026-05-11T22:11:47Z, and `analytics_events` increased to 5030 with the
  latest row at 2026-05-11T19:38:32Z.
- No vendor crossed the cancellation threshold. OpenRouter remains consecutive
  zero-usage evidence for the current key, but there is still no confirmed
  active spend or approved replacement path, so it remains watch/investigate
  rather than a cancellation candidate.
- Vapi, Printful, Pinecone, Resend, Read.ai auth, and Calendly auth remain the
  unresolved decision queue. They need dashboard/auth or billing-owner evidence
  before any deprecation packet is safe.
- BuiltWith remains a protected watch item during the outreach/client-volume
  ramp. Fireflies remains resolved as canceled per Vambah's 2026-05-01
  confirmation unless new paid-plan evidence appears.

Raw Findings

- Prior automation memory file was missing at
  `$CODEX_HOME/automations/portfolio-subscription-cancellation-monitor/memory.md`.
  The durable tracker and admin status JSON were used as continuity state.
- Action tracker feedback file had no entry for
  `portfolio-subscription-cancellation-monitor`; no completed or dismissed
  action was re-raised from tracker feedback.
- Read-only provider checks ran at 2026-05-12T12:52Z. Secret values, raw
  account payloads, and raw logs are not included in this report.
- Supabase production aggregates: `analytics_events` 5030, `meeting_records`
  110, `orders` 26, `gamma_reports` 6, `social_content_queue` 29,
  `drive_video_queue` 35, `email_messages` 9, `documents_local_rag` 3434,
  `printful_sync_log` 0, `cost_events` 14, `video_generation_jobs` 4,
  `diagnostic_audits` 29, `outreach_queue` 9, `contact_submissions` 268, and
  `agent_runs` 35.
- Supabase latest usage signals: latest `agent_runs` row at 2026-05-11,
  latest `cost_events` row at 2026-05-11, latest Gamma report remains
  2026-05-02, latest social content row remains 2026-05-07, latest video
  generation job remains 2026-04-15, and `printful_sync_log` remains empty.
- n8n Cloud API: 77 workflows, 72 active workflows, and latest successful
  execution started at 2026-05-12T12:00:44Z.
- Vercel CLI authentication was available as `vsillah`; direct project-list
  output was not returned in this run, so the run did not refresh Vercel
  deployment metadata beyond repo/config references and the prior weekly
  evidence.
- Apify API: account still reports `STARTER`; the latest sampled account run
  remains a succeeded run on 2026-05-06.
- ElevenLabs API: subscription remains active on Creator with 18,068 of 164,102
  characters used; next character reset returned 2026-05-19T18:38:26Z.
- OpenRouter API: current key still reports zero usage.
- Vapi API: latest returned call remains a 2026-04-30 `webCall` with ended
  status.
- Pinecone API: one ready serverless index named `publications` exists in
  `aws/us-east-1`.
- Printful API: two native stores remain visible; `printful_sync_log` remains
  empty.
- Hunter.io API: account remains Free with quota data visible and reset date
  2026-06-09.
- Read AI and Calendly direct checks both returned 401 again.
- Local reference counts, excluding subscription tracker files: Supabase 3038,
  n8n 3109, Vercel 422, Stripe 437, OpenAI 506, Anthropic 219, Gamma 876,
  HeyGen 597, Read.ai/Read AI 110, Vapi 111, Printful 315, Resend 129,
  Pinecone 255, BuiltWith 189, Fireflies 1, Apify 245, Hunter 43, OpenRouter
  73, ElevenLabs 101, Calendly 416, Slack 1262, Gmail 451, Gemini 47, Google
  Cloud 47, and Perplexity 42.
- Local n8n export node footprint includes 76 Supabase nodes, 51 Slack nodes,
  35 OpenAI chat nodes, 19 Gmail nodes, 7 OpenRouter chat nodes, 7 Google Drive
  nodes, 6 Pinecone vector-store nodes, 6 Perplexity nodes, 2 Calendly triggers,
  1 Stripe trigger, and 1 Anthropic node.

Derived Movement Since Prior Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | `agent_runs` increased from 33 to 35; analytics increased to 5030 | Active | Keep |
| n8n Cloud | Successful execution on 2026-05-12 with 72 active workflows | Active | Keep |
| Vercel | CLI auth available; project-list output did not refresh | Operational evidence stale by one run | Keep; refresh deployment metadata next run |
| Stripe | Checkout/order code and 26 order rows remain | Active revenue dependency | Keep |
| OpenAI | Code, cost/event, and n8n nodes remain | Active | Keep; continue cost monitoring |
| Anthropic | Code and n8n fallback/eval references remain | Watch | Decide after next receipt/bakeoff refresh |
| Gamma | Latest report remains 2026-05-02; admin/report code active | Active enough | Keep; watch deck alternatives |
| HeyGen | Video-generation code/config and API key availability remain | Campaign-dependent active | Keep; review after next video campaign |
| Read.ai | Direct API check returned 401 again; meeting rows/docs remain | Auth unresolved | Keep; refresh auth |
| BuiltWith | Protected outreach-ramp decision remains | Protected watch | Keep during outreach/client-volume ramp |
| Fireflies.ai | No new paid evidence; previously confirmed canceled | Resolved canceled | Keep out of active queue |
| Vapi | Latest API-visible call remains 2026-04-30 | Quiet | Investigate billing/voice UX |
| Printful | Two API stores visible; `printful_sync_log` still empty | Quiet sync | Investigate store/order strategy |
| Resend | Local key absent; optional code/env references remain | Usage unresolved | Verify Vercel env/billing before deciding |
| Pinecone | Ready `publications` serverless index remains | Active infrastructure exists | Investigate billing/API traffic |
| Hunter.io | API reports Free plan | Not a paid cancellation target | Keep/watch |
| OpenRouter | Zero current-key usage again | Consecutive quiet key evidence | Watch; prepare deprecation packet only after bakeoff |
| Apify | Starter plan; latest sampled run remains 2026-05-06 | Account active, actor-level quiet | Keep; pause/replace weak actor surfaces first |
| ElevenLabs | Active Creator subscription; reset date 2026-05-19 | Paid, low recent movement | Review before renewal against campaign plan |
| Calendly | Direct API check returned 401 again; scheduling references remain | Auth unresolved | Refresh token; keep |

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor meets the cancellation threshold in this daily run.**
- No approval phrase was given in this run.

Next Audit Focus

- Refresh Read AI and Calendly auth before using those providers as usage
  evidence.
- Refresh Vercel project/deployment metadata after this run's CLI list command
  returned no project data.
- Confirm OpenRouter's role in the next media/model bakeoff; if unused again
  and no active spend exists, prepare a deprecation packet rather than canceling
  automatically.
- Verify whether Resend exists in Vercel production env or billing, and whether
  Gmail/n8n is the only real outbound path.
- Confirm Vapi dashboard billing and whether production voice UX is intended to
  stay enabled.
- Check Pinecone billing/API traffic and compare with the Supabase/local RAG
  replacement path.
- Check Printful dashboard/order history and decide whether both stores remain
  strategically active.
- Review ElevenLabs renewal before 2026-05-19T18:38:26Z against the next
  planned social/audio/video campaign.
- Continue the Apify actor-level replacement bakeoff by pausing or replacing
  weak actor surfaces before considering account-level changes.

## 2026-05-11 Weekly Subscription Report

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- The root checkout at `/Users/vambahsillah/Projects/Portfolio` was on
  `codex/hyperagent-evaluations` with pre-existing dirty changes in
  `docs/subscription-cancellation-audit.md` and
  `docs/subscription-status.json`, so this weekly update was staged in the
  clean `codex/subscription-watch-next` worktree to preserve unrelated work.
- Core operational dependencies moved since the prior weekly run: n8n Cloud
  still has 77 workflows, 72 active workflows, and a successful execution at
  2026-05-11T13:01:18Z; Supabase production `agent_runs` increased to 33 with
  the latest row at 2026-05-11T13:00:02Z; Vercel project metadata shows
  `portfolio` and `portfolio-staging` updated on 2026-05-11.
- No vendor changed cancellation status this week. The standing decisions still
  hold: BuiltWith remains a protected watch item during the outreach/client
  volume ramp, and Fireflies remains resolved as canceled per Vambah's
  2026-05-01 confirmation unless new paid-plan evidence appears.
- OpenRouter remains consecutive quiet evidence with zero current-key usage,
  but no active spend or approved replacement path was confirmed, so it stays
  watch/investigate rather than a cancellation candidate.
- Read AI and Calendly direct API checks still returned 401. Existing receipt,
  meeting, scheduling, and n8n evidence keep them as keep/auth-refresh items.
- Apify remains paid and active enough to keep at the account level. The next
  decision is actor-level cleanup: pause or replace weak no-run, failing, and
  empty-output surfaces before any account-level cancellation decision.
- ElevenLabs remains active on Creator with the same 18,068 of 164,102
  character usage signal. Review before the 2026-05-19 renewal window against
  the next planned audio/video campaign.

Raw Findings

- Git state at start: `/Users/vambahsillah/Projects/Portfolio` was on
  `codex/hyperagent-evaluations` with dirty subscription tracker files from a
  prior monitor run. `/Users/vambahsillah/Projects/Portfolio.worktrees/subscription-watch`
  was clean on `codex/subscription-watch-next`.
- Prior weekly automation memory was missing; the durable tracker, structured
  admin status file, and daily monitor memory were used as continuity state.
- Safe read-only provider checks were run at 2026-05-11T13:03Z. Secret values,
  raw account payloads, and raw logs are not included in this report.
- Supabase production aggregate reads found: `analytics_events` 5019,
  `meeting_records` 110, `orders` 26, `gamma_reports` 6,
  `social_content_queue` 29, `drive_video_queue` 35, `email_messages` 9,
  `documents_local_rag` 3434, `printful_sync_log` 0, `cost_events` 14,
  `video_generation_jobs` 4, `diagnostic_audits` 29, `outreach_queue` 9,
  `contact_submissions` 268, and `agent_runs` 33.
- Supabase latest usage signals: latest Gamma report created 2026-05-02;
  latest social content row created 2026-05-07; latest agent run created
  2026-05-11; latest email row remains a 2026-04-30 row using `n8n` transport.
- n8n Cloud API: 77 workflows, 72 active workflows, and latest successful
  execution started at 2026-05-11T13:01:18Z.
- Vercel CLI is authenticated under `vsillahs-projects`; project metadata shows
  `portfolio` updated at 2026-05-11T09:22:41Z and `portfolio-staging` updated
  at 2026-05-11T09:22:40Z, both on Node 24.x.
- Apify API: account still reports `STARTER`; latest sampled run remains a
  succeeded run on 2026-05-06.
- ElevenLabs API: subscription remains active on Creator with 18,068 of 164,102
  characters used.
- OpenRouter API: current key still reports zero usage.
- Vapi API: latest returned call remains a 2026-04-30 `webCall` with ended
  status.
- Pinecone API: one ready serverless index named `publications` exists in
  `aws/us-east-1`.
- Printful API: two native stores remain visible; `printful_sync_log` remains
  empty.
- Hunter.io API: account remains Free with quota data visible and reset date
  2026-06-09.
- Read AI API and Calendly API both returned 401.

Derived Movement Since Prior Weekly Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | Production counts refreshed; `agent_runs` increased to 33 and `cost_events` to 14 | Active | Keep |
| n8n Cloud | 77 workflows, 72 active, successful execution on 2026-05-11 | Active | Keep; continue separate workflow-error hygiene |
| Vercel | `portfolio` and `portfolio-staging` project records updated on 2026-05-11 | Active | Keep |
| Stripe | Checkout/order code and 26 order rows remain | Active revenue dependency | Keep |
| OpenAI | Cost/event and generation code paths remain | Active | Keep; continue cost monitoring |
| Anthropic | Code/workflow references remain; transition adjustment still expected | Watch | Decide after next receipt/bakeoff refresh |
| Gamma | Latest completed report remains 2026-05-02; report/admin code active | Active enough | Keep; watch deck alternatives |
| HeyGen | Video-generation paths and config rows remain | Campaign-dependent active | Keep; review after next video campaign |
| Read.ai | Direct API auth still returns 401; receipt and meeting rows remain | Auth unresolved | Keep; refresh auth |
| BuiltWith | Protected outreach-ramp decision remains | Protected watch | Keep during outreach/client-volume ramp |
| Fireflies.ai | No new paid evidence; previously confirmed canceled | Resolved canceled | Keep out of active queue |
| Vapi | 2026-04-30 call still visible; no newer call found | Quiet since recent call | Investigate billing/voice UX |
| Printful | Two API stores visible; `printful_sync_log` remains empty | Quiet sync | Investigate store/order strategy |
| Resend | No live key/billing evidence confirmed; latest email row still uses `n8n` | Usage unresolved | Verify Vercel env/billing before deciding |
| Pinecone | Ready `publications` serverless index remains | Active infrastructure exists | Investigate billing/API traffic |
| Hunter.io | API reports Free plan | Not a paid cancellation target | Keep/watch |
| OpenRouter | Zero usage again for current key | Consecutive quiet key evidence | Watch; prepare deprecation packet only after bakeoff |
| Apify | Starter plan plus actor-level analysis remains | Active paid dependency | Keep; pause/replace weak actor surfaces first |
| ElevenLabs | Active Creator subscription; quota still available | Active paid dependency | Watch renewal against next campaign |
| Calendly | Direct API auth still returns 401; scheduling links and n8n triggers remain | Auth unresolved | Refresh token; keep |

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor meets the cancellation threshold in this weekly run.**
- No approval phrase was given in this run.

Next Audit Focus

- Refresh Read AI and Calendly auth before using those providers as usage
  evidence.
- Confirm OpenRouter's role in the next media/model bakeoff; if unused again and
  no active spend exists, prepare a deprecation packet rather than canceling
  automatically.
- Verify whether Resend exists in Vercel production env or billing, and whether
  Gmail/n8n is the only real outbound path.
- Confirm Vapi dashboard billing and whether production voice UX is intended to
  stay enabled.
- Check Pinecone billing/API traffic and compare with the Supabase/local RAG
  replacement path.
- Check Printful dashboard/order history and decide whether both stores remain
  strategically active.
- Review ElevenLabs renewal before 2026-05-19 against the next planned
  social/audio/video campaign.
- Continue the Apify actor-level replacement bakeoff by pausing or replacing
  weak actor surfaces before considering account-level changes.

## 2026-05-09 Apify Run-History Evidence Update

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- A direct read-only Apify API pull sampled the latest 10 runs for each of the
  12 configured actor surfaces listed in `docs/apify-call-bakeoff-analysis.md`.
- The sample found 59 total runs, 40 successful runs, 19 failed runs, 315
  dataset items, and `$1.99585` in actor usage cost, or about `$0.00634` per
  dataset item before manual acceptance review.
- Four actor categories currently show useful-looking output: Reddit listening,
  Google Maps, LinkedIn post search, and Capterra reviews.
- Eight configured surfaces are no-run, failing, or empty-output: Facebook
  friends, Facebook groups, Facebook comments, LinkedIn connections, LinkedIn
  post engagement, G2 reviews, profile enrichment, and website screenshot/video.
- Recommendation: keep Apify as a watch item for now, but stop treating every
  configured Apify actor as equally valuable. Pause or replace the weak
  surfaces first, then run replacement tests against only the productive
  categories before the next renewal decision.
- Replacement gate added after checking current primary-source pricing/terms:
  test Brave Search against Reddit/Capterra evidence capture, Google Places API
  against Google Maps discovery, and browser/manual sampling against LinkedIn
  post search. Do not benchmark no-run or empty-output actors until a workflow
  owner proves the campaign still needs that source.

Raw Findings

- Token source: existing local `APIFY_TOKEN`; values were not printed.
- Evidence source updated: `/docs/apify-call-bakeoff-analysis.md`.
- Dashboard data updated: `/docs/subscription-status.json`.
- Pricing/terms checked from Brave Search API, Google Maps Platform pricing,
  Reddit Data API Wiki, and Reddit Data API Terms on 2026-05-24.
- No shared cost-event schema changes and no production write actions.

## 2026-05-24 Apify Replacement Harness Update

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- Added a repeatable replacement bakeoff harness for the productive Apify
  categories. The harness can dry-run credential readiness now and run live
  low-volume Brave Search / Google Places challenger calls once read-only keys
  are available.
- Current credential check found local Apify tokens, but no
  `BRAVE_SEARCH_API_KEY` and no `GOOGLE_MAPS_API_KEY`; live replacement API
  tests are therefore blocked rather than inferred.
- LinkedIn post-search replacement remains manual/browser-agent ready because
  the decision depends on accepted lead quality and account-risk burden.

Raw Findings

- New planner: `/lib/apify-replacement-bakeoff.ts`.
- New CLI harness: `/scripts/apify-replacement-bakeoff.ts`.
- New command: `npm run apify:replacement-bakeoff`.
- New tests: `/lib/apify-replacement-bakeoff.test.ts`.
- No shared cost-event schema changes and no production write actions.

## 2026-05-25 LinkedIn Manual Replacement Packet

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- Added a LinkedIn post-search replacement packet for the one Apify LinkedIn
  surface that currently has the strongest value signal.
- Current LinkedIn guidance was checked before writing the packet. The packet
  keeps the replacement test manual and source-register based; it does not
  authorize scraping, auto-viewing, auto-messaging, profile copying, or
  automated browser activity against LinkedIn.
- The acceptance gate requires at least 15 accepted evidence items or leads in
  a 30-minute sprint, fit-score average of 3.5 or higher, reviewable source
  URLs, and less than 2 minutes of review time per accepted item.

Raw Findings

- New packet: `/docs/apify-linkedin-manual-replacement-packet.md`.
- Updated source map: `/docs/apify-call-bakeoff-analysis.md`.
- LinkedIn references checked on 2026-05-25: Prohibited software and
  extensions, Automated activity on LinkedIn, and Professional Community
  Policies.
- No shared cost-event schema changes and no production write actions.

## 2026-05-09 Budget Query Readiness Update

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- The admin Subscription Watch surface now separates the current receipt-backed
  run-rate from the projected next-cycle run-rate, so the dashboard can answer
  questions about whether the month is inflated by quick enrollments,
  cancellations, and the Anthropic-to-ChatGPT switch.
- Current confirmed run-rate remains `$791.02` against the `$300.00` monthly
  target. The tracked Anthropic adjustment is `-$106.25` if cancellation holds,
  projecting a next-cycle run-rate of `$684.77`, still `$384.77` over target.
- Gamma and Apify remain explicit watch items. Gamma stays in the deck/tooling
  comparison path. Apify stays tied to actor-level replacement analysis rather
  than a simple cancellation recommendation.
- The Apify analysis currently identifies 12 configured actor call surfaces and
  requires direct Apify run history, actor costs, dataset counts, and accepted
  result rates before deciding whether to replace, pause, or keep Apify.

Raw Findings

- Dashboard/data source updated: `/docs/subscription-status.json`.
- Query helper updated: `/lib/subscription-status.ts`.
- Admin view updated: `/app/admin/subscriptions/page.tsx`.
- Apify evidence source remains `/docs/apify-call-bakeoff-analysis.md`.
- This update does not touch shared cost-event schema or production billing
  writes.

## 2026-05-08 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- Core runtime and revenue dependencies still show live usage: Supabase
  production tables, n8n Cloud executions, Vercel production/staging
  deployments, Stripe checkout/order code, OpenAI cost/event code paths, Gamma
  reports, HeyGen video paths, Read.ai-linked meeting rows, Slack/Gmail
  workflow references, Apify automations, Calendly links, Google integrations,
  and active admin/report surfaces.
- n8n Cloud remains active with 77 workflows and successful executions at
  2026-05-08T14:00Z.
- Supabase production counts moved since the last daily monitor, including
  `contact_submissions` 268, `agent_runs` 24, `analytics_events` 5005,
  `meeting_records` 110, and `social_content_queue` 29.
- Vercel remains operationally active. `portfolio-staging` was `READY` for
  `main` at 2026-05-08T14:18Z; the later deployment monitor confirmed both
  `portfolio` and `portfolio-staging` production deployments reached `READY`.
- Apify is confirmed paid and recently active: the account is on `STARTER`, and
  actor runs include a 2026-05-06 succeeded run plus low-cost failed checks.
  Keep it as an explicit watch item tied to actor-level replacement analysis,
  not a cancellation candidate.
- ElevenLabs remains confirmed paid and active: the API reports an active
  Creator subscription with 18,068 of 164,102 characters used.
- OpenRouter remains quiet for the current key with zero usage. This is
  consecutive quiet API evidence, but no active spend or approved replacement
  decision was confirmed, so it stays watch/investigate rather than cancel.
- Vapi remains a watch item, not a cancellation candidate. The Calls API still
  returns the recent 2026-04-30 `webCall`; billing and intended production voice
  UX still need dashboard confirmation.
- BuiltWith remains protected during the outreach/client-volume ramp. Fireflies
  remains resolved as canceled per Vambah's 2026-05-01 confirmation.

Raw Findings

- Git state at start: clean `main` tracking `origin/main`. No unrelated dirty
  work was found.
- Prior automation memory file was missing at
  `$CODEX_HOME/automations/portfolio-subscription-cancellation-monitor/memory.md`;
  the durable repo tracker and global subscription-monitor notes were used as
  continuity state.
- Repo evidence refreshed across package manifests, environment-name inventory,
  docs, app/api routes, lib integrations, n8n exports, migrations, and the admin
  Subscription Watch files. Secret values and raw account data are not included
  in this report.
- Local reference counts, excluding dependency/install output and subscription
  tracker files: Supabase 4862, n8n 4572, Vercel 309, Stripe 662, OpenAI 783,
  Anthropic 249, Gamma 1264, HeyGen 783, Read.ai/Read AI 501, Vapi 366,
  Printful 516, Resend 146, Pinecone 268, BuiltWith 261, Fireflies 1, Apify 334,
  Hunter 67, OpenRouter 95, ElevenLabs 206, Calendly 582, Slack 1433, Gmail 586,
  Gemini 88, Google Cloud 15, Paper 17, Excalidraw 4, Figma 2, V0 21, and
  Perplexity 54.
- Local n8n export evidence: 44 workflow JSON files. Node footprint includes 60
  Supabase nodes, 40 Slack nodes, 25 OpenAI/OpenAI-chat nodes, 17 Gmail nodes,
  10 Google/Drive nodes, 5 Apify nodes, 4 OpenRouter nodes, 3 Pinecone nodes, 2
  Calendly nodes, and 1 Anthropic node.
- Environment-name inventory confirms configured keys or URLs for Supabase,
  n8n Cloud, Vapi, Pinecone, Hunter.io, Printful, OpenRouter, Stripe, Gamma,
  HeyGen, Apify, BuiltWith, OpenAI, Anthropic, Gemini, ElevenLabs, Calendly,
  Slack, Resend, Gmail, Google service account, USPS, LinkedIn, and Source
  Protocol. Values were not printed.
- Vercel CLI 53.1.0 is authenticated under `vsillahs-projects`. Projects listed
  include `portfolio` and `portfolio-staging`; both project records updated on
  2026-05-08 and use Node 24.x.
- Open PRs during this run were #180 and #181, both with successful
  `Vercel - portfolio` and `Vercel - portfolio-staging` checks. They were not
  part of this audit and were not modified.
- Supabase production aggregate read using existing env vars found:
  `analytics_events` 5005, `pain_point_evidence` 4679, `meeting_records` 110,
  `project_reminders` 857, `orders` 26, `gamma_reports` 6,
  `social_content_queue` 29, `drive_video_queue` 35, `heygen_config` 9084,
  `email_messages` 9, `documents_local_rag` 3434, `printful_sync_log` 0,
  `cost_events` 13, `video_generation_jobs` 4, `diagnostic_audits` 29,
  `outreach_queue` 9, `contact_submissions` 268, and `agent_runs` 24.
- Supabase latest usage signals: latest Gamma report updated on 2026-05-02 with
  completed status; latest email row on 2026-04-30 using `n8n` transport; latest
  social content row updated on 2026-05-07; latest agent run on 2026-05-08 with
  completed status.
- n8n Cloud API: 77 workflows listed. Recent executions returned 10 results,
  with the newest successful trigger executions starting around
  2026-05-08T14:00Z.
- Vapi API: `GET /call` still returns the recent 2026-04-30 `webCall` with a
  small recorded call cost. Billing plan status was not confirmed.
- Pinecone API: one ready serverless index named `publications` exists in
  `aws/us-east-1`, dimension 1536, metric `cosine`.
- Hunter.io API: account status returned plan `Free`, 5 used searches, 5 used
  credits, 10 used verifications, and reset date 2026-05-09.
- Printful API: two native stores are visible: `AmaduTown Store` and
  `Personal orders`. Portfolio still has one historical Printful-linked order,
  but `printful_sync_log` remains empty.
- OpenRouter API: current key status returned zero usage and no confirmed
  active spend.
- ElevenLabs API: subscription status is active on Creator, with character usage
  and remaining quota visible.
- Apify API: account plan is `STARTER`; latest actor runs include a succeeded
  run on 2026-05-06 and low-cost failed checks on 2026-05-06 and 2026-04-29.
- Read AI direct API was not refreshed in this run; existing Supabase meeting
  rows and repo references remain the current evidence.

Derived Movement Since Last Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | Production counts refreshed on 2026-05-08; key tables increased | Active | Keep |
| n8n Cloud | 77 workflows; successful executions on 2026-05-08 | Active | Keep; continue workflow-error triage separately |
| Vercel | Production and staging project records updated on 2026-05-08; later deployment monitor confirmed both production contexts `READY` | Active | Keep; continue deployment monitoring |
| Stripe | Checkout/order code and 26 order rows remain | Active revenue dependency | Keep |
| OpenAI | Cost-event and generation code paths remain heavily referenced | Active | Keep; continue cost monitoring |
| Anthropic | Workflow/code references remain; monthly plan is a budget watch item after ChatGPT transition | Watch | Decide after next receipt/bakeoff refresh |
| Gamma | Latest completed report on 2026-05-02; report/admin code active | Active | Keep; keep watching deck alternatives |
| HeyGen | Video-generation paths and config rows remain | Campaign-dependent active | Keep; review after next video campaign |
| Read.ai | Meeting rows through April plus repo references; direct API not refreshed | Active enough but auth needs refresh | Keep; refresh auth |
| BuiltWith | Local references remain; protected watch decision still applies | Protected watch | Keep during outreach/client-volume ramp |
| Fireflies.ai | No new paid evidence; previously confirmed canceled | Resolved canceled | Keep out of active queue |
| Vapi | 2026-04-30 call remains visible through API | Recent usage confirmed | Investigate billing/voice UX |
| Printful | Two API stores visible; `printful_sync_log` remains empty | Quiet sync, likely usage-based | Investigate store/order strategy |
| Resend | Env/code path present, but latest DB email row still uses `n8n` transport | Usage unresolved | Verify Vercel env/billing before deciding |
| Pinecone | Ready `publications` serverless index remains | Active infrastructure exists | Investigate billing/API traffic |
| Hunter.io | API reports Free plan with quota usage | Not a paid cancellation target | Keep/watch |
| OpenRouter | Zero usage again for current key | Consecutive quiet key evidence | Watch; decide after model/media bakeoff |
| Apify | Starter plan plus recent actor runs | Active paid dependency | Keep; review actor cadence/spend |
| ElevenLabs | Creator subscription active with increased character usage | Active paid dependency | Watch renewal against next social/audio campaign |
| Calendly | Scheduling links and package dependency remain; direct API not refreshed | Auth/usage unresolved, not inactive | Refresh token; keep |

Inactive-For-Two-Sessions Evidence

- **OpenRouter:** current key has consecutive zero-usage API evidence. Keep as
  watch, not cancel, until the media/model bakeoff confirms it is not needed or
  a replacement path is approved.
- **Resend:** latest production email evidence still points to `n8n` transport,
  but env/code paths exist. Verify Vercel env and billing before deciding
  whether this is only an optional fallback.
- **Printful:** sync log remains empty across sessions, but API stores and one
  historical Printful-linked order keep it in investigate.
- **BuiltWith:** still protected as an outreach-ramp watch item.
- **Vapi:** does not qualify as inactive because the API still confirms a
  2026-04-30 call.

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor meets the cancellation threshold in this run.**
- No approval phrase was given in this run.

Next Audit Focus

- Keep deployment queue metrics visible after staging preview suppression and
  continue verifying both production contexts after merges.
- Confirm OpenRouter's role in the next media/model bakeoff; if unused again
  and no active spend exists, prepare a deprecation packet rather than canceling
  automatically.
- Verify whether Resend exists in Vercel production env or billing, and whether
  Gmail/n8n is the only real outbound path.
- Refresh Read AI and Calendly auth before drawing new usage conclusions.
- Confirm Vapi dashboard billing and whether production voice UX is intended to
  stay enabled.
- Check Pinecone billing/API traffic and compare with the Supabase/local RAG
  replacement path.
- Check Printful dashboard/order history and decide whether both stores remain
  strategically active.
- Review ElevenLabs renewal before 2026-05-19 against the next planned
  social/audio/video campaign.
- Continue the Apify actor-level replacement bakeoff before the next renewal.

## 2026-05-06 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- Core runtime and revenue dependencies still show live usage: Supabase
  production tables, n8n Cloud executions, Vercel deployments for both
  `portfolio` and `portfolio-staging`, Stripe checkout/order code, OpenAI cost
  events, Gamma reports, HeyGen video rows, Read.ai-linked meeting rows,
  Slack/Gmail workflow references, Apify automations, Calendly links, and
  Google Cloud/Drive integrations.
- Vercel is operationally active today. `vercel projects ls` showed
  `portfolio` updated 27 minutes before this run and `portfolio-staging`
  updated 30 minutes before this run; both latest deployment lists showed
  `READY` production deployments from `main` on 2026-05-06.
- n8n Cloud remains active with 77 workflows and finished executions at
  2026-05-06T12:00Z.
- Supabase production counts increased since the prior run, including
  `contact_submissions` 267, `diagnostic_audits` 29, and `agent_runs` 21.
- BuiltWith remains protected during the outreach/client-volume ramp. Current
  data presence improved again: 267 `website_tech_stack` rows and 29
  diagnostic `enriched_tech_stack` rows.
- Vapi remains a watch item, not a cancellation candidate. The Calls API still
  returns the recent 2026-04-30 `webCall`; billing and intended production voice
  UX still need dashboard confirmation.
- OpenRouter remains quiet for the current key with zero daily, weekly, monthly,
  and all-time usage. This is now consecutive quiet API evidence, but no
  active paid spend or low-risk replacement decision was confirmed, so it stays
  watch/investigate rather than cancel.
- ElevenLabs is confirmed paid and active: the API reports a Creator monthly
  subscription, active status, 16,947 of 164,102 characters used, and a next
  invoice attempt on 2026-05-19.
- Apify is confirmed paid and active: the API reports the Starter plan at
  $39/month with platform features enabled; n8n Apify nodes remain in the
  automation footprint.
- Hunter.io remains Free with quota usage. It is not a paid cancellation target.
- Fireflies remains resolved as canceled per Vambah's 2026-05-01 confirmation;
  no new paid-plan evidence appeared.

Raw Findings

- Git state at start: clean detached `HEAD`. No unrelated dirty work was found.
- Prior automation memory file was missing at
  `$CODEX_HOME/automations/portfolio-subscription-cancellation-monitor/memory.md`;
  the durable repo tracker and global subscription-monitor notes were used as
  continuity state.
- Repo evidence refreshed across package/env templates, docs, app/api routes,
  lib integrations, n8n exports, migrations, and the admin Subscription Watch
  files. Secret values and raw account data are not included in this report.
- Local reference counts, excluding dependency/install output and subscription
  tracker files: Supabase 3380, n8n 3238, Vercel 213, Stripe 434, OpenAI 501,
  Anthropic 175, Gamma 826, HeyGen 554, Read.ai/Read AI 186, Vapi 111,
  Printful 317, Resend 126, Pinecone 167, BuiltWith 183, Fireflies 1, Apify
  178, Hunter 25, OpenRouter 79, ElevenLabs 89, Calendly 400, Slack 1042,
  Gmail 424, Gemini 43, USPS 119, Paper 15, Excalidraw 3, and Figma 2.
- Local n8n export evidence: 45 workflow JSON files. Node footprint includes
  60 Supabase nodes, 41 Slack nodes, 28 OpenAI nodes, 17 Gmail nodes, 12 Google
  nodes, 6 Google Drive nodes, 5 Apify nodes, 4 OpenRouter nodes, 3 Pinecone
  nodes, 2 Calendly nodes, and 1 Anthropic node.
- Environment-name inventory confirms configured keys for Supabase, n8n Cloud,
  Vapi, Pinecone, Hunter.io, Printful, OpenRouter, Stripe, Gamma, HeyGen,
  Apify, BuiltWith, OpenAI, Anthropic, Gemini, ElevenLabs, Calendly, and Slack.
  `RESEND_API_KEY` was not present in local `.env.local` during this run.
- Vercel CLI: user-owned Vercel CLI 53.1.0 is authenticated under
  `vsillahs-projects`. Projects listed include `portfolio` and
  `portfolio-staging`; both have fresh 2026-05-06 `READY` deployments from
  `main`.
- Supabase production aggregate read using existing env vars found:
  `analytics_events` 4993, `pain_point_evidence` 4679, `meeting_records` 109,
  `project_reminders` 857, `orders` 26, `gamma_reports` 6,
  `social_content_queue` 28, `drive_video_queue` 35, `heygen_config` 9084,
  `email_messages` 9, `documents_local_rag` 3434, `printful_sync_log` 0,
  `cost_events` 13, `video_generation_jobs` 4, `diagnostic_audits` 29,
  `outreach_queue` 9, `contact_submissions` 267, and `agent_runs` 21.
- Supabase latest usage signals: latest OpenAI cost event on 2026-04-30
  (`llm_openai`, `gpt-4o-mini`, in-app outreach); latest Gamma report on
  2026-05-02 with completed status; latest HeyGen video job updated on
  2026-04-15 with completed status; latest email row on 2026-04-30 using `n8n`
  transport; latest Read.ai-linked meeting on 2026-04-15; latest social content
  row on 2026-04-23; latest agent run on 2026-05-05.
- n8n Cloud API: 77 workflows listed. Recent executions returned 10 results,
  with the newest five finished executions starting around 2026-05-06T12:00Z.
- Vapi API: `GET /call` still returns the recent 2026-04-30 `webCall`.
  Billing plan status was not confirmed.
- Pinecone API: one ready serverless index named `publications` exists in
  `aws/us-east-1`, dimension 1536, metric `cosine`.
- Hunter.io API: account status returned plan `Free`, 5 used searches, 5 used
  credits, 10 used verifications, and reset date 2026-05-09.
- Printful API: two native stores are visible: `AmaduTown Store` and
  `Personal orders`. Portfolio still has one historical Printful-linked order,
  but `printful_sync_log` remains empty.
- OpenRouter API: current key status returned zero usage for daily, weekly,
  monthly, and all-time windows. No active spend signal was confirmed.
- ElevenLabs API: subscription status is active on Creator monthly, with
  character usage and a next invoice attempt on 2026-05-19.
- Apify API: account plan is Starter, $39/month, with platform features enabled.
- Calendly API: current token returned `401 Unauthenticated`; scheduling links
  remain heavily referenced in Portfolio, so this is a token-refresh issue, not
  cancellation evidence.
- Read AI and Slack app connectors failed to initialize because the Codex app
  MCP handoff to `chatgpt.com/backend-api/wham/apps` failed. A direct Read AI
  token check also returned `401`, so Read AI usage was not refreshed beyond
  existing Supabase rows in this run.

Derived Movement Since Last Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | Production counts refreshed on 2026-05-06; several key tables increased | Active | Keep |
| n8n Cloud | 77 workflows; finished executions on 2026-05-06 | Active | Keep; triage workflow errors separately |
| Vercel | `portfolio` and `portfolio-staging` both updated/deployed on 2026-05-06 | Active | Keep; billing owner still worth documenting |
| Stripe | Checkout/order code, 26 order rows, and Stripe API access remain | Active revenue dependency | Keep |
| OpenAI | Latest cost event on 2026-04-30 | Active | Keep; continue cost monitoring |
| Gamma | Latest completed report on 2026-05-02 | Active | Keep |
| HeyGen | Completed video job on 2026-04-15; API key can list avatars | Campaign-dependent active | Keep; review after next video campaign |
| Read.ai | DB rows through 2026-04-15; connector/token refresh failed today | Active enough but auth stale | Keep; refresh auth |
| BuiltWith | 267 website tech-stack rows and 29 enriched diagnostic rows | Protected watch | Keep during outreach/client-volume ramp |
| Fireflies.ai | No new paid evidence; previously confirmed canceled | Resolved canceled | Keep out of active queue |
| Vapi | 2026-04-30 call remains visible through API | Recent usage confirmed | Investigate billing/voice UX |
| Printful | Two API stores visible; `printful_sync_log` remains empty | Quiet sync, likely usage-based | Investigate store/order strategy |
| Resend | Local production env lacks `RESEND_API_KEY`; DB email rows still use `n8n` | Usage unresolved | Verify Vercel env/billing before deciding |
| Pinecone | Ready `publications` serverless index remains | Active infrastructure exists | Investigate billing/API traffic |
| Hunter.io | API reports Free plan with quota usage | Not a paid cancellation target | Keep/watch |
| OpenRouter | Zero usage again for current key | Consecutive quiet key evidence | Watch; decide after model/media bakeoff |
| Apify | Starter $39/month plan and n8n Apify nodes remain | Active paid dependency | Keep; review actor cadence/spend |
| ElevenLabs | Creator monthly subscription active with next invoice on 2026-05-19 | Active paid dependency | Watch renewal against next social/audio campaign |
| Calendly | API token invalid, but scheduling links remain heavily referenced | Auth stale, not inactive | Refresh token; keep |

Inactive-For-Two-Sessions Evidence

- **OpenRouter:** current key now has consecutive zero-usage API evidence. Keep
  as watch, not cancel, until the media/model bakeoff confirms it is not needed
  or a replacement path is approved.
- **Resend:** production email rows still show `n8n`, and local production env
  lacks `RESEND_API_KEY`. Verify Vercel env and billing before deciding whether
  this is only an optional code path.
- **Printful:** sync log remains empty across sessions, but API stores and one
  historical Printful-linked order keep it in investigate.
- **BuiltWith:** still protected as an outreach-ramp watch item, and production
  tech-stack rows continue to increase.
- **Vapi:** does not qualify as inactive because the API still confirms a
  2026-04-30 call.

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor meets the cancellation threshold in this run.**
- No approval phrase was given in this run.

Next Audit Focus

- Confirm OpenRouter's role in the next media/model bakeoff; if unused again
  and no active spend exists, prepare a deprecation packet rather than canceling
  automatically.
- Verify whether Resend exists in Vercel production env or billing; local env
  did not include a key.
- Refresh Read AI and Calendly auth before drawing new usage conclusions.
- Confirm Vapi dashboard billing and whether production voice UX is intended to
  stay enabled.
- Check Pinecone billing/API traffic and compare with the Supabase/local RAG
  replacement path.
- Check Printful dashboard/order history and decide whether both stores remain
  strategically active.
- Review ElevenLabs renewal before 2026-05-19 against the next planned
  social/audio/video campaign.

## 2026-05-06 Budget Query Readiness Update

Status: YELLOW

Summary:

- Added a receipt-backed budget snapshot to `docs/subscription-status.json` so
  `/admin/subscriptions` and `GET /api/admin/subscriptions/status?q=...` can
  answer monthly spend questions such as "Are we under $300?"
- Confirmed monthly run-rate snapshot: `$791.02` against a `$300` target, with
  `$491.02` over target.
- This is a partial receipt-verified snapshot, not final bank reconciliation.
  Recent quick enrollments/cancellations, especially the Anthropic to ChatGPT
  switch, may reduce next-month realized spend.
- Gamma and Apify remain watch items. Gamma is a low-dollar watch item. Apify is
  now linked to `docs/apify-call-bakeoff-analysis.md` for actor-level
  replacement analysis.
- No cancellation was performed and no approval phrase was given.

Raw Findings:

- Gmail receipts confirmed: Gamma `$25.00`, n8n `$63.75`, Read.ai `$20.98`,
  Supabase `$25.27`, BuiltWith `$307.00` across three receipts, Apify `$39.00`,
  HeyGen `$30.81`, ElevenLabs `$23.38`, Calendly `$12.75`, Google Cloud `$9.33`,
  Anthropic `$106.25`, OpenAI/ChatGPT Pro `$106.25`, and Vercel `$21.25`.
- n8n Cloud execution `13174` for workflow `HqpDGIHxvJqXKHuT` succeeded on
  2026-05-06 and showed the Apify Actor Health Monitor checking
  `alien_force~facebook-scraper-pro` and `harvestapi~linkedin-profile-search`.
  Both returned `no_runs` warnings, so the actor monitor itself is active but
  does not prove recent productive actor usage.

Next Audit Focus:

- Refresh the budget snapshot after the Anthropic/ChatGPT transition settles.
- Pull direct Apify run history, dataset item counts, and compute/cost data for
  every configured actor before the next Apify renewal.
- Keep Gamma and Apify visible in the admin dashboard watch path.

## 2026-05-05 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- Core runtime and revenue dependencies still show live usage: Supabase
  production tables, n8n Cloud executions, Vercel deployments for both
  `portfolio` and `portfolio-staging`, Stripe checkout/order code, OpenAI cost
  events, Gamma reports, HeyGen video rows, Read.ai meeting records, Slack/Gmail
  workflow references, Apify automations, Calendly, and Google Cloud.
- Vapi should move out of the provisional red cancellation gate. The read-only
  Vapi Calls API returned one recent `webCall` created on 2026-04-30 with a
  small recorded call cost. Dashboard billing still needs confirmation, but the
  current evidence no longer supports "no operational usage confirmed."
- Pinecone has a live ready `publications` serverless index. Keep it in
  investigate until current RAG traffic and billing are checked against the
  Supabase/local RAG replacement path.
- Hunter.io returned a Free plan with quota usage, so it is not a paid
  cancellation candidate in this session.
- OpenRouter returned zero usage for the current key. Keep it as a new
  low-cost/unknown watch item until the media/model bakeoff needs it or confirms
  it can be removed.
- BuiltWith remains a protected outreach-ramp watch item, with stronger
  production data than previously observed: `website_tech_stack` rows and
  diagnostic `enriched_tech_stack` rows are populated.
- Fireflies remains resolved as canceled per Vambah's 2026-05-01 confirmation;
  no new paid-plan evidence appeared.

Raw Findings

- Git state at start: clean detached `HEAD`. No unrelated dirty work was found.
- Automation memory from prior daily runs showed Vapi as the main provisional
  red investigation gate, BuiltWith as a protected watch item, and Fireflies as
  resolved canceled.
- Repo evidence refreshed across package/env templates, docs, app/api routes,
  lib integrations, scripts, n8n exports, migrations, and the admin
  Subscription Watch files. Secret values were not included in this report.
- Local reference counts, excluding dependency/install output and subscription
  tracker files: Supabase 4146, n8n 4147, Vercel 233, Stripe 539, OpenAI 534,
  Anthropic 197, Gamma 1124, HeyGen 706, Read.ai 115, Vapi 148, Printful 398,
  Resend 150, Pinecone 224, BuiltWith 224, Fireflies 1, Apify 288, Hunter 64,
  OpenRouter 92, ElevenLabs 145, Calendly 553, Slack 1273, Gmail 554, Gemini 81,
  USPS 145, Paper 12, Excalidraw 4, and Figma 2.
- Local n8n export evidence: 45 workflow JSON files. Node footprint includes
  60 Supabase nodes, 40 Slack nodes, 18 OpenAI chat model nodes, 15 Gmail nodes,
  10 schedule triggers, 5 Apify nodes, 4 OpenRouter chat model nodes, 4 Google
  Drive nodes, 3 Pinecone vector-store nodes, 3 OpenAI nodes, 3 OpenAI embedding
  nodes, and 1 Anthropic node.
- n8n Cloud connector: 77 workflows listed. Recent executions include
  successful webhook and scheduled executions on 2026-05-05 through
  12:48:10Z. Recent errors also appeared on 2026-05-05 and 2026-05-04; treat
  those as workflow hygiene, not subscription-cancellation evidence.
- Vercel CLI: user-owned Vercel CLI 53.1.0 is authenticated. `vercel ls
  --format json` showed fresh `READY` deployments for both `portfolio` and
  `portfolio-staging` on 2026-05-05, including `main` and active feature branch
  deployments under `vsillahs-projects`.
- Supabase production aggregate read using existing env vars found:
  `analytics_events` 4977, `pain_point_evidence` 4679, `meeting_records` 109,
  `project_reminders` 857, `orders` 26, `gamma_reports` 6,
  `social_content_queue` 28, `drive_video_queue` 35, `heygen_config` 9084,
  `email_messages` 9, `documents_local_rag` 3434, `printful_sync_log` 0,
  `cost_events` 13, `video_generation_jobs` 4, `diagnostic_audits` 27,
  `outreach_queue` 9, `contact_submissions` 249, and `agent_runs` 5.
- Supabase latest usage signals: latest OpenAI cost event on 2026-04-30
  (`llm_openai`, `gpt-4o-mini`, in-app outreach); latest Gamma report on
  2026-05-02 with completed status; latest HeyGen video generation job on
  2026-04-15 with completed status; latest email/outreach rows on 2026-04-30
  using `n8n` transport; latest Read.ai-linked meeting rows on 2026-04-16;
  latest social content rows on 2026-04-23; latest agent run on 2026-05-04.
- BuiltWith data path: 249 `contact_submissions.website_tech_stack` rows, 27
  diagnostic `enriched_tech_stack` rows, and 1
  `client_verified_tech_stack` row were observed. BuiltWith is still protected
  during the outreach/client-volume ramp.
- Vapi API: `GET /call` returned one recent call, a `webCall` created on
  2026-04-30 and ended on 2026-04-30, with a small recorded call cost. Billing
  plan status was not confirmed.
- Pinecone API: one ready serverless index named `publications` exists in
  `aws/us-east-1`, dimension 1536, metric `cosine`.
- Hunter.io API: account status returned plan `Free`, 50 used requests, 75
  available requests, reset date 2026-05-09.
- Printful API: two native stores are visible: `AmaduTown Store` and
  `Personal orders`. Portfolio still has one historical Printful-linked order,
  but `printful_sync_log` remains empty.
- OpenRouter API: current key status returned zero usage for daily, weekly, and
  monthly windows. No active spend signal was confirmed.
- Read AI, Gmail, Slack, and Vercel app connectors were unavailable in this
  session due MCP app startup/handshake failures, so those connector-specific
  signals were not refreshed. Repo, Supabase, n8n Cloud, Vercel CLI, and direct
  read-only provider APIs were used instead.

Derived Movement Since Last Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | Production counts refreshed on 2026-05-05 | Active | Keep |
| n8n Cloud | 77 workflows; successful executions on 2026-05-05 | Active, with separate workflow hygiene errors | Keep; triage recurring errors outside cancellation audit |
| Vercel | Ready deployments for production and staging on 2026-05-05 | Active | Keep; billing owner still worth documenting |
| Stripe | Checkout/order code and 26 production order rows remain | Active revenue dependency | Keep |
| OpenAI | Latest cost event on 2026-04-30 | Active | Keep; continue cost monitoring |
| Gamma | Latest completed report on 2026-05-02 | Active | Keep |
| HeyGen | Completed video job on 2026-04-15 and config rows remain | Active but campaign-dependent | Keep; review after next video campaign |
| Read.ai | Read.ai-linked meeting records through 2026-04-16; connector unavailable today | Active enough | Keep; refresh connector next run |
| BuiltWith | 249 website tech-stack rows and 27 enriched diagnostic rows | Protected watch | Keep during outreach/client-volume ramp |
| Fireflies.ai | No new paid evidence; previously confirmed canceled | Resolved canceled | Keep out of active queue unless paid evidence reappears |
| Vapi | One Vapi `webCall` on 2026-04-30 | Recent usage confirmed | Investigate billing/production voice UX; no longer provisional red |
| Printful | Two API stores visible; one historical Printful-linked order; sync log empty | Quiet sync, likely usage-based | Investigate store/order strategy, not cancellation |
| Resend | 0 production `resend` transport rows; 9 `n8n` transport email rows | Usage unresolved | Verify production env and whether paid plan exists |
| Pinecone | One ready `publications` serverless index | Active infrastructure exists | Investigate billing/API traffic before any replacement |
| Hunter.io | API reports Free plan with quota usage | Not a paid cancellation target | Keep/watch; revisit only if upgraded or redundant |
| OpenRouter | Current key reports zero usage | Quiet current key | Watch; decide after model/media bakeoff need is clearer |
| Apify | n8n Apify nodes and actor monitor workflows remain active | Active | Keep; continue spend/cadence review |

Inactive-For-Two-Sessions Evidence

- **OpenRouter:** current key reports zero usage, but this is a newer baseline
  and no paid-plan evidence was confirmed. Keep as watch, not cancel.
- **Resend:** production email rows still show `n8n` rather than `resend`.
  Verify production env and billing before deciding whether to remove the
  optional code path.
- **Printful:** sync log remains empty across sessions, but API stores and one
  historical Printful-linked order keep it in investigate.
- **BuiltWith:** still protected as an outreach-ramp watch item, and production
  tech-stack rows now show real data presence.
- **Vapi:** no longer qualifies as a no-usage candidate because the Vapi API
  confirmed a 2026-04-30 call.

Candidate Cancellations

- **No automatic cancellation.**
- **No current vendor meets the cancellation threshold in this run.**
- No approval phrase was given in this run.

Next Audit Focus

- Confirm Vapi dashboard billing and whether production voice UX is intended to
  stay enabled.
- Check Pinecone billing/API traffic and compare with the Supabase/local RAG
  replacement path.
- Decide whether OpenRouter is still needed for media/model bakeoffs after a
  zero-usage key check.
- Confirm whether production has a paid Resend configuration or whether
  Gmail/n8n is the actual outbound channel.
- Check Printful dashboard/order history and decide whether the two stores are
  strategically active.
- Refresh Read AI, Gmail, Slack, and Vercel app connectors once MCP app startup
  is healthy again.

## 2026-05-03 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- Core runtime and revenue dependencies still show live usage: Supabase
  production rows, n8n Cloud executions, Vercel deployments for both
  `portfolio` and `portfolio-staging`, Stripe payment-intent activity, Gamma,
  HeyGen, OpenAI cost events, Read.ai meeting records, Slack/Gmail/n8n email,
  Calendly, Apify, and Google Cloud.
- Vapi remains the only provisional red investigation gate. This is now another
  quiet audit session: code/env/webhook references remain, but no dashboard,
  billing, call-history, DB, Slack, or Gmail usage signal was confirmed. It
  still requires dashboard/billing verification before any cancellation packet.
- BuiltWith remains a protected watch item during the outreach/client-volume
  ramp. Do not move it into the cancellation queue until there is enough lead,
  audit, implementation-strategy, proposal, and conversion evidence to judge the
  enrichment value.
- Fireflies remains resolved as canceled per Vambah's 2026-05-01 confirmation;
  no new paid-plan evidence appeared.
- Hunter.io and OpenRouter are now explicitly tracked as investigate items
  because they have repo/n8n/env references but no billing evidence was
  confirmed in this run.

Raw Findings

- Git state at start: branch `codex/automation-context-dashboard` with unrelated
  automation-dashboard changes already present (`app/admin/agents/page.tsx`,
  `lib/admin-nav.ts`, `app/admin/agents/automations/`,
  `app/api/admin/agents/automations/`,
  `lib/codex-automation-inventory.ts`, and
  `lib/codex-automation-inventory.test.ts`). These were left untouched.
- Automation memory from 2026-05-02 showed Vapi as the only provisional red
  investigation gate, BuiltWith as protected watch, and Fireflies as resolved
  canceled.
- Repo evidence refreshed across package/env manifests, docs, app/api routes,
  lib integrations, scripts, n8n exports, admin Subscription Watch surface, and
  local Google Drive asset names. `.env.local` and `.env.example` expose env
  names only; no secrets were printed.
- Local reference counts, excluding dependency/install output and subscription
  tracker files: Supabase 4823, n8n 4765, Gamma 1232, HeyGen 768, Stripe 650,
  Calendly 601, OpenAI 598, Printful 519, Vapi 353, Apify 294, BuiltWith 241,
  Vercel 240, Pinecone 230, Anthropic 221, ElevenLabs 199, Resend 149, USPS 148,
  Read.ai 126, OpenRouter 95, Gemini 85, Hunter 66, Paper 20, Excalidraw 4,
  Figma 3, Fireflies 1.
- n8n export evidence: 46 local workflow JSON files. Node footprint includes
  64 Supabase nodes, 48 Slack nodes, 30 OpenAI nodes, 17 Gmail nodes, 14 Google
  nodes, 11 Apify nodes, 10 schedule nodes, 6 Google Drive nodes, 3 Pinecone
  nodes, 3 Calendly nodes, 1 Gemini node, and 1 Anthropic node. The manifest
  still lists Pinecone as part of the RAG workflow pack.
- Supabase connector returned one read-only production count query, then
  required reauthentication on the follow-up metadata query. A local read-only
  Supabase client check using existing production env vars found:
  `analytics_events` 4971, `pain_point_evidence` 4679, `meeting_records` 109,
  `project_reminders` 857, `orders` 26, `gamma_reports` 6,
  `social_content_queue` 28, `drive_video_queue` 35, `heygen_config` 9084,
  `email_messages` 9, `documents_local_rag` 3434, `printful_sync_log` 0,
  `cost_events` 13, `video_generation_jobs` 4, and `diagnostic_audits` 27.
- Supabase latest usage signals: latest OpenAI cost event on 2026-04-30;
  latest Gamma report created 2026-05-02 with completed status; latest HeyGen
  video jobs completed on 2026-04-15; latest email rows on 2026-04-30 using
  `n8n` transport; latest Read.ai-linked meeting rows created 2026-04-16;
  latest social content drafts on 2026-04-23; latest order on 2026-03-19; one
  historical order has a Printful order id; `printful_sync_log` remains empty.
- n8n Cloud connector: recent execution list shows repeated successful
  executions through 2026-05-03T08:00Z. Recent error list still shows scheduled
  workflow errors on 2026-05-03, 2026-05-02, and earlier; treat as workflow
  hygiene, not subscription-cancellation evidence.
- Read AI connector: six meetings returned for April 2026, with the latest
  meeting on 2026-04-15. No May meeting signal appeared, but the April usage is
  still recent enough to keep Read.ai active.
- Slack connector: no Read.ai, Fireflies, Vapi, Vercel, Printful, Resend,
  Pinecone, or BuiltWith hits after 2026-05-02.
- Gmail connector: a new Apify payment-success invoice was found on
  2026-05-03 for $39. No fresh billing receipt evidence was found after
  2026-05-02 for Vapi, Vercel, Printful, Resend, Pinecone, BuiltWith,
  Fireflies, ElevenLabs, Gamma, n8n, Read.ai, Supabase, Stripe, OpenAI,
  Anthropic, Google Cloud, Calendly, or HeyGen in this pass.
- Vercel CLI: the user-owned Vercel CLI at `~/.npm-global/bin/vercel` is
  authenticated. `vercel ls --yes` showed ready deployments within the last
  hour for both `vsillahs-projects/portfolio` and
  `vsillahs-projects/portfolio-staging`, including production and preview
  deployments. No `.vercel/project.json` exists in the repo.
- Stripe connector: the connected Stripe account returned zero active
  subscriptions, one draft/manual invoice with no amount due, and recent payment
  intents including succeeded payments. This supports keeping Stripe as a
  revenue dependency rather than treating it as a Portfolio vendor-subscription
  cancellation target.
- Local Google Drive source search found a HeyGen video asset under AmaduTown
  Advisory Solutions materials; no new Drive evidence for Vapi, BuiltWith,
  Printful, Resend, Pinecone, or Fireflies was found in this pass.

Derived Movement Since Last Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | Production counts and active tables refreshed on 2026-05-03 | Active | Keep |
| n8n Cloud | Successful executions through 2026-05-03T08:00Z | Active, with separate workflow hygiene errors | Keep; triage recurring workflow errors outside cancellation audit |
| Vercel | Ready production/preview deployments for portfolio and staging within the last hour | Active | Keep; billing owner still worth documenting |
| Stripe | No active Stripe subscriptions; recent payment intents and checkout/webhook code remain | Active revenue dependency | Keep |
| Apify | New Gmail payment-success invoice on 2026-05-03 for $39; n8n Apify nodes remain | Active paid tool | Keep; continue spend/cadence review |
| OpenAI | Latest production cost event on 2026-04-30 | Active | Keep; continue cost monitoring |
| Gamma | Latest completed report on 2026-05-02 | Active | Keep |
| HeyGen | Completed video jobs on 2026-04-15 and Drive video asset found | Active but campaign-dependent | Keep; review after next video campaign |
| Read.ai | April meetings and Read.ai-linked meeting records; no May meeting yet | Active enough | Keep |
| BuiltWith | Protected watch item; no new operational signal this run | Quiet but protected | Keep during outreach/client-volume ramp |
| Fireflies.ai | No new paid evidence; previously confirmed canceled | Resolved canceled | Keep out of active queue unless paid evidence reappears |
| Vapi | Code/env/webhook footprint remains; no operational or billing usage confirmed again | Multi-session quiet | Provisional red investigation: verify dashboard/billing and production voice UX |
| Printful | Fulfillment code and one historical Printful-linked order; sync log still empty | Quiet sync, likely usage-based | Investigate dashboard/order history |
| Resend | Optional transactional provider remains; latest production email rows use n8n | Usage unresolved | Verify production env and billing |
| Pinecone | n8n RAG export references remain; local/Supabase RAG rows populated | Replacement path needs design | Investigate billing/API usage before any deprecation |
| ElevenLabs | Prior receipt; social/audio references remain | Quiet-ish | Watch through next social content cycle |
| Hunter.io | `HUNTER_API_KEY`, n8n node-swap docs, and lead-source references present | New baseline, usage unresolved | Investigate billing/API usage; not a cancellation candidate yet |
| OpenRouter | `OPENROUTER_API_KEY`, media bakeoff, and Gmail draft workflow references present | New baseline, usage unresolved | Investigate billing/API usage; keep as specialist until bakeoff data says otherwise |

Inactive-For-Two-Sessions Evidence

- **Vapi:** remains the strongest inactive signal. Multiple sessions now show
  code/env references but no confirmed operational usage. Required next step is
  dashboard call-history and billing verification, plus a check that no
  production voice UX depends on it.
- **BuiltWith:** still has consecutive quiet operational passes, but it is
  explicitly protected as a watch item during the outreach ramp.
- **Printful:** `printful_sync_log` remains empty across sessions, but store
  fulfillment code and a historical Printful-linked order keep it in
  investigate rather than cancel.
- **Resend:** still unresolved because production email rows show `n8n`
  transport, but Resend code/env references remain.

Candidate Cancellations

- **No automatic cancellation.**
- **Vapi remains the only provisional cancellation candidate.** Required
  approval, after dashboard/billing and production voice checks:
  `Cancel Vapi for Portfolio`.
- No approval phrase was given in this run.

Next Audit Focus

- Check Vapi dashboard call history and billing first.
- Check Pinecone and OpenRouter billing/API usage against the current RAG/model
  routing plans.
- Check Hunter.io billing/API usage now that lead workflows reference the core
  Hunter node.
- Check Printful dashboard/store order history and decide whether merchandise is
  still strategically active.
- Confirm whether production has Resend configured or whether Gmail/n8n is the
  actual outbound path.
- Document Vercel billing ownership now that CLI deployment evidence is live.

## 2026-05-02 Daily Monitor Run

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- Core runtime and revenue dependencies remain active: Supabase, n8n Cloud,
  Vercel deployment flow, Stripe checkout code, OpenAI cost events, Gamma,
  HeyGen, Read.ai, Slack, Gmail/n8n email, Calendly, Apify, and Google Cloud.
- Vapi now has two consecutive audit sessions with no confirmed operational
  usage signal. It should move to a **provisional red investigation gate**:
  if dashboard/billing confirms an active paid plan and production voice UX is
  not enabled, the exact approval needed is `Cancel Vapi for Portfolio`.
- BuiltWith stays a watch item, not a cancellation candidate, per the outreach
  and client-volume ramp decision. Production diagnostic audit rows are
  populated, but current enriched tech-stack rows were empty in this run.
- Fireflies remains resolved as canceled. Slack still has April recap evidence,
  but no new post-May-01 activity was found and no new paid-plan evidence was
  found in this run.

Raw Findings

- Git state: started without unrelated dirty files; final state is detached
  `HEAD` at `11acd31` with only this audit tracker and status JSON modified.
- Repo evidence: `package.json` still includes paid-service SDKs for Supabase,
  Stripe, Vapi, Vercel Speed Insights, Resend, Google APIs, and automation/test
  tooling. Env templates include keys for Anthropic, Apify, BuiltWith,
  Calendly, ElevenLabs, Gamma, Gemini, HeyGen, n8n, OpenAI, Printful, Resend,
  Slack, Stripe, Supabase, USPS, and Vapi.
- Local reference counts, excluding dependency/install output and this tracker:
  Supabase 4635, n8n 4265, Gamma 1211, HeyGen 711, Stripe 597, Calendly 581,
  OpenAI 575, Printful 504, Vapi 332, Apify 286, BuiltWith 238, Pinecone 226,
  Anthropic 215, Vercel 212, Read.ai 213, ElevenLabs 154, USPS 145, Resend 141,
  Gemini 83, Paper 20, Excalidraw 4, Figma 2, Fireflies 1.
- n8n export evidence: 45 local workflow export files. Node footprint includes
  60 Supabase nodes, 40 Slack nodes, 18 OpenAI chat model nodes, 15 Gmail nodes,
  10 schedule triggers, 5 Apify nodes, 4 Google Drive nodes, 3 Pinecone vector
  store nodes, and 2 Calendly triggers.
- Supabase connector: Portfolio project `My Portfolio` is `ACTIVE_HEALTHY`;
  organization plan is `pro`. Current production table signals include
  `analytics_events` 4968, `pain_point_evidence` 4681, `meeting_records` 109,
  `project_reminders` 857, `orders` 26, `gamma_reports` 6,
  `social_content_queue` 28, `drive_video_queue` 35, `heygen_config` 9084,
  `email_messages` 9, `documents_local_rag` 3434, and
  `printful_sync_log` 0.
- Supabase production aggregate read: latest OpenAI cost event on 2026-04-30;
  latest email row on 2026-04-30 using `n8n` transport; latest Gamma report row
  on 2026-05-02 with completed status; latest HeyGen video generation job on
  2026-04-15 with completed status; latest social extraction run on
  2026-04-23 with success status; latest Read.ai-linked meeting record on
  2026-04-16; one order has a Printful order id, but `printful_sync_log`
  remains empty.
- Supabase linked CLI context is still the dev project `My Portfolio- Dev`;
  production aggregate evidence above came from the production Supabase env
  variables without printing secrets.
- n8n Cloud connector: 77 workflows listed, with recent successful executions
  on 2026-05-02, including Google Contacts Sync, Milestone Planning, Gamma
  cleanup, and Apify Actor Monitor workflows. One staging Google Contacts Sync
  execution errored on 2026-05-02 and should be handled as workflow hygiene, not
  as subscription cancellation evidence.
- Read AI connector: no meetings since 2026-05-01, but five April meetings were
  returned from 2026-04-02 through 2026-04-15, so Read.ai remains active enough
  to keep.
- Slack connector: `#meeting-transcripts` exists. No Read.ai or Fireflies
  transcript posts were found after 2026-05-01. Read.ai and Fireflies both had
  April recap evidence; Fireflies remains resolved because Vambah confirmed it
  was canceled.
- Gmail connector: recent billing search found Google Cloud payment evidence on
  2026-05-01 and Vercel bot deployment comments on Portfolio PRs on 2026-05-01
  and 2026-05-02. No fresh billing receipt evidence was found for Vercel,
  Printful, Vapi, Resend, Pinecone, Fireflies, BuiltWith, or ElevenLabs after
  2026-05-01 in this pass.
- Vercel connector: `list_teams` still returned no teams, so billing/project
  ownership remains unresolved through the connector. Gmail PR/deployment bot
  evidence shows Vercel is operationally active even though billing access is
  not available here.

Derived Movement Since Last Run

| Tool/vendor | Latest evidence | Inactivity status | Recommendation |
| --- | --- | --- | --- |
| Supabase | Pro org, healthy project, active production rows | Active | Keep |
| n8n Cloud | 77 workflows; successful executions on 2026-05-02 | Active | Keep; continue workflow hygiene separately |
| Vercel | PR deployment bot activity on 2026-05-01 and 2026-05-02; connector team listing unavailable | Operationally active, billing unresolved | Keep; resolve dashboard/team billing access |
| Stripe | Checkout/webhook code remains central; orders table has 26 rows | High-risk dependency | Keep; dashboard/billing still unresolved |
| OpenAI | Production cost event on 2026-04-30 | Active | Keep; continue cost monitoring |
| Gamma | Production report completed on 2026-05-02 | Active | Keep |
| HeyGen | Completed video generation job on 2026-04-15 and 9084 synced config rows | Active but campaign-dependent | Keep; review after next video campaign |
| Read.ai | April meetings and Read.ai-linked meeting rows; no May meeting yet | Active enough | Keep; fix stale in-app token separately if needed |
| BuiltWith | Code paths present; no non-empty production enriched tech-stack rows in this run | Quiet for another session, but protected watch item | Keep during outreach/client-volume ramp |
| Fireflies.ai | No post-May-01 Slack activity; previously confirmed canceled | Resolved canceled | Keep out of active queue unless paid evidence reappears |
| Vapi | Code/env/webhook footprint remains; no operational usage confirmed across consecutive sessions | Two-session quiet | Provisional red investigation: verify dashboard/billing and production voice UX |
| Printful | Fulfillment code, variants, and one historical Printful-linked order; sync log empty | Quiet sync, but not clear subscription spend | Investigate store dashboard/order history |
| Resend | Optional code path; latest email transport is n8n | Usage unresolved; no billing evidence | Verify production env and billing before deciding |
| Pinecone | n8n RAG query/ingest references active; local RAG documents also populated | Active/replacement path needs design | Investigate billing and RAG replacement plan, do not cancel blindly |
| ElevenLabs | Paid receipt from prior pass; social/audio paths still present | Quiet-ish | Watch through next social content cycle |

Inactive-For-Two-Sessions Evidence

- **Vapi:** consecutive sessions found code/env references but no dashboard,
  DB, cost, or call-history usage signal. This is enough to require dashboard
  verification and a production UX check before renewal, but not enough to
  cancel without the approval phrase.
- **BuiltWith:** consecutive sessions lack confirmed operational usage, but
  BuiltWith is explicitly a watch item during the outreach ramp and remains
  outside the cancellation queue.
- **Printful:** `printful_sync_log` stayed empty, but one historical
  Printful-linked order and active fulfillment code make this a dashboard/order
  history investigation rather than a subscription cancellation.
- **Resend:** consecutive sessions did not prove production usage, and the
  latest production email row used `n8n` transport. Treat as unresolved until
  production env and billing are verified.

Candidate Cancellations

- **No automatic cancellation.**
- **Vapi is the only provisional cancellation candidate.** Required approval,
  after dashboard/billing and production voice checks: `Cancel Vapi for
  Portfolio`.
- If approved later, the cancellation packet should remove or disable the
  smallest safe voice surface, update Vapi env/template references, verify
  `/api/vapi/webhook` and client-template impact, and document rollback steps.

Next Audit Focus

- Check Vapi dashboard call history and billing first.
- Resolve Vercel team/project billing access even though deployment activity is
  clearly live.
- Check Printful dashboard/store order history and whether merchandise remains
  strategically active.
- Confirm whether production has Resend configured or whether Gmail/n8n is the
  actual outbound path.
- Check Pinecone billing/API usage against the Supabase/local RAG replacement
  path before any deprecation planning.

## 2026-05-01 Billing Evidence Pass

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- Gmail billing evidence materially improved the subscription map. Recent paid
  or payment-confirmation emails were found for Gamma, n8n, Read.ai, Supabase,
  BuiltWith, Apify, HeyGen, ElevenLabs, Calendly, Anthropic, OpenAI/ChatGPT Pro,
  and Google Cloud.
- BuiltWith stays on the watchlist: recent receipts were found and operational
  usage was not confirmed in this pass, but current client traffic is still too
  low to judge whether the implementation-strategy workflow benefits from
  BuiltWith enrichment.
- Fireflies is resolved as canceled per Vambah confirmation on 2026-05-01.
  Gmail also showed a refund on 2026-03-20 and a weekly digest on 2026-03-23.
  Keep it out of the active cancellation queue unless new paid-plan evidence
  appears.
- Printful, Vapi, Resend, and Pinecone remain unresolved because they have
  code/config references but no recent billing receipt evidence in Gmail.
- Vercel remains unresolved: Gmail had only a Terms update, the connector did
  not expose a team/project, and the repo has no `.vercel/project.json`.

Raw Findings

- Git state: branch `codex/subscription-cancellation-refresh`; unrelated
  `.gitignore` modification present and left untouched.
- Computer Use: Chrome was inspected. It was open to an Infisical success page.
  A BuiltWith dashboard/login check was attempted, but BuiltWith presented an
  image CAPTCHA before account access. The CAPTCHA was not solved and no
  dashboard cancellation or account-setting actions were attempted.
- Gmail search, 180-day billing window:
  - Gamma receipt on 2026-05-01 and prior receipt on 2026-04-01.
  - n8n receipt on 2026-04-22 for Cloud Pro-1, amount shown in snippet as
    $63.75.
  - Read AI receipt on 2026-04-20.
  - Supabase payment received on 2026-04-09, amount shown in snippet as $25.27.
  - BuiltWith receipts on 2026-04-10 for $99.00, $99.00, and $109.00.
  - Apify invoices/payment-success emails on 2026-04-03, 2026-03-03,
    2026-02-03, 2026-01-03, 2025-12-03, and 2025-11-03; latest amount shown in
    snippet as $39.00.
  - HeyGen receipts on 2026-04-14, 2026-03-14, and 2026-03-12.
  - ElevenLabs receipts on 2026-04-19 and 2026-03-19.
  - Calendly receipt on 2026-04-04.
  - Google Cloud payment received on 2026-05-01, amount shown in snippet as
    $9.33.
  - Anthropic receipts on 2026-04-11, 2026-03-21, 2026-03-11, 2026-02-12, and
    2025-12-16, plus a 2026-03-18 API credit access warning.
  - OpenAI email on 2026-04-29 confirms ChatGPT Pro subscription; 2026-02-12
    email confirms API usage tier increase.
  - Fireflies refund on 2026-03-20 and weekly digest on 2026-03-23.
  - No recent billing receipts found for Vercel, Printful, Vapi, Resend, or
    Pinecone with the searched Gmail queries.
- Local evidence retained from prior pass:
  - BuiltWith has code/env references but no operational rows or connector usage
    signal found.
  - Vapi has voice code/env references but no fresh usage signal found.
  - Printful has store/fulfillment code paths and product variants, but
    `printful_sync_log` was empty in Supabase.
  - Resend exists as an optional transactional email provider with Gmail SMTP
    fallback.
  - Pinecone remains active indirectly through n8n RAG workflow references.

Derived Movement Since Manual Refresh

| Tool/vendor | Billing evidence | Usage evidence | Movement | Recommendation |
| --- | --- | --- | --- | --- |
| BuiltWith | Three receipts on 2026-04-10 | No confirmed operational usage in this pass, but client traffic is still early | Remains a watch item | Keep for now; reassess after more outreach/client volume and implementation-strategy usage evidence |
| Fireflies.ai | Refund on 2026-03-20; Vambah confirmed canceled on 2026-05-01 | Digest on 2026-03-23; prior duplicate recap evidence | Resolved as canceled | Remove from active cancellation queue; only re-open if new paid-plan evidence appears |
| Gamma | Receipts on 2026-05-01 and 2026-04-01 | Active report/deck code and DB rows | Stronger keep signal | Keep |
| n8n Cloud | Receipt on 2026-04-22 | Active executions on 2026-05-01 | Stronger keep signal | Keep |
| Read.ai | Receipt on 2026-04-20 | April meetings available | Stronger keep signal | Keep; fix stale in-app token separately |
| Supabase | Payment on 2026-04-09 | Active project and table rows | Stronger keep signal | Keep |
| Apify | Monthly invoices through 2026-04-03 | Actor monitor executions on 2026-05-01 | Stronger keep signal with spend-review need | Keep; review actor spend and scraping cadence |
| HeyGen | Receipts through 2026-04-14 | Catalog/video code and DB rows | Stronger keep signal | Keep; review after next campaign |
| ElevenLabs | Receipts through 2026-04-19 | One social-audio workflow reference; no new run confirmed | Paid but quiet-ish | Watch; review before renewal if social audio remains paused |
| Calendly | Receipt on 2026-04-04 | Active booking links and n8n router references | Stronger keep signal | Keep |
| Vercel | No billing receipt found; connector unavailable | Production hosting likely but unverified | Still unresolved | Needs dashboard/account check |
| Printful | No billing receipt found | Fulfillment code exists; sync log quiet | Still unresolved | Check dashboard/store order history |
| Vapi | No billing receipt found | Voice code exists; no usage signal | Still unresolved | Check dashboard call history and whether production voice UI is enabled |
| Resend | No billing receipt found | Optional provider with Gmail fallback | Still unresolved | Verify production env before keeping as paid dependency |
| Pinecone | No billing receipt found | n8n RAG references active | Still unresolved | Check billing/API usage and compare with Supabase/local RAG replacement path |

Watch Items And Candidate Cancellations

- **BuiltWith: watch item, not a cancellation candidate right now.** It has
  recent paid receipts and the current pass did not confirm operational usage,
  but Portfolio has not yet had enough client traffic to evaluate whether
  BuiltWith improves implementation strategy, sales preparation, or conversion.
  Keep it active through the next outreach/client cycle, then reassess with
  dashboard/API usage and sales-flow evidence. Dependency packet:
  [builtwith-deprecation-packet.md](./builtwith-deprecation-packet.md).
- **Fireflies: resolved as canceled.** Vambah confirmed on 2026-05-01 that
  Fireflies is already canceled. Do not treat it as an active cancellation
  target unless new billing evidence shows a paid plan was restarted.

Next Audit Focus

- Use Computer Use on billing dashboards for Vercel, Printful, Vapi, Resend,
  and Pinecone. BuiltWith currently requires a CAPTCHA before dashboard access,
  so defer dashboard usage confirmation until the outreach/client-volume
  reassessment. Stop at any fresh login, payment-owner, or account-setting gate
  and record the needed manual step.
- For BuiltWith, keep it active while outreach ramps. Collect API/dashboard
  usage history and compare implementation-strategy/proposal outcomes for leads
  where stack enrichment helped versus leads where it did not. Use
  [builtwith-deprecation-packet.md](./builtwith-deprecation-packet.md) only if a
  later cancellation decision is approved.
- For Fireflies, keep the resolved/canceled status unless new paid-plan evidence
  appears.
- For Vercel, locate the actual hosting account/project outside the current
  connector context.

## 2026-05-01 Manual Refresh Run

Status: YELLOW

Summary:

- No cancellation approvals requested.
- No tool has two consecutive inactive audit sessions yet.
- Supabase, n8n Cloud, Read.ai, Slack, Gamma, HeyGen, Google Drive, and the
  core LLM paths continue to show meaningful usage or active dependency signals.
- Fireflies remains the clearest redundancy question because it appears to
  overlap with Read.ai in meeting recap capture, but it is not ready for
  cancellation without billing and owner confirmation.
- Vercel and Stripe remain high-risk unknowns because billing/project access was
  not available through the current connector context.
- Printful, Vapi, BuiltWith, USPS, Resend, LinkedIn, and ElevenLabs remain
  watchlist items, not cancellation candidates.

Raw Findings

- Git state: clean worktree before the refresh. The first local pass started
  from `codex/source-respecting-llm-protocol`, then this doc-only update was
  moved onto `codex/subscription-cancellation-refresh` from `main` before
  commit.
- Supabase connector: project `My Portfolio` is `ACTIVE_HEALTHY`. Current row
  signals include `analytics_events` 4939, `pain_point_evidence` 4681,
  `project_reminders` 857, `meeting_records` 109, `orders` 26,
  `social_content_queue` 28, `drive_video_queue` 35, `heygen_config` 9084,
  `gamma_reports` 6, and `cost_events` 13.
- n8n Cloud connector: 76 workflows listed. Recent executions were successful
  on 2026-05-01 through at least 18:00 UTC, including milestone planning,
  Gamma cleanup, and Apify actor monitor workflows.
- n8n export evidence: exported workflows include 60 Supabase nodes, 40 Slack
  nodes, 18 OpenAI chat model nodes, 15 Gmail nodes, 9 schedule triggers, 5
  Apify nodes, 4 Google Drive nodes, 3 Pinecone vector store nodes, 2 Calendly
  triggers, 1 Stripe trigger, and 1 Anthropic node.
- Read AI connector: six meetings were available since 2026-04-01, with the
  latest starting on 2026-04-15. This keeps Read.ai active as an external
  meeting-capture account even if the Portfolio in-app OAuth token path remains
  stale.
- Vercel connector: `list_teams` returned no teams, and the repo still has no
  `.vercel/project.json`; project/deployment billing status remains unresolved.
- Local reference counts across app/lib/scripts/docs show broad implementation
  footprint: Gamma 1038, Read/Read.ai text paths 1701, HeyGen 626, Slack 541,
  Stripe 466, Printful 398, Calendly 387, OpenAI 292, Anthropic 179, BuiltWith
  175, USPS 146, Resend 134, Apify 137, Pinecone 117, Vapi 113, ElevenLabs
  118, Gemini 34, and Fireflies 5.

Derived Movement Since Baseline

| Tool/vendor | Prior status | Refresh signal | Current inactivity status | Recommendation |
| --- | --- | --- | --- | --- |
| Supabase | GREEN | Project active and core tables show live Portfolio state | Active | Keep |
| n8n Cloud | GREEN | Successful executions on 2026-05-01 and 76 workflows present | Active | Keep; later rationalize duplicate/staging workflows |
| Read.ai | GREEN | April meetings available through connector | Active externally | Keep; separately fix or remove stale in-app token path |
| Fireflies.ai | YELLOW | Only 5 local references; prior Slack evidence showed duplicate meeting recap behavior | Redundancy watch, not inactive | Investigate whether both meeting assistants are paid |
| Vercel | YELLOW | Connector did not expose account/project; no `.vercel/project.json` | Unknown, high-risk | Keep; needs browser or account-level billing check |
| Stripe | YELLOW | Strong repo and database dependency, but no live dashboard access in this run | Unknown, high-risk | Keep until Stripe billing/dashboard usage is checked |
| Printful | YELLOW | Large code footprint, product variants present, sync log still quiet | First-session quiet continues | Watch; verify dashboard order/sync activity |
| Vapi | YELLOW | Code/env footprint remains; no fresh usage signal found | First-session quiet continues | Watch; check Vapi dashboard before any recommendation |
| BuiltWith | YELLOW | Code/env footprint remains; no fresh operational signal found | First-session quiet continues | Watch; evaluate replacement with browser/other enrichment |
| USPS | YELLOW | Commerce address routes/tests remain; no fresh operational signal found | First-session quiet continues | Watch; keep until checkout/shipping path is reviewed |
| Resend | YELLOW | Webhook and email code remain; provider-specific production usage unresolved | Unknown | Investigate whether production uses Resend or Gmail fallback |
| ElevenLabs | YELLOW | n8n social audio reference remains; no new run confirmed | First-session quiet-ish | Watch with next social content campaign |

Candidate Cancellations

None. This refresh strengthens the watchlist, but it does not meet the
two-session inactivity gate for any paid tool.

Next Audit Focus

- Use Computer Use or browser access for billing dashboards where connectors
  are insufficient: Vercel, Stripe, Printful, Vapi, BuiltWith, ElevenLabs, and
  any Fireflies account.
- Decide whether Fireflies and Read.ai are both intentionally active before the
  next renewal cycle.
- Confirm whether Resend is configured in production or whether Gmail/n8n is
  the real outbound channel.
- Verify whether Printful has recent fulfillment activity outside the Portfolio
  `printful_sync_log`.
- Check whether Vapi is still enabled in production UX or only remains in the
  template/product surface.

## 2026-05-01 Baseline Run

Status: YELLOW

Summary:

- No cancellation approvals requested.
- No tool has two consecutive inactive audit sessions yet; this is the baseline.
- Supabase and n8n are active operational dependencies.
- Meeting capture has a redundancy signal: Read.ai and Fireflies both posted
  recaps into the meeting transcript workflow in April 2026.
- In-app Read.ai OAuth storage looks stale even though the external Read.ai
  account is active through the connector and Slack recap flow.
- Vapi, Printful, and some media/social generation paths need another audit
  session before any cancellation recommendation.

Raw Findings

- Git state: worktree was already dirty on `codex/client-ai-ops-roadmap`.
  Existing modified/untracked files were treated as unrelated and left alone.
- Existing durable tracker: none found before this file.
- Repo evidence inspected: `package.json`, `.env.example`,
  `.env.staging.example`, `n8n-exports/manifest.json`, n8n exports, docs,
  app API routes, integration libraries, migrations, and admin/bakeoff docs.
- Supabase connector: project `My Portfolio` is `ACTIVE_HEALTHY`; table counts
  show active app usage, including `analytics_events`, `pain_point_evidence`,
  `value_evidence_workflow_runs`, `meeting_records`, `gamma_reports`,
  `heygen_config`, `orders`, and `cost_events`.
- n8n Cloud connector: 76 workflows listed; recent executions observed on
  2026-05-01, especially monitor/scheduled workflows and RAG webhook traffic.
- Stripe connector: unavailable in this session due auth requirement.
- Vercel connector: account/team project listing was not available from the
  current connector context; repo has no `.vercel/project.json`.
- Google Drive search: no clear subscription/billing tracker found.
- Slack connector: `#meeting-transcripts` exists and contains recent Read.ai
  and Fireflies recap posts in April 2026.
- Read AI connector: recent meetings were available from April 2026 onward.

Derived Inventory

| Status | Tool/vendor | Purpose in Portfolio | Evidence source | Cost/billing signal | Last code/config/reference usage | Last operational usage signal | Dependencies/replacement risk | Session inactivity | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GREEN | Supabase | Primary database, auth/session data, storage-adjacent app state, realtime admin data | `@supabase/supabase-js`, env templates, migrations, connector table list | Paid status not shown; project is active healthy | Repo references across app/lib/scripts; last inspected 2026-05-01 | Active row counts across core tables; project active healthy | High: primary data plane | Active | Keep |
| GREEN | n8n Cloud | Workflow automation runtime for lead intake, RAG, meetings, social, value evidence, progress updates | `n8n-exports`, env templates, `lib/n8n.ts`, n8n connector | Paid status not shown; cloud workspace active | Manifest last updated 2026-04-27; many env routes | Executions observed on 2026-05-01 | High: many webhooks and callbacks depend on it | Active | Keep; rationalize duplicate/staging workflows separately |
| GREEN | OpenAI | In-app LLM generation, RAG embeddings in n8n, cost tracking | `lib/llm-dispatch.ts`, `lib/cost-calculator.ts`, n8n credential refs | Usage cost tracked in `cost_events` | Cost events last observed 2026-04-28 | Recent LLM cost rows and active code paths | Medium/high: outreach, audit, meeting, social, RAG | Active | Keep; update pricing rates periodically |
| GREEN | Gamma | Admin report/deck generation and theme sync | `lib/gamma-client.ts`, Gamma report routes, env templates | API credit/billing unknown | `gamma_reports` rows and theme sync code | Last Gamma report row 2026-04-16; theme sync 2026-04-16 | Medium: deck/report workflow | Active | Keep |
| GREEN | HeyGen | Avatar/video generation, catalog sync, report companion video | `lib/heygen.ts`, video-generation routes, `docs/heygen-template-brand-setup.md` | API plan unknown | Code and env routes active; sync tables present | Completed video job from 2026-03-25; catalog sync 2026-04-08 | Medium: video generation depends on it | Active but quieter | Keep; review cost after next content campaign |
| GREEN | Read.ai | Meeting capture and Slack recap source; optional in-app meeting lookup | `lib/read-ai.ts`, migrations, meeting docs, Read AI connector, Slack recaps | Subscription status unknown | App token table exists but stored token expired 2026-03-27 | Connector lists April 2026 meetings; Slack recaps posted April 2026 | Medium: meeting follow-up pipeline uses recaps | Active externally; stale in app token | Keep account; investigate stale in-app token path |
| GREEN | Slack | Meeting intake, sales notifications, outreach notifications, workflow status | n8n refs, env templates, Slack connector | Paid workspace status unknown | Many n8n Slack nodes and app webhook env vars | Recent transcript channel activity in April 2026 | Medium/high: ops notifications and meeting ingestion | Active | Keep |
| YELLOW | Fireflies.ai | Meeting recaps appearing alongside Read.ai in Slack | Slack channel evidence | Subscription status unknown | No direct repo integration found | April 2026 recap posts in `#meeting-transcripts` | Low/medium: duplicate meeting assistant if Read.ai is canonical | Active but redundant | Investigate redundancy with Read.ai before renewal |
| YELLOW | Pinecone | Vector store behind n8n RAG ingestion/query workflows | n8n manifest and node types | Paid status unknown | n8n credential refs; no direct app dependency found | RAG query execution observed 2026-04-30; ingestion workflow active in prod | Medium: RAG quality may depend on current index | Active via n8n | Investigate direct billing and whether local/Supabase RAG can replace |
| YELLOW | Vercel | Hosting/deployments, Speed Insights dependency | package dependency, docs, Vercel connector attempt | Billing not available | `@vercel/speed-insights`, deployment docs | Connector could not list project in this session | High: production hosting likely depends on it | Unknown | Investigate with Vercel account/project access |
| YELLOW | Stripe | Payments, checkout, webhooks, continuity plans | Stripe deps, payment routes, env templates | Connector auth required; app has 26 orders | Active code routes and Stripe env vars | Supabase orders exist; no live Stripe read available | High: commerce/payment path | Unknown | Keep until Stripe dashboard usage is checked |
| YELLOW | Printful | Store fulfillment, product variants, shipping/mockups/webhooks | `lib/printful.ts`, Printful admin routes, env templates | Subscription/usage unknown | Code and product tables present | `orders` has rows; `printful_sync_log` has 0 rows | Medium: store fulfillment fallback required | First-session quiet | Watch; verify recent Printful dashboard/orders next run |
| YELLOW | Vapi | Voice AI/webhook integration | `@vapi-ai/web`, `lib/vapi.ts`, `/api/vapi/webhook` | Usage/cost unknown | Env/template and webhook code present | No recent DB cost signal found this run | Medium if voice chat is public | First-session quiet | Watch; check Vapi dashboard next run |
| YELLOW | Resend | Optional transactional email and deliverability webhooks | `resend` dependency, email delivery code, webhook route | Usage/cost unknown | Email provider fallback code present | `email_messages` has rows; provider-specific usage not verified | Low/medium: Gmail fallback exists | Unknown | Investigate whether Resend is configured in production |
| YELLOW | Gmail/Google APIs | SMTP fallback, user Gmail drafts/OAuth, Drive sync | env templates, googleapis dependency, Gmail routes, Drive sync routes | Workspace/API billing unknown | Active code/config references | Gmail draft creds table empty; Drive queue has rows | Medium: email and asset workflows | Mixed | Keep; clean unused OAuth paths only after second quiet run |
| YELLOW | Calendly | Booking links, n8n webhook router, report next-meeting links | env templates, n8n trigger refs, Calendly event libs | Paid status unknown | Active links and n8n routes | n8n active workflows include Calendly router | Medium: sales/onboarding booking | Active by config | Keep |
| YELLOW | Apify | Lead scraping, social listening, actor health monitor | n8n env docs, n8n node refs | Paid status unknown | n8n workflows and env references | n8n actor monitors executed 2026-05-01 | Medium: lead discovery/value evidence | Active | Keep; review actor spend |
| YELLOW | BuiltWith | Tech-stack lookup/enrichment | `lib/tech-stack-lookup.ts`, env templates | Paid status unknown | Code and env reference present | No operational evidence found this run | Low/medium: enrichment can be optional | First-session quiet | Watch |
| YELLOW | ElevenLabs | TTS/audio in social content workflow | env templates, n8n env docs | Paid status unknown | Env and n8n docs reference | Social extraction last success 2026-04-08 | Medium for audio generation | First-session quiet-ish | Watch with social pipeline |
| YELLOW | LinkedIn API | Social publishing / warm lead scraping credentials | env templates, auth/publishing routes, n8n docs | Paid status not applicable/unknown | Code and n8n references present | Warm lead audit last failed 2026-03-23 due outbound disabled | First-session quiet; public/social risk | Watch; verify before cancellation |
| YELLOW | Google Drive | Video asset queue, script folders, Drive-to-RAG ingestion | `lib/google-drive.ts`, Drive sync routes, n8n RAG ingest | Workspace billing unknown | Code and n8n references present | Drive video queue has 35 rows; n8n ingestion active in prod | Medium: asset/provenance workflows | Active | Keep |
| YELLOW | USPS | Address validation/suggest for commerce | `lib/usps.ts`, address routes, env templates | API cost unknown | Code and tests present | No operational evidence found this run | Low/medium: commerce UX fallback needed | First-session quiet | Watch |
| YELLOW | Figma / Paper / Excalidraw / HeyGen design ecosystem | Design/reference tools around decks, diagrams, visual assets | bakeoff docs, local design docs, Drive search | Billing unknown | No production app dependency for Figma/Paper/Excalidraw found | No connector/billing evidence gathered this run | Low for app runtime; high for creative workflow if actively used | Unknown | Investigate manually; do not cancel from repo evidence alone |

Candidate Cancellations

None approved or recommended for cancellation on this baseline run.

Investigate Before Next Run

- Fireflies.ai vs Read.ai: confirm whether both are intentionally active. If
  both are paid and both continue to post duplicate meeting summaries, choose a
  canonical capture source before renewal.
- Read.ai in-app OAuth: the Portfolio `integration_tokens` row is stale while
  the external Read.ai connector is active. Decide whether to refresh the
  Portfolio token path or remove that in-app lookup surface.
- Vapi: verify dashboard usage and whether the public voice feature is enabled.
- Printful: verify recent store orders/syncs outside Supabase before judging.
- Pinecone: identify billing owner and whether current RAG can move to
  Supabase/local retrieval after bakeoff evidence.
- Vercel and Stripe: reconnect or authorize read-only billing/project access
  for future audits.

Approval Needed

No cancellation action should be taken now. Future cancellation requires the
exact phrase `Cancel <tool/vendor> for Portfolio`, then a separate verification,
branch, deprecation packet, validation, and rollback plan for that named tool.
