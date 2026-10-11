# Deterministic visual binding QA

This packet exercises the Agent Ops theme repair and Social Content deterministic visual-recipe binding without touching a live row or calling a media provider.

## Scope

- Agent Ops routes: `/admin` (compact radar) and `/admin/agents` (full radar plus operations side rail).
- Synthetic Social Content route: `/admin/social-content/deterministic-visual-binding-qa?step=visuals&qa=deterministic-visual-binding&qa_state=ready`.
- Recipe states covered: persisted/ready, unsupported reserved template, unsaved aspect change, saved/rebuilt/validated, current rendered asset, and the visual approval/rejection decision gate.
- Themes covered: persisted `System` resolved against a light OS preference, plus explicit `Dark`.
- Viewports covered in both themes: 390×844, 768×1000, and 1440×1000.
- Workflow order verified in the rendered DOM: recipe → save/rebuild/validate → render → review → approve or reject.
- The compact recipe keeps editable template, constrained visual type, and aspect ahead of render. Its explicit disclosure exposes render mode, system and renderer versions, template ID/label, copy/candidate/recipe versions, headline, argument map, nodes, connectors, rationale, and provenance.
- The provider-art-direction field stays collapsed, names its future consumer, and is excluded from both synthetic recipe-save and render request bodies. The deterministic path exposes no active image-prompt control.
- Unsupported template/type combinations fail closed. An aspect change disables rendering until the exact recipe is persisted and rebuilt; render then fences the persisted SHA-256 recipe version.
- The runner records Agent Ops surface luminance, the Social Content lane width, representative text contrast, horizontal overflow, browser errors, exact synthetic request bodies, and MP4 playability.
- Provider receipt: `provider=none`, `model=null`, `status=not_called`, `external_call=false`.
- Shared database writes, shared storage writes, provider calls, platform drafts, uploads, scheduling, publishing, and external sends: zero.

The synthetic fixture is enabled only for development, test, or Vercel preview contexts and is explicitly disabled when `VERCEL_ENV=production`.

## Evidence

- `390-system-light-walkthrough.mp4`, `768-system-light-walkthrough.mp4`, and `1440-system-light-walkthrough.mp4` — inherited System/light repair and complete recipe path.
- `390-dark-walkthrough.mp4`, `768-dark-walkthrough.mp4`, and `1440-dark-walkthrough.mp4` — explicit Dark regression and complete recipe path.
- `results.json` — persisted/resolved themes, Agent Ops luminance, exact workflow order and recipe, version fence, prompt exclusion, content-lane widths, contrast ratios, overflow, page errors, playable-video durations, and no-egress counters.
- Representative PNGs preserve the compact/full Agent Ops surfaces, effective inputs, unsupported combination, unsaved recipe, current asset, and decision gate without duplicating every video frame.

The publication asset itself contains only public-facing content and the AmaduTown Advisory Solutions brand footer. Provider, deterministic-render, internal-review, and Human-QA metadata remain in the review UI and receipt rather than the PNG.

All MP4 files are H.264 with `yuv420p` pixel format and fast-start metadata.

## Reproduce

```bash
./node_modules/.bin/tsx scripts/generate-deterministic-visual-qa-asset.ts
npm run build
SOCIAL_DETERMINISTIC_VISUAL_QA_FIXTURE=true MOCK_N8N=true N8N_DISABLE_OUTBOUND=true \
  ./node_modules/.bin/next start --hostname 127.0.0.1 --port 4033
QA_BASE_URL=http://127.0.0.1:4033 node scripts/qa/deterministic-visual-binding.cjs
```

The QA runner blocks external browser requests, permits only the synthetic recipe PUT and render POST, asserts the five-step workflow order and zero active deterministic image-prompt controls, verifies exact recipe persistence and render-version fencing, asserts zero unexpected mutations, and fails on theme drift, light/dark surface regression, contrast failure, horizontal overflow, browser errors, or unplayable MP4 output.

For a protected Git preview, keep Deployment Protection enabled and let the linked Vercel project inject its short-lived development OIDC token without printing or persisting it:

```bash
QA_BASE_URL=https://exact-preview.vercel.app \
QA_SOURCE_COMMIT=<exact-preview-commit> \
  vc env run -- node scripts/qa/deterministic-visual-binding.cjs
```

The recorder sends the token only through the origin-scoped Vercel Trusted Sources header before navigation. `results.json` records the preview base URL and source commit, never the token.
