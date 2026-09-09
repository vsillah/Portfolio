# Website naming scope and remaining references

The authored website names are `AmaduTown, LLC` and `AmaduTown Advisory Solutions, LLC`, including uppercase display variants. This sweep covers public navigation, home, authentication, legal, store, checkout, purchases, pricing, client portal, authored admin labels, social previews, root metadata and website-generated PDF/PPTX/carousel/report branding. Known owner enums receive a display label without changing their stored keys.

## Preserved identifiers

URLs, email addresses, handles, domains, technical keys, database identifiers, asset paths and filenames remain unchanged. `protected-source-tokens.json` records the original tokens for the initial authored source set. Vambah Sillah remains a personal name. `approved-artifacts-sha256.json` verifies that the previously approved SMS artifacts and migration remain byte-for-byte intact.

## Runtime and CMS content

Database-authored products, services, blog posts, social posts, client names, channel titles, proposals, source records and previously generated documents are not rewritten or normalized at render time. Vendor-returned channel titles are preserved, with a regression assertion in the social-content page tests. No live database inventory or mutation was performed; their exact current values require a separately scoped source review.

## Deliberate source exclusions

| Category | Representative sources | Reason |
| --- | --- | --- |
| Outbound-only identities and templates | `lib/business-email-config.ts`, `lib/email/templates/{order-confirmation,proposal,shipment}.ts`, `lib/delivery-email.ts`, `lib/client-update-drafts.ts`, `lib/warm-outreach-manual-social-handoff.ts`, outbound sample in `components/admin/outreach/warmSlackSendApprovalQaFixture.ts:763` | Sender/provider and outbound copy changes are outside this website pass. The fixture's current status labels were updated separately. |
| Historical authored material and source titles | `lib/agentified-publication.ts:8`, `lib/knowledge-source-manifest.ts:9`, `lib/chatbot-knowledge.ts:42`, `lib/accelerated-module0-video-draft.ts`, `lib/admin-demo-seed.ts`, `lib/agentified-launch-campaign.ts`, `lib/email/legacy-admin-email-samples.ts`, `agentified/campaign/portfolio-campaign-packet.json` | Preserve publication metadata, historical campaigns, samples and source provenance. |
| Operational prompts and generated content inputs | `app/admin/agents/standup/page.tsx:554`, `app/api/admin/rag-health/route.ts:39`, video-generation and voice-note generation routes; `lib/system-prompts.ts`, `lib/social-content.ts`, `lib/social-topic-backlog.ts`, `lib/ai-onboarding-generator.ts`, `lib/lead-research-context.ts`, `lib/constants/creator-background.ts`, `lib/video-ideas-context.ts`, `lib/video-script-intelligence.ts`, `lib/content-packages.ts` | A company naming sweep does not rewrite agent instructions or generated content inputs. |
| Workflow and research identities | `lib/agent-organization.ts:227`, `lib/agent-war-room.ts`, `lib/agentic-content-review-packets.ts`, `lib/client-ai-ops-roadmap.ts:436`, `lib/comment-inbox-policy.ts`, `lib/cross-channel-autoresearch-backlog.ts`, `lib/social-content-calendar.ts`, `lib/social-content-calibration-library.ts`, `lib/social-content-intelligence.ts` | Preserve workflow identities, research packets and historical content. Current authored display labels are changed only in the scoped sources. |
| Provider fallback | `lib/publishing/youtube.ts:156` | Outbound publication fallback is outside website display naming. |
| Code and test terminology | `lib/pricing-model.ts` / `ComparisonChecklist` capability keys, `lib/gamma-report-builder.ts` capability access, `lib/testing/chatbot-questions.ts`, policy regexes, chart/CSS/PDF comments | Technical identifiers, evaluation questions and comments are not authored company labels. |

## Graphic-only references

The shield/logo images, `public/agentified-cover.svg`, `public/agent-avatars/amadutown-brand.svg`, and `design-files/about-page-video/schematic-{cta,hub}.svg` remain unchanged. Asset names and intrinsic design are preserved; accessible website labels use the authored company name where in scope. Graphic lettering needs a separate design/source update.

This inventory is source-based. It does not assert that remote CMS content or historical media has been renamed.
