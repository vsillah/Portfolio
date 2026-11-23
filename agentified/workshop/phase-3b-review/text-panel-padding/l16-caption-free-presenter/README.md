# L16 caption-free presenter review

This source-only packet replaces the burned-caption pixels inside the two existing L16 presenter panels. The caption-free export came from the retained HeyGen job `25b6988235318f42abadd8b3b76c1a9c`, using its existing 1080p download with burned-in captions off. No job was submitted or regenerated; the download UI presented no fee. The source is bound by SHA-256 `350c259baa900d6eef9fc35a4f96ef5cb25ea0001c23d69f00fff9f82f356f87`.

`build.mjs` binds the approved illustrated composite, original presenter, clean export, backdrop, timeline, and VTT hashes. It rebuilds only the opening and closing presenter panels at the approved coordinates, then copies the illustrated composite's audio and embedded subtitle streams. The learner binding in this PR remains unchanged.

## Reproduce

From the repository root:

```bash
node agentified/workshop/phase-3b-review/text-panel-padding/l16-caption-free-presenter/build.mjs
```

The resulting candidate and binding receipt are in this folder. `record-route.cjs 3152` exercised the candidate through a disposable worktree at PR #1295 head `7bb6267c9fb98172679e161aafa208dfc7a276c3`. That worktree temporarily points L16 to the candidate and updates the local completion hash and L16 `video.ended` condition from the separate draft PR #1294. Those route changes are not in this PR.

Desktop 1280×844 and mobile 390×844 contextual recordings, stills, and an exact route check log are in `route-evidence/`. The route recordings are visual-only browser captures. Audio-bearing opening and closing clips include the presenter joins; the candidate audio bitstream is copied unchanged from the approved composite. `validation-receipt.json` lists hashes, stream parity, decode results, route checks, and limitations.

This packet is review-only. It does not bind learner media or authorize merge, deployment, publication, or release.
