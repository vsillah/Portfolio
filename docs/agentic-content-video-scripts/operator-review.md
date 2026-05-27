# Agentic Video Operator Review

Date: 2026-05-27
Status: Pilot reviewed and held for approval

## Scope

This phase added the missing human-in-the-loop edit control for pending video drafts and used it to clean the first agentic AI pilot before any generation job starts.

## Pilot Reviewed

- Source packet: Episode 1, `The Receipt Every Agent Needs`
- Queue item id: `9f9dd8f1-9d19-48ff-bedf-2a5779a44be8`
- Status after review: `pending`
- Linked generation job: none
- Script length after review: `2386` characters
- Storyboard scenes: `5`
- B-roll hints: `home`, `admin`, `admin`, `tools`, `resources`

The queued draft was moved back from the generated title `The Essential Receipt for Every Agent` to the source title `The Receipt Every Agent Needs`. The script now matches the reviewed Episode 1 source packet rather than the more polished LLM rewrite.

## Product Change

The Admin Video Generation Decide queue now supports a review/edit pass before generation:

- `Review/Edit` opens editable title, script, and storyboard JSON fields.
- `Save Review` writes the pending draft through the admin API.
- The Generate Video action is disabled while review mode is open.
- The API only allows updates for pending drafts with no linked generation job.
- The API rejects missing titles, missing scripts, scripts over the HeyGen 5,000-character limit, and invalid storyboard JSON.

This keeps the video workflow extensible for HeyGen and ElevenLabs while preserving a human approval gate between AI drafting and media generation.

## Approval Gate

No HeyGen job, ElevenLabs job, n8n audio regeneration, B-roll capture, or publishing action was started.

Before render, Shaka should approve:

- final title and script,
- five-scene storyboard,
- whether to capture B-roll assets for the five hints,
- presenter mode, template, avatar, and voice settings,
- and whether this pilot should move into a HeyGen render.

## Known Runtime Notes

- The workflow-status route still reports `column video_generation_workflow_runs.agent_run_id does not exist` in local dev.
- The HeyGen avatar endpoint can hit a Next cache warning when the provider response exceeds 2 MB.
- The B-roll library showed no currently matched assets during the visual smoke; the storyboard hints are ready, but capture remains a separate approval step.
