# Module 0 Render Handoff Checklist

Status: blocked until script-intelligence approval
Provider execution: locked until explicit approval

This checklist is the bridge from the revised Module 0 asset packet into the existing Portfolio video-generation workflow. It does not authorize render-readiness approval, HeyGen, ElevenLabs, Remotion, HyperFrames, upload, scheduling, or publishing jobs.

## Target Workflow

- Primary review surface: `/admin/content/video-generation`
- Course source packet: `docs/accelerated-course-modules/module-0-video-assets`
- Primary lesson script: `primary-lesson-script.md`
- Avatar script segments: `heygen-segments.md`
- Narration option: `elevenlabs-narration.md`
- Composition spec: `storyboard-render-spec.md`
- Caption source: `captions/module-0-primary.srt`
- Thumbnail source: `thumbnail-briefs.md`

## Preflight Steps

1. Open the Module 0 packet and confirm the revised script, Shorts package, thumbnail briefs, and privacy checklist have passed Script Intelligence review.
2. Confirm the selected render mode:
   - default: HeyGen avatar plus Portfolio/AmaduTown b-roll,
   - fallback: ElevenLabs narration plus slide-first visuals.
3. Review all b-roll surfaces before capture. Public pages are allowed; admin screens require crop, redaction, or demo data.
4. Confirm the title and closing cards render at `1920x1080` and preserve the AmaduTown logo aspect ratio.
5. Confirm captions are regenerated or manually checked after any script edit.
6. Confirm no provider job, upload, social draft, schedule, or publish row exists before the explicit render approval.

## Approval Gate Required Before Execution

The next human approval must explicitly name which actions are approved:

- `heygen_generation`
- `elevenlabs_generation`
- `broll_capture`
- `render_preflight`
- `final_render`
- `upload`
- `schedule`
- `publish`

Approval for one action does not imply approval for the others.

## Ready-To-Queue Criteria

Module 0 can move from `ready_for_script_intelligence_review` to render-readiness preflight only when:

- Script Intelligence review is approved,
- privacy review is passed,
- b-roll sources are public-safe or redacted,
- avatar/narration provider choice is confirmed,
- cost/quota risk is accepted,
- the operator confirms the job is local review only,
- external upload, scheduling, and publishing remain locked.
