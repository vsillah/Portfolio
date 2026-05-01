# Technology Bakeoff Surface Map

Use this map to keep Portfolio from getting stale. Any workflow that depends on a fast-moving vendor, model, runtime, generation tool, integration, or automation layer should have a bakeoff path before the default is changed.

The principle: do not swap tools because something looks new. Run a small, comparable test, score it, preserve evidence, then promote the winner behind an adapter or settings layer.

## Priority Surfaces

| Surface | Current Portfolio area | Bakeoff candidates | Primary criteria | Promotion gate |
| --- | --- | --- | --- | --- |
| Image and video generation | `/admin/content/video-generation`, social content, Gamma reports, media uploads | fal, Replicate, OpenRouter, direct providers, HeyGen, future video models | output quality, latency, cost, brand control, provenance, API fit | selected model passes `lib/media-generation-bakeoff.ts`, keeps old default as fallback |
| Presentation and deck production | `/admin/presentations`, `/admin/reports/gamma`, course and deck packages | Codex/PPTX, Gamma, Claude Design, Paper, Excalidraw | clarity, voice, editability, export quality, proof, speaker readiness | winning base keeps source guide, notes, screenshots, QA exports |
| Chat and diagnostic models | `/api/chat`, `/admin/chat-eval`, `/tools/audit`, `/api/chat/diagnostic` | hosted LLMs, local RAG, open-weight models, model routers | answer accuracy, source use, escalation quality, latency, cost, safety | chat eval score improves without hurting conversion or trust |
| RAG and knowledge retrieval | `/api/knowledge`, `lib/rag-query.ts`, local RAG shadow mode, chatbot knowledge build | Supabase/Postgres retrieval, local vector stores, hosted vector DBs, rerankers | recall, precision, freshness, privacy, query latency, maintenance burden | shadow results beat current retrieval on saved test questions |
| Social content generation | `/admin/social-content`, n8n social workflows, LinkedIn review queue | copy models, image models, TTS, scheduling/publishing tools | voice fit, approval burden, image quality, platform fit, rights, publish reliability | human review acceptance rate rises and private-source handling stays clean |
| Voice and avatar video | video generation, HeyGen webhooks, VAPI webhook, meeting follow-up content | HeyGen, ElevenLabs, Vapi, avatar/video alternatives, direct TTS providers | voice quality, likeness/control, webhook reliability, cost per minute, consent and approval | approval gate for public/client-facing voice or avatar output |
| Workflow automation runtime | n8n exports, `/admin/agents`, webhook routes, cron routes | n8n Cloud, Codex automations, Vercel cron, Supabase scheduled jobs, local scripts | observability, retries, cost, deploy friction, audit trail, rollback | new workflows write run traces or equivalent evidence before production use |
| Agent runtimes | `/admin/agents`, Hermes bridge, OpenCode/OpenClaw evaluation | Codex, Hermes, OpenCode/OpenClaw, Claude Code, future coding agents | repository performance, auditability, permissions, rollback, handoff quality | runtime stays read-only or sandboxed until trace and approval behavior is proven |
| Email and outbound messaging | `/admin/email-center`, Gmail helpers, Resend webhook, proposal/email drafts | Gmail API, Resend, SMTP, n8n email nodes, copy models | deliverability, personalization, auditability, reply handling, approval burden | outbound sends require traceable draft, approval state, and delivery event |
| Lead discovery and enrichment | outreach dashboard, tech-stack lookup, warm lead workflows | Apify actors, BuiltWith, LinkedIn/Google sources, enrichment APIs, browser agents | data quality, source reliability, cost per useful lead, compliance, duplicate rate | enrichment improves qualified-lead yield without adding privacy risk |
| Pricing, bundles, and ROI tools | `/admin/sales`, `/admin/cost-revenue`, `/pricing`, ROI tools | pricing models, market data sources, proposal generators, analytics providers | margin accuracy, offer clarity, conversion, source quality, update effort | changes are validated against cost/revenue and proposal acceptance data |
| Testing and QA automation | `/admin/testing`, Playwright, API route tests, regression docs | Playwright, browser-use, synthetic monitors, visual diff tools, LLM judges | bug catch rate, false positives, speed, maintenance, screenshot evidence | new QA layer catches known regressions before adding CI or admin noise |
| Payments, fulfillment, and commerce | checkout, Stripe routes, Printful webhook, store/services/products | Stripe features, checkout UX tools, fulfillment tools, tax/shipping providers | payment reliability, fulfillment accuracy, support burden, reconciliation | no default swap without test transaction, webhook trace, and rollback plan |
| Analytics and attribution | `/admin/analytics`, funnel analytics, cost events, campaign pages | Vercel analytics, custom event tracking, PostHog, Supabase events, warehouse tools | event accuracy, funnel visibility, privacy, cost, operational usefulness | dashboard answers a decision the current analytics cannot answer |
| Content and asset management | Content Hub, uploads, publications, products, projects, Google Drive sync | Supabase Storage, Drive, local staged assets, CMS tools, asset CDNs | provenance, speed, permissions, migration cost, public URL stability | source register and rollback path exist before moving canonical assets |

## Review Cadence

- Monthly: scan fast-moving model and generation surfaces: media, chat, RAG, social content, voice, agents.
- Quarterly: review infrastructure surfaces: automation runtime, analytics, testing, commerce, asset storage.
- Before any major campaign, deck, course, or launch: run the relevant bakeoff even if the current default still works.
- After recurring failures or rising cost: run a bakeoff before patching around the same provider again.

## Standard Bakeoff Packet

Every bakeoff should produce:

- decision question
- current default and fallback
- candidate list
- shared test inputs
- scoring dimensions and weights
- run evidence
- cost and latency notes
- human review notes where judgment matters
- recommendation
- promotion gate
- rollback path

## Where The Code Should Converge

Prefer reusable evaluators under `lib/*-bakeoff.ts` or `lib/*-evaluation.ts`. Production tools should read provider/model choices from settings or config, not hard-code a vendor directly in page components.

Existing examples:

- `lib/presentation-bakeoff.ts`
- `lib/media-generation-bakeoff.ts`
- `lib/ai-layer-fit-evaluation.ts`
- `lib/agent-runtime-evaluation.ts`

When a new surface gets repeated evaluation pressure, create the evaluator first, then wire it into the admin UI.
