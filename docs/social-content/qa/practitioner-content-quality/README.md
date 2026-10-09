# Practitioner content quality QA

This packet exercises the existing Social Content detail route with a synthetic, anonymized practitioner story. It does not read or mutate shared content.

Exact deployed QA route:

`https://portfolio-hyo1ftend-vsillahs-projects.vercel.app/admin/social-content/practitioner-content-quality-qa?step=copy`

The fixture exists only in local development, tests, and Vercel Preview. Production returns to the normal authenticated database path.

## Reviewed behavior

- Structured evidence shows the situation, operating constraint, practitioner detail, decision, result state, provenance boundary, and redaction status.
- The finished default candidate is a complete 1,800–2,100 character LinkedIn post in Vambah's grounded practitioner voice. It moves from a concrete weekly intake scene through the operating constraint, the proof-stacking mechanism, a bounded result, four operator questions, a practical takeaway, and a specific discussion prompt.
- A typed framework-application receipt binds the approved framework to exact visible copy beats, the approved voice reference, the performance-calibration state, and the correlational boundary. The fixture uses an explicit bounded fallback because no measured post-performance history is attached; its static reference shapes voice and structure only.
- The deterministic AmaduTown candidate renders the full argument as a five-stage operator system map: context, constraint, decision mechanism, bounded result, and practical takeaway. It uses fixed typography, palette, grid, logo placement, safe area, and responsive platform geometry.
- The approval gate fails closed when the framework is null, only named rather than applied, missing voice or performance calibration, paired with thin copy, or represented by a sparse visual. `Ready` is impossible until evidence, specificity, privacy, framework, voice, performance, copy, and visual gates all pass.
- The fixture identifies itself as read-only, explains the boundary, provides a recovery link, and disables save, approval, and rejection controls.
- Post Text, Voiceover Script, and Saved spoken script share one content-aware editor: a readable six-line minimum, natural growth with the script, responsive caps, and internal vertical scrolling only after the active cap. Compact non-script fields retain their prior height.
- Legacy provider-generated imagery is comparison evidence only and remains unapproved.

## Responsive evidence

- `390-read-only-fixture.png`, `390-blocked-gate.png`, `390-practitioner-review.png`, `390-argument-visual.png`, and `390-walkthrough.mp4`
- `768-read-only-fixture.png`, `768-blocked-gate.png`, `768-practitioner-review.png`, `768-argument-visual.png`, and `768-walkthrough.mp4`
- `1440-read-only-fixture.png`, `1440-blocked-gate.png`, `1440-practitioner-review.png`, `1440-argument-visual.png`, and `1440-walkthrough.mp4`
- Each viewport also includes medium-content `*-post-text-editor.png` and `*-voiceover-script-editor.png` captures plus matching `*-over-cap.png` captures.
- `results.json` records computed height, minimum, maximum, scroll height, overflow behavior, and resize behavior for short, medium, and over-cap content at every viewport, along with the no-egress and no-mutation assertions.

## Reproduction

For a protected Vercel preview, use the linked Portfolio project's short-lived development OIDC token without printing or persisting it:

```bash
vc env run --cwd /Users/vambahsillah/Projects/Portfolio -- \
  sh -c 'cd "$1" && QA_BASE_URL="$2" node scripts/qa/practitioner-content-quality.cjs' \
  sh /Users/vambahsillah/.codex/worktrees/491f/Portfolio \
  https://portfolio-hyo1ftend-vsillahs-projects.vercel.app
```

The Playwright script reads the fixture from the deployed Social Content detail API; it does not intercept that endpoint. It supplies synthetic browser auth, records the blocked state followed by the finished review state, blocks Vercel feedback/analytics scripts and unrelated admin dependencies, asserts zero external requests and API mutations, and converts each viewport recording to MP4 with FFmpeg.

No model, media, upload, scheduling, publishing, or external provider call is part of this QA packet.
