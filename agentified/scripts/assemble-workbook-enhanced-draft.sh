#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CHAPTER_DIR="$ROOT/manuscript/production-draft/chapters"
OUTDIR="$ROOT/manuscript/workbook-enhanced"
OUT="$OUTDIR/agentified-workbook-enhanced-draft.md"
ENDNOTES="$ROOT/manuscript/references/formal-endnotes.md"

mkdir -p "$OUTDIR"

builder_block() {
  local chapter="$1"
  case "$chapter" in
    0)
      cat <<'EOF'

### Build your operating system

Operating artifact: Current Agentic Operating Map

Use this before you add another tool. List where agent work enters, which harness carries it, which portfolio or corpus it depends on, where it is reviewed, where memory lives, where costs appear, where drift would show up, and where evidence can be inspected.

Prompt:

```text
Map my current agentic operating system. For each AI tool or automation I use, identify the harness it depends on, the portfolio or corpus it depends on, which source tiers it may use, what it reads, what it writes, who reviews it, what approval it needs, where memory lives, what it costs, where drift would show up, and where evidence is stored. Mark unknowns as governance gaps.
```
EOF
      ;;
    1)
      cat <<'EOF'

### Build your operating system

Operating artifact: Agent Work Receipt

Portfolio pattern: Portfolio ties agent runs, events, artifacts, approvals, cost, work items, and handoffs into a traceable envelope.

Use this when: an agent creates work another person may act on.

Builder prompts:

1. What did the agent intend?
2. What did it read?
3. What artifact did it produce?
4. Who approved it?
5. What did it cost?
6. What happened after the artifact entered the workflow?
7. How would you undo the action if the artifact was wrong?

Copy/paste prompt:

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
```

Keep this artifact if:

- another person may act on the agent's output
- the action touches a client, customer, public surface, memory, money, or production system

Red flag:

If the receipt has more than two unknown fields, the agent should not receive more authority yet.
EOF
      ;;
    2)
      cat <<'EOF'

### Build your operating system

Operating artifact: Agent Job Description

Use this before giving an agent tools, memory, or a workflow.

Prompt:

```text
Write an Agent Job Description for this agent: [agent]. Include job to be done, manager, allowed inputs, allowed tools, allowed outputs, forbidden actions, approval required for, success metric, failure signal, and retirement condition.
```
EOF
      ;;
    3)
      cat <<'EOF'

### Build your operating system

Operating artifact: Decision Card

Use this to separate recommendation from execution.

Prompt:

```text
Create a Decision Card for this agent-supported decision: [decision]. Include decision owner, agent role, what the agent may prepare, what it may not execute, required evidence, confidence threshold, approval gate, fallback route, and rollback path.
```
EOF
      ;;
    4)
      cat <<'EOF'

### Build your operating system

Operating artifact: Trace Harness

Use this when raw logs exist but the accountable owner still cannot explain what happened.

Prompt:

```text
Turn this run into an operator-readable Trace Harness: [sanitized run summary]. Explain what happened, why it happened, what sources were used, what approval gate applied, what artifact was produced, what cost was incurred, and how rollback works.

Then assess the harness itself. What did the current environment make easy? What did it make hard to govern? Where did authority, cost, traceability, or tool access break down?
```
EOF
      ;;
    5)
      cat <<'EOF'

### Build your operating system

Operating artifact: Source Safety Ladder

Use this before agents quote, retrieve, remember, or publish from a source.

Prompt:

```text
Classify these sources into public_safe, client_safe, internal_ops, or private: [sources]. For each source, define read use, quote use, memory use, publish use, approval required, and risk if misused. Choose the stricter tier when unsure.
```
EOF
      ;;
    6)
      cat <<'EOF'

### Build your operating system

Operating artifact: Memory Proposal

Use this when an agent notices something that may deserve to become durable knowledge.

Prompt:

```text
Convert this observation into a memory proposal, not a memory: [observation]. Include source, event, proposed memory, confidence, privacy tier, approval owner, links, allowed projections, and review date.
```
EOF
      ;;
    7)
      cat <<'EOF'

### Build your operating system

Operating artifact: Controller Routing Policy

Use this to make delegation visible instead of hiding it inside a prompt.

Prompt:

```text
Draft a controller routing policy for these task types: [tasks]. Include risk class, required evidence, preferred owner, fallback owner, approval gate, confidence threshold, and refusal condition.
```
EOF
      ;;
    8)
      cat <<'EOF'

### Build your operating system

Operating artifact: Operating Map

Use this to close the harness layer before expanding authority.

Prompt:

```text
Create an operating map for my agentic system. Map intake, routing, trace, artifact storage, approval, memory, spend, mobile unblock, client-safe proof, and rollback. Return the top five missing controls.
```
EOF
      ;;
    9)
      cat <<'EOF'

### Build your operating system

Operating artifact: Permission Slip

Use this before an agent receives a new action, tool, source, or audience.

Prompt:

```text
Create a Permission Slip for this agent request: [request]. Include requested action, side effect class, data involved, tools involved, approval owner, expiration, evidence required, allowed scope, forbidden scope, and revocation path.
```
EOF
      ;;
    10)
      cat <<'EOF'

### Build your operating system

Operating artifact: Quarterly Cull

Use this to remove polished work that no longer creates value.

Prompt:

```text
Run a Quarterly Cull on this agent portfolio: [agents]. Score proof delivered, owner, approver, permission validity, cost, risk, and whether we would build it again. Recommend keep, narrow, pause, or retire.
```
EOF
      ;;
    11)
      cat <<'EOF'

### Build your operating system

Operating artifact: Agentic PRD Packet

Use this before building or expanding an agent workflow.

Prompt:

```text
Write an Agentic PRD Packet for this workflow: [workflow]. Include outcome, operator, scope fences, allowed inputs, forbidden inputs, expected artifacts, acceptance tests, approval gates, owner, risks, rollback path, and retirement condition.
```
EOF
      ;;
    12)
      cat <<'EOF'

### Build your operating system

Operating artifact: Pod Model

Use this when multiple agents touch the same outcome.

Prompt:

```text
Design a pod model for these agents: [agents]. Include pod purpose, human owner, router, inputs, outputs, approval gates, handoff rules, and failure mode. Keep final authority with humans unless explicitly approved.
```
EOF
      ;;
    13)
      cat <<'EOF'

### Build your operating system

Operating artifact: Handoff Contract Card

Use this wherever one agent, automation, or human hands work to another.

Prompt:

```text
Create a Handoff Contract Card. Sender: [sender]. Receiver: [receiver]. Work: [work]. Include required artifact, source evidence, assumptions, confidence, open questions, acceptance criteria, refusal conditions, trace pointer, and human owner.
```
EOF
      ;;
    14)
      cat <<'EOF'

### Build your operating system

Operating artifact: Evaluation Loop

Use this before expanding an agent's permission.

Prompt:

```text
Design an Evaluation Loop for this agent: [agent]. Include captured run fields, rubric criteria, automated judge role, human sample rule, pass threshold, hold threshold, rollback trigger, and permission decision. Do not treat judge score as final authority.
```
EOF
      ;;
    15)
      cat <<'EOF'

### Build your operating system

Operating artifact: Agent Metrics Ladder

Use this to separate activity from quality, trust, cost, and outcomes.

Prompt:

```text
Create an Agent Metrics Ladder for this workflow: [workflow]. Separate activity, quality, trust, cost, and outcome metrics. Identify which metrics can expand authority and which are diagnostic only.
```
EOF
      ;;
    16)
      cat <<'EOF'

### Build your operating system

Operating artifact: Review Posture Card

Use this so human review is specific, not ceremonial.

Prompt:

```text
Create review instructions for this approval packet: [packet]. Define review posture, first evidence to inspect, approve condition, reject condition, request-revision condition, escalation condition, required comment, and trace evidence to check.
```
EOF
      ;;
    17)
      cat <<'EOF'

### Build your operating system

Operating artifact: Spend Envelope

Use this before an agent can recommend or trigger paid work.

Prompt:

```text
Create a Spend Envelope for this agent-requested spend: [request]. Include requesting agent, approving human, amount limit, currency, counterparty, purpose, allowed window, maximum retries, evidence, trace link, revocation path, and forbidden actions.
```
EOF
      ;;
    18)
      cat <<'EOF'

### Build your operating system

Operating artifact: Decision Brief

Use this when agents prepare evidence for consequential decisions.

Prompt:

```text
Draft a Decision Brief for this decision: [decision]. Include context, options, recommendation, reversibility, what would change our mind, decision owner, approval deadline, evidence gaps, and rollback path. Argue the strongest rejected option fairly.
```
EOF
      ;;
    19)
      cat <<'EOF'

### Build your operating system

Operating artifact: Mission Control Cockpit

Use this to design the first screen an operator needs every morning.

Prompt:

```text
Design a Mission Control cockpit for my agentic system. Include status strip, daily brief, approvals, blocked work, stale or failed runs, cost signals, agent roster, trace drilldowns, and mobile unblock links.
```
EOF
      ;;
    20)
      cat <<'EOF'

### Build your operating system

Operating artifact: Unblock Ladder

Use this before agent approvals move into Slack, Teams, email, or mobile.

Prompt:

```text
Create an Unblock Ladder for my mobile agent actions. Define status-only actions, low-risk approve/decline actions, route or assign actions, revision requests, escalations, actions that must deep-link to the main cockpit, forbidden mobile actions, and trace events.
```
EOF
      ;;
    21)
      cat <<'EOF'

### Build your operating system

Operating artifact: Client-Safe Proof Packet

Use this when a client, funder, executive, or board asks for evidence.

Prompt:

```text
Create a client-safe proof packet outline for this workflow: [workflow]. Include capability boundaries, scoped trace references, delegation evidence, approval decisions, cost or spend authority summary, export scope, ledger metadata, exclusions, and reviewer notes.
```
EOF
      ;;
    22)
      cat <<'EOF'

### Build your operating system

Operating artifact: Foundry Test

Use this before turning an idea into a build.

Prompt:

```text
Run a Foundry Test on this idea: [idea]. Score demand signal, monetization path, builder fit, build velocity, differentiation, and release readiness. Add evidence, risks, prototype scope, commercialization path, and the human gate before build.
```
EOF
      ;;
    23)
      cat <<'EOF'

### Build your operating system

Operating artifact: AutoResearch Proposal

Use this when the system should propose research without executing it.

Prompt:

```text
Create an AutoResearch proposal for this operating question: [question]. Include title, hypothesis, experiment config, expected impact, baseline, metric gate, touched files or settings, risk, rollback, promotion recommendation, approval question, next metric gate, and result status: not_run.
```
EOF
      ;;
    24)
      cat <<'EOF'

### Build your operating system

Operating artifact: Three-Panel Demo

Use this to prove the operating system without pretending everything worked.

Prompt:

```text
Design a Three-Panel Demo for this audience: [audience]. Use queue, trace, and memory panels. Add what to show, what not to show, privacy exclusions, likely questions, and the proof file or export to provide.
```
EOF
      ;;
    25)
      cat <<'EOF'

### Build your operating system

Operating artifact: Six-Beat Day

Use this to turn agent work into a daily operating rhythm.

Prompt:

```text
Create my Six-Beat Day brief from this agent activity: [activity]. Organize into brief, route, review, approve, recover, and learn. End with: What did I approve today that I should have questioned?
```
EOF
      ;;
    26)
      cat <<'EOF'

### Build your operating system

Operating artifact: Accountability Stack

Use this to close the book with a roadmap for your own agentic OS.

Prompt:

```text
Create an Accountability Stack for my agentic operating system. Use source, event, proposal, memory, routing, action, approval, cost/spend, export, and rollback. For each layer, define owner, evidence, privacy tier, approval gate, failure mode, and next improvement.
```
EOF
      ;;
  esac
}

append_chapter_with_block() {
  local chapter="$1"
  local file="$2"
  printf "\n\n"
  cat "$CHAPTER_DIR/$file"
  builder_block "$chapter"
}

{
  cat <<'EOF'
# Agentified

## The Product Leader's Guide to Superhuman Acceleration Built on Trust

Vambah Sillah

Workbook-enhanced draft assembled on 2026-07-04.

Status: expanded production draft for author review.

---

## How to use this book

This book is a story, but it is also a build guide.

## The A.M.I.N.A. process

Sam does not discover the operating system alone. He finds Amina, the named agentic guide who refuses to let speed outrun responsibility. In the story, Amina helps Sam see the work behind the work: the sources, approvals, receipts, boundaries, costs, and consequences that make agentic production trustworthy.

In the workbook, A.M.I.N.A. becomes the process you can carry into your own organization:

- Align the work: name the outcome, the human stake, and the decision being prepared.
- Map the authority: define what the agent can read, write, remember, recommend, spend, or route.
- Instrument the receipt: require trace, source, artifact, owner, cost, approval state, and rollback path.
- Negotiate the gate: decide what needs human approval before the agent can move forward.
- Audit the outcome: review what happened, what changed, what was learned, and whether authority should expand or shrink.

### A.M.I.N.A. inside SAM

![A.M.I.N.A. inside SAM](/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/visuals/rendered/figure-3-amina-inside-sam.png)

SAM gives the team a way to accelerate learning. A.M.I.N.A. gives the reader a way to keep that acceleration governed while agents prepare work.

## What you will build

At the end of each chapter, you will build one piece of your own agentic operating system. Do not copy Sam's company. Do not copy Portfolio. Copy the discipline: name the work, define the scope, preserve the source, route the decision, require approval, track the cost, export proof, and keep a rollback path.

By the end, you should have a working operating-system packet:

- operating map
- agent job descriptions
- receipts
- source safety ladder
- memory proposal flow
- routing policy
- approval gates
- spend envelope
- Mission Control sketch
- client-safe proof packet
- daily operating rhythm
- accountability stack

---

## Table of contents

- The A.M.I.N.A. process
- A critical note on agent safety
- Act I: The Harness
  - Chapter 1: The First Receipt
  - Chapter 2: Agents Need Jobs Not Vibes
  - Chapter 3: Start With The Decision
  - Chapter 4: The Trace Harness
  - Chapter 5: Data Safety Becomes Source Safety
  - Chapter 6: From Feedback To Memory
  - Chapter 7: The Controller Brain
  - Chapter 8: The Operating Map
- Act II: Authority
  - Chapter 9: The Permission Slip
  - Chapter 10: The Priority Trap Returns
  - Chapter 11: PRDs For Agents
  - Chapter 12: Swarms Need Org Charts
  - Chapter 13: Handoffs Are Product Interfaces
  - Chapter 14: The Evaluation Loop
  - Chapter 15: Metrics That Matter For Agents
  - Chapter 16: Human Review Is The Trust Layer
  - Chapter 17: Money Needs A Gate
  - Chapter 18: The Decision Theater Rebuilt
- Act III: The Agentified Organization
  - Chapter 19: Mission Control
  - Chapter 20: Slack Is The Unblock Lane
  - Chapter 21: Client-Safe Proof
  - Chapter 22: The Mobile Foundry Test
  - Chapter 23: AutoResearch Without Autonomy Theater
  - Chapter 24: The Board Demo
  - Chapter 25: The Agentified Day
  - Chapter 26: What Comes Next
- Appendix: Frameworks and operating tools
- Appendix: Endnotes
- Appendix: Author review decisions
EOF

  append_chapter_with_block 0 "ch00-critical-note-on-agent-safety.md"

  cat <<'EOF'


# Act I: The Harness

Before agents earn authority, their work has to become visible, reviewable, and recoverable.
EOF
  append_chapter_with_block 1 "ch01-the-first-receipt.md"
  append_chapter_with_block 2 "ch02-agents-need-jobs-not-vibes.md"
  append_chapter_with_block 3 "ch03-start-with-the-decision.md"
  append_chapter_with_block 4 "ch04-the-trace-harness.md"
  append_chapter_with_block 5 "ch05-data-safety-becomes-source-safety.md"
  append_chapter_with_block 6 "ch06-from-feedback-to-memory.md"
  append_chapter_with_block 7 "ch07-the-controller-brain.md"
  append_chapter_with_block 8 "ch08-the-operating-map.md"

  cat <<'EOF'


# Act II: Authority

Once agent work is visible, the hard question changes: what are agents allowed to do, and who grants that authority?

Amina's next discipline is to map authority before expanding it. An agent can prepare useful work long before it should be allowed to create side effects. The ladder below gives the reader a simple way to see the climb.

### Figure II.1: Authority ladder

![Authority ladder](/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/visuals/rendered/figure-ii-1-authority-ladder.png)

Authority should climb only when evidence climbs with it. The higher the side effect, the stronger the receipt, gate, and rollback path must be.
EOF
  append_chapter_with_block 9 "ch09-the-permission-slip.md"
  append_chapter_with_block 10 "ch10-the-priority-trap-returns.md"
  append_chapter_with_block 11 "ch11-prds-for-agents.md"
  append_chapter_with_block 12 "ch12-swarms-need-org-charts.md"
  append_chapter_with_block 13 "ch13-handoffs-are-product-interfaces.md"
  append_chapter_with_block 14 "ch14-the-evaluation-loop.md"
  append_chapter_with_block 15 "ch15-metrics-that-matter-for-agents.md"
  append_chapter_with_block 16 "ch16-human-review-is-the-trust-layer.md"
  append_chapter_with_block 17 "ch17-money-needs-a-gate.md"
  append_chapter_with_block 18 "ch18-the-decision-theater-rebuilt.md"

  cat <<'EOF'


# Act III: The Agentified Organization

The demo can impress a room. The operating rhythm is what survives Monday morning.
EOF
  append_chapter_with_block 19 "ch19-mission-control.md"
  append_chapter_with_block 20 "ch20-slack-is-the-unblock-lane.md"
  append_chapter_with_block 21 "ch21-client-safe-proof.md"
  append_chapter_with_block 22 "ch22-the-mobile-foundry-test.md"
  append_chapter_with_block 23 "ch23-autoresearch-without-autonomy-theater.md"
  append_chapter_with_block 24 "ch24-the-board-demo.md"
  append_chapter_with_block 25 "ch25-the-agentified-day.md"
  append_chapter_with_block 26 "ch26-what-comes-next.md"

  cat <<'EOF'


# Appendix: Frameworks and operating tools

For full blank worksheets, examples, and longer prompts, use the companion workbook:

`/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/workbook/agentified-operating-system-workbook.md`

| Framework | Chapter | Production treatment |
| --- | --- | --- |
| Agent Work Receipt | 1 | Table or worksheet |
| Agent JD | 2 | One-page worksheet |
| Decision Card | 3 | Card template |
| Trace Harness | 4 | Five-question diagram |
| Source Safety Ladder | 5 | Ladder diagram |
| S-E-P-M Pipeline | 6 | Flow diagram |
| Controller Loop | 7 | Loop diagram |
| Operating Map | 8 | Lifecycle map |
| Permission Slip | 9 | One-page form |
| Quarterly Cull | 10 | Scoring table |
| Agentic PRD Packet | 11 | Checklist |
| Pod Model | 12 | Org chart |
| Handoff Contract Card | 13 | Interface card |
| Evaluation Loop | 14 | Loop diagram |
| Agent Metrics Ladder | 15 | Ladder diagram |
| Review Postures | 16 | Matrix |
| Spend Envelope | 17 | Approval packet |
| Decision Brief | 18 | Brief template |
| Cockpit Loop | 19 | Operating loop |
| Unblock Ladder | 20 | Ladder |
| Scoped Proof Loop | 21 | Export flow |
| Foundry Test | 22 | Rubric |
| AutoResearch Ladder | 23 | Gate flow |
| Three-Panel Demo | 24 | Presentation storyboard |
| Six-Beat Day | 25 | Daily rhythm |
| Accountability Stack | 26 | Stack diagram |
EOF

  printf "\n\n"
  cat "$ENDNOTES"

  cat <<'EOF'

# Appendix: Author review decisions

- Final subtitle selected: The Product Leader's Guide to Superhuman Acceleration Built on Trust.
- Decide whether the safety note remains a safety note or becomes a preface.
- Decide how much workbook material belongs inside the book versus companion workbook.
- Decide which diagrams get created first.
- Decide whether any real Portfolio screenshots, route names, or traces are approved for public use.
- Decide how formal endnote markers should be inserted in the prose during the next revision pass.
- Decide whether to prepare a PDF/EPUB proof next or expand examples further first.
EOF
} > "$OUT"

wc -w "$OUT"
