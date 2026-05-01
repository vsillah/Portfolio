# Portfolio Subscription Cancellation Audit

Recurring audit tracker for paid apps, hosted services, model/API providers,
automation runtimes, design/media tools, and third-party integrations used by
Portfolio.

Authority boundary: this tracker never approves cancellation by itself. A tool
only becomes a cancellation candidate after two consecutive audit sessions with
no meaningful usage signal, or after clear redundancy plus a lower-risk
replacement path. Production changes require explicit approval in the form
`Cancel <tool/vendor> for Portfolio`.

## 2026-05-01 Billing Evidence Pass

Status: YELLOW

Summary:

- No cancellation approvals requested and no cancellation action taken.
- Gmail billing evidence materially improved the subscription map. Recent paid
  or payment-confirmation emails were found for Gamma, n8n, Read.ai, Supabase,
  BuiltWith, Apify, HeyGen, ElevenLabs, Calendly, Anthropic, OpenAI/ChatGPT Pro,
  and Google Cloud.
- BuiltWith is now the strongest cost-review candidate: recent receipts were
  found, but no meaningful operational usage signal was confirmed in the repo,
  database, n8n, or connector evidence gathered so far.
- Fireflies looks less like an active cancellation target and more like a
  cancellation-confirmation task: Gmail shows a refund on 2026-03-20 and a
  weekly digest on 2026-03-23. Verify whether the paid plan is already canceled
  before taking any further action.
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
| BuiltWith | Three receipts on 2026-04-10 | No confirmed operational usage | Moves from watchlist to cost-review candidate | Prepare replacement/deprecation review before renewal; likely cancellation candidate if dashboard confirms no recent API usage |
| Fireflies.ai | Refund on 2026-03-20 | Digest on 2026-03-23; prior duplicate recap evidence | Moves from redundancy watch to cancellation-confirmation check | Verify paid plan status; if already canceled, remove from cancellation queue and document as resolved |
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

Candidate Cancellations

- **BuiltWith: candidate for cancellation review, not cancellation yet.** It has
  recent paid receipts and repeated quiet operational evidence. Before approval,
  verify dashboard/API usage, identify any live lead-enrichment flows still
  calling it, and confirm whether browser/manual research or another enrichment
  source can replace it. Deprecation packet:
  [builtwith-deprecation-packet.md](./builtwith-deprecation-packet.md).
- **Fireflies: candidate for resolved/canceled status verification.** The refund
  suggests the paid plan may already be canceled. Do not request cancellation
  unless dashboard status says the paid plan is still active.

Next Audit Focus

- Use Computer Use on billing dashboards for BuiltWith, Fireflies, Vercel,
  Printful, Vapi, Resend, and Pinecone. BuiltWith currently requires a CAPTCHA
  before dashboard access, so usage confirmation needs Vambah handoff or
  explicit approval at that gate. Stop at any fresh login, payment-owner, or
  account-setting gate and record the needed manual step.
- For BuiltWith, collect API/dashboard usage history and use
  [builtwith-deprecation-packet.md](./builtwith-deprecation-packet.md) as the
  approval-gated code-path and replacement plan if cancellation is approved.
- For Fireflies, confirm whether the subscription is already canceled after the
  2026-03-20 refund.
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
