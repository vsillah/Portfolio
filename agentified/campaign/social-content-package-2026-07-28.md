# Agentified social-content package

Status: Review-ready internal package
Prepared: 2026-07-28
Campaign id: `f936c07c-f780-4a22-97f3-c0e3e10643d6`
Campaign slug: `agentified-trust-scale-2026-07`
Campaign status: `draft`
Owner lane: Portfolio Content Strategy
Publishing authority: Human approval required

This package reconciles the current Agentified campaign source, the human review packet, draft assets, production calendar rows, and linked Social Content queue drafts.

It does not publish, schedule, send email, create provider drafts, generate paid-provider assets, upload media, or change production settings.

## Source map

| Source | Role | Boundary |
| --- | --- | --- |
| `agentified/campaign/portfolio-campaign-packet.json` | Canonical campaign calendar, phase, channel, timing, source paths, and side-effect boundaries. | Source of truth for asset IDs and planned calendar order. |
| `agentified/campaign/launch-review-packet-2026-07-27.md` | First human-review packet for the launch sequence. | Review packet only. It does not authorize external publication. |
| `agentified/campaign/draft-assets.md` | Draft copy, carousel outlines, short-form scripts, offer copy, and review notes. | Public copy source, pending human decisions. |
| `agentified/campaign/release-calendar.md` | Human-readable release calendar. | Proposed review slots, not external publishing commitments. |
| `agentified/campaign/visual-asset-autoresearch-loop.md` | Source-first visual replacement loop when existing assets are not suitable. | Review and generation process only. It does not authorize provider generation, publishing, scheduling, uploads, or platform submission. |
| Production read-only check, 2026-07-28 | Campaign, calendar, queue, and work-item reconciliation. | Read-only evidence. No production writes were made. |

## Current production state

| Area | State |
| --- | --- |
| Campaign | `draft` |
| Calendar rows | 12 |
| Calendar authorization | 12 `authorized` internally |
| Agent work items | 12 `queued`, owned by `chief-of-staff`, runtime `manual` |
| Branch/worktree/PR ownership on work items | None |
| LinkedIn queue drafts | 9 linked |
| Internally approved LinkedIn queue drafts | 3 |
| LinkedIn drafts still in `draft` | 6 |
| YouTube Shorts placeholders | 2 calendar rows, no queue draft |
| Page CTA placeholder | 1 calendar row, no queue draft |
| External publication | 0 rows with `published_at`; 0 rows with `platform_post_id` |

Internal authorization means the calendar row is allowed to move through the internal review and draft handoff path. It does not mean publish-ready.

## Copy state definitions

| State | Meaning | Allowed next action |
| --- | --- | --- |
| `approved_internal_queue` | A linked Social Content queue draft exists and is approved internally. | Human can perform final copy/CTA/platform review. |
| `draft_queue` | A linked Social Content queue draft exists but still has `status = draft`. | Revise or approve internally after review. |
| `placeholder_missing_queue` | Calendar row exists, but no Social Content queue draft is linked. | Prepare the missing internal draft packet only. |
| `blocked_external` | A provider, send, platform, or public-site action would be required. | Stop for explicit human approval. |

## Calendar and readiness

| Date ET | Asset ID | Phase | Channel | Queue state | Copy state | Asset requirements | CTA/URL needs | Readiness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-27 3:00 PM | `AGT-LI-01` | `tease` | LinkedIn | Linked queue draft `approved`, single image | `approved_internal_queue` | Confirm visual or plain text treatment. No provider asset required for copy review. | CTA undecided in source: question CTA or `/agentified`. Production queue has no CTA URL. | Ready for final human copy/CTA review. |
| 2026-07-28 12:00 PM | `AGT-LI-02` | `tease` | LinkedIn | Linked queue draft `approved`, single image | `approved_internal_queue` | Optional simple handoff receipt visual. | Production queue has no CTA URL. Decide question CTA vs release CTA. | Ready for final human copy/CTA review. |
| 2026-07-29 9:00 AM | `AGT-CAR-01` | `teach` | LinkedIn carousel | Linked queue draft `approved`, carousel | `approved_internal_queue` | Carousel design needed before external use. Confirm AMINA visual treatment. | Production queue uses `Review the AMINA loop` with `https://amadutown.com/agentified`. | Ready for human carousel copy and design approval. |
| 2026-07-30 12:00 PM | `AGT-LI-03` | `teach` | LinkedIn | Linked queue draft `draft`, single image | `draft_queue` | Confirm whether a SAM lineage visual is needed. | Production queue has no CTA URL. Source needs SAM lineage check. | Needs internal approval. |
| 2026-07-31 3:00 PM | `AGT-SHORT-01` | `teach` | YouTube Shorts / Reels | No queue draft | `placeholder_missing_queue` | Script approval, visual method, captions, and provider/native decision. | No final URL required unless caption routes to `/agentified`. | Missing internal draft packet. No provider work approved. |
| 2026-08-03 9:00 AM | `AGT-LI-04` | `proof` | LinkedIn | Linked queue draft `draft`, single image | `draft_queue` | Final cover selection and public-use approval required. | Production queue uses `Follow the Agentified release` with `https://amadutown.com/agentified`. | Needs visual approval and internal copy approval. |
| 2026-08-04 12:00 PM | `AGT-CAR-02` | `proof` | LinkedIn carousel | Linked queue draft `draft`, carousel | `draft_queue` | SAM-to-AMINA carousel design; confirm owned SAM visual source. | Production queue uses `Follow the Agentified release` with `https://amadutown.com/agentified`. | Needs source and visual approval. |
| 2026-08-05 9:00 AM | `AGT-LI-05` | `proof` | LinkedIn | Linked queue draft `draft`, single image | `draft_queue` | Workbook preview decision and any approved preview asset. | Production queue uses `Follow the Agentified release` with `https://amadutown.com/agentified`. | Needs workbook preview gate. |
| 2026-08-06 3:00 PM | `AGT-SHORT-02` | `proof` | YouTube Shorts / Reels | No queue draft | `placeholder_missing_queue` | Script approval, cover motion plan, captions, and provider/native decision. | No final URL required unless caption routes to `/agentified`. | Missing internal draft packet. No provider work approved. |
| 2026-08-07 9:00 AM | `AGT-LI-06` | `offer` | LinkedIn | Linked queue draft `draft`, single image | `draft_queue` | Confirm release path and whether public page is ready for traffic. | Production queue uses `Start here` with `https://amadutown.com/agentified`. | Needs offer/CTA approval. |
| 2026-08-08 10:00 AM | `AGT-EMAIL-01` | `offer` | LinkedIn placeholder for owned channel | Linked queue draft `draft`, single image | `draft_queue` | Email audience/list decision remains missing. Social queue currently treats this as LinkedIn placeholder copy. | Production queue uses `Follow the Agentified release` with `https://amadutown.com/agentified`. | Needs channel decision before use. |
| 2026-08-09 12:00 PM | `AGT-PAGE-01` | `offer` | Portfolio page / thumbnail placeholder | No queue draft | `placeholder_missing_queue` | Public `/agentified` CTA block approval and conversion path decision. | Button/path options still unresolved. | Missing internal draft packet and site-update approval. |

## LinkedIn queue reconciliation

| Asset ID | Queue ID | Queue status | Format | Calendar authorization | Publication fields | Action |
| --- | --- | --- | --- | --- | --- | --- |
| `AGT-LI-01` | `bd2ca637-3680-480d-bc1b-07620a881401` | `approved` | `single_image` | `authorized` | No `published_at`; no `platform_post_id` | Final human CTA decision. |
| `AGT-LI-02` | `05ef0716-8bee-4b44-bf82-46462b160c7f` | `approved` | `single_image` | `authorized` | No `published_at`; no `platform_post_id` | Final human CTA decision. |
| `AGT-CAR-01` | `a4822232-50a2-451c-b032-a4bd297c115a` | `approved` | `carousel` | `authorized` | No `published_at`; no `platform_post_id` | Final carousel visual approval. |
| `AGT-LI-03` | `dc24682b-1de0-4bdd-8a9d-a10fc0c89e39` | `draft` | `single_image` | `authorized` | No `published_at`; no `platform_post_id` | Internal copy approval. |
| `AGT-LI-04` | `9ee3363b-23ce-451d-a1a7-cf15847986ea` | `draft` | `single_image` | `authorized` | No `published_at`; no `platform_post_id` | Cover approval plus copy approval. |
| `AGT-CAR-02` | `0ca05d6a-580a-4432-84cf-30973668be23` | `draft` | `carousel` | `authorized` | No `published_at`; no `platform_post_id` | SAM-to-AMINA source and visual approval. |
| `AGT-LI-05` | `95fb9be6-6316-4d6a-b4bf-4e9547cad33c` | `draft` | `single_image` | `authorized` | No `published_at`; no `platform_post_id` | Workbook preview gate. |
| `AGT-LI-06` | `2c9242f9-a8e8-4622-9343-b4d2f936880c` | `draft` | `single_image` | `authorized` | No `published_at`; no `platform_post_id` | Offer CTA approval. |
| `AGT-EMAIL-01` | `e327ddb8-0633-43e1-bb50-c4d2fa4152e1` | `draft` | `single_image` | `authorized` | No `published_at`; no `platform_post_id` | Decide whether this remains a LinkedIn adaptation or returns to email/newsletter. |

## Placeholder requirements

| Asset ID | Missing piece | Needed before internal draft handoff | External boundary |
| --- | --- | --- | --- |
| `AGT-SHORT-01` | No linked Social Content queue draft. | Script review packet, format choice, storyboard notes, captions, and visual-source plan. | No HeyGen, native recording, upload, or Shorts scheduling. |
| `AGT-SHORT-02` | No linked Social Content queue draft. | Script review packet, cover-motion plan, captions, and public visual approval. | No HeyGen, native recording, upload, or Shorts scheduling. |
| `AGT-PAGE-01` | No linked queue draft or approved site change packet. | CTA block review, conversion path, button text, and current `/agentified` page check. | No public page replacement. |

## Per-item source trace

| Asset ID | Draft source | Packet source | Review source |
| --- | --- | --- | --- |
| `AGT-LI-01` | `agentified/campaign/draft-assets.md#agt-li-01` | `agentified/campaign/portfolio-campaign-packet.json` | `agentified/campaign/launch-review-packet-2026-07-27.md` |
| `AGT-LI-02` | `agentified/campaign/draft-assets.md#agt-li-02` | `agentified/campaign/portfolio-campaign-packet.json` | `agentified/campaign/launch-review-packet-2026-07-27.md` |
| `AGT-CAR-01` | `agentified/campaign/draft-assets.md#agt-car-01` | `agentified/campaign/portfolio-campaign-packet.json` | `agentified/campaign/launch-review-packet-2026-07-27.md` |
| `AGT-LI-03` | `agentified/campaign/draft-assets.md#agt-li-03` | `agentified/campaign/portfolio-campaign-packet.json` | `agentified/campaign/launch-review-packet-2026-07-27.md` |
| `AGT-SHORT-01` | `agentified/campaign/draft-assets.md#agt-short-01` | `agentified/campaign/portfolio-campaign-packet.json` | `agentified/campaign/launch-review-packet-2026-07-27.md` |
| `AGT-LI-04` | `agentified/campaign/draft-assets.md#agt-li-04` | `agentified/campaign/portfolio-campaign-packet.json` | `agentified/campaign/launch-review-packet-2026-07-27.md` |
| `AGT-CAR-02` | `agentified/campaign/draft-assets.md#agt-car-02` | `agentified/campaign/portfolio-campaign-packet.json` | `agentified/campaign/launch-review-packet-2026-07-27.md` |
| `AGT-LI-05` | `agentified/campaign/draft-assets.md#agt-li-05` | `agentified/campaign/portfolio-campaign-packet.json` | `agentified/campaign/launch-review-packet-2026-07-27.md` |
| `AGT-SHORT-02` | `agentified/campaign/draft-assets.md#agt-short-02` | `agentified/campaign/portfolio-campaign-packet.json` | `agentified/campaign/launch-review-packet-2026-07-27.md` |
| `AGT-LI-06` | `agentified/campaign/draft-assets.md#agt-li-06` | `agentified/campaign/portfolio-campaign-packet.json` | `agentified/campaign/launch-review-packet-2026-07-27.md` |
| `AGT-EMAIL-01` | `agentified/campaign/draft-assets.md#agt-email-01` | `agentified/campaign/portfolio-campaign-packet.json` | `agentified/campaign/launch-review-packet-2026-07-27.md` |
| `AGT-PAGE-01` | `agentified/campaign/draft-assets.md#agt-page-01` | `agentified/campaign/portfolio-campaign-packet.json` | `agentified/campaign/launch-review-packet-2026-07-27.md` |

## Acronym and claim check

| Term | Current approved handling |
| --- | --- |
| AMINA | Expand as Align, Map, Instrument, Negotiate, Audit. Verified against current campaign packet and draft assets. |
| SAM | Do not expand in this package. Nearby sources use different expansions, so public copy should say "SAM loop" unless Vambah confirms the expansion for this campaign. |
| Agentified promise | Use "achieve agentic scale through trust" as the current campaign promise. |
| Publication claims | Do not claim any asset was posted, scheduled, sent, or externally published. |

## Humanizer pass

The package keeps public-facing copy review grounded in the approved draft source. For final copy edits, remove:

- formulaic "here is/let's dive in" framing
- generic AI hype
- "not just X, but Y" antithesis
- unsupported industry claims
- private manuscript, Chronicle, client, credential, or raw admin details
- visual claims until the cover, carousel, and page assets are approved

The strongest immediate post remains `AGT-LI-01`. It opens from the operating tension, stays public-safe, and does not require provider media.

## Human decisions needed

| Decision | Affects |
| --- | --- |
| Approve, revise, hold, or reject `AGT-LI-01` as the first public post. | First launch action. |
| Decide CTA style for `AGT-LI-01` and `AGT-LI-02`: question CTA, `/agentified`, or no CTA. | Opening LinkedIn posts. |
| Approve AMINA carousel language and design direction. | `AGT-CAR-01`. |
| Confirm the SAM expansion or leave SAM unexpanded. | `AGT-LI-03`, `AGT-CAR-02`, page and email copy. |
| Approve final cover asset for public use. | `AGT-LI-04`, `AGT-SHORT-02`, proof assets. |
| Decide workbook preview path: gated, ungated, or hold. | `AGT-LI-05`. |
| Decide Shorts production method: native recording, text-over-cover, HeyGen, or hold. | `AGT-SHORT-01`, `AGT-SHORT-02`. |
| Decide whether `AGT-EMAIL-01` stays as LinkedIn-adapted copy or returns to email/newsletter. | Offer sequence. |
| Approve `/agentified` CTA block and conversion path. | `AGT-PAGE-01`. |

## Handoff recommendation

1. Review `AGT-LI-01`, `AGT-LI-02`, and `AGT-CAR-01` first because they already have approved internal queue drafts.
2. Resolve CTA and SAM wording before moving the six remaining LinkedIn queue drafts out of `draft`.
3. Prepare separate internal draft packets for the two Shorts and the page CTA. Do not call providers or update the public page from this package.
4. Keep final external publishing approval separate from internal queue approval.
5. When a draft needs a visual and the current assets are unsuitable, use the visual asset AutoResearch loop before asking for human visual approval.

## Closed gates

- LinkedIn publishing
- External scheduling
- YouTube Shorts upload or scheduling
- HeyGen or other paid provider generation
- Native recording or final render
- Email send
- Public `/agentified` page replacement
- Production settings changes
