# Client Experience Simulator: Add pre-sale, checkout, and onboarding journey simulations

**Type:** feature | **Priority:** normal | **Effort:** large (3 separate journeys)

## TL;DR

Extend the Client Experience Simulator (`/admin/client-experience`) with additional journey tabs beyond the current post-sale proposal flow. Three new simulation modes, prioritized by revenue impact.

## Current State

The simulator currently covers the **post-sale proposal-to-dashboard** journey:
- Proposal view (access code)
- Signing preview
- Payment (test checkout via existing Stripe endpoint)
- Client dashboard (token-based)

## Desired Outcome

Add these as additional tabs/modes on the same simulator page (or as sub-pages):

### 1. Pre-Sale Lead Journey (high priority)
- Simulate: site visit -> chat/diagnostic -> lead scoring -> lead dashboard
- Key routes: `/` (home), `/#contact` (chat), `/tools/audit`, `/client/dashboard/[token]` (lead stage)
- Resolve: `diagnostic_audit_id`, lead dashboard `access_token`, chat session data

### 2. Store Checkout Journey (high priority)
- Simulate: browse store -> add to cart -> checkout -> payment -> purchases page
- Key routes: `/store`, `/checkout`, `/checkout/payment`, `/purchases`
- Includes: campaign enrollment banners, discount codes, shipping for merchandise

### 3. Onboarding Plan Journey (medium priority)
- Simulate: post-payment onboarding experience
- Key route: `/onboarding/[id]`
- Resolve: `onboarding_plan_id` from client project
- Shows milestones, communication plan, warranty, artifacts

### Lower priority (backlog)
- Campaign landing & enrollment (`/campaigns/[slug]`)
- ROI calculator (`/tools/roi/[token]`)
- E-book / lead magnet download (`/ebook/[slug]`, `/resources`)

## Relevant Files

- `app/admin/client-experience/page.tsx` -- main simulator page to extend
- `app/api/admin/client-experience/[projectId]/resolve/route.ts` -- resolve endpoint to extend
- `lib/admin-nav.ts` -- nav entry already exists

## Notes

- **Prerequisite:** validate the current post-sale simulator works end-to-end first
- Each new journey follows the same pattern: resolve tokens/credentials -> present steps inline -> provide "Open as Client" links
- Pre-sale journey will need a different selector (leads/diagnostic audits instead of client projects)
