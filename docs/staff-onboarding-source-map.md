# Staff onboarding: source and claim register

Reviewed 2026-10-01 against base `bada9bf1`. Route: `/help/staff`; complete print view: `/help/staff/print`.

## Placement and audience

The existing `/help` page reads `docs/user-help-guide.md`; `/admin/help` reads the sales/operator SOP. Both now link to one client-safe orientation under Help. It is intentionally readable without a staff/admin account, includes no internal records, and is marked noindex (not an access-control mechanism). Operational routes retain their existing permissions. No new dashboard, API, database, or knowledge-ingestion source was added.

## Evidence

| Claim | Repo evidence | Limit |
| --- | --- | --- |
| Brand and company name | `lib/website-brand.ts`, `tailwind.config.ts`, `app/layout.tsx`, `public/amadutown-logo-upscaled.png` | Formal name uses the existing company constant. Existing site navigation branding is unchanged. |
| Website, delivery, coordinated agents, reviewed memory | `docs/user-help-guide.md`, `docs/admin-sales-lead-pipeline-sop.md`, `docs/agentic-operating-system-governance.md`, `lib/open-brain.ts` | Capability evolution diagram; no invented dates or company history. |
| Next.js / React runtime | `package.json`, `app/layout.tsx` | Package evidence, not a software upgrade recommendation. |
| Supabase / Postgres, sign-in, storage | `lib/supabase.ts`, `lib/auth.ts`, `supabase/migrations/`, upload routes | No database inspection or live permission claims. |
| n8n handoff and outbound controls | `lib/n8n.ts`, `lib/n8n-runtime-flags.ts`, `n8n-exports/` | Configured integration is not live activation evidence. |
| Slack review and receipts | `lib/slack-action-receipts.ts`, `lib/slack-receipt-canary.ts`, `vercel.json` | Receipt recording does not prove downstream execution. |
| Gmail and Workspace | `lib/gmail-user-api.ts`, `lib/warm-outreach-gmail-operating-loop.ts`, `docs/warm-gmail-review-contract.md` | Draft creation and sending are separate gates; no account status claimed. |
| Telnyx | `lib/warm-outreach-sms-live-execution.ts`, `lib/warm-outreach-sms-provider-readiness.ts` | Per-recipient approval and provider execution gate; availability unverified. |
| 1Password / Infisical | `docs/credential-management-system.md`, `scripts/credential-broker.ts` | Describe purpose only; no credential inventory copied. |
| OpenAI / model providers | `lib/ai-onboarding-generator.ts`, `lib/n8n.ts`, `package.json` | Configured assistance capabilities; no claim about active model, billing, or account. |
| Stripe | `app/api/payments/create-intent/route.ts`, `app/api/payments/webhook/route.ts` | Payment capability, not live payment proof. |
| GitHub / Codex | `AGENTS.md`, `.github/workflows/` | Code proposal/review roles; no staff approval authority granted. |
| Vercel and observability | `vercel.json`, `app/layout.tsx`, `lib/vercel-deployment-metrics.ts` | Checked-in deployment configuration; live env and provider settings intentionally not queried. |
| Open Brain | `lib/open-brain.ts`, `docs/open-brain-local-service.md`, `docs/agentic-content-research-prds/04-open-brain-memory-architecture.md` | Local-first truth, proposals, and compiled overlays; private memories excluded. |
| Jev | `docs/jev-shadow/README.md`, `docs/jev-shadow/pilot-completion.md`, `lib/engagement-shadow/` | Offline mock harness only. No live quality, activation, or production-readiness claim. |

Local repo and AmaduTown Drive Company Materials were searched. The Drive employee handbook and presentation assets were discovered; no private handbook contents or Drive assets were incorporated. The canonical repo logo and design tokens were sufficient. Voice follows the local personality corpus without quoting private material, with a humanizer pass for plain, direct language.

## Confirmation still needed

Vambah should confirm the assigned supervisor/support channel and the first staff member's role and access scope. The first-week tasks are proposed supervised practice, not an approved HR policy. The capability evolution should be confirmed before presenting it as company history. Live provider activation, staff entitlements, and service health were not inspected and are explicitly not asserted.

## Privacy and behavior

The guide introduces no fetch, provider action, persistence, analytics event, or external link. Existing root layout/auth/navigation behavior remains. Checklist state is transient and explicitly labeled. Print opens the browser dialog and does not upload a document. Both routes reuse the same copy. Hash navigation opens the requested section. Native print temporarily expands details and restores the reader's state afterward.
