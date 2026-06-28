# LinkedIn AutoResearch loop

Status: Operating spec
Date: 2026-06-28
Lane: Portfolio Content Strategy
Channel: LinkedIn first
Mode: Human gated
Success frame: Relative lift

## Purpose

This loop turns outside content signals into review-ready LinkedIn strategy without publishing, scheduling, sending, provider generation, or production queue mutation.

The loop should answer one practical question before a draft moves forward:

Can Vambah add a useful, specific perspective to a topic that is already proving traction with comparable creators?

If the answer is yes, Content Strategy can prepare a draft packet. If the answer is no, the topic returns to the backlog with the reason recorded.

## Loop summary

1. Build a comparable creator cohort.
   - Start with creators whose content overlaps Vambah's AI, product, access, nonprofit capacity, equity, consulting, and builder-operator themes.
   - Prefer creators with a similar audience size or a clear adjacent audience over large accounts with weak audience fit.
   - Record platform, handle, follower or subscriber band, topic lanes, and the reason the creator belongs in the cohort.

2. Detect outlier content.
   - Compare each candidate post against that creator's normal performance when data is available.
   - Mark outliers by relative performance, retention cues, comment quality, and topic fit.
   - Capture the hook, structure, proof move, CTA, comment pattern, and any visible format choice.

3. Cross-reference Vambah's corpus and current Portfolio themes.
   - Use the personality corpus, LinkedIn voice guidance, and approved Portfolio proof surfaces to test whether Vambah has a real angle.
   - Score for lived credibility, operating proof, public-safe source support, audience fit, and campaign fit.
   - Reject topics that require private client details, unsupported claims, sensitive personal disclosure, or generic AI commentary.

4. Prepare a review-ready draft packet.
   - Borrow structure only when it is useful: hook shape, pacing, proof placement, question design, or retention pattern.
   - Keep the argument in Vambah's voice: concrete scene, system diagnosis, practical path, and a specific closing question.
   - Route the packet through Nefertiti for voice and public-claim review, then Shaka for campaign priority and publishing authority.

5. Evaluate after release.
   - Compare performance against Vambah's recent baseline and the benchmark creator's outlier.
   - Track relative lift, comment quality, saves, shares, profile visits when available, and CTA movement.
   - Record what changed: topic, hook, proof, format, CTA, publish window, or audience segment.

6. Continue or stop.
   - Continue while the topic still produces new angles, useful engagement, and clear learning.
   - Slow down when Vambah's content reaches comparable traction, the topic starts repeating, or audience response weakens.
   - Stop when the market feels saturated, the evidence gets stale, or the next draft would only mimic the benchmark.

## Approval states

| State | Meaning | Allowed action |
| --- | --- | --- |
| `research_candidate` | A creator, post, or topic may be worth reviewing. | Capture public evidence and comparison notes. |
| `outlier_confirmed` | The candidate appears to outperform its normal context. | Build a pattern summary and topic hypothesis. |
| `unique_angle_found` | Vambah has a public-safe, source-supported perspective. | Create a draft packet for review. |
| `human_review_ready` | The packet passed voice, source, privacy, and benchmark checks. | Route to Nefertiti and Shaka. |
| `approved_for_internal_handoff` | Human approval allows Portfolio internal handoff. | Link to a Social Content draft or work item. |
| `publish_ready` | Human explicitly approved publishing prep. | Prepare the external publishing packet only. |
| `blocked` | Evidence, angle, source, privacy, or CTA has a gap. | Stop and record the needed decision. |

`publish_ready` does not grant permission to publish. External scheduling, posting, sending, upload, and provider generation still require explicit approval.

## Evidence packet

Each research packet should preserve raw public evidence separately from derived analysis.

Required fields:

- source URL
- platform and channel
- creator name and handle
- follower or subscriber band, if visible
- topic lane
- post title or hook
- post format
- visible metrics and capture date
- benchmark reason
- outlier reason
- hook and retention structure
- comments or audience signal summary
- privacy and source boundary
- recommended next action

Derived analysis should include:

- why this topic is relevant to Vambah's audience
- what the creator's structure appears to do well
- what Vambah can add that is not a copy of the source
- which proof surface supports the angle
- what would make the topic blocked

## Unique-angle rubric

| Check | Pass condition |
| --- | --- |
| Voice fit | The idea can start from a real scene, tension, or practical operating problem. |
| Credibility | Vambah has lived, product, advisory, builder, or community context that supports the point. |
| Proof | Portfolio, AmaduTown, Accelerated, or public sources can support the claim without private data. |
| Audience value | The post helps product leaders, operators, consultants, founders, nonprofits, or equity-centered technologists make a better decision. |
| Difference | The angle adds a new operating lesson, moral frame, or practical path instead of repeating the benchmark. |
| CTA fit | The close can invite a specific conversation or approved offer path. |

If any check fails, mark the packet `blocked` or return it to the topic backlog with the failure reason.

## Draft construction rules

- Use the benchmark's structure as a reference, not a script.
- Keep Vambah's first 210 characters focused on tension, scene, or a sharp practical question.
- Translate the topic into plain language before adding a framework.
- Tie critique to an action the reader can take.
- Keep personal details public-safe and necessary to the point.
- Avoid generic AI hype, abstract authority language, formulaic signposting, and negative antithesis patterns.
- Keep hashtags to the LinkedIn voice guidance range after human review.

## Performance review

Review released content at the end of the evaluation window chosen for the channel.

Compare against:

- Vambah's recent LinkedIn baseline
- the specific benchmark post
- the creator's normal performance band, when available
- the intended campaign goal

Record:

- absolute metrics available from the platform
- relative lift versus Vambah's baseline
- relative gap versus the benchmark
- comment quality and audience signal
- hook performance notes
- format performance notes
- CTA or offer movement
- recommended next test

The next loop should change one main variable when possible: topic, hook, proof source, format, CTA, or publish window.

## Saturation and equivalence thresholds

Treat saturation as a decision point, not a failure.

The loop should slow down or stop a topic when one of these is true:

- three consecutive attempts show declining relative lift
- comments repeat the same point without new audience signal
- new benchmark posts no longer add distinct structure or insight
- Vambah's post reaches comparable traction and the next move should shift from imitation pressure to owned thought leadership
- the topic needs claims or proof that are not public-safe

Once Vambah has enough released content with clear overperformance, use his own winning posts as the first template source. External benchmarks become secondary references.

## Queue-aware implementation boundary

This packet is intentionally docs-first because active PRs are touching the existing Social Content and Content Intelligence surfaces.

Future code should prefer isolated additions first:

- a loop service that reads existing research packets, topic backlog entries, and engagement summaries
- a cron or admin review endpoint that writes proposed review packets only
- tests that prove no publishing, scheduling, provider generation, or send action can happen from the loop

Avoid changing existing content intelligence UI, social channel workflow routes, campaign content plan routes, or shared calendar services until the Integration Captain sequences the active queue.

## Roadmap status

Completed in this packet:

- Defined the LinkedIn-first AutoResearch loop.
- Added comparable creator, outlier, unique-angle, draft, evaluation, and saturation rules.
- Preserved approval gates and the no-publishing boundary.

Next:

- Integration Captain can merge this spec without sequencing code conflicts.
- After the active queue clears, implement the loop through isolated service and review-packet endpoints.

Decision gate:

- No external publishing, scheduling, provider generation, or production queue mutation is approved by this packet.
