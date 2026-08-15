# Cross-channel AutoResearch backlog contract

Status: draft operating contract
Date: 2026-08-15
Owner lane: Content Strategy / Amina
Mode: internal research, backlog, and draft preparation only

## Purpose

Portfolio needs one AutoResearch backlog contract across LinkedIn, X, YouTube, Instagram, Facebook, and future TikTok or manual channels.

The contract turns public research evidence into channel-specific backlog rows without creating a parallel strategy or bypassing the Social Content approval path. Amina can use it to decide what should become a LinkedIn post, X thread, YouTube video, Instagram carousel, Facebook companion post, thumbnail, B-roll request, hashtag test, or future TikTok/manual record.

This contract does not publish, schedule, upload, call providers, send Slack messages, send external messages, mutate production rows, or change credentials.

## Existing source basis

Reuse these existing packets before adding new strategy:

| Source | Reused for | Boundary |
| --- | --- | --- |
| `docs/content-strategy/linkedin-autoresearch-loop.md` | Comparable-creator loop, unique-angle scoring, 24-48 hour directional review, seven-day decision review, saturation rules, and LinkedIn voice guardrails. | LinkedIn-first rules become shared learning-loop rules, not a separate LinkedIn silo. |
| `docs/content-strategy/agentified-youtube-x-calendar-brief.md` | Campaign-calendar integration for YouTube and X, source-distance requirements, X backlog rows, and decision-window handling. | Calendar rows remain part of one Agentified campaign. |
| `docs/content-strategy/agentified-x-research-evidence-2026-08-05.md` | Public X evidence examples and Amina refinement recommendations for `AGT-X-01` through `AGT-X-04`. | Evidence can supply patterns only; no creator copy, identity, or private analytics is reused. |
| `docs/content-strategy/agentified-x-review-packets-2026-08-05.md` | X draft packet structure, CTA timing, source-distance review, and human approval language. | Approval covers internal copy/source/privacy readiness only. |
| `docs/content-strategy/agentified-instagram-research-calendar-brief-2026-08-05.md` | Instagram and Facebook channel mapping, format choices, and Meta/provider boundary. | Use `instagram_reels` as a planning format only when motion or B-roll is needed. |
| `docs/content-strategy/agentified-instagram-research-evidence-2026-08-06.md` | Instagram/Facebook public evidence, phase-to-format recommendations, B-roll and carousel guidance. | Metrics remain directional unless first-party approved signal is available. |
| `docs/content-strategy/agentified-instagram-review-packets-2026-08-06.md` | IG/FB review packet shape, hashtags, visual direction, and batch approval gate. | External Meta publishing remains separately gated. |
| `docs/agentic-content-video-scripts/agentified-youtube-amina-research-to-video-packet.md` | YouTube long-form and Shorts structure, thumbnail/B-roll requirements, avatar gate, and playlist/channel gates. | Render, upload, and playlist/provider actions require separate approval. |
| `docs/agentified-visual-autoresearch.md` | Amina visual strategy, source search order, rights/privacy checks, and QA loop. | Visual selection can reach human review only, not provider handoff. |
| `agentified/campaign/portfolio-campaign-packet.json` | Current draft campaign rows, phases, IDs, authorization flags, and side-effect boundary. | The packet is `draft_prepare_only`; it creates no campaign, social drafts, uploads, schedules, or posts. |
| `docs/linkedin-voice.md` | Vambah voice, first-210-character hook discipline, hashtags, and anti-formula guidance. | Public-facing copy still needs human review and public-claim review. |

## Backlog row model

Each backlog item represents one research-backed content idea before it becomes a channel draft. Channel variants are children of the idea, not separate competing strategies.

```ts
type CrossChannelAutoResearchBacklogItem = {
  id: string
  title: string
  status:
    | 'research_candidate'
    | 'source_basis_recorded'
    | 'channel_fit_recommended'
    | 'draft_packet_ready'
    | 'human_review_ready'
    | 'approved_for_internal_handoff'
    | 'blocked'
    | 'manual_hold'
    | 'superseded'
  targetAvatar: string
  campaignSlug?: string
  campaignPhase?: 'tease' | 'teach' | 'proof' | 'offer'
  sourcePacketPaths: string[]
  provenance: AutoResearchProvenance[]
  sourceDistance: SourceDistanceReview
  channelVariants: ChannelVariantRecommendation[]
  ctaHypothesis: CtaHypothesis
  releaseLinkage?: ReleaseLinkage
  postReleaseSignals?: PostReleaseSignalPlan
  improvementRecommendation?: ImprovementRecommendation
  gates: GateState[]
  blockedReason?: string
  nextHumanDecision?: string
}
```

Use this as a contract shape for the next implementation slice. This PR does not add the type to runtime code.

## Required fields

| Field | Meaning | Required handling |
| --- | --- | --- |
| `id` | Stable internal backlog ID. | Must be unique and traceable to a source packet, work item, or calendar row. |
| `title` | Plain-language idea title. | Should name the operating tension or proof claim, not the channel. |
| `status` | Current internal state. | `approved_for_internal_handoff` allows Social Content draft preparation only after human approval; it does not approve publishing. |
| `targetAvatar` | The intended reader/viewer. | Use the existing Agentified target-avatar fit language where applicable: AI product operators, agent-builder educators, product leaders, consultants, nonprofits, founders, or equity-centered technologists. |
| `campaignSlug` | Optional campaign binding. | For Agentified, use `agentified-trust-scale-2026-07`. Do not create a second campaign. |
| `campaignPhase` | Calendar phase. | Store only `tease`, `teach`, `proof`, or `offer`. |
| `sourcePacketPaths` | Existing packet references. | Reference existing docs or campaign JSON. Do not duplicate packet contents. |
| `provenance` | Public source and internal proof basis. | Keep raw public evidence separate from derived analysis. |
| `sourceDistance` | Originality, privacy, and rights boundary. | Must state what pattern can be adapted and what cannot be copied. |
| `channelVariants` | Channel-specific recommendation set. | Must include fit reason, format, asset needs, CTA timing, and manual/provider boundaries. |
| `ctaHypothesis` | The action the content tests. | Must name whether the CTA is conversation, save/share, follow, `/agentified`, playlist, waitlist, consultation, or manual review. |
| `releaseLinkage` | Link to campaign row, Social Content row, work item, or release artifact. | Linkage can be planned or draft; it cannot imply external execution. |
| `postReleaseSignals` | Learning-window plan. | Must name the 24-48 hour directional window and seven-day decision window. |
| `improvementRecommendation` | What the next release should change. | Recommendations can target CTA, thumbnail, hashtags, B-roll, hook, format, proof placement, source placement, or publish window. |
| `gates` | Sequential approval and execution states. | Gates must remain fail-closed and separate internal handoff from provider execution. |
| `blockedReason` | Why the item cannot advance. | Use for missing source basis, rights/privacy uncertainty, weak target-avatar fit, unsupported proof, thin signal, missing asset, missing CTA approval, or provider/manual hold. |
| `nextHumanDecision` | Exact decision needed from Vambah or captain. | Must be one concrete decision, not broad approval. |

## Provenance contract

```ts
type AutoResearchProvenance = {
  sourceId: string
  sourceType: 'public_post' | 'public_video' | 'public_profile' | 'portfolio_proof' | 'campaign_packet' | 'review_packet' | 'manual_note'
  urlOrPath: string
  capturedAt: string
  visibleSignalBasis?: string
  transferablePattern: string
  internalProofSurface?: string
  confidence: 'low' | 'medium' | 'high'
}

type SourceDistanceReview = {
  status: 'pending' | 'approved' | 'blocked' | 'manual_review'
  allowedPatternUse: string
  disallowedReuse: string[]
  privacyNotes: string
  rightsNotes: string
  reviewerLane?: 'Amina' | 'Moremi' | 'Nefertiti' | 'Shaka' | 'human'
}
```

Public research can inform structure, hook type, format, proof placement, CTA shape, cadence, visual grammar, and audience signal. It cannot supply copied language, thumbnails, distinctive visual identity, catchphrases, proprietary assets, private analytics, or unsupported claims.

## Channel variant contract

```ts
type ChannelVariantRecommendation = {
  channel: 'linkedin' | 'x' | 'youtube' | 'youtube_shorts' | 'instagram' | 'instagram_reels' | 'facebook' | 'tiktok' | 'manual'
  recommendedFormat:
    | 'text_post'
    | 'thread'
    | 'carousel'
    | 'single_image'
    | 'short_form_video'
    | 'long_form_video'
    | 'thumbnail'
    | 'manual_review_packet'
  channelFit: 'strong' | 'medium' | 'weak' | 'blocked'
  fitReason: string
  hookHypothesis: string
  proofPlacement: string
  ctaRole: 'conversation' | 'save_share' | 'follow' | 'release_url' | 'playlist' | 'consultation' | 'manual_review' | 'none'
  visualNeeds: VisualNeed[]
  hashtagNeeds?: HashtagNeed
  publishWindowHypothesis?: string
  providerBoundary: 'internal_only' | 'provider_setup_required' | 'render_gate_required' | 'upload_gate_required' | 'publish_gate_required'
  manualState?: 'needs_source_review' | 'needs_copy_review' | 'needs_visual_review' | 'needs_final_submit_approval' | 'manual_hold'
}

type VisualNeed = {
  kind: 'thumbnail' | 'b_roll' | 'carousel' | 'screenshot' | 'cover_frame' | 'caption_card' | 'alt_text' | 'none'
  description: string
  sourceAssetPath?: string
  rightsState: 'approved_source' | 'needs_audit' | 'needs_generation_qa' | 'blocked'
}

type HashtagNeed = {
  strategy: 'linkedin_3_to_5' | 'instagram_3_to_5' | 'x_minimal' | 'youtube_metadata' | 'none'
  candidateTags: string[]
  reviewState: 'draft' | 'approved' | 'blocked'
}
```

Channel guidance:

| Channel | Fit signal | Common needs |
| --- | --- | --- |
| LinkedIn | Strong when the idea needs a concrete scene, operating lesson, proof, and discussion CTA. | First-210-character hook, 3-5 hashtags, proof/source placement, comment question. |
| X | Strong when the idea can become a compact tension post, mini-thread, proof artifact thread, or release thread. | Thread structure, tight CTA timing, minimal hashtags, source-distance note. |
| YouTube | Strong when the idea needs operating proof, B-roll, dashboard walkthrough, or workbook explanation. | Title, thumbnail promise, script, B-roll/redaction plan, playlist/channel gate. |
| YouTube Shorts | Strong when the idea can be taught in 35-55 seconds with one tension, one proof cue, one rule, and one viewer action. | Cold open, captions, proof cuts, avatar/voice approval. |
| Instagram | Strong when the idea is saveable or visual: carousel, single-image proof, or release post. | Carousel outline, caption, visual direction, hashtags, Meta boundary. |
| Instagram Reels | Strong only when motion, avatar, or B-roll improves proof. | Rights-cleared B-roll, caption card, render/privacy gate. |
| Facebook | Strong as a companion Page post for release, proof, or community-oriented explanation. | Direct caption, CTA clarity, visual reuse, Meta boundary. |
| TikTok | Future/manual only until a provider path and channel strategy are approved. | Short-form video hypothesis, hook, proof cue, rights and platform review. |
| Manual | Use when the idea should remain a review packet, workshop prompt, newsletter seed, or human-only content note. | Exact next decision and blocked/manual state. |

## Amina conversion workflow

Amina converts research evidence into backlog rows through this sequence:

1. Source basis: cite existing packet paths and public evidence IDs. If evidence is missing, set `status: 'research_candidate'` and `blockedReason: 'source_basis_missing'`.
2. Target-avatar and campaign fit: name the avatar, campaign slug, and phase. If the item does not fit the current campaign, keep it in the reusable backlog rather than forcing it into Agentified.
3. Source-distance review: record transferable pattern, disallowed reuse, privacy notes, and rights notes. If uncertainty remains, set `sourceDistance.status: 'manual_review'`.
4. Channel-fit recommendation: create one or more channel variants with fit reason, format, CTA role, visual needs, hashtag needs, and provider boundary.
5. Draft packet handoff: only after the source, avatar, source-distance, and channel-fit fields are complete can a variant move to `draft_packet_ready`.
6. Human review: Nefertiti reviews voice/public claims where copy exists; Moremi reviews source-distance/privacy; Shaka prioritizes campaign and publishing authority; Vambah approves named human gates.
7. Internal handoff: approved items can link to Social Content, campaign calendar, work items, or manual packets. External execution remains locked.

## Sequential gates

Use these gates in order. A later pass cannot repair an earlier missing gate.

| Gate | Pass condition | Allowed next action |
| --- | --- | --- |
| Source basis | Public evidence or internal proof path exists and is linked. | Analyze pattern and avatar fit. |
| Copy | Draft copy or script packet exists with voice and claim checks. | Route to source-distance/privacy review. |
| Visual/media | Visual direction, B-roll, thumbnail, carousel, screenshot, or no-visual rationale is recorded. | Route to rights/privacy review. |
| Privacy/rights | Source-distance, private-data boundary, rights, and platform terms are approved or blocked. | Prepare internal draft handoff. |
| Draft handoff | Social Content, campaign row, work item, or manual packet linkage is present. | Request final internal review. |
| Final submission | Human explicitly approves the exact channel/item for provider preparation. | Prepare provider packet only. |
| Provider execution | Separate current approval exists for the named provider action. | Execute only that named action. |
| Status reconciliation | Post-action status and evidence are recorded. | Start post-release signal windows. |

Blocked/manual states:

- `blocked_source_basis_missing`
- `blocked_source_distance`
- `blocked_privacy_or_rights`
- `blocked_visual_asset`
- `blocked_cta`
- `blocked_provider_setup`
- `blocked_external_approval`
- `manual_hold`
- `directional_insufficient_sample`

## Learning-loop contract

Every released item that enters learning review needs two windows.

| Window | Use | Output |
| --- | --- | --- |
| 24-48 hour directional review | Early read on hook resonance, visible conversation quality, obvious packaging issues, first comments, saves/shares where available, view-to-follower signal where visible, and CTA friction. | `directional_signal` or `directional_insufficient_sample`. No winner, loser, saturation, or final lesson. |
| Seven-day decision review | Decision-grade review for repeat, revise, pause, scale, or supersede. | `decision_grade` only when the packet cites metric window, visible sample basis, source-distance notes, confidence, and first-party/public basis. Otherwise keep `directional_insufficient_sample`. |

```ts
type PostReleaseSignalPlan = {
  directionalWindow: '24_48h'
  decisionWindow: 'seven_day'
  baselineComparison: string
  benchmarkComparison?: string
  visibleSampleBasis: string
  trackedSignals: Array<
    | 'hook_resonance'
    | 'comment_quality'
    | 'saves'
    | 'shares'
    | 'reposts'
    | 'profile_visits'
    | 'watch_time'
    | 'retention'
    | 'thumbnail_ctr'
    | 'hashtag_discovery'
    | 'cta_clicks'
    | 'manual_replies'
  >
}

type ImprovementRecommendation = {
  recommendationState: 'draft' | 'directional_signal' | 'directional_insufficient_sample' | 'decision_grade' | 'blocked'
  reviewWindowUsed: '24_48h' | 'seven_day'
  changeType:
    | 'cta'
    | 'thumbnail'
    | 'hashtags'
    | 'b_roll'
    | 'hook'
    | 'format'
    | 'proof_placement'
    | 'source_placement'
    | 'publish_window'
    | 'target_avatar'
    | 'pause_or_supersede'
  recommendation: string
  evidenceBasis: string
  confidence: 'low' | 'medium' | 'high'
  nextTest?: string
}
```

Change one main variable per next release when practical: CTA, thumbnail, hashtags, B-roll, hook, format, proof placement, source placement, target avatar, or publish window.

Examples:

| Signal | Recommendation field |
| --- | --- |
| Strong comments but weak CTA movement | `changeType: 'cta'`; test a more specific question or approved release URL placement. |
| Good watch starts but weak retention | `changeType: 'b_roll'`; move real Portfolio proof earlier and shorten presenter-only segments. |
| Weak YouTube packaging signal | `changeType: 'thumbnail'`; revise promise, face/proof balance, or title-thumbnail alignment. |
| Instagram saves outperform comments | `changeType: 'format'`; repeat carousel structure and make the save/share CTA clearer. |
| X replies ask for implementation detail | `changeType: 'proof_placement'`; add a receipt, workflow, or source screenshot in the next thread. |
| LinkedIn reach is fine but audience is broad | `changeType: 'target_avatar'`; sharpen toward product operators, nonprofit leaders, or founder-builders. |
| Early window has too little data | `recommendationState: 'directional_insufficient_sample'`; wait for seven-day review or run a manual qualitative review. |

## Backlog-to-release linkage

Recommended linkage order:

1. Backlog item: one source-backed idea.
2. Channel variant: one recommended channel/format for that idea.
3. Draft packet: copy, script, visual direction, or manual packet for review.
4. Campaign calendar item: optional schedule planning row with `authorization_status: pending`.
5. Social Content draft: internal governed draft only after approval.
6. Provider packet: only after final submission approval.
7. External execution: only after separate provider approval.
8. Signal packet: directional and seven-day learning record.
9. Improvement recommendation: next-release input linked back to the original item.

For Agentified, existing IDs such as `AGT-X-01`, `AGT-YT-EP01`, `AGT-IG-01`, and `AGT-LI-*` remain the campaign anchors. New rows should link to those anchors or clearly explain why a new manual backlog item is needed.

## Future implementation slice

This docs-only slice intentionally avoids shared runtime surfaces. A safe next implementation can add:

- a typed model in an isolated `lib/*autoresearch-backlog*` module;
- fixtures that reference existing packet paths instead of copying packet bodies;
- tests proving gate ordering, blocked/manual states, source-distance requirements, and no external side effects;
- an admin read-only projection that shows backlog item, channel variants, gates, and learning windows;
- import logic only after captain sequencing confirms no conflict with Social Content, calendar, provider, or migration lanes.

Acceptance criteria for that slice:

- sample rows reference existing research packets and campaign IDs;
- source-distance is required before draft handoff;
- `approved_for_internal_handoff` does not grant provider execution;
- `24_48h` recommendations cannot become decision-grade;
- seven-day recommendations require visible sample basis and confidence;
- blocked states remain fail-closed;
- no provider, Slack, cron, migration, publish, schedule, or upload action can run from the backlog contract.

## Roadmap status

Completed in this packet:

- Unified the existing LinkedIn, X, YouTube, Instagram, Facebook, visual, voice, and campaign packets into one cross-channel backlog contract.
- Defined backlog item, channel variant, provenance, source-distance, visual/media, hashtag, signal-window, improvement, gate, and blocked/manual state fields.
- Kept Amina's conversion path public-safe, provenance-linked, and draft-only.

Next:

- Review this contract against the active Social Content and Content Intelligence surfaces.
- After captain sequencing, implement a small isolated typed model and focused tests.
- Then add a read-only admin projection before any import, cron, provider, or production mutation path.

Decision gate:

- This packet approves no external publishing, scheduling, provider execution, Slack send, production mutation, or migration.
