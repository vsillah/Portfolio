# Artifact Evidence Traceability QA

Protected production-equivalent fixture:

`/admin/social-content/f966123f-05eb-48ec-a7c2-970afce642ef?step=copy&qa_fixture=channel_native_video_v2&video_package_state=ready`

## What this proves

- The artifact stays clean until **Trace evidence** is enabled.
- Numbered regions and trace-list entries share the same manifest order.
- A numbered region opens a compact source-lineage detail with bounded input, source identity, evidence and rights/privacy receipts, version, transformation, visibility, and a protected authoritative deep link.
- Applicable output elements expose a versioned numerical evaluation only inside selected proof: six 0–100 dimensions, weighting, thresholds, measurement basis, deterministic inputs, cohort/sample/freshness fields, rank/percentile when available, and exact receipt links.
- Missing benchmark, audience-fit, or originality evidence is shown as **Unscored** and holds advancement; zero is never used as a stand-in for unknown evidence.
- Keyboard activation works, and the trace/list/detail layout remains usable at 390 px.
- Private source material is represented only by an approved redacted summary.
- The fixture made no production/shared writes, provider calls, media renders, uploads, platform drafts, schedules, publications, credential changes, or external sends.

## Evidence

- `desktop-1440-clean.png`
- `desktop-1440-trace.png`
- `desktop-1440-detail.png`
- `desktop-1440-evaluation.png`
- `mobile-390-clean.png`
- `mobile-390-trace.png`
- `mobile-390-detail.png`
- `mobile-390-evaluation.png`
- `artifact-evidence-trace-walkthrough.mp4`

The MP4 is H.264 and contains the desktop and mobile review paths, including an expanded score-to-receipt calculation.

## Reproduce

```bash
QA_BASE_URL=http://localhost:5227 node scripts/qa/record-artifact-evidence-trace.mjs
```

The recorder remaps the existing gitignored admin storage state in memory, blocks Vercel analytics, observes no other external requests, and deletes raw browser captures after producing the review MP4.
