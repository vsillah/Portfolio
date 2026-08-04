# Agentified YouTube review package

Date: 2026-08-04
Status: internal review package, not approved for render
Owner: Amina (Strategic Narrative)
Campaign: `agentified-trust-scale-2026-07`
Destination target: AmaduTown YouTube channel, Agentified playlist

## Boundary

This package turns the approved Agentified YouTube research direction into reviewable script and asset requirements for the YouTube lane.

Allowed from this package:

- review script, storyboard, caption, and B-roll requirements;
- confirm avatar, channel, playlist, and calendar metadata;
- prepare internal asset-capture work;
- run source, voice, privacy, and visual-readiness QA.

Not allowed from this package:

- HeyGen render;
- ElevenLabs generation;
- YouTube provider draft creation;
- YouTube upload, schedule, or publish;
- paid provider asset generation;
- external campaign or calendar mutation.

## Batch metadata

| Item | Campaign phase | Format | Calendar relationship | Current gate |
| --- | --- | --- | --- | --- |
| `AGT-SHORT-01` | Teach | YouTube Short | Same Agentified campaign calendar | Script and asset review |
| `AGT-SHORT-02` | Proof | YouTube Short | Same Agentified campaign calendar | Cover rights and asset review |
| `9f9dd8f1-9d19-48ff-bedf-2a5779a44be8` | Long-form pilot | Episode 1 | Same Agentified campaign calendar | Reuse pending queue item |

Resolved operator decisions:

- use the AmaduTown YouTube channel;
- target the Agentified playlist after provider setup verifies the playlist exists;
- approve a usable HeyGen avatar pool once, then rotate across approved avatars so the batch does not reuse the same presenter by default;
- keep the Shorts and long-form episode in the Agentified campaign calendar;
- reuse Episode 1 queue item `9f9dd8f1-9d19-48ff-bedf-2a5779a44be8`.

## Avatar rotation rule

Vambah does not need to choose a unique avatar for each release. The workflow should use `https://app.heygen.com/avatar/my-avatars` to confirm a usable pool of approved HeyGen avatars, then assign avatars by rotation.

Rotation policy:

1. Use only avatars that Vambah has approved for AmaduTown and Agentified content.
2. Do not use the same avatar on consecutive Agentified YouTube publications when two or more approved avatars are available.
3. Record the assigned avatar name or stable non-secret identifier in the render packet for each item.
4. Let Amina choose the next avatar in rotation unless a script, format, or brand-fit issue requires a human override.
5. If only one avatar is usable, stop at the render gate and ask whether to proceed with a repeat or expand the avatar pool.

The rotation assignment is a production-prep decision only. It does not authorize HeyGen rendering, YouTube provider work, upload, scheduling, or publishing.

## Source basis

| Source | Use |
| --- | --- |
| `agentified/campaign/portfolio-campaign-packet.json` | Campaign item IDs, phase metadata, planned angles, and authorization boundary. |
| `agentified/campaign/draft-assets.md` | Source script material for `AGT-SHORT-01` and `AGT-SHORT-02`. |
| `docs/agentic-content-video-scripts/agentified-youtube-amina-research-to-video-packet.md` | Amina research-to-video strategy, public pattern scan, destination decisions, and QA gate. |
| `docs/agentic-content-video-scripts/wave-1-youtube-scripts.md` | Episode 1 pilot script and storyboard source. |
| `docs/content-strategy/agentic-book-rollout-campaign-plan.md` | Whisper-to-shout campaign structure and approval path. |
| `agentified/manuscript/production-draft/chapters/ch01-the-first-receipt.md` | Long-form receipt concept and operating-system source context. |
| `agentified/manuscript/visuals/agentified-sam-trust-layer-diagrams.md` | Visual vocabulary for source, receipt, gate, eval, and proof. |

## Batch QA rules

Every item must pass these checks before provider render or upload is considered:

| Gate | Pass condition |
| --- | --- |
| Source basis | The script points to Agentified, Portfolio, or approved campaign material. |
| Voice | The language sounds like Vambah explaining an operating discipline, not a generic AI explainer. |
| Humanizer pass | Remove filler hype, empty antithesis, over-polished pacing, and vague AI authority language. |
| Visual suitability | B-roll or design assets are named, public-safe, and tied to the argument. |
| Rights and privacy | Screens, cover assets, book assets, captions, and B-roll are cleared before public render. |
| Avatar readiness | Approved HeyGen avatar pool is confirmed, the current item avoids unnecessary consecutive repetition, and Amina records the rotation-selected avatar before render approval. |
| Accessibility | Captions and on-screen text are prepared for mobile viewing. |
| Calendar linkage | The item maps to the Agentified campaign calendar and the next sequence trigger stays explicit. |

## AGT-SHORT-01: Agentic work needs an operating system

Format: YouTube Short
Phase: Teach
Target duration: 40-55 seconds
Destination: AmaduTown YouTube channel, Agentified playlist
Source calendar item: `AGT-SHORT-01`
Planned angle: short spoken frame on permissions, receipts, review, gates, and drift

### Script

```text
Most teams are asking the wrong question about agents.

They ask, "What can this agent do?"

The better question is this:

What does this agent have permission to do?

And how will we know if it did the work well?

That is the difference between speed and trust.

If an agent drafts a product brief, routes a customer issue, edits code, or prepares a recommendation, the output is only part of the job.

You still need the receipt.

What was the source?
What changed?
Who reviewed it?
Where was the approval gate?
What happens if the agent drifts?

That is why I am writing Agentified.

The goal is agentic scale through trust.

Agents can help us move faster.

Product leaders still have to design the operating system that makes the work worthy of trust.

Follow the Agentified release at https://amadutown.com/agentified
```

### Storyboard

| Beat | Visual | Notes |
| --- | --- | --- |
| 1 | rotation-selected approved HeyGen avatar, direct-to-camera | Cold open with the wrong-question framing. |
| 2 | Simple on-screen split: "Can it do it?" vs. "Should it do it?" | Keep text large enough for mobile. |
| 3 | Portfolio-style receipt flow: source -> change -> reviewer -> gate -> drift check | Use diagram or redacted admin proof, not private data. |
| 4 | Five caption cards: Source, Change, Review, Gate, Drift | Each card gets one spoken line. |
| 5 | Agentified cover or workbook cue with `/agentified` CTA | End on the release path. |

### Asset requirements

| Asset | Requirement | Status |
| --- | --- | --- |
| Avatar | rotation-selected approved HeyGen avatar | Approved avatar pool and rotation assignment required before render. |
| Diagram | Source -> change -> review -> gate -> drift | Can be generated internally from brand-safe shapes. |
| Portfolio proof | Redacted Agent Ops receipt or approval-gate screen | Capture task required if used. |
| Cover/workbook cue | Approved Agentified cover or workbook visual | Rights/privacy review required. |
| Captions | Burned-in mobile captions | Prepare before render. |

### QA notes

- The script is public-safe and does not claim Portfolio is a finished autonomous enterprise platform.
- The proof standard is structural: show the path of work, not private run data.
- No external render or upload is approved by this script package.

## AGT-SHORT-02: What the cover is really showing

Format: YouTube Short
Phase: Proof
Target duration: 45-60 seconds
Destination: AmaduTown YouTube channel, Agentified playlist
Source calendar item: `AGT-SHORT-02`
Planned angle: explain the cover as inspectable machinery for trusted agentic work

### Script

```text
The Agentified cover is not trying to show AI as magic.

It is trying to show AI as machinery.

At the center is movement:

work being sensed,
routed,
acted on,
and measured.

Around that movement are the things that make agentic work trustworthy.

Receipts.
Controls.
Gates.
Audit loops.

That is AMINA.

Align the work.
Map authority.
Instrument receipts.
Negotiate gates.
Audit outcomes.

Accelerated gave me the SAM loop.

Agentified asks how that loop changes when agents start carrying more of the work.

My answer is simple:

scale the work through trust, or the speed will eventually outrun the system.

Follow the Agentified release at https://amadutown.com/agentified
```

### Storyboard

| Beat | Visual | Notes |
| --- | --- | --- |
| 1 | Slow push-in on approved Agentified cover | Open with the cover as machinery. |
| 2 | Motion overlay around the center: sense, route, act, measure | Keep motion simple and readable. |
| 3 | Four proof labels: Receipts, Controls, Gates, Audit loops | Labels should appear one at a time. |
| 4 | AMINA acronym card | Spell out all five words on first use. |
| 5 | rotation-selected approved avatar close or cover/workbook close | CTA to `/agentified`. |

### Asset requirements

| Asset | Requirement | Status |
| --- | --- | --- |
| Agentified cover | Approved cover comp or current production cover | Rights and final-cover check required. |
| AMINA card | Align, Map, Instrument, Negotiate, Audit | Must match manuscript terminology. |
| SAM/AMINA bridge | Optional diagram if legible in portrait | Use only if it does not crowd the Short. |
| Avatar | rotation-selected approved HeyGen avatar | Approved avatar pool and rotation assignment required before render. |
| Captions | Mobile captions with acronym expansion | Prepare before render. |

### QA notes

- The cover visual must be approved for public use before render.
- AMINA wording must match the manuscript and Open Brain terminology.
- Avoid dense diagramming. This Short should make the cover intelligible, not turn it into a lecture slide.

## Episode 1: The Receipt Every Agent Needs

Format: YouTube long-form pilot
Target duration: 3-5 minutes
Destination: AmaduTown YouTube channel, Agentified playlist
Queue item: `9f9dd8f1-9d19-48ff-bedf-2a5779a44be8`
Current queue status: pending
Source title: `The Receipt Every Agent Needs`

### Script source

Use `docs/agentic-content-video-scripts/wave-1-youtube-scripts.md#episode-1-the-receipt-every-agent-needs` as the source script. The queue item already exists and should be edited or approved in place. Do not create a duplicate Episode 1 draft.

The opening line stays:

```text
The first thing I built around agents was the receipt.
```

### Review treatment

The pilot should feel like a practical field note from the system Vambah is building.

Keep these beats:

1. The receipt comes before autonomy.
2. The impressive demo skips the hardest review questions.
3. Portfolio proof surfaces show runs, steps, events, artifacts, approvals, costs, work items, Mission Control, Slack unblocks, and client-safe audit paths.
4. Small businesses, nonprofits, community teams, and overloaded operators need clarity, not another tool to babysit.
5. The receipt turns agentic output into something a human can inspect.

Tighten before render:

- reduce repeated setup around demos;
- make the receipt checklist visually explicit;
- keep the CTA connected to the Agentified release and workbook;
- keep private examples abstract and structural.

### Storyboard

| Scene | Visual | B-roll requirement |
| --- | --- | --- |
| 1 | rotation-selected approved HeyGen avatar opens with the receipt line | No B-roll required. |
| 2 | Simple animation: prompt -> tool -> output -> receipt | Internal diagram can be generated. |
| 3 | Redacted Portfolio Agent Ops proof surface | Capture only public-safe structure. |
| 4 | Receipt checklist: source, tool, handoff, approval, cost, outcome | Large text, high contrast. |
| 5 | Agentified cover or workbook frame with CTA | Rights and final visual approval required. |

### Asset requirements

| Asset | Requirement | Status |
| --- | --- | --- |
| Queue item | Reuse `9f9dd8f1-9d19-48ff-bedf-2a5779a44be8` | Existing pending item. |
| Avatar | rotation-selected approved HeyGen avatar | Approved avatar pool and rotation assignment required before render. |
| Portfolio B-roll | Redacted Agent Ops, Mission Control, Kanban, or run detail screens | Capture and privacy review required. |
| Diagram | Prompt -> tool -> trace -> approval -> audit summary | Can be generated internally. |
| Cover/workbook | Approved Agentified cover or workbook frame | Rights/privacy review required. |
| Captions | Full captions and YouTube description notes | Prepare before upload approval. |

### Description draft

```text
The first Agentified video starts with the receipt.

Before an agent earns more authority, the work has to be reviewable: source, tool, handoff, approval, cost, and outcome.

Follow the Agentified release:
https://amadutown.com/agentified
```

### Tags and metadata

Suggested tags:

- agentic AI
- AI operations
- product management
- AI governance
- AmaduTown
- Agentified

Playlist target:

- Agentified

Audience:

- Product leaders, operators, founders, nonprofit leaders, and business builders who want AI systems that can be trusted in real work.

## Human decisions still required

| Decision | Applies to | Required before |
| --- | --- | --- |
| Approve HeyGen avatar pool and rotation assignment | All three items | Any HeyGen render. |
| Confirm Agentified playlist exists or authorize setup | All three items | Any YouTube upload. |
| Approve cover/workbook public use | `AGT-SHORT-02`, Episode 1 | Any public render or upload. |
| Approve redacted Portfolio B-roll | `AGT-SHORT-01`, Episode 1 | Any public render or upload. |
| Approve script batch | All three items | Render packet. |
| Approve visual and privacy packet | All three items | Provider handoff. |
| Approve YouTube submission | All three items | Upload, schedule, or publish. |

## Next allowed action

Amina may move these three items into an internal review state for script, storyboard, B-roll, and asset-packet preparation.

Stop before provider render approval. HeyGen, ElevenLabs, YouTube provider draft creation, upload, scheduling, and publication remain separate explicit gates.
