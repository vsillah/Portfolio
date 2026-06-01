# Agentic Value Communications Plan

Status: Draft channel architecture
Source map: [`docs/agentic-enterprise-value-map.md`](agentic-enterprise-value-map.md)

## Relationship To The Existing Agentic Backlog

This plan is additive. It should not recreate the agentic backlog, research PRDs, research dossier, LinkedIn drafts, or YouTube scripts already produced.

Existing work to reuse:

| Existing asset | What it already covers | How this plan should use it |
| --- | --- | --- |
| `docs/agentic-content-research-prds/` | The 12 research PRDs for the agentic content series. | Treat as the research backlog and source assignment layer. Do not create another PRD set for the same topics. |
| `docs/agentic-content-research-briefs/phase-2-research-dossier.md` | Source-backed research notes across the PRD set. | Pull evidence, claims, and proof references from it when drafting channel assets. |
| `docs/agentic-content-linkedin-drafts/wave-1-drafts.md` | First-pass LinkedIn drafts for the initial wave. | Reuse, revise, or split these drafts rather than starting from scratch. |
| `docs/agentic-content-video-scripts/wave-1-youtube-scripts.md` | First YouTube-ready script set and storyboard ideas. | Use as raw material for long-form and short-form scripts. |
| `docs/agentic-content-video-scripts/render-approval-packet.md` | Render gate, readiness, and publishing boundary for the pilot video. | Keep live rendering and publishing behind the existing approval path. |
| `docs/agentic-os-client-advisory-explainer.md` | Client-safe advisory positioning. | Reuse when building the client one-pager and website proof page. |

What this plan adds:

- A channel map that decides which idea belongs on LinkedIn, carousel, YouTube, Shorts/TikTok/Reels, website, client packet, or technical appendix.
- A component library that lets one concept become multiple channel-native assets without changing the source claim.
- A sequencing recommendation so the public language can be tested before the client-facing packet is locked.
- A measurement loop for deciding which assets to expand, clip, revise, or retire.
- A challenger gate that keeps first-pass drafts away from human approval until a skeptical agent review has tested the claims, source map, privacy boundary, and channel fit.

Rule for future work: if a deliverable already exists, create a revision brief, channel adaptation, or packaging layer. Do not duplicate the source backlog.

## Source-Grounded Production Harness

Source inspiration: [I Built a Deck With AI, Then Made a Second AI Attack It.](https://youtu.be/MFzxIT88zfg) by Nate B. Jones.

The useful takeaway is the workflow shape: serious AI-assisted knowledge work should move through a source packet, a specification, constrained artifact creation, and a Ralph Loop-style challenger pass before it is treated as ready.

This mirrors the Portfolio AutoResearch pattern: create a bounded proposal, test it against evidence, record the iteration, and only then ask for human approval. The human should see a decision packet, not the first draft.

Apply that pattern to the agentic content backlog:

| Stage | Purpose | Portfolio adaptation | Output |
| --- | --- | --- | --- |
| 1. Source inventory | Know what the model is allowed to use. | Index existing PRDs, briefs, drafts, scripts, governance docs, implementation files, and transcript-derived references. | Source register with IDs, dates, owners, status, and privacy boundary. |
| 2. Artifact specification | Define what the asset must become before drafting. | For each LinkedIn post, carousel, video, one-pager, or appendix, write the audience, claim, proof, channel, length, and source IDs. | Channel spec or creative brief. |
| 3. Constrained creation | Generate only against the approved source packet and spec. | Adapt existing drafts/scripts instead of asking the model to invent a new strategy. | Draft asset with source IDs attached. |
| 4. Agentic Challenger Loop | Attack the artifact before polishing it. | Amina, the Agentic Challenger role, enumerates unsupported claims, implementation drift, source gaps, privacy risk, channel mismatch, weak logic, and duplicated material. | Issue list only, not fixes. |
| 5. Repair pass | Repair only the challenger issue list. | The creator updates the asset, records fixes, and preserves unresolved questions. | Revised draft with resolved issues. |
| 6. Challenger re-check | Decide whether the draft is ready for a human. | Amina verifies fixes and sets `pass_to_human`. | `passed`, `needs_revision`, or `blocked`. |
| 7. Human editorial gate | Make the final judgment only after challenger clearance. | Vambah reviews voice, moral clarity, business value, and publication risk from a compact packet. | Approved, revise, hold, or split. |

This turns the existing content backlog into a governed content production system.

Default gate: a draft does not route to Vambah for human-in-the-loop approval unless `pass_to_human=true`. The only exception is an explicit human-decision packet for an unresolved risk the challenger cannot resolve, such as a source conflict, privacy judgment, or strategic positioning choice.

## Ralph Loop / Agentic Challenger Standard

The loop is creator -> challenger -> repair -> challenger re-check -> human review.

The challenger does not fix the artifact. It only produces findings. This keeps critique and repair separate, which makes the review trace easier to trust.

Required challenger questions:

- Which claims are unsupported by the attached source IDs?
- Where does the artifact imply Portfolio has built something that is only planned?
- Does the artifact expose private logs, client information, raw chat exports, secrets, or internal-only traces?
- Is this duplicating an existing PRD, brief, LinkedIn draft, or script instead of adapting it?
- Does the format fit the intended channel and audience?
- What must be fixed before a human should spend time reviewing it?

Review packet statuses:

| Status | Meaning | Next step |
| --- | --- | --- |
| `needs_revision` | The draft has fixable issues. | Repair the issue list and re-run the challenger. |
| `blocked` | The draft has a source, privacy, or implementation conflict that cannot be safely repaired by the agent. | Create an exception packet for Vambah or hold the asset. |
| `passed` | The challenger found no blocking issues and verified required fixes. | Route a compact HITL packet for human approval. |

Review packet fields:

- `asset_id`
- `channel`
- `source_ids`
- `draft_version`
- `loop_round`
- `creator_agent`
- `challenger_agent`
- `challenger_prompt_version`
- `challenge_findings`
- `unsupported_claims`
- `source_conflicts`
- `privacy_flags`
- `implementation_drift`
- `required_fixes`
- `fixes_applied`
- `residual_risks_for_human`
- `challenger_status`
- `pass_to_human`
- `approval_status`

`pass_to_human=true` only when unsupported claims, source conflicts, critical privacy flags, and implementation drift are resolved or explicitly marked as residual human decisions.

## Meta-Agent Review Roles

These roles should evaluate the content before it becomes public or client-facing. They can be simulated by Codex prompts at first and later implemented as Agent Ops work items.

| Review role | Job | Questions it must answer |
| --- | --- | --- |
| Amina / Agentic Challenger | Performs the mandatory pre-HITL attack pass. | Should this asset be routed to a human yet, or does it need repair, source work, privacy cleanup, or a hold? |
| Source Librarian | Checks whether the draft maps back to approved sources. | Which source IDs support each claim? Are any claims unsupported? |
| Fact Auditor | Looks for factual, numerical, architectural, or implementation drift. | Does the draft claim something Portfolio has not actually built? |
| Privacy Reviewer | Checks whether private material could leak into public content. | Does this expose clients, raw logs, secrets, private chats, or internal-only traces? |
| Channel Editor | Tests fit for LinkedIn, carousel, YouTube, Shorts, website, or client packet. | Is this the right format, length, hook, and level of detail for the channel? |
| Voice Editor | Applies Vambah voice and anti-AI cleanup. | Does it sound grounded, practical, and human? Are there AI-isms or generic claims? |
| Conversion Strategist | Checks whether the asset has a clear next action. | Is this for conversation, trust-building, sales, technical proof, or video expansion? |

Minimum review rule:

- Public LinkedIn post: Amina / Agentic Challenger, Source Librarian, Fact Auditor, Voice Editor.
- Carousel: Amina / Agentic Challenger, Source Librarian, Channel Editor, Voice Editor.
- YouTube long-form: Amina / Agentic Challenger, Source Librarian, Fact Auditor, Privacy Reviewer, Voice Editor.
- Client one-pager: Amina / Agentic Challenger, Source Librarian, Fact Auditor, Privacy Reviewer, Conversion Strategist.
- Technical appendix: Amina / Agentic Challenger, Source Librarian, Fact Auditor, Privacy Reviewer.

## Claim-Level Attribution Standard

Every channel asset should carry a private source map before publication. The public asset does not need footnotes everywhere, but the working file should preserve attribution.

Recommended fields:

- `asset_id`
- `channel`
- `primary_claim`
- `supporting_claims`
- `source_ids`
- `implementation_proof`
- `privacy_classification`
- `review_roles_completed`
- `open_issues`
- `challenger_status`
- `pass_to_human`
- `residual_risks_for_human`
- `approval_status`

Example:

| Claim | Source IDs | Proof type | Public-safe? |
| --- | --- | --- | --- |
| Agent runs need a receipt. | `agent-operations-roadmap`, `agentic-patterns`, `run-detail-route` | Docs and route implementation | Yes |
| Handoffs need ownership and acceptance criteria. | `agent-work-items`, `agentic-patterns`, `agent-swarms-prd` | Helper implementation and PRD | Yes |
| Payment and paid external jobs need approval gates. | `agent-policy`, `agentic-operating-system-governance` | Policy implementation | Yes, if no transaction data is shown |

## Channel Adaptation Matrix

Use this matrix to convert the existing backlog into channel-native assets without creating duplicate work. Every row starts with `approval_status=not_ready` until the challenger loop sets `pass_to_human=true`.

| Asset | Reuse source | Channel | Challenger requirement | Human packet |
| --- | --- | --- | --- | --- |
| Flagship post: "Anyone can launch an agent now" | `wave-1-drafts.md`, value map core message | LinkedIn | Check for hype, unsupported autonomy claims, and duplicated wording. | Final post, source IDs, challenger findings, residual risks. |
| Carousel: "7 things your enterprise agent needs after the demo" | PRDs 02-09, component library | LinkedIn carousel | Check each slide has one source-backed idea and no private UI detail. | Slide outline, visual notes, source map, privacy notes. |
| YouTube script: "The Part of Agentic AI Most Teams Skip" | `wave-1-youtube-scripts.md`, value map lifecycle | YouTube | Check implementation claims, story logic, and proof-screen safety. | Script, storyboard, source map, blur/avoid list. |
| Short: "The agent needs a receipt" | Observability component, PRD 02 | Shorts/TikTok/Reels | Check the hook is accurate and does not overclaim live autonomy. | 45-second script and proof note. |
| Short: "A handoff is a work packet" | Handoff component, PRD 06 | Shorts/TikTok/Reels | Check handoff language matches existing work-item and trace behavior. | 45-second script and source note. |
| Post: "Scope is the safety model" | PRD 07, `agent-policy` evidence | LinkedIn | Check permission examples do not imply broad production authority. | Final post and claim map. |
| Post: "Agent QA needs scorecards" | PRD 05, evaluation route evidence | LinkedIn | Check the difference between implemented scoring and planned reflection loops. | Final post, built/planned distinction, source IDs. |
| Client one-pager | advisory explainer, value stack | PDF/web | Check client-safe language and remove internal swarm/provider detail. | One-pager draft, buyer-risk framing, privacy notes. |
| Technical appendix | value map, PRD evidence, implementation paths | PDF/Markdown | Check source paths and proof statements for drift. | Appendix draft, proof register, unresolved evidence gaps. |
| Website proof page | value map, channel plan | Portfolio page | Check public-safe screenshots, privacy boundary, and call-to-action fit. | Page brief, section map, proof-safe asset list. |

Phase 2 video rule: HeyGen, ElevenLabs, Remotion, HyperFrames, or other provider/render work cannot begin until the script has challenger clearance and the existing render approval packet is approved. Challenger clearance is a precondition for render-readiness, not the render approval itself.

## Why This Needs Multiple Deliverables

The value of Portfolio is too broad for one post, one video, or one packet.

People enter this topic from different levels of maturity:

- Some people are still impressed that an agent can use a tool.
- Some are trying to bring Open CLAW, OpenCode, n8n, or another agent runtime into an enterprise setting.
- Some are worried about compliance, audit, spend, and customer data.
- Some need to see the operator interface before the architecture makes sense.
- Some need a short story they can repeat to a board, funder, buyer, or internal sponsor.

So the communication strategy should work like the product itself: modular, traceable, and channel-aware.

The master source map holds the full system. The public communication should break that system into smaller doors people can walk through.

## Communication Principle

Do not lead with "agentic AI architecture."

Lead with the operational anxiety people already feel:

- "I launched an agent. Now how do I know what it did?"
- "What happens when one agent hands work to another?"
- "Who approves an agent before it sends, spends, publishes, or changes production?"
- "How do I explain this to compliance?"
- "How do I know the output is getting better?"

Then show the operating layer Portfolio already built.

## Channel Roles

| Channel | Job | Best format | What it should prove |
| --- | --- | --- | --- |
| LinkedIn text post | Create the sharp framing and invite discussion | 900-1,800 character post | The reader recognizes the hidden enterprise problem. |
| LinkedIn carousel | Make the system scannable | 7-10 slides | The reader sees the component model. |
| LinkedIn article/newsletter | Teach the full framework | 1,200-2,000 words | The reader understands why the operating layer matters. |
| YouTube long-form | Tell the full story with receipts | 6-10 minute scripted walkthrough | The viewer sees proof surfaces and understands the lifecycle. |
| YouTube Shorts / TikTok / Reels | Isolate one memorable idea | 30-60 second clip | One concept sticks: receipt, scope, handoff, approval, QA. |
| Client one-pager | Support advisory/sales conversations | PDF or webpage | A buyer understands the business value without needing technical depth. |
| Technical appendix | Support due diligence | Markdown/PDF proof register | A technical reviewer can inspect the implementation surfaces. |
| Website proof page | Turn the portfolio into an explainer | Public/private page | The website communicates the system behind the features. |
| Workshop/webinar | Convert attention into authority | 30-45 minute teaching session | The audience can evaluate their own agent readiness gaps. |

## Component Library

Each component should become its own reusable content object. Some objects become posts. Some become slides. Some become short videos. Some become sections in a client packet.

| Component | Core idea | Best first channel | Secondary channels |
| --- | --- | --- | --- |
| The receipt | Every agent run needs a record of what happened. | LinkedIn post | YouTube section, carousel slide, client one-pager |
| Agent-to-agent handoff | A handoff is a work packet, not a chat message. | Carousel | Short video, technical appendix |
| Scope and permission | Scope is the safety model. | LinkedIn post | YouTube section, client one-pager |
| Human-in-the-loop | Human review needs a designed surface. | Short video | LinkedIn post, carousel |
| Compliance and transactions | Spending, publishing, sending, and production changes need authority. | LinkedIn article | Client one-pager, technical appendix |
| QA and coaching | Agent quality improves through rubrics and traces. | YouTube section | LinkedIn post, workshop |
| Slack and Mission Control | Operators need both full review and mobile unblock. | Carousel | Short video, client demo |
| Runtime readiness | New runtimes need install, auth, trace, rollback, and audit proof before production. | LinkedIn post | Technical appendix, webinar |
| Client-safe proof | Governance exports explain the system without leaking private material. | Client one-pager | Website page, YouTube close |

## Recommended Content Arc

### Wave 1: Awareness

Purpose: make people feel the gap between agent demos and enterprise operations.

Deliverables:

1. LinkedIn post: "Anyone can launch an agent now. That is the exciting part. It is also the dangerous part."
2. Carousel: "The 7 things your agent needs after the demo."
3. Short video: "The agent needs a receipt."

Why this works:

This wave does not require the audience to understand the full architecture. It gives them language for the problem.

### Wave 2: System Education

Purpose: explain the lifecycle in plain language.

Deliverables:

1. YouTube video: "The Part of Agentic AI Most Teams Skip."
2. LinkedIn article: "The Enterprise Agent Lifecycle: scope, trace, handoff, approval, QA."
3. Carousel: "From model action to governed operation."

Why this works:

This wave moves from attention to authority. It teaches the full lifecycle and positions Portfolio as proof, not theory.

### Wave 3: Component Deep Dives

Purpose: turn each hidden layer into a reusable thought-leadership asset.

Deliverables:

1. LinkedIn post: "A handoff is not a message. It is a work packet."
2. LinkedIn post: "Scope is not a prompt. Scope is the safety model."
3. LinkedIn post: "Human-in-the-loop is an interface problem."
4. LinkedIn post: "Compliance belongs inside the workflow."
5. LinkedIn post: "Agent QA needs scorecards, not vibes."
6. Short video set: one 45-second clip for each idea.

Why this works:

Each component can stand alone. Together, they build the full operating system narrative.

### Wave 4: Proof And Conversion

Purpose: convert the narrative into client-facing and enterprise-facing proof.

Deliverables:

1. Client one-pager: "Governed Agentic Operations."
2. Technical appendix: implementation proof map with source references.
3. Website proof page: "How Portfolio runs governed agents."
4. Advisory workshop outline: "Enterprise Agent Readiness Audit."

Why this works:

This wave gives buyers, partners, and internal stakeholders something concrete to evaluate.

## Channel-Specific Deliverable Specs

### LinkedIn Text Posts

Best for: sharp framing, market education, conversation.

Format:

- 900-1,800 characters for most posts.
- One concept per post.
- Open with a tension, not a definition.
- Use Portfolio proof after the reader feels the problem.
- End with a question that asks for operational experience, not generic opinion.

Example series:

1. The agent needs a receipt.
2. A handoff is a work packet.
3. Scope is the safety model.
4. Human-in-the-loop is an interface problem.
5. Compliance belongs in the workflow.
6. Agent QA needs scorecards.
7. New runtimes need an operating model before production authority.

### LinkedIn Carousel

Best for: the component model.

Format:

1. Cover: "The 7 things your enterprise agent needs after the demo"
2. Receipt: observability and trace
3. Scope: tools, data, writes, spend
4. Handoff: summary, owner, acceptance criteria
5. Approval: human checkpoint for side effects
6. Compliance: risk monitor and governance export
7. QA: rubrics and coaching signals
8. Operator surface: Mission Control and Slack
9. Close: "Execution is becoming cheap. Governed execution is where the value is."

Design direction:

- Use simple system diagrams, not decorative AI imagery.
- Keep each slide to one idea.
- Use Portfolio UI proof only when it can be shown without private details.

### YouTube Long-Form

Best for: full architecture, story, receipts.

Format:

- 6-10 minutes.
- Start with the wrong question: "Can the agent do the work?"
- Move into the better question: "Can the business explain what happened?"
- Use the lifecycle diagram as the spine.
- Show or describe Portfolio proof surfaces at each phase.
- End with a practical readiness checklist.

Reusable chapters:

1. The demo is not the operating model.
2. The agent needs a receipt.
3. Handoff is a product feature.
4. Scope is the safety model.
5. Compliance lives in the workflow.
6. QA is a loop.
7. Human-in-the-loop has to be designed.

Phase 2 video extensibility:

- This script can later feed HeyGen avatar generation.
- Shorts can be cut from each chapter.
- ElevenLabs should only be used when there is a separate approved audio plan.
- Any rendered video should remain internal until a publishing packet is approved.

### Short-Form Video

Best for: memorable single ideas.

Format:

- 30-60 seconds.
- One punchy concept.
- No broad intro.
- One practical example.
- One closing line.

Short ideas:

1. "Your agent needs a receipt."
2. "A handoff is not a Slack message."
3. "Scope is not a prompt instruction."
4. "Human-in-the-loop is an interface problem."
5. "Compliance cannot live in a PDF."
6. "Agent QA cannot be vibes."

### Client One-Pager

Best for: advisory and sales conversations.

Format:

- One page.
- Plain language.
- No deep code references.
- Focus on business risk and operator confidence.

Sections:

1. The problem: agents can act faster than organizations can govern.
2. The model: registry, scope, trace, handoff, approval, QA, audit.
3. The proof: Portfolio implements the control plane.
4. The value: safer adoption, clearer ownership, better compliance, measurable quality.
5. The ask: run an agent readiness audit.

### Technical Appendix

Best for: enterprise due diligence and internal credibility.

Format:

- Markdown or PDF.
- Source-mapped.
- Evidence-first.

Sections:

1. Agent registry and scope.
2. Runtime policies.
3. Handoff schema.
4. Observability tables.
5. Approval gates.
6. Risk/compliance monitor.
7. Evaluation rubrics.
8. Governance export boundaries.

### Website Proof Page

Best for: making the portfolio communicate the value without a live walkthrough.

Format:

- Public-safe.
- Visual-first.
- Structured around the lifecycle.

Sections:

1. Governed agents, not unchecked automation.
2. Enterprise agent lifecycle diagram.
3. What Portfolio proves.
4. Component cards.
5. Client-safe audit/export framing.
6. Call to action: advisory, audit, or workshop.

## Priority Recommendation

Start with three assets:

1. LinkedIn flagship post: creates the framing and tests market resonance.
2. Carousel: makes the component model visual and shareable.
3. YouTube script: becomes the long-form source for clips, Shorts, and future HeyGen production.

Then build the client one-pager and technical appendix once the public language is calibrated.

Reasoning:

The public channels will tell us which language lands. The client packet should benefit from that learning instead of locking the language too early.

## First Production Backlog

| Priority | Deliverable | Channel | Source component | Output | Approval status | Human review |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | Flagship post: "Anyone can launch an agent now" | LinkedIn | Core message | Text post | `human_review_ready` in `docs/agentic-content-review-packets/p0-challenger-review-packets.md` | Ready for editorial approval; publishing still gated |
| P0 | Carousel: "7 things your enterprise agent needs after the demo" | LinkedIn | Component library | Slide outline | `human_review_ready` in `docs/agentic-content-review-packets/p0-challenger-review-packets.md` | Ready for editorial approval; visual build/publishing still gated |
| P0 | YouTube script: "The Part of Agentic AI Most Teams Skip" | YouTube | Full lifecycle | 6-10 minute script | `human_review_ready` in `docs/agentic-content-review-packets/p0-challenger-review-packets.md` | Ready for editorial approval; render/provider still gated |
| P1 | Short: "The agent needs a receipt" | TikTok/Reels/Shorts | Observability | 45-second script | `human_review_ready` in `docs/agentic-content-review-packets/p1-challenger-review-packets.md` | Ready for editorial approval; render/provider still gated |
| P1 | Short: "A handoff is a work packet" | TikTok/Reels/Shorts | Handoff | 45-second script | `human_review_ready` in `docs/agentic-content-review-packets/p1-challenger-review-packets.md` | Ready for editorial approval; render/provider still gated |
| P1 | Post: "Scope is the safety model" | LinkedIn | Scope | Text post | `human_review_ready` in `docs/agentic-content-review-packets/p1-challenger-review-packets.md` | Ready for editorial approval; publishing still gated |
| P1 | Post: "Agent QA needs scorecards" | LinkedIn | QA loop | Text post | `human_review_ready` in `docs/agentic-content-review-packets/p1-challenger-review-packets.md` | Ready for editorial approval; publishing still gated |
| P2 | Client one-pager | PDF/web | Value stack | Advisory asset | `human_review_ready` in `docs/agentic-content-review-packets/p2-challenger-review-packets.md` | Ready for editorial approval; PDF/web production still gated |
| P2 | Technical appendix | PDF/Markdown | Source map | Due diligence asset | `human_review_ready` in `docs/agentic-content-review-packets/p2-challenger-review-packets.md` | Ready for editorial approval; appendix production still gated |
| P2 | Website proof page | Portfolio | Full system | Webpage | `human_review_ready` in `docs/agentic-content-review-packets/p2-challenger-review-packets.md` | Ready for editorial approval; website implementation still gated |

## Challenger Test Scenarios

Use these scenarios when validating the first challenger prompts or future Agent Ops implementation:

| Scenario | Challenger finding | Expected routing |
| --- | --- | --- |
| Unsupported claim | Draft says Portfolio has autonomous production mutation without proof. | `blocked` until claim is removed or a source proves it. |
| Duplicate work | Draft repeats an existing LinkedIn script without a new channel purpose. | `needs_revision`; route to adaptation, not new creation. |
| Privacy risk | Draft references private run logs, raw chat exports, client records, or secrets. | `blocked` until removed or escalated as a human decision. |
| Source conflict | Two sources disagree on whether a capability is built or planned. | `needs_revision` with residual-risk note if unresolved. |
| Channel mismatch | Long technical explainer is marked as short-form-ready. | `needs_revision`; rewrite to channel constraints. |
| Valid pass | Draft is sourced, public-safe, channel-fit, and all fixes are verified. | `passed`; compact HITL packet can route to Vambah. |
| Provider gate | YouTube or avatar script asks for HeyGen/ElevenLabs work before review. | `blocked`; script must pass challenger and render approval first. |

## Measurement

| Asset | Signal to watch | Decision |
| --- | --- | --- |
| LinkedIn flagship post | Comments from builders/operators asking about implementation | Expand into article and carousel. |
| Carousel | Saves and shares | Turn into website proof page. |
| YouTube long-form | Watch retention through lifecycle sections | Cut the strongest section into Shorts. |
| Shorts | Repeat comments or direct messages | Turn repeated questions into LinkedIn posts. |
| Client one-pager | Buyer confusion or repeated objections | Add examples or simplify the language. |
| Technical appendix | Review questions from technical stakeholders | Add missing source references or proof screenshots. |

## Editorial Guardrails

- Do not make the story sound like AI hype.
- Do not imply agents are fully autonomous in production.
- Do not show private admin data, client records, secrets, raw logs, or private source material.
- Do not collapse governance into fear. The point is confidence.
- Keep the language operational: role, scope, trace, handoff, approval, quality, audit.
- Use Open CLAW/OpenCode-style runtime references as examples of execution capacity, not as the whole operating model.

## Working Tagline Options

- Execution is becoming cheap. Governed execution is where the value is.
- The agent is only as trustworthy as the operating system around it.
- Your agent needs a receipt.
- A demo proves capability. A trace proves control.
- Scope is the safety model.
- Human-in-the-loop is an interface, not a checkbox.
