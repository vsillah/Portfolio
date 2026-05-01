# AmaduTown Email Migration Inventory

This inventory supports the phased `amadutown.com` email rollout. It is intentionally operational, not secret-bearing: do not paste API keys, passwords, OAuth tokens, or recovery codes here.

## Current Rollout Status

| Area | Status | Next Action |
| --- | --- | --- |
| Portfolio code | Ready in PR #81 | Merge after review, then set env vars in Vercel |
| Vercel previews | Passing for `portfolio` and `portfolio-staging` | Verify post-merge production deployments |
| Google Workspace | External setup required | Create Workspace user and aliases for `amadutown.com` |
| n8n Cloud credentials | External setup required | Reconnect selected Gmail credentials to Workspace mailbox |
| SaaS login migration | Inventory started | Update only business-critical accounts first |

## Portfolio Environment Variables

Set these before or immediately after merging PR #81:

| Variable | Target Value | Notes |
| --- | --- | --- |
| `BUSINESS_FROM_EMAIL` | `vambah@amadutown.com` | Client-facing sender identity |
| `BUSINESS_REPLY_TO_EMAIL` | `clients@amadutown.com` | Client replies and active-project routing |
| `ADMIN_NOTIFICATION_EMAIL` | current preferred admin inbox | Keep personal Gmail if it remains the recovery inbox |
| `AUTOMATION_INBOUND_EMAIL` | `automation@amadutown.com` | Machine-triggered routing and filters |
| `BUSINESS_FROM_NAME` | `AmaduTown` | Optional; `EMAIL_FROM_NAME` remains supported |
| `GMAIL_USER` | transport mailbox | Credential only, not the public identity |
| `GMAIL_APP_PASSWORD` | transport app password | Rotate after Workspace cutover |
| `RESEND_FROM_EMAIL` | verified sender if using Resend | Should align with the branded domain once DNS is ready |

## n8n Gmail Workflow Migration List

Migrate in this order so client-facing communication moves first and reply automation comes after the sending identity is stable.

| Priority | Workflow | Gmail/Email Nodes | Action |
| --- | --- | --- | --- |
| 1 | `WF-FUP: Follow-Up Meeting Scheduler` | `Create Gmail Draft` | Reconnect to Workspace Gmail; confirm drafts appear in `vambah@amadutown.com` |
| 1 | `WF-GDR: Gmail Draft Reply` | `Gmail Trigger`, `Create Gmail Draft`, `Forward to Owner` | Reconnect trigger/draft credential; route owner forwarding to `ADMIN_NOTIFICATION_EMAIL` |
| 1 | `Client Progress Update Router` | `Gmail Send Email`, `Email Delivery Callback` | Send staging test from branded domain; confirm callback updates Portfolio |
| 1 | `WF-007: Automated Progress Updates` | `Send Email Update` | Confirm no staging send reaches real clients |
| 2 | `WF-AGE: Agenda Email Sender` | `Build Agenda Email`, `Send Agenda to Client` | Reconnect sender; test with internal recipient |
| 2 | `ATAS Onboarding Plan Email Delivery` | `Send Onboarding Email`, `Confirm Email Delivery` | Reconnect sender; update naming if UI still says ATAS |
| 2 | `WF-000A: Discovery Call Booked` | `Send Pre-Call Email` | Test with Calendly sandbox/internal booking |
| 2 | `WF-000B: Discovery Session Complete` | `Send Proposal Email` | Test proposal delivery with internal recipient |
| 2 | `WF-001: Client Payment Intake` | `Send Onboarding Invite Email` | Test after Stripe/checkout staging flow |
| 2 | `WF-001B: Onboarding Call Handler` | `Send Kickoff Meeting Link` | Test with internal recipient |
| 2 | `WF-002: Kickoff Call Scheduled` | `Send Pre-Kickoff Prep Email` | Test with internal recipient |
| 2 | `WF-012: Project Delivery & Upsell` | `Send Delivery Email` | Test with internal recipient |
| 3 | `WF-CLG-003: Send and Follow-Up` | `Send Email via Gmail`, `Generate Follow-Up`, `Check for Reply` | Migrate after active-client workflows because it touches outreach sequencing |
| 3 | `WF-CLG-004: Reply Detection and Notification` | `New Email Received`, reply classification/Slack alerts | Reconnect only after aliases and filters are stable |
| 3 | `WF-PROV: Provisioning Reminder` | `Send Email Reminder` | Migrate after client-delivery workflows |
| 4 | `ReversR Beta Tester Intake form` | `Send a message` | Confirm whether this is still active before migrating |
| 4 | `HeyGen Cold Email - Sub Agent - Jono Catliff` | follow-up messaging nodes | Confirm whether this is still active before migrating |

Keep Google Drive and Google Contacts credentials unchanged unless a workflow explicitly needs Workspace-owned Drive/Contacts data.

## SaaS Login Classification

Use these classes when changing account emails. Do not bulk-change every login.

| Service | Default Classification | Migration Action |
| --- | --- | --- |
| Google Workspace | primary business identity | Create `vambah@amadutown.com`; keep personal Gmail as recovery/admin |
| Vercel | add branded secondary/admin first | Do not replace owner login until deploy access is confirmed |
| GitHub | add branded secondary first | Keep current owner identity until repo, billing, and recovery are verified |
| Supabase | add branded secondary/admin first | Do not remove current admin until dev/prod access is verified |
| n8n Cloud | add branded secondary/admin first | Keep existing owner until credentials and workflow execution are verified |
| Stripe | add branded secondary/admin first | Keep current owner/recovery until payouts, webhooks, and tax docs are verified |
| Google Cloud Console | add branded Workspace user as admin | Required for Gmail OAuth consent/client maintenance |
| Resend | change/add branded domain sender | Verify DNS before using for production sends |
| Slack | add as secondary if supported | Keep current login until workspace ownership is verified |
| Calendly | change only after booking links are verified | Update public links/templates after account identity is stable |
| OpenAI/Anthropic/Apify/HeyGen/Printful/BuiltWith | add branded secondary where supported | Migrate billing/login only after API keys and webhooks are confirmed unaffected |

## Human-In-The-Loop Checklist

These steps require browser/admin access and should be performed with the user present if the session hits MFA, billing confirmation, or ownership transfer prompts:

1. Google Workspace signup and domain verification.
2. DNS record setup for MX, SPF, DKIM, and DMARC.
3. Vercel environment variable updates for production and staging.
4. n8n Cloud Gmail credential reconnection.
5. SaaS admin/user email changes for Vercel, GitHub, Supabase, n8n, Stripe, and Google Cloud.

Use Computer Use for those browser-only steps when a human confirmation or MFA challenge appears.
