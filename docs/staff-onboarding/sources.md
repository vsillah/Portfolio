# Staff onboarding evidence register

Reviewed 2026-10-01 against `bada9bf1` (origin/main at lane start). This register supports copy, not live provider readiness. No account values, credentials, customer records, or private exports were used.

## Placement and source ownership

- Stable route: `/admin/help/onboarding`; entry from the existing `/admin/help` guide.
- Existing architecture: `app/admin/help/page.tsx`, `app/help/page.tsx`, `components/DocViewer.tsx`, `components/admin/Breadcrumbs.tsx`, `components/ProtectedRoute.tsx`.
- Access inherits `requireAdmin`; no new staff role, grants, auth changes, or database migration.
- Content is shared between screen and PDF in `lib/staff-onboarding.ts`.
- PDF follows `lib/onboarding-pdf.tsx` client Blob generation and `lib/pdf-brand-styles.ts`; no new PDF service or API route.
- Screen reuses the existing shield at `public/amadutown-logo-upscaled.png`, preserving its natural aspect ratio.

## Claim-to-evidence map

| Subject | Repository evidence | Permitted conclusion |
| --- | --- | --- |
| Portfolio | `docs/user-help-guide.md`, `docs/admin-sales-lead-pipeline-sop.md`, `app/admin/layout.tsx`, `package.json` | Public website/storefront plus protected operating workspace; Next.js and React application. |
| Vercel | `docs/vercel-deployment-runbook.md`, `next.config.js` | Deployment workflow tracks portfolio and portfolio-staging; no current health claim. |
| Supabase / Postgres | `lib/supabase.ts`, `lib/auth.ts`, `supabase/migrations/` | Database and authentication integration exists; access still depends on account and role. |
| n8n | `lib/n8n.ts`, `lib/n8n-runtime-flags.ts`, `docs/n8n-cloud-workflow-setup.md` | Configured workflow integration; staging/preview name alone does not disable outbound calls. |
| Slack | `lib/slack-receipt-status.ts`, `docs/agent-ops-slack-mobile-unblock.md` | Review and receipt flows exist; recorded intent, canonical outcome, and card delivery are separate. |
| Gmail / Workspace | `lib/gmail-user-api.ts`, `docs/warm-gmail-review-contract.md`, `app/api/admin/outreach/[id]/gmail-user-draft/route.ts`, `app/api/admin/outreach/[id]/gmail-user-send/route.ts` | Separate draft and send paths with authorization; no mailbox entitlement or delivery claim. |
| 1Password | `docs/credential-management-system.md` | Runbook assigns human logins and recovery information to 1Password; actual vault access is owner-confirmed. |
| OpenAI / providers | `lib/llm-dispatch.ts`, `lib/llm-judge.ts` | OpenAI and Anthropic call implementations exist; no claim about current models, billing, or activation. |
| Telnyx | `lib/warm-outreach-sms-provider-readiness.ts`, `lib/warm-outreach-sms-live-execution.ts` | Readiness and explicit send gates exist; no live delivery or campaign-readiness claim. |
| Stripe | `lib/stripe.ts`, `app/api/payments/` | Payment integration and mode distinction exist; onboarding grants no billing authority. |
| GitHub / Codex | `AGENTS.md`, `scripts/qa/`, repository pull-request workflow | Scoped implementation and captain integration workflow; no new account requirements inferred. |
| Open Brain | `docs/open-brain-local-service.md`, `docs/agentic-content-research-prds/04-open-brain-memory-architecture.md` | Local-first memory core; Portfolio is a projection and proposal surface; approved learning only. |
| JEV | `docs/jev-shadow/README.md`, `docs/jev-shadow/pilot-completion.md`, `lib/engagement-shadow/jev.ts` | Offline mock benchmark, live HOLD, no production caller or send authority. |
| Approval/no-egress | `AGENTS.md`, Gmail and SMS gates above, `lib/n8n-runtime-flags.ts` | Explicit action boundaries, safe practice, and receipt verification. |

## Design and voice sources

The local repo and AmaduTown Google Drive Company Materials directory were searched before design work. Drive contains presentation templates, pitch decks, a Business Model Canvas PDF, and an Employee Handbook pointer. None was copied or quoted; the handbook's contents were not read or treated as policy. Existing Portfolio navigation, colors, shield, and shared PDF brand styles were sufficient. Private personality corpus informed plain-language style only; no private source text was included.

## Owner confirmations still needed

- Name the onboarding owner and approved support channel. The guide deliberately uses role-based instructions rather than invented people or Slack channels.
- Confirm which new staff receive the existing admin role. This implementation does not grant access or create a less-privileged staff role.
- Confirm a designated practice environment and permitted sample records before real onboarding. The development QA proxy is synthetic and is not a staff training service.
- Confirm company-history dates if a chronological history is desired. The evolution map depicts repository capabilities, not an asserted timeline.
- Confirm each staff member's approved work account, vault, tools, and task scope. The tool map describes responsibilities, not active subscriptions or live connections.
