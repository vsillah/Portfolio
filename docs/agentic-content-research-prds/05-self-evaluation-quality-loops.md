# PRD 05: Self-Evaluation And Quality Loops

## Objective

Research the evaluation and feedback loops that let agents improve safely: rubrics, run scoring, budget checks, LLM judge surfaces, source validation, and coaching signals.

This chapter should argue that quality loops come before expanded authority.

## Research Questions

- Which self-evaluation patterns exist in Portfolio today?
- What is deterministic evaluation versus LLM-assisted evaluation?
- How do budget checks, failed runs, stale runs, and rubric scores create coaching signals?
- Which gaps remain before agents can revise outputs inline?

## Portfolio Evidence To Inspect

- `docs/agentic-patterns.md`
- `lib/agent-evaluations.ts`
- `app/api/admin/agents/runs/[runId]/evaluate/route.ts`
- `lib/llm-judge.ts`
- `lib/source-validator/llm-judge.ts`
- `app/admin/chat-eval`
- `lib/video-ideas-generation.ts`
- `lib/agent-budget-policy.ts`

## Public-Safe Claim Boundaries

- Do not publish private evaluation content, transcript excerpts, or raw chat sessions.
- Keep examples structural: rubric dimensions, score thresholds, pass/fail signals, budget decisions.
- Be clear that inline reflection is still minimal or planned where the scorecard says so.

## LinkedIn Output Target

- Format: builder insight post.
- Hook direction: "If an agent cannot evaluate its work, it should not get more power."
- Core point: self-evaluation is a promotion gate, not a decorative feature.
- Close: ask what quality evidence readers would require before trusting an agent with higher-risk work.

## Phase 2 Video Expansion

- YouTube angle: "The Evaluation Loop That Keeps Agents Honest."
- Target runtime: 5 to 7 minutes.
- Opening scene: a quality summary or run evaluation, then the rule that agents earn authority through evidence.
- Script framework fit: problem, quality loop, example, gap, recommendation.
- HeyGen suitability: strong with UI and chart B-roll.
- ElevenLabs suitability: optional audio for short clips.
- Storyboard/B-roll ideas: evaluation route, agent quality summary, Chat Eval, source validator, budget check events.
- Evidence needed before recording: a sanitized quality/evaluation example that does not expose private content.

## Acceptance Criteria

- Research memo separates built eval loops from planned reflection/debate/self-consistency work.
- Output includes at least one concrete quality gate and one remaining gap.
- LinkedIn recommendation ties evaluation to authority, not vanity metrics.
- Phase 2 notes include a screen-safe visual plan.

## UI Seeding Packet

Title: `Research PRD: Self-evaluation and quality loops`

Owner: Research Source Register

Runtime: codex

Narrative:
Research Portfolio's agent evaluation and feedback loops. Inspect the agentic patterns scorecard, agent evaluations, run evaluate route, LLM judge, source validator, Chat Eval, video ideas budget checks, and Agent Ops budget policy. Produce public-safe notes for a LinkedIn post and Phase 2 video on why agents should earn authority through evaluation. Acceptance: distinguish implemented quality loops from planned reflection work, name concrete gates, and avoid private transcript or chat content.
