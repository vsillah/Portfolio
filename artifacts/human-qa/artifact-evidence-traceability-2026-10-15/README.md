# Artifact Evidence Traceability QA

Protected production-equivalent fixture:

`/admin/social-content/f966123f-05eb-48ec-a7c2-970afce642ef?step=copy&qa_fixture=channel_native_video_v2&video_package_state=ready`

## What this proves

- The artifact stays clean until **Trace evidence** is enabled.
- Numbered regions and trace-list entries share the same manifest order.
- A numbered region opens a compact source-lineage detail with bounded input, source identity, evidence and rights/privacy receipts, version, transformation, visibility, and a protected authoritative deep link.
- Keyboard activation works, and the trace/list/detail layout remains usable at 390 px.
- Private source material is represented only by an approved redacted summary.
- The fixture made no production/shared writes, provider calls, media renders, uploads, platform drafts, schedules, publications, credential changes, or external sends.

## Evidence

- `desktop-1440-clean.png`
- `desktop-1440-trace.png`
- `desktop-1440-detail.png`
- `mobile-390-clean.png`
- `mobile-390-trace.png`
- `mobile-390-detail.png`
- `artifact-evidence-trace-walkthrough.mp4`

The MP4 is H.264, 1440×900, 25 fps, approximately 14.5 seconds, and contains the desktop and mobile review paths.

## Reproduce

```bash
QA_BASE_URL=http://localhost:5227 node scripts/qa/record-artifact-evidence-trace.mjs
```

The recorder remaps the existing gitignored admin storage state in memory, blocks Vercel analytics, observes no other external requests, and deletes raw browser captures after producing the review MP4.
