# Agentic AI Video Scripts: Wave 1

Date: 2026-05-27
Status: Draft for video review
Source LinkedIn wave: `docs/agentic-content-linkedin-drafts/wave-1-drafts.md`
Recommended pilot: Episode 1, "The Receipt Every Agent Needs"

## Production Guardrails

- No video generation job has been started.
- No ElevenLabs audio job has been started.
- No script has been inserted into `video_ideas_queue`.
- Every script is designed to stay under the HeyGen 5,000-character limit.
- Every storyboard uses 3-6 scenes and B-roll hints that fit the existing admin video-generation matching model.
- Public claims stay inside the accepted research boundary: Portfolio is a live operating discipline and proof surface, not a finished autonomous enterprise platform.

## Shared Delivery Notes

Format: YouTube / LinkedIn video, 3-5 minutes.

Primary style: direct-to-camera HeyGen avatar with screen-recorded Portfolio B-roll and simple diagrams.

Voice: conversational, mission-driven, no-BS. The rhythm should feel like Vambah explaining the system to a founder, product leader, or nonprofit executive who wants AI to be useful without creating new risk.

HeyGen mode: Template mode preferred with AmaduTown brand voice. Avatar fallback is acceptable if template defaults are unavailable.

ElevenLabs use: optional for audio-only social cutdowns after the final script is approved. Keep ElevenLabs separate from the primary HeyGen generation flow unless the operator deliberately chooses a native audio composite.

## Episode 1: The Receipt Every Agent Needs

LinkedIn source: Draft 1, "The Receipt"
Purpose: Launch the series and explain why traceability comes before autonomy.
Recommended status: Pilot episode

### Spoken Script

The first thing I built around agents was the receipt.

That sounds backwards, because most people start with the agent. The prompt. The tool call. The impressive demo where something happens in a browser and everybody leans forward.

I understand that instinct. I love that part too.

But the more I build with agents, the more I care about what happens after the model says yes.

Who asked it to act? Which tool did it touch? What evidence did it use? Where did the output go? Did it cost money? Did it cross a line that should have required approval?

That is the part most demos skip.

Inside my Portfolio site, I have been building Agent Ops more like an operating room than a magic trick. There are runs, steps, events, artifacts, handoffs, approvals, costs, work items, Mission Control, Slack unblocks, and a client-safe audit path.

Some of that sounds boring.

Good.

Because the real product is not the moment an agent does something impressive. The real product is the confidence to review what happened, explain why it happened, and decide whether the system deserves more authority next time.

That matters for the organizations I care about.

Small businesses. Nonprofits. Community teams. Operators who already have too much work on their plate.

They are being sold the most abstract version of innovation. More tools. More dashboards. More promises. More work to manage the work.

Agents should move in the opposite direction.

They should make invisible work visible. They should turn activity into evidence. They should give the operator enough clarity to say yes, no, pause, or route this somewhere else.

That is why I keep coming back to the receipt.

If an agent recommends something, show the source.

If it touches a tool, show the tool.

If it hands work to another agent, show the handoff.

If it needs approval, stop and ask.

If it costs money, tie the cost to the run.

If a client needs proof, give them a safe summary instead of raw private logs.

This is the part of agentic AI that will separate toys from systems.

Models will get smarter. Tools will get easier. More people will be able to wire together workflows that looked impossible a year ago.

That is good.

But speed without a receipt becomes a new kind of chaos.

So I am building the receipt first.

The agent can get smarter later.

The operating discipline has to come now.

Let's get it.

### Storyboard

| Scene | Visual Beat | B-roll hint |
| --- | --- | --- |
| 1 | Direct-to-camera opening: "The first thing I built around agents was the receipt." | home |
| 2 | Quick cuts of Agent Ops concepts: run, step, event, artifact, approval, cost. Use simple labels over a dark admin-style background. | admin |
| 3 | Mission Control or Agent Ops dashboard as proof surface. Slow pan or zoom, no private content exposed. | admin |
| 4 | Diagram: model output flows into trace, approval, handoff, and audit summary. | tools |
| 5 | Closing direct-to-camera with a simple receipt checklist on screen. | resources |

### Queue Packet

Title: `The Receipt Every Agent Needs`

Channel: `youtube`

Aspect ratio: `16:9`

Suggested custom prompt for Admin Video Generation from_direction mode:

```text
Polish this script only for spoken rhythm. Preserve the argument, first-person voice, public-safe claim boundaries, and proof references. Keep it under 5,000 characters. Create a 5-scene storyboard with brollHint values: home, admin, admin, tools, resources.
```

## Episode 2: The Swarm Needs A Handoff

LinkedIn source: Draft 2, "The Swarm Needs A Handoff"
Purpose: Explain why multi-agent systems need operating design, not a pile of worker agents.

### Spoken Script

A swarm is not a room full of agents talking.

It is an operating model.

That distinction matters because right now it is easy to spin up a research agent, a writing agent, a critic, a reviewer, and a few tool-using assistants. The demo looks alive because every part is producing output.

Then the real questions show up.

Who owns the next step?

Which agent can touch client context?

What happens when two agents disagree?

Who stops the work when the risk changes?

Where does the handoff live?

This is where a swarm becomes useful or noisy.

In my own Agent Ops build, I am treating the swarm like an organization. Shaka is the Chief of Staff. Research has a lane. Content has a lane. Compliance has a lane. Integration has a lane.

Each agent needs a role. Each role needs a scope. Each handoff needs an output. Each risky action needs a gate.

That is less glamorous than saying the agents collaborate.

But collaboration without operating design becomes a meeting with no agenda.

I have been in enough rooms like that.

The loudest person leaves with the decision. The quietest risk goes unspoken. The follow-up gets assumed instead of assigned. Then a week later, everybody remembers the meeting differently.

Agent systems can recreate that same pattern at machine speed.

More output does not fix unclear ownership.

The real work is deciding which pattern fits the task.

Some work should be sequential. One agent researches, another drafts, another reviews, and the captain integrates.

Some work can run in parallel. Independent checks, independent source gathering, independent QA.

Some work needs a manager. That is Shaka's lane: route the request, check the risk class, name the owner, ask for evidence, and stop when the next step needs a human.

That is where product management and agent design start to overlap.

You need ownership.

You need decision rights.

You need a path from idea to output to review.

The technology is new. The operating problem is familiar.

A team without handoffs drops work.

An agent swarm without handoffs drops accountability.

Let's get it.

### Storyboard

| Scene | Visual Beat | B-roll hint |
| --- | --- | --- |
| 1 | Direct-to-camera opening with the line "A swarm is not a room full of agents talking." | home |
| 2 | Diagram of agents as disconnected circles producing output. | tools |
| 3 | Transition into an organization map: Shaka routes to research, content, compliance, integration. | admin |
| 4 | Handoff contract overlay: owner, output, evidence, risk, next gate. | module sync |
| 5 | Closing checklist: ownership, decision rights, review path. | resources |

### Queue Packet

Title: `The Swarm Needs A Handoff`

Channel: `youtube`

Aspect ratio: `16:9`

Suggested custom prompt:

```text
Convert this into a direct-to-camera YouTube script with a clean 5-scene storyboard. Preserve the Shaka controller framing, agent org-map metaphor, and the warning that output does not equal accountability. Keep it under 5,000 characters. Use brollHint values: home, tools, admin, module sync, resources.
```

## Episode 3: Memory Is A Governed Library

LinkedIn source: Draft 3, "Memory Is A Governed Library"
Purpose: Explain Open Brain and memory governance through a human, public-safe lens.

### Spoken Script

Agent memory should feel more like a governed library than a junk drawer.

That is where my thinking has landed.

A lot of AI products talk about memory like it is automatically good. The system remembers you. It remembers your work. It remembers your preferences. It gets more personal over time.

That can be useful.

It can also get messy fast.

What did it remember? Where did that memory come from? Was it a fact, an inference, or a private moment that should have stayed temporary? Who approved it as durable knowledge? Can it be corrected? Can it be kept out of public-facing content?

Those questions matter because I am building across several lanes at once.

Personal work. Client work. Public thought leadership. Community-centered advisory work. Product strategy. Automation experiments.

Those lanes cannot collapse into one pile of context.

So I have been treating Open Brain as the memory core.

Raw sources stay raw.

Events become records.

Useful patterns become proposals.

Approved memories become durable.

Public content only sees what is safe to project.

That structure may sound heavy until you imagine the alternative: an agent confidently blending private notes, client context, half-formed thoughts, and public claims because nobody gave memory a governance model.

I do not want AI that remembers everything.

I want AI that knows what deserves to become memory.

That is the difference between personalization and stewardship.

The communities I care about have had enough systems extract from them, mislabel them, and speak for them without consent.

If AI is going to remember, it should remember with provenance.

It should remember with boundaries.

It should remember in a way that can be challenged.

The future of agent memory cannot be "save everything and hope the model sorts it out."

The better path is source, proposal, approval, memory, projection.

That is how memory becomes useful without becoming careless.

Let's get it.

### Storyboard

| Scene | Visual Beat | B-roll hint |
| --- | --- | --- |
| 1 | Direct-to-camera opening with library/junk drawer contrast as on-screen text. | home |
| 2 | Three-lane diagram: raw source, approved memory, public projection. | tools |
| 3 | Open Brain admin surface or synthetic memory graph, avoiding private content. | admin |
| 4 | Close-up diagram of "source -> proposal -> approval -> memory -> projection." | resources |
| 5 | Closing line over a clean library-style memory card visual. | about |

### Queue Packet

Title: `Memory Is A Governed Library`

Channel: `youtube`

Aspect ratio: `16:9`

Suggested custom prompt:

```text
Polish for spoken YouTube delivery while preserving the Open Brain memory governance model: source, proposal, approval, memory, projection. Keep private and client-data boundaries explicit without referencing private examples. Keep under 5,000 characters. Use brollHint values: home, tools, admin, resources, about.
```

## Episode 4: The Agent Promotion Board

LinkedIn source: Draft 4, "The Agent Does Not Get Promoted By Confidence"
Purpose: Turn evals into a practical management metaphor.

### Spoken Script

The agent does not get promoted because it sounded confident.

It gets promoted because the evidence held up.

That is the management model I keep coming back to as I build out Agent Ops.

We would never give a new employee production access because they spoke well in one meeting. We would give them a bounded task. Review the work. Watch how they handle edge cases. See whether they ask for help at the right moment.

Agents need the same discipline.

A good final answer is not enough.

I want to know how the work happened.

Did it choose the right tool?

Did it stay inside scope?

Did it route the work to the right owner?

Did it ask for approval when the task became sensitive?

Did it preserve the evidence?

Did the cost make sense for the value of the work?

That is why evals matter.

And I do not mean evals as a spreadsheet trophy. I mean evals as an operating loop.

The loop should tell us whether the agent needs a better prompt, a narrower tool, a clearer handoff, a stricter guardrail, or less authority.

That last one matters.

Sometimes the lesson is that the agent should do less.

That is uncomfortable because the market rewards bigger claims. More autonomy. More speed. More agents working while you sleep.

But in real operations, maturity often looks like restraint.

The system learns where it is strong. It learns where it is weak. Then the operator changes the boundary.

That is management.

So I think about agent evaluation like a promotion board.

The agent brings the work.

The trace brings the evidence.

The eval checks the behavior.

The operator decides what authority changes next.

Maybe the agent gets a wider lane.

Maybe it gets a narrower tool.

Maybe it stays advisory.

Maybe it stops.

That is how trust gets built.

The goal is not to create agents that always sound impressive.

The goal is to create systems that know when impressive is not enough.

Let's get it.

### Storyboard

| Scene | Visual Beat | B-roll hint |
| --- | --- | --- |
| 1 | Direct-to-camera opening: "The agent does not get promoted because it sounded confident." | home |
| 2 | Promotion-board visual: task, trace, eval, authority decision. | tools |
| 3 | Agent Ops evaluation or run evidence surface, redacted or synthetic. | admin |
| 4 | Boundary-change diagram: wider lane, narrower tool, advisory only, stop. | chat eval |
| 5 | Closing checklist: tool, scope, route, approval, evidence, cost. | resources |

### Queue Packet

Title: `The Agent Promotion Board`

Channel: `youtube`

Aspect ratio: `16:9`

Suggested custom prompt:

```text
Create a spoken YouTube script and 5-scene storyboard from this promotion-board metaphor. Preserve the distinction between final-answer quality and workflow behavior. Keep the script under 5,000 characters. Use brollHint values: home, tools, admin, chat eval, resources.
```

## Episode 5: Human Review Is The Trust Layer

LinkedIn source: Draft 5, "Human Review Is The Trust Layer"
Purpose: Explain approval boundaries for side effects.

### Spoken Script

Human review is the trust layer.

I have been thinking about that while building approval flows into my agent system.

There is a version of the AI future where humans become the annoying checkpoint. The slow part. The blocker. The person the system tries to route around so the automation can keep moving.

That future does not interest me.

The better version is more precise.

Let the system move quickly where the risk is low.

Pause when the work touches a client, a public channel, production data, money, private context, or someone else's reputation.

Then make the approval specific.

What action is being approved?

What evidence supports it?

Who owns the decision?

What happens if we reject it?

Where is the trace?

That is different from asking a human to babysit every step.

Human-in-the-loop should mean bringing the person in where judgment, consent, authority, or accountability matter.

That is how I am thinking about Agent Ops.

Publishing needs a gate.

Outbound email needs a gate.

Production writes need a gate.

Private-to-public movement needs a gate.

Payment authority needs an even stronger one.

The point is not to slow the system down.

The point is to let safe work move without pretending every action is safe.

That distinction matters inside real teams.

A vague approval process turns into theater. Everybody clicks yes because the request is unclear and the work has already moved too far.

A good approval flow gives the human a real decision.

Approve this action.

Reject it.

Ask for more evidence.

Route it to the right owner.

That is how AI becomes useful inside real organizations.

Speed where it is earned.

Human judgment where it is required.

If agents are going to operate near real customers, real money, real data, and real reputations, the approval layer has to be built into the system.

It cannot be a sticky note next to the demo.

Let's get it.

### Storyboard

| Scene | Visual Beat | B-roll hint |
| --- | --- | --- |
| 1 | Direct-to-camera opening: "Human review is the trust layer." | home |
| 2 | Risk ladder: low-risk work moves, sensitive work pauses. | tools |
| 3 | Approval packet visual: action, evidence, owner, reject path, trace. | admin |
| 4 | Side-effect gates: publishing, outbound email, production write, private-to-public, payment. | module sync |
| 5 | Closing principle: speed where earned, judgment where required. | resources |

### Queue Packet

Title: `Human Review Is The Trust Layer`

Channel: `youtube`

Aspect ratio: `16:9`

Suggested custom prompt:

```text
Polish this into a direct-to-camera YouTube script with a 5-scene storyboard. Preserve the approval-boundary framing for side effects. Keep under 5,000 characters. Use brollHint values: home, tools, admin, module sync, resources.
```

## Pilot Recommendation

Start with Episode 1.

Why: it introduces the entire series without requiring the viewer to already understand Shaka, Open Brain, evals, or approval gates. It also gives the clearest visual structure for a first video: receipt, trace, approval, handoff, cost, audit.

Publishing order:

1. The Receipt Every Agent Needs
2. The Swarm Needs A Handoff
3. Memory Is A Governed Library
4. The Agent Promotion Board
5. Human Review Is The Trust Layer

## Operator Checklist Before Generation

- Pick exactly one pilot script.
- Confirm no private admin data appears in B-roll.
- Confirm HeyGen template or avatar/voice defaults are configured in Admin -> Content -> Video Generation -> Settings.
- Confirm script remains under 5,000 characters after any edit.
- Confirm storyboard B-roll hints resolve to acceptable existing assets or synthetic diagrams.
- Insert into queue through the admin UI or approved API flow only after Shaka approval.
