# Social draft workflow

Status: Lane workflow packet
Date: 2026-06-28

## Purpose

This workflow turns a campaign idea into review-ready social content without crossing into publishing, scheduling, provider generation, or external sends.

The goal is a clean handoff:

`campaign goal -> topic backlog -> calendar item -> draft packet -> challenger review -> human approval -> internal handoff -> separate publishing approval`

## Draft states

| State | Meaning | Allowed action |
| --- | --- | --- |
| `draft` | Working copy exists, but it has not passed voice, source, or privacy review. | Edit internally. |
| `human_review_ready` | The packet passed source, privacy, and challenger checks. | Route to Nefertiti/Shaka for review. |
| `approved_for_internal_handoff` | Human approved the draft for Portfolio internal handoff. | Create or link internal Social Content draft/work item. |
| `blocked` | A claim, source, privacy issue, CTA, or asset dependency needs a decision. | Stop and request the specific decision. |
| `publish_ready` | Human explicitly approved publishing prep after internal handoff. | Prepare external publishing packet only. |

`publish_ready` is still not permission to publish. It means the content packet can move to a separate publishing approval surface.

## Workflow

1. Confirm campaign source.
   - Campaign name
   - Audience
   - Offer path
   - Template key, usually `whisper_to_shout`
   - Canonical phase: `tease`, `teach`, `proof`, or `offer`

2. Build the source packet.
   - Public sources
   - Portfolio-owned proof surface
   - Private-derived voice notes, summarized only
   - Blocked or missing evidence
   - Privacy boundary

3. Draft the channel asset.
   - LinkedIn text
   - Carousel outline
   - YouTube Shorts script
   - Thumbnail concept
   - Email or follow-up note, when approved

4. Apply the voice pass.
   - Start from a concrete scene, tension, or practical problem.
   - Keep claims specific.
   - Use plain sentences.
   - Keep the bridge between story and execution.
   - Avoid formulaic signposting, generic AI hype, and negative antithesis patterns.

5. Apply the source and privacy pass.
   - Mark every proof claim as owned, public, private-derived, or blocked.
   - Remove private chats, client records, raw account data, and sensitive personal details.
   - Keep screenshots sanitized or replace them with diagrams.

6. Apply the challenger pass.
   - Unsupported claim check
   - Implementation drift check
   - Privacy check
   - Duplicate work check
   - Channel fit check
   - CTA fit check

7. Route to human review.
   - Nefertiti: voice, rhythm, public claim comfort.
   - Shaka: campaign priority, approval state, publishing authority.
   - Integration Captain: only if a code/data mutation or merge is needed.

## Review packet template

```yaml
asset_id:
campaign_id:
campaign_template_key: whisper_to_shout
campaign_phase:
channel:
draft_version:
creator_lane: content-strategy
status: human_review_ready
source_ids:
  -
approval_required:
  voice_review: true
  source_review: true
  privacy_review: true
  publishing_approval: true
external_actions:
  provider_generation: false
  upload: false
  publish: false
  schedule: false
  send: false
```

Required packet sections:

- Draft to review
- Intended audience
- Campaign role
- Source map
- Claim boundary
- Privacy notes
- Challenger findings
- Human decision needed
- Next internal handoff if approved

## LinkedIn draft checklist

- The first 210 characters carry the tension.
- The post has one main idea.
- Paragraphs are short enough for mobile reading.
- A lived detail, operational scene, or concrete work moment opens the frame.
- The post moves from diagnosis to a practical next step.
- The CTA asks a specific question or routes to a specific approved offer path.
- Hashtags stay between three and five.
- Character count is checked before review.
- The humanizer pass removed formulaic phrases, generic AI terms, empty uplift, and over-polished list cadence.

## Publishing prep boundary

Content Strategy may prepare:

- final copy packet
- alt text or visual notes
- sanitized image/screen-capture request
- recommended publish window
- approval checklist
- internal Social Content handoff note

Content Strategy may not do the following without explicit approval:

- publish to LinkedIn, YouTube, Instagram, or email
- schedule through any external platform
- trigger n8n, HeyGen, ElevenLabs, Remotion, HyperFrames, or upload workflows
- use private or client-specific proof in public content
- mark a rejected calendar item as authorized without a decision note

## Escalation rules

Escalate to Vambah when:

- the CTA path is unclear
- a proof claim depends on private work
- a screenshot would expose private state
- a campaign asks for external publishing
- a draft needs a public claim that the current product cannot support
- the same topic appears in another active worktree or PR

## Roadmap status

Completed in this workflow:

- Defined draft states and approval gates.
- Added the review packet template.
- Clarified the publishing prep boundary.

Next:

- Use this template for the first Accelerated campaign review packet after the topic priority is approved.
- Attach each future draft packet to the relevant Social Content calendar item or campaign work item.

Decision gate:

- A human must approve movement from review-ready content into any external publishing workflow.
