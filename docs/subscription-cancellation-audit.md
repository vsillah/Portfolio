# Portfolio Subscription Cancellation Audit

Recurring audit tracker for paid apps, hosted services, model/API providers,
automation runtimes, design/media tools, and third-party integrations used by
Portfolio.

Authority boundary: this tracker never approves cancellation by itself. A tool
only becomes a cancellation candidate after two consecutive audit sessions with
no meaningful usage signal, or after clear redundancy plus a lower-risk
replacement path. Production changes require explicit approval in the form
`Cancel <tool/vendor> for Portfolio`.

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
