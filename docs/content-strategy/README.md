# Portfolio content strategy lane

Status: Lane operating packet
Date: 2026-06-28
Branch: `codex/content-strategy`
Worktree: `/Users/vambahsillah/Projects/Portfolio.worktrees/content-strategy`

## Scope

This lane owns content strategy artifacts for Portfolio social execution:

- social content calendar plans
- topic backlog and campaign sequencing
- LinkedIn and social draft workflows
- content intelligence review packets
- approval-gated publishing prep

It does not publish, schedule, upload, generate provider media, send external messages, or mutate production campaign queues without explicit approval.

## Source map

| Source | Use in this lane | Boundary |
| --- | --- | --- |
| `docs/linkedin-voice.md` | LinkedIn voice, post rhythm, hashtags, and anti-formula guidance. | Public-facing drafts must still pass human review. |
| Personality corpus pack | Vambah voice, content pillars, source sensitivity, and privacy rules. | Private-derived summaries inform tone only. Raw private exports stay out of artifacts. |
| `docs/automations/content-voice-runbook.md` | Corpus drift and content voice governance. | Agents may report and recommend; they do not move or quote private corpus files. |
| `lib/social-content-calendar.ts` | Canonical `whisper_to_shout` template, phases, required assets, and gates. | Do not invent phase enums. Store campaign phases as `tease`, `teach`, `proof`, and `offer`. |
| `supabase/migrations/20260623182842_social_content_calendar_items.sql` | Calendar item authorization contract. | `authorized` means internal draft handoff may proceed. It does not mean external publishing. |
| `docs/agentic-content-linkedin-drafts/` | Existing LinkedIn draft packet pattern. | Drafts are review artifacts, not posting instructions. |
| `docs/agentic-content-review-packets/` | Challenger review packet structure. | Challenger pass routes to human review only. |

## Operating rules

1. Start from campaign goal, audience, proof source, offer path, and approval gate before writing copy.
2. Use `whisper_to_shout` for launch arcs unless a product owner approves a different template.
3. Keep the remembered "Tease/Wispr/Shout" language as a planning overlay only. Canonical stored phases remain `tease`, `teach`, `proof`, and `offer`.
4. Separate raw inputs, source notes, draft copy, review findings, and publishing prep.
5. Mark every draft with `draft`, `human_review_ready`, `approved_for_internal_handoff`, or `blocked`.
6. Use Shaka for final publishing authority and Nefertiti for voice/public-claim review when a packet is ready.
7. Keep provider work separate: HeyGen, ElevenLabs, YouTube, LinkedIn, n8n, and scheduler actions all require explicit approval.

## Lane artifacts

- `accelerated-whisper-to-shout-campaign-plan.md`: 14-day campaign plan, calendar, topic backlog, source map, and review gates.
- `social-draft-workflow.md`: draft creation workflow, approval checklist, review packet template, and publishing prep boundary.

## Current roadmap status

Completed in this packet:

- Defined the Portfolio Content Strategy lane scope.
- Bound the lane to the existing campaign calendar model and approval gates.
- Added a first campaign plan and draft workflow packet.

Next:

- Human review of the campaign angles and backlog priority.
- If approved, create internal Social Content calendar items through the admin UI or a separately approved data path.
- After calendar creation, generate review-ready draft packets per phase.

Decision gate:

- No publishing, external scheduling, provider generation, or queue mutation is approved by these docs.
