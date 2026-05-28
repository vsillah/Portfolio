# Agentic Content Challenger Loop

Status: Review packet standard for agentic content assets
Primary plan: [`docs/agentic-value-communications-plan.md`](agentic-value-communications-plan.md)

## Purpose

Use this packet before any agentic content asset reaches Vambah for human-in-the-loop approval.

The loop is simple:

1. Build from an approved source packet.
2. Draft against a channel spec.
3. Send the draft to Amina, the Agentic Challenger role.
4. Repair only the challenger findings.
5. Re-run the challenger.
6. Route to human review only after `pass_to_human=true`.

This follows the same discipline as Portfolio AutoResearch: bounded proposal, evidence check, iteration trace, and approval gate. The challenger is not the approver. The challenger decides whether the work is ready to ask a human for approval.

## Role Contract

| Role | Responsibility | Boundary |
| --- | --- | --- |
| Creator | Drafts or adapts the asset from approved sources and the channel spec. | Does not send to human review directly. |
| Amina, Agentic Challenger | Enumerates unsupported claims, implementation drift, source gaps, privacy risk, duplicated work, weak logic, and channel mismatch. | Does not rewrite or approve publication. |
| Repair agent | Fixes only the challenger issue list and records what changed. | Does not hide unresolved findings. |
| Verifier | Confirms required fixes were applied and sets challenger status. | Does not override privacy or source conflicts. |
| Vambah / Shaka approval surface | Makes the final human decision after challenger clearance. | Approval still controls publication, rendering, provider calls, and public/client release. |

## Packet Template

```yaml
asset_id:
channel:
source_ids: []
draft_version:
loop_round:
creator_agent:
challenger_agent: Amina
challenger_prompt_version:
challenge_findings: []
unsupported_claims: []
source_conflicts: []
privacy_flags: []
implementation_drift: []
required_fixes: []
fixes_applied: []
residual_risks_for_human: []
challenger_status: needs_revision # needs_revision | passed | blocked
pass_to_human: false
approval_status: not_ready # not_ready | human_review_ready | approved | revise | held
```

## Gate Rules

- `pass_to_human=true` only when unsupported claims, source conflicts, critical privacy flags, and implementation drift are resolved or explicitly marked as residual human decisions.
- `approval_status=human_review_ready` only when `challenger_status=passed`.
- Provider work for HeyGen, ElevenLabs, Remotion, HyperFrames, or publishing remains blocked until both challenger clearance and the existing render or publishing approval packet are complete.
- Private source material can shape voice and structure, but it should not appear in public copy unless Vambah explicitly approves it.
- If a draft duplicates an existing PRD, brief, LinkedIn draft, or script, create an adaptation note instead of a new content item.

## Challenger Prompt

Use this prompt pattern for the first simulated reviewer pass:

```text
You are Amina, the Agentic Challenger for Portfolio's agentic content system.

Review the attached source packet, channel spec, and draft. Do not rewrite the draft. Enumerate issues only.

Find:
- unsupported claims
- implementation drift
- source gaps
- source conflicts
- privacy or public-safety risks
- duplicated work that should be adapted instead
- channel mismatch
- weak logic or unclear value framing
- provider/render/publishing steps that need approval first

Return:
- challenger_status: needs_revision, blocked, or passed
- pass_to_human: true or false
- challenge_findings
- required_fixes
- residual_risks_for_human

Set pass_to_human=true only if the draft is sourced, public-safe, channel-fit, and free of blocking implementation drift.
```

## Acceptance Scenarios

| Scenario | Expected challenger status | Human review? |
| --- | --- | --- |
| Draft claims autonomous production mutation without source proof. | `blocked` | No |
| Draft repeats existing content without a new channel adaptation purpose. | `needs_revision` | No |
| Draft includes private logs, raw chat exports, client data, or secrets. | `blocked` | No |
| Draft has one unresolved positioning choice but no factual/privacy risk. | `passed` with residual risk | Yes |
| Draft is source-backed, public-safe, channel-fit, and verified after repair. | `passed` | Yes |
| Script requests HeyGen or ElevenLabs generation before clearance. | `blocked` | No |

## Human Review Packet

When the loop passes, send only the compact packet unless Vambah asks for the full trace:

- final draft or asset outline,
- source IDs and proof notes,
- challenger status,
- findings summary,
- fixes applied,
- residual human decisions,
- approval request.

The goal is not to make the human do the agent's QA work. The goal is to make the human decision clearer.
