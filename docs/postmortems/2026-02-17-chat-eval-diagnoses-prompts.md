# Postmortem: Chat Eval Diagnoses & Prompt Traceability (2026-02-17)

## Summary

Session focused on fixing Chat Eval admin flows (chats not showing, diagnose errors, diagnosis detail), aligning system prompt apply behavior with the DB (system_prompt → chatbot), adding version-history ↔ diagnosis traceability, and centralizing prompt display names across the workflow.

## What went well

- **Structured debug approach** — Evidence-before-fix and instrumentation were used for behavioral bugs (batch 500, list returning 0 rows); root causes were identified before changing code.
- **Schema + code parity** — Migration for `diagnosis_id` was written to disk in `migrations/` and applied via Supabase MCP; project rule (migration file on disk) was followed.
- **Single source of truth for names** — `lib/constants/prompt-keys.ts` (PROMPT_DISPLAY_NAMES, getPromptDisplayName) is used in admin prompts list, prompt history, diagnosis detail, and Chat Eval Queues so naming is consistent.
- **Bidirectional traceability** — From a diagnosis, users can open System Prompts and the specific prompt; from prompt version history, "View source diagnosis" links back to the error diagnosis when the version was applied from one.
- **RLS awareness** — Migration added only a column and FK; no new RLS policies, so no circular-reference risk. Supabase RLS rule was referenced when running the migration.

## What could improve

- **Embed/FK qualification** — Diagnoses list and detail APIs failed until `chat_sessions.channel` was removed and embeds used explicit FK names (e.g. `chat_sessions!error_diagnoses_session_id_fkey`). Earlier check of PostgREST embed rules (or project rule like supabase-embed-disambiguation) could have shortened the fix cycle.
- **Target key mismatch** — The LLM judge was recommending `system_prompt` while the DB uses `chatbot`; this wasn’t obvious until apply was tested. Documenting “prompt key = DB key” (and mapping any LLM output to it) in one place (e.g. llm-judge or a small doc) would reduce repeat mistakes.
- **Naming rollout** — Prompt naming was centralized in one pass (prompts list, history, diagnosis, queues). If similar “display name” maps are added elsewhere, consider reusing or extending the same constant module.

## Action items

| Priority | Action | Owner |
|----------|--------|--------|
| Low | Add a one-line note in `lib/llm-judge.ts` or docs: “Recommendation target must be a DB prompt key (e.g. chatbot, voice_agent), not system_prompt.” | — |
| Low | When adding new prompt keys, update `lib/constants/prompt-keys.ts` and any queues/channels that reference them. | — |

## References

- Migration: `migrations/2026_02_17_add_diagnosis_id_to_system_prompt_history.sql`
- Prompt names: `lib/constants/prompt-keys.ts`
- Apply route (diagnosis_id + change_reason): `app/api/admin/chat-eval/diagnoses/[id]/apply/route.ts`
- History UI (View source diagnosis): `app/admin/prompts/[key]/history/page.tsx`
- Rules: `.cursor/rules/supabase-rls.mdc`, migration-rollout-checklist, filter-all-option, enum-sync-checklist
