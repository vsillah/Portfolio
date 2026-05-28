# Agentic Video Render Approval Packet

Date: 2026-05-27
Status: Ready for Shaka review, not approved for render
Approval owner: Shaka
Human reviewer: Vambah Sillah

## Decision Needed

Approve or hold the first agentic AI pilot video for a gated HeyGen render.

The pilot is `The Receipt Every Agent Needs`. It explains why traceability has to come before autonomy: every agent run needs a receipt showing who asked, which tools were touched, what evidence was used, what it cost, and where a human approval gate was required.

## Recommended Decision

Approve a controlled pilot render only after confirming the presenter settings and B-roll capture plan below.

This should be treated as a production rehearsal, not a publishing approval. Rendering the video creates a review artifact. Publishing to YouTube, LinkedIn, or any public channel remains a separate decision.

## Current Evidence

| Item | Value |
| --- | --- |
| Queue item id | `9f9dd8f1-9d19-48ff-bedf-2a5779a44be8` |
| Queue status | `pending` |
| Linked generation job | none |
| Source packet | `docs/agentic-content-video-scripts/wave-1-youtube-scripts.md` |
| Operator review | `docs/agentic-content-video-scripts/operator-review.md` |
| Title | `The Receipt Every Agent Needs` |
| Script length | `2386` characters |
| HeyGen limit | `5000` characters |
| Storyboard scenes | `5` |
| B-roll hints | `home`, `admin`, `admin`, `tools`, `resources` |

## Approved Scope If Shaka Says Yes

- Create one HeyGen review render from the pending draft.
- Use channel `youtube`.
- Use aspect ratio `16:9`.
- Use the reviewed title and script already saved in the queue item.
- Use the five-scene storyboard already saved in the queue item.
- Capture or attach only non-private B-roll that matches the five approved hints.
- Keep the output as an internal review artifact until a separate publishing approval exists.

## Not Approved In This Packet

- Publishing to YouTube, LinkedIn, the website, or social queues.
- Changing the script after approval without another review.
- Adding private client data, private admin logs, raw database records, secrets, or personal account details to B-roll.
- Starting ElevenLabs audio generation unless a later cutdown or native composite plan explicitly calls for it.
- Starting n8n audio regeneration or social publishing flows.
- Creating multiple render variations.
- Using paid external media generation beyond the one approved pilot render.

## Presenter Settings To Confirm

Recommended path:

- Presenter mode: HeyGen template mode.
- Template: AmaduTown template, if available.
- Voice: configured AmaduTown brand voice, if available.
- Fallback: configured HeyGen avatar and voice defaults.

Hold render if:

- no presenter default is configured,
- the selected avatar or voice does not match the AmaduTown brand,
- the generated preview would expose private admin or client material,
- or the operator cannot verify which external account will be charged.

## B-Roll Capture Plan

| Scene | Hint | Approved visual direction | Privacy rule |
| --- | --- | --- | --- |
| 1 | `home` | Direct-to-camera opening or public-safe homepage framing. | No account data. |
| 2 | `admin` | Abstract Agent Ops concepts: run, step, event, artifact, approval, cost. | Use synthetic labels or blurred/private-safe surfaces only. |
| 3 | `admin` | Mission Control or Agent Ops proof surface. | No client names, emails, tokens, or raw logs. |
| 4 | `tools` | Simple flow diagram: model output to trace, approval, handoff, audit summary. | Prefer generated/static diagram over live private data. |
| 5 | `resources` | Closing checklist: source, tool, handoff, approval, cost, safe summary. | Public-safe checklist only. |

Recommended capture order:

1. Capture or attach public-safe B-roll assets for `admin`, `tools`, and `resources`.
2. Re-open the pending draft in Admin Video Generation.
3. Confirm the draft still shows `2386 / 5000` characters and 5 scenes.
4. Confirm B-roll assets are linked only to approved hints.
5. Run the read-only Render readiness check.
6. Then request Shaka approval to render.

## Risk Review

| Risk | Level | Mitigation |
| --- | --- | --- |
| Paid external media job starts too early | Medium | Keep the queue item pending until Shaka approval is recorded. |
| Private admin/client data appears in B-roll | High | Use synthetic labels, public-safe screens, or static diagrams. |
| Script drifts back to generic AI voice | Medium | Use the reviewed source script already saved in the queue. |
| Render is mistaken for publish approval | Medium | Treat HeyGen output as an internal review artifact only. |
| Avatar/video composition quality is poor | Medium | Review the final MP4 and browser preview. If compositing is needed, use native FFmpeg composition with the source MP4 as visual truth. |

## Approval Record

Use this exact decision language in Shaka, Slack, or the Agent Ops approval surface:

```text
Approval request: Render one internal HeyGen pilot for "The Receipt Every Agent Needs".

Approved scope:
- One internal review render only.
- Queue item: 9f9dd8f1-9d19-48ff-bedf-2a5779a44be8.
- Channel: youtube.
- Aspect ratio: 16:9.
- Script: reviewed source script, 2386 characters.
- Storyboard: 5 scenes with hints home, admin, admin, tools, resources.
- B-roll: public-safe or synthetic only.

Not approved:
- Publishing.
- Multiple render variations.
- ElevenLabs generation.
- n8n audio regeneration.
- Social queue insertion.
- Private admin/client data in visuals.

Decision:
- Approve render
- Hold for B-roll capture
- Hold for presenter settings
- Request script revision
```

## Go Criteria

Render can proceed only when all are true:

- Shaka approval is recorded.
- Presenter/template settings are known.
- The queue item is still pending.
- `video_generation_job_id` is still empty.
- The script is still under 5000 characters.
- B-roll assets, if attached, are public-safe.

## Execution Gate

The Admin Video Generation render path now requires the operator to confirm this Shaka approval packet before HeyGen starts:

- Each expanded draft includes a read-only Render readiness check for draft status, script length, HeyGen config, storyboard count, and B-roll matches.
- The readiness check does not create a job, update the queue, call HeyGen, approve publishing, or replace Shaka approval.
- The single-draft Generate Video button stays disabled until the render gate checkbox is checked.
- The selected-draft batch Generate Videos button stays disabled until the batch render gate checkbox is checked.
- The single-draft and batch API routes reject requests without the render approval payload before reading draft queue records or calling HeyGen.
- The approval payload is scoped to one internal review render and explicitly excludes publishing approval.

## Stop Criteria

Stop before render if any are true:

- queue item status is no longer `pending`,
- a generation job already exists,
- script exceeds HeyGen limits,
- B-roll exposes private material,
- HeyGen credentials or billing account are unclear,
- or the operator cannot verify the selected avatar and voice.

## Roadmap Position

This packet now closes the gap between a reviewed script and a render-ready pilot. The next phase after Shaka approval is a controlled HeyGen render, followed by final MP4 review and a separate publishing packet.
