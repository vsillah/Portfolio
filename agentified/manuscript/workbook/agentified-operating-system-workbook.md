# Agentified operating system workbook

Status: companion workbook draft for `Agentified`

Purpose: turn the book from a story about Sam into a buildable operating manual. Each worksheet helps the reader create part of their own authentic agentic operating system: one that reflects their work, their risks, their people, their approval lines, and their values.

This workbook borrows from Portfolio's actual agentic operating system patterns:

- Agent Ops trace records, artifacts, approvals, handoffs, work items, and costs
- Shaka as Chief of Staff/router
- Open Brain source, event, proposal, memory, link, and projection records
- Mission Control as the main cockpit
- Slack as the mobile unblock lane
- payment and spend authority gates
- client-safe governance exports
- Mobile App Foundry scoring and approval packets
- Model Ops AutoResearch proposal gates

It also has formal YouTube endnotes for the outside creators and videos that shaped the thinking behind agent orchestration, MCP, automations, evals, secure AI-assisted coding, app validation, and AI-assisted writing:

- `/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/references/youtube-ai-source-map.md`
- `/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/references/formal-endnotes.md`

Portfolio is the worked example. Your own environment is the assignment.

## The A.M.I.N.A. process

In the story, Sam finds Amina, the named agentic guide who helps him stop treating agent speed as the prize. Amina earns trust by making the work visible: sources, approvals, receipts, boundaries, costs, and consequences.

A.M.I.N.A. is the reader's operating process:

- Align the work: name the outcome, the human stake, and the decision being prepared.
- Map the authority: define what the agent can read, write, remember, recommend, spend, or route.
- Instrument the receipt: require trace, source, artifact, owner, cost, approval state, and rollback path.
- Negotiate the gate: decide what needs human approval before the agent can move forward.
- Audit the outcome: review what happened, what changed, what was learned, and whether authority should expand or shrink.

Use A.M.I.N.A. before you give an agent more power. If you cannot answer one of the five steps, that is the work. The missing answer points to the next operating risk.

### A.M.I.N.A. inside SAM

![A.M.I.N.A. inside SAM](/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/visuals/rendered/publication-plates/figure-3-amina-inside-sam-publication-plate.png)

SAM gives the team a way to accelerate learning. A.M.I.N.A. gives the reader a way to keep that acceleration governed while agents prepare work.

## How to use this workbook

Work one chapter at a time.

For each chapter, produce one artifact. Do not make the artifact pretty first. Make it honest first.

Each worksheet has five parts:

- Portfolio pattern: the operating idea borrowed from Portfolio.
- Example: how the pattern shows up in an agentic OS.
- Builder prompts: questions the reader can answer directly.
- Copy/paste AI prompt: a prompt the reader can give to their own AI tool.
- Output: the operating artifact they should keep.

The workbook aims at something more durable than adding agents: a system that makes agent work responsible.

The five A.M.I.N.A. moves repeat across the worksheets:

- Align: current map, Decision Card, Agentic PRD Packet.
- Map: Agent Job Description, Routing Policy, Permission Slip, Pod Model.
- Instrument: Agent Work Receipt, Trace Harness, Handoff Contract, Metrics Ladder.
- Negotiate: Source Safety Ladder, Review Posture, Spend Envelope, Unblock Ladder.
- Audit: Evaluation Loop, Client-Safe Proof, Foundry Test, AutoResearch Proposal, Accountability Stack.

---

# Operating system starter map

Before Chapter 1, the reader should sketch the system they already have.

## Worksheet 0: your current agentic operating surface

Portfolio pattern: Portfolio treats Admin as the control plane, Slack as the mobile unblock surface, Open Brain as memory, and Agent Ops traces as the source of evidence.

Example: A founder may have ChatGPT, Claude, Zapier, Gmail drafts, Slack summaries, and a few scripts. That is already an operating system. It is probably just undocumented.

Author pattern: My own harness search moved through Replit, Cursor, and Codex. Each stop taught a different constraint: speed is useful, authority has to be designed, cost shapes behavior, and traceability decides whether the work can be trusted.

Portfolio-first pattern: The agentic OS became easier to build because Portfolio already held a personal and professional corpus. Open Brain, agent roles, Kanban, evals, drift assessment, and guardrails could attach to work that already had shape.

Builder prompts:

1. Where do agent outputs currently appear?
2. Which tools can agents read from?
3. Which tools can agents write to?
4. Where do approvals happen?
5. Where does memory live?
6. Where do costs show up?
7. Where would you look if something went wrong?
8. Which harness are you using today, and what does it make easy?
9. What does that harness make hard to govern?
10. What would make you outgrow it?
11. What portfolio, corpus, or body of work already carries your fingerprints?
12. Which parts of that corpus are public, client-safe, internal, private, or off limits?
13. Which agent roles could safely use that substrate, and which roles need stricter boundaries?
14. What would drift look like if an agent slowly moved away from your voice, judgment, or standards?

Copy/paste AI prompt:

```text
Help me map my current agentic operating system.

My tools are:
[list tools]

My current AI or automation workflows are:
[list workflows]

For each workflow, identify:
- which harness it depends on
- which portfolio or corpus it depends on
- which source tiers it may use: public, client-safe, internal, private, or off limits
- what it reads
- what it writes
- who reviews it
- what action it can take
- what approval it needs
- where evidence is stored
- what it costs to run
- what the harness makes easy
- what the harness makes hard to govern
- where drift would show up
- what could go wrong

Return a simple operating map with gaps and recommended next artifacts.
Do not recommend new agents until the current system is mapped.
```

Output: one-page operating map.

Keep this sentence at the top:

```text
This is what my agentic system can currently read, write, remember, route, approve, spend, and prove.
```

---

# Act I worksheets: The Harness

Act I question: before agents earn authority, how do we know what happened?

## Chapter 1 worksheet: Agent Work Receipt

Portfolio pattern: every agentic action resolves into a traceable envelope: agent, runtime, scope, intent, approval, cost, artifact, outcome, and audit summary.

Example: An agent drafts a client memo. The system needs more than the memo. It needs a receipt that says what the agent intended, what it read, what it produced, who approved it, what it cost, and how to reverse it.

Use this worksheet after reading Figure 1.1 in the manuscript. The figure teaches the motion: run, receipt, human gate, outcome. This worksheet turns that motion into a record you can keep.

Builder prompts:

1. What is one agent action that already happens in your work?
2. What did the agent intend?
3. Which agent or tool produced it?
4. What did it read?
5. What did it write or prepare?
6. Who approved it?
7. What did it cost?
8. What happened afterward?
9. How would you undo it?
10. Which fields are unknown today?
11. Who owns closing each unknown before this agent receives more authority?

Copy/paste AI prompt:

```text
Create an Agent Work Receipt for this agent action:

[describe the action]

Use these fields:
- intent
- agent or automation
- source
- action taken
- artifact produced
- approval state
- cost or resource use
- outcome
- rollback path
- open governance gaps

Write it in plain language a nontechnical operator could read.
If a field is unknown, mark it as a risk instead of guessing.
For each risk, name the human owner who must close it.
```

Output: Agent Work Receipt.

Red flag: if the receipt has more than two unknown fields, the agent should not receive more authority yet.

## Chapter 2 worksheet: Agent Job Description

Portfolio pattern: Portfolio maps named agents to roles, responsibilities, runtimes, approval gates, and live/partial/planned status.

Example: Shaka routes work. Amina finds demand signals. Imhotep prepares prototype packets. Kandake prepares commercialization packets. The names matter less than the job clarity.

Builder prompts:

1. What job should this agent own?
2. What job should it never own?
3. Who manages it?
4. What does success look like?
5. What data can it read?
6. What tools can it use?
7. What side effects are forbidden?
8. What approvals does it need?

Copy/paste AI prompt:

```text
Write a job description for an AI agent in my operating system.

Agent purpose:
[purpose]

Business context:
[context]

Use this format:
- agent name
- job to be done
- manager
- allowed inputs
- allowed tools
- allowed outputs
- forbidden actions
- approval required for
- success metric
- failure signal
- retirement condition

Keep it concrete. Do not give the agent broad authority by default.
```

Output: Agent JD.

Red flag: if the job description uses phrases like "handle everything," "manage all," or "autonomously run," rewrite it.

## Chapter 3 worksheet: Decision Card

Portfolio pattern: Shaka's delegation policy separates task type, risk class, required evidence, fallback, approval gate, and confidence threshold.

Example: "Draft renewal memo" prepares work. "Send renewal memo" spends authority.

Builder prompts:

1. What decision is being prepared?
2. Who owns the final call?
3. What can the agent recommend?
4. What can the agent execute?
5. What evidence must be attached?
6. What confidence level is enough to proceed?
7. What fallback happens when confidence is low?

Copy/paste AI prompt:

```text
Create a Decision Card for this agent-supported decision:

[decision]

Use these fields:
- decision owner
- decision type
- agent role
- what the agent may prepare
- what the agent may not execute
- required evidence
- confidence threshold
- approval gate
- fallback route
- rollback path

Make the boundary between recommendation and execution explicit.
```

Output: Decision Card.

Red flag: if the same agent recommends and approves the decision, the design is broken.

## Chapter 4 worksheet: Trace Harness

Portfolio pattern: run detail pages connect steps, events, artifacts, approvals, handoffs, cost, and related context.

Example: An operator should be able to answer why an agent moved work from one lane to another without reading raw JSON.

Builder prompts:

1. What did the agent decide or prepare?
2. What did it read?
3. What would have stopped it?
4. Where is the artifact?
5. Who reviews it?

Copy/paste AI prompt:

```text
Turn this agent trace into an operator-readable Trace Harness:

[paste sanitized trace summary or describe the run]

Answer:
- what happened
- why it happened
- what source evidence was used
- what approval gate applied
- what artifact was produced
- what cost or resource was used
- what rollback path exists
- what a nontechnical owner should know

Do not expose private logs or secrets.
```

Output: Trace Harness.

Red flag: if only engineers can understand the trace, the accountable owner is unprotected.

## Chapter 5 worksheet: Source Safety Ladder

Portfolio pattern: Open Brain and RAG projections use privacy tiers: public_safe, client_safe, internal_ops, private.

Example: A client-safe source can inform work inside that client lane, but it should not become public-facing memory.

Builder prompts:

1. What are the top sources your agents read?
2. Which are public?
3. Which belong to a client?
4. Which are internal operations?
5. Which are private?
6. What can agents quote?
7. What can agents remember?
8. What can agents publish?

Copy/paste AI prompt:

```text
Classify these sources into a Source Safety Ladder:

[list sources]

Use these tiers:
- public_safe
- client_safe
- internal_ops
- private

For each source, define:
- allowed read use
- allowed quote use
- allowed memory use
- allowed publish use
- approval required
- risk if misused

If a source is ambiguous, choose the stricter tier.
```

Output: Source Safety Ladder.

Red flag: if a source has no tier, the agent should not rely on it.

## Chapter 6 worksheet: Source, Event, Proposal, Memory

Portfolio pattern: Open Brain routes durable memory through source records, events, proposals, approved memories, and projections.

Example: A meeting insight should become a proposal before it becomes shared memory. The proposal should carry source, confidence, privacy tier, and approval status.

Builder prompts:

1. What did the system observe?
2. Where did the evidence come from?
3. Is it a durable fact, a temporary note, or a hypothesis?
4. Who should approve it?
5. What privacy tier applies?
6. Where can it be projected after approval?

Copy/paste AI prompt:

```text
Convert this observation into a memory proposal:

[observation]

Use this structure:
- source record
- event observed
- proposed memory
- confidence
- privacy tier
- approval owner
- links to related work
- allowed projections
- expiration or review date

Do not promote the memory automatically. Return it as a proposal.
```

Output: Memory Proposal.

Red flag: if every observation becomes memory, the system will learn the wrong things with confidence.

## Chapter 7 worksheet: Controller Routing Policy

Portfolio pattern: Shaka routes by task type, risk class, required evidence, preferred agent, fallback, approval gate, and confidence.

Example: A pricing question routes differently from a support question because the risk and approval gate differ.

Builder prompts:

1. What task types enter your system?
2. What risk classes do you recognize?
3. Which agent or human handles each class?
4. What evidence is required before routing?
5. What is the fallback?
6. When should the controller refuse to route?

Copy/paste AI prompt:

```text
Draft a controller routing policy for my agentic operating system.

My common task types are:
[list]

My available agents or human roles are:
[list]

Create a routing table with:
- task type
- risk class
- required evidence
- preferred owner
- fallback owner
- approval gate
- confidence threshold
- refusal condition

Keep it deterministic enough that a human can audit why work was routed.
```

Output: Controller Routing Policy.

Red flag: if routing is hidden inside a prompt no one can inspect, delegation is not governed.

## Chapter 8 worksheet: Operating Map

Portfolio pattern: Agent Operations uses one control plane, one mobile surface, one trace model, approval before mutation, and no hidden runtimes.

Example: Mission Control is the cockpit. Slack is the mobile unblock lane. Open Brain is the memory core. Agent runs are the evidence.

Use Figure 8.1 from the manuscript before filling out this worksheet. The stack should be visible before the lifecycle map gets detailed:

```text
Owned corpus -> Open Brain -> Harness -> Roles -> Controls -> Mission Control -> Public-safe proof
```

The operating map should show where each workflow sits in that stack. If a workflow skips a layer, mark the skip as a governance gap instead of smoothing it over.

Builder prompts:

1. Where does work enter?
2. Where does it get routed?
3. Where does it wait for approval?
4. Where does memory get proposed?
5. Where does spend get checked?
6. Where does proof get exported?
7. Where does rollback happen?
8. Which owned corpus or source tier does the workflow depend on?
9. Which harness carries the work?
10. Which named role owns each step?
11. Which control keeps the step from outrunning trust?

Copy/paste AI prompt:

```text
Create an operating map for my agentic system.

Current tools:
[tools]

Current workflows:
[workflows]

Map:
- owned corpus or source tier
- intake
- routing
- trace
- artifact storage
- approval
- memory
- spend
- mobile unblock
- client-safe proof
- rollback
- named role
- control or gate

Return:
- one-page lifecycle map
- top five missing controls
- top five unclear owners
- top five hidden handoffs
- any skipped stack layers
```

Output: Operating Map.

Red flag: if no single surface shows the state of agent work, the human operator becomes the dashboard.

---

# Act II worksheets: Authority

Act II question: what can agents prepare, recommend, route, or execute, and who grants that authority?

## Chapter 9 worksheet: Permission Slip

Portfolio pattern: runtime policy and agent approvals gate publishing, sending, production writes, config changes, private-to-public content, paid jobs, and payment actions.

Example: an agent may draft an outbound email, but it cannot send the email without an approval checkpoint.

Use Figure II.1 from the manuscript before filling out this worksheet. Place the request on the ladder first: prepare, recommend, route, stage, or execute. The higher the rung, the stronger the required evidence, gate, and rollback path.

Builder prompts:

1. What permission is the agent requesting?
2. What is the exact action?
3. What side effect could happen?
4. What evidence supports the request?
5. Who can approve it?
6. How long does the permission last?
7. How can it be revoked?
8. Which authority rung does this request sit on?
9. What receipt proves the request is ready?
10. What source check is required?
11. What rollback path protects the organization if the approval was wrong?

Copy/paste AI prompt:

```text
Create a Permission Slip for this agent request:

[request]

Include:
- requested action
- authority rung: prepare, recommend, route, stage, or execute
- side effect class
- data involved
- tools involved
- approval owner
- expiration or review date
- evidence required
- receipt required
- source check required
- allowed scope
- forbidden scope
- revocation path
- rollback path

If the action touches customers, publishing, production data, money, or private-to-public material, mark approval required.
```

Output: Permission Slip.

Red flag: a permission with no expiration becomes permanent authority by accident.

## Chapter 10 worksheet: Quarterly Cull

Portfolio pattern: Agent Ops tracks live, partial, planned, stale, failed, and approval-waiting work; unused agents and work items should not quietly persist.

Example: a beautifully traced agent that no one reads is still waste.

Builder prompts:

1. Which agents ran this quarter?
2. Which produced proof?
3. Which had an owner?
4. Which would you build again today?
5. Which permissions should be revoked?
6. Which triggers should be deleted?

Copy/paste AI prompt:

```text
Run a Quarterly Cull on this agent portfolio:

[list agents or automations]

For each one, score:
- proof delivered this quarter
- current owner
- current approver
- current permission validity
- cost or maintenance burden
- would we build it again today
- keep, narrow, pause, or retire

Return a cull table and sunset notes for anything that should be retired.
```

Output: Quarterly Cull table.

Red flag: "nobody complained" is not proof of value.

## Chapter 11 worksheet: Agentic PRD Packet

Portfolio pattern: work items, approval packets, prototype packets, and commercialization packets all preserve scope, owner, evidence, risks, rollback, and approval gates.

Example: a prototype packet should name the repo, MVP scope, smoke tests, demo evidence, commercialization assumptions, risks, and gates before anyone builds.

Builder prompts:

1. What outcome should this agent produce?
2. What is out of scope?
3. What inputs are allowed?
4. What acceptance tests prove quality?
5. What risks need review?
6. Who owns the packet?
7. What rollback path exists?

Copy/paste AI prompt:

```text
Write an Agentic PRD Packet for this agent-supported workflow:

[workflow]

Include:
- outcome
- user or operator
- scope fences
- allowed inputs
- forbidden inputs
- expected artifacts
- acceptance tests
- approval gates
- owner
- risks
- rollback path
- retirement condition

Keep it short enough to review before build work begins.
```

Output: Agentic PRD Packet.

Red flag: if the PRD only says what the agent should do, it is missing authority design.

## Chapter 12 worksheet: Pod Model

Portfolio pattern: Portfolio groups agents into pods and uses Shaka to route across them without letting specialist agents inherit broad authority.

Example: Amina, Imhotep, and Kandake work in the Mobile Foundry lane, while Shaka routes gates and conflicts.

Builder prompts:

1. Which agents belong together?
2. What outcome does the pod own?
3. Who is the human owner?
4. Which agent leads preparation?
5. Which agent is forbidden from final approval?
6. Where do handoffs happen?

Copy/paste AI prompt:

```text
Design a pod model for these agents or automations:

[list]

For each pod, define:
- pod purpose
- agents or tools in the pod
- human owner
- controller or router
- inputs
- outputs
- approval gates
- handoff rules
- failure mode

Keep side-effect authority with humans unless explicitly approved.
```

Output: Pod Model.

Red flag: a swarm without an owner is a meeting that never ends.

## Chapter 13 worksheet: Handoff Contract Card

Portfolio pattern: `agent_handoffs` and work items preserve source run, owning agent, next action, execution mode, validation, blockers, and trace link.

Example: a research agent should not hand a drafting agent a vague summary. It should hand over sources, confidence, open questions, and forbidden claims.

Builder prompts:

1. Who is the sender?
2. Who is the receiver?
3. What artifact moves?
4. What assumptions travel with it?
5. What evidence must be attached?
6. What should the receiver refuse?

Copy/paste AI prompt:

```text
Create a Handoff Contract Card.

Sender:
[sender]

Receiver:
[receiver]

Work being handed off:
[work]

Include:
- required artifact
- source evidence
- assumptions
- confidence
- open questions
- receiver acceptance criteria
- refusal conditions
- trace link or evidence pointer
- human owner
```

Output: Handoff Contract Card.

Red flag: if the receiver has to infer context, the handoff is not a contract.

## Chapter 14 worksheet: Evaluation Loop

Portfolio pattern: evaluation should capture, judge, sample, and decide before permission expands.

Example: an LLM judge can scale review, but human sampling anchors the judge.

Builder prompts:

1. What output are you evaluating?
2. What does good look like?
3. What can be scored automatically?
4. What must a human sample?
5. What permission decision follows the score?

Copy/paste AI prompt:

```text
Design an Evaluation Loop for this agent:

[agent/workflow]

Include:
- captured run fields
- rubric criteria
- automated judge role
- human sample rule
- pass threshold
- hold threshold
- rollback trigger
- permission decision after evaluation

Do not treat the judge score as final authority.
```

Output: Evaluation Loop.

Red flag: if the eval never changes permissions, it is theater.

## Chapter 15 worksheet: Agent Metrics Ladder

Portfolio pattern: Agent Ops tracks status, stale runs, approvals, costs, work items, handoffs, artifacts, and outcomes.

Example: "runs completed" is activity. "approved artifacts that changed a decision" is closer to value.

Builder prompts:

1. What activity metric do you track?
2. What quality metric do you track?
3. What trust metric do you track?
4. What cost metric do you track?
5. What outcome metric matters?

Copy/paste AI prompt:

```text
Create an Agent Metrics Ladder for this workflow:

[workflow]

Separate:
- activity metric
- quality metric
- trust metric
- cost metric
- outcome metric
- metric that should not be used for decisions
- review cadence

Explain which metric can expand authority and which metric is only diagnostic.
```

Output: Agent Metrics Ladder.

Red flag: if a metric cannot change a decision, it is probably a dashboard decoration.

## Chapter 16 worksheet: Review Postures

Portfolio pattern: approval checkpoints can approve, reject, request revision, route, or deep-link to the full trace.

Example: a human should know whether they are reviewing for quality, source safety, spend, customer risk, or public claim risk.

Builder prompts:

1. What kind of review is this?
2. What should the reviewer check first?
3. What is the fastest safe yes?
4. What requires a no?
5. What requires escalation?

Copy/paste AI prompt:

```text
Create review instructions for this approval packet:

[packet]

Define:
- review posture
- what to inspect first
- approve condition
- reject condition
- request revision condition
- escalation condition
- required comment
- trace evidence to check

Keep the human reviewer responsible for authority, not busywork.
```

Output: Review Posture card.

Red flag: if every review looks the same, reviewers will stop reading.

## Chapter 17 worksheet: Spend Envelope

Portfolio pattern: payment and spend authority must be amount-bound, purpose-bound, time-bound, and trace-bound.

Example: an agent can recommend increasing a paid API budget, but a human approves the amount, purpose, window, retries, and rollback.

Builder prompts:

1. What spend is being requested?
2. What is the maximum amount?
3. What is the purpose?
4. Who is the counterparty?
5. What is the time window?
6. What evidence supports it?
7. How is it revoked?

Copy/paste AI prompt:

```text
Create a Spend Envelope for this agent-requested spend:

[spend request]

Include:
- requesting agent
- approving human
- amount limit
- currency
- counterparty
- purpose
- allowed execution window
- maximum retries
- evidence required
- trace link
- revocation path
- forbidden actions

Separate recommendation from execution.
```

Output: Spend Envelope.

Red flag: if money can move without a named human, the system is not ready.

## Chapter 18 worksheet: Decision Brief

Portfolio pattern: authority decisions should include context, options, recommendation, reversibility, and what would change our mind.

Example: the agent can assemble the brief, but the human signs the decision.

Builder prompts:

1. What decision is on the table?
2. What changed?
3. What options are real?
4. What does the agent recommend?
5. What would make that recommendation wrong?
6. Who signs?

Copy/paste AI prompt:

```text
Draft a Decision Brief for this decision:

[decision]

Use five sections:
- context
- options
- recommendation
- reversibility
- what would change our mind

Then add:
- decision owner
- approval deadline
- evidence gaps
- rollback path

Argue the strongest rejected option fairly.
```

Output: Decision Brief.

Red flag: if the brief makes disagreement hard, the agent is framing too much of the decision.

---

# Act III worksheets: The Agentified Organization

Act III question: what does work feel like when agents become governed operating capacity?

## Chapter 19 worksheet: Mission Control Cockpit

Portfolio pattern: `/admin/agents` should show state at a glance: Daily Operating Brief, Chief of Staff command, Agent Inbox, work queue, active roster, latest activity, costs, approvals, and trace drilldowns.

Example: the operator starts the day from one cockpit instead of checking five systems by memory.

Builder prompts:

1. What needs to be visible first?
2. What needs a human today?
3. What failed?
4. What is stale?
5. What cost changed?
6. What can be routed?
7. What evidence is one click away?

Copy/paste AI prompt:

```text
Design a Mission Control cockpit for my agentic operating system.

My main workflows:
[workflows]

Create a first-screen layout with:
- status strip
- daily brief
- approvals
- blocked work
- stale or failed runs
- cost signals
- agent roster
- trace drilldowns
- mobile unblock links

Keep it operator-focused, not decorative.
```

Output: Mission Control Cockpit sketch.

Red flag: if the first screen is mostly charts, it may not be helping the operator decide.

## Chapter 20 worksheet: Unblock Ladder

Portfolio pattern: Slack is allowed to approve or decline low-risk packets, request revision, assign/handoff work, mark ready, route inbox items, ask Shaka, and open Portfolio traces. It must not merge, deploy, publish, send, mutate customer data, touch payments, or change production config.

Example: Slack can unblock a review packet. It cannot become the place where serious authority hides.

Builder prompts:

1. What mobile actions are safe?
2. What actions must deep-link back to the cockpit?
3. Who can act from mobile?
4. What trace event gets written?
5. What action should never be mobile?

Copy/paste AI prompt:

```text
Create an Unblock Ladder for my mobile agent actions.

Mobile surface:
[Slack, Teams, email, app, etc.]

Define:
- status-only actions
- low-risk approve/decline actions
- route or assign actions
- revision request actions
- escalation actions
- actions that must deep-link to the main cockpit
- forbidden mobile actions
- trace event written after each action

Keep mobile as an unblock lane, not a hidden control plane.
```

Output: Unblock Ladder.

Red flag: if mobile can do more than the main cockpit can explain, the design is backwards.

## Chapter 21 worksheet: Client-Safe Proof Packet

Portfolio pattern: client-safe exports include capability inventory, scoped delegation evidence, authority approvals, scope filters, and ledger metadata while excluding raw prompts, private logs, secrets, private reasoning, and sensitive records.

Example: a client can validate guardrails without receiving raw run logs.

Builder prompts:

1. What proof would a client ask for?
2. What should be included?
3. What should be excluded?
4. What scope applies: run, project, date window?
5. What ledger proves export happened?

Copy/paste AI prompt:

```text
Create a client-safe proof packet outline for this agentic workflow:

[workflow]

Include:
- capability boundaries
- scoped trace references
- delegation evidence
- approval decisions
- cost or spend authority summary
- export scope
- export timestamp/ledger metadata
- exclusions
- reviewer notes

Exclude raw prompts, private logs, secrets, private reasoning, sensitive records, and client data outside the scope.
```

Output: Client-Safe Proof Packet.

Red flag: if proof requires dumping raw logs, the proof surface is not mature.

## Chapter 22 worksheet: Foundry Test

Portfolio pattern: Mobile App Foundry uses Amina for demand, Imhotep for prototype fit, Kandake for commercialization, and Shaka for routing/approval.

Example: an app idea receives a popularity score, source evidence, prototype scope, commercialization path, risks, and human gate before build.

Builder prompts:

1. What opportunity are you testing?
2. What demand evidence exists?
3. Who pays?
4. Does it fit your builder strengths?
5. How fast can you prototype?
6. What makes it different?
7. What release risk exists?
8. What approval is needed before build?

Copy/paste AI prompt:

```text
Run a Foundry Test on this idea:

[idea]

Score out of 100:
- demand signal: 25
- monetization path: 20
- builder fit: 20
- build velocity: 15
- differentiation: 10
- release readiness: 10

Then produce:
- evidence summary
- risks
- prototype scope
- commercialization path
- human gate before build

Do not create repos, invite testers, collect user data, set pricing, or publish claims.
```

Output: Foundry Test packet.

Red flag: if the idea is exciting but the payer is unclear, the packet should not become a build.

## Chapter 23 worksheet: AutoResearch Proposal

Portfolio pattern: Model Ops AutoResearch emits proposals with hypothesis, experiment config, expected impact, baseline, touched files/settings, metric gate, result summary, risk, rollback, approval question, and next metric gate. Proposals remain not_run until approved.

Example: the system can propose a model swap evaluation, but it cannot change routing defaults without approval.

Builder prompts:

1. What gap does current evidence show?
2. What experiment would reduce uncertainty?
3. What metric gate decides success?
4. What risk exists?
5. What rollback path exists?
6. What exactly does approval authorize?

Copy/paste AI prompt:

```text
Create an AutoResearch proposal for this operating question:

[question]

Include:
- proposal title
- hypothesis
- experiment config
- expected impact
- current baseline
- metric gate
- touched files or settings
- risk level
- rollback path
- promotion recommendation
- explicit approval question
- next metric gate
- result status: not_run

Make clear that approval authorizes only the next scoped research action.
```

Output: AutoResearch Proposal.

Red flag: a proposal is not evidence. It is a request to learn.

## Chapter 24 worksheet: Three-Panel Demo

Portfolio pattern: a board or client walkthrough should show queue, trace, and memory rather than a slide promise.

Example: show what is waiting, why one item was blocked, and what memory rule governed the decision.

Builder prompts:

1. What is in the queue?
2. What trace proves one decision?
3. What memory or policy governed it?
4. What was rejected?
5. What export can the reviewer take away?

Copy/paste AI prompt:

```text
Design a Three-Panel Demo for my agentic operating system.

Audience:
[board/client/team]

Use three panels:
- queue: what is active, blocked, rejected, or waiting
- trace: one work item from request to decision
- memory: the source or policy that governed the decision

Add:
- what not to show
- privacy exclusions
- likely questions
- proof file or export to provide
```

Output: Three-Panel Demo storyboard.

Red flag: if the demo only shows wins, it is a sales pitch, not operating proof.

## Chapter 25 worksheet: Six-Beat Day

Portfolio pattern: daily operation moves through brief, route, review, approve, recover, learn.

Example: the day starts with what ran, what needs a human, and what learned something worth keeping.

Builder prompts:

1. What ran?
2. What needs a human?
3. What should be routed elsewhere?
4. What needs review?
5. What is ready for approval?
6. What needs recovery?
7. What should become memory?

Copy/paste AI prompt:

```text
Create my Six-Beat Day brief from this agent activity:

[activity]

Organize into:
- brief: what ran
- route: what belongs elsewhere
- review: what needs careful human reading
- approve: what needs authority
- recover: what failed or stalled
- learn: what should become a memory proposal

End with the question:
What did I approve today that I should have questioned?
```

Output: Six-Beat Day brief.

Red flag: if the brief becomes a to-do list, the system is pushing work back onto the human.

## Chapter 26 worksheet: Accountability Stack

Portfolio pattern: durable operating systems preserve source, event, proposal, memory, trace, approval, export, and rollback.

Example: the final proof is the system's ability to explain, reverse, and learn from the action an agent took.

Builder prompts:

1. What does your system know?
2. Where did it learn that?
3. Who approved it?
4. What can it do with that knowledge?
5. How is the action traced?
6. How is it exported safely?
7. How is it reversed?

Copy/paste AI prompt:

```text
Create an Accountability Stack for my agentic operating system.

Use these layers:
- source
- event
- proposal
- memory
- routing
- action
- approval
- cost/spend
- export
- rollback

For each layer, define:
- owner
- evidence
- privacy tier
- approval gate
- failure mode
- next improvement

End with a one-page roadmap for making the system more accountable.
```

Output: Accountability Stack.

Red flag: if the system can learn but cannot forget, narrow, revoke, or roll back, it is incomplete.

---

# Prompt bank

Use these prompts as reusable operating moves.

## Agent scope prompt

```text
Help me narrow this agent's authority.

Agent:
[agent]

Current scope:
[scope]

Recommend:
- what it should keep
- what it should lose
- what requires approval
- what should be read-only
- what should be forbidden
- what evidence would justify expanded authority later
```

## Approval packet prompt

```text
Create an approval packet for this agent output:

[output]

Include:
- requested action
- evidence
- source tier
- risk
- reviewer
- approve condition
- reject condition
- rollback path
- expiration
```

## Memory proposal prompt

```text
Turn this observation into a memory proposal, not a memory:

[observation]

Include source, confidence, privacy tier, approval owner, allowed projections, and expiration.
```

## Client-safe proof prompt

```text
Summarize this agent workflow for a client-safe proof packet.

Include role boundaries, trace references, approval decisions, and exclusions.
Do not include raw logs, private prompts, secrets, private reasoning, or sensitive records.
```

## Retire-or-keep prompt

```text
Evaluate whether this agent should stay active:

[agent/workflow]

Assess proof delivered, owner, approver, cost, risk, current permissions, and whether we would build it again.
Recommend keep, narrow, pause, or retire.
```

---

# Portfolio source map

This workbook draws from these Portfolio docs:

- `/Users/vambahsillah/Projects/Portfolio/docs/agentic-operating-system-governance.md`
- `/Users/vambahsillah/Projects/Portfolio/docs/agent-operations-roadmap.md`
- `/Users/vambahsillah/Projects/Portfolio/docs/agentic-patterns.md`
- `/Users/vambahsillah/Projects/Portfolio/docs/open-brain-local-service.md`
- `/Users/vambahsillah/Projects/Portfolio/docs/agentic-content-research-prds/01-agentic-operating-system-overview.md`
- `/Users/vambahsillah/Projects/Portfolio/docs/agentic-content-research-prds/02-harness-trace-foundation.md`
- `/Users/vambahsillah/Projects/Portfolio/docs/agentic-content-research-prds/03-shaka-controller-brain.md`
- `/Users/vambahsillah/Projects/Portfolio/docs/agentic-content-research-prds/04-open-brain-memory-architecture.md`
- `/Users/vambahsillah/Projects/Portfolio/docs/agentic-content-research-prds/08-human-in-the-loop-approvals.md`
- `/Users/vambahsillah/Projects/Portfolio/docs/agentic-content-research-prds/09-mission-control-slack-traceability.md`
- `/Users/vambahsillah/Projects/Portfolio/docs/agentic-content-research-prds/10-cost-spend-payment-authority.md`
- `/Users/vambahsillah/Projects/Portfolio/docs/agentic-content-research-prds/11-client-safe-audit-export.md`
- `/Users/vambahsillah/Projects/Portfolio/docs/mobile-app-foundry-agent-system.md`
- `/Users/vambahsillah/Projects/Portfolio/docs/model-ops-autoresearch.md`
- `/Users/vambahsillah/Projects/Portfolio/docs/agent-ops-slack-mobile-unblock.md`
- `/Users/vambahsillah/Projects/Portfolio/docs/agentic-os-client-advisory-explainer.md`
