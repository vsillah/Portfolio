# L07-01 Session Option Brief source correction

Status: **review-only, unbound**. This package starts from PR #1296 head `a07b0a62a4226176a2276a613da4da8863ce5d8f`. It replaces only the registered L07-01 visual interval `0–27.99` seconds. The full candidate retains every later L07 scene, including the L07-07 blank writing workspace and approved L07-08 closing composition.

The source script and L07 scene packet describe a synthetic type card on a neutral field, with no approved L07-01 plate. The brief compares the room, attendance, and facilitator notes. The facilitator claim appears as “Confirmed,” is struck when the narrator calls it wrong, and changes to the source wording “Available for review.” The three rows stay populated after the presenter exits. The final card asks the exact source question when the narration begins its requirement questions. These are raster PNG states drawn as one complete clipboard, not cropped fragments or a final SVG teaching illustration.

`build-plates.py` uses Pillow and the local Avenir Next font to produce the complete raster field and eight timed states. `build.mjs` checks source hashes, applies the retained caption-free presenter at the original `1048,326,768,432` panel rectangle and `0–9.37` window, and copies the previous candidate's audio and embedded subtitle streams. The panel uses the same studio backdrop, outline, aspect ratio, and chroma treatment as the earlier approved closing correction. No provider call or generated source is required.

From Portfolio root:

```bash
node agentified/workshop/phase-3b-review/text-panel-padding/l07-01-source-brief/build.mjs
```

`candidate-receipt.json` binds the input, raster states, timing, output, and hashes. `validation-receipt.json` records stream, visual-parity, and exact learner-route results. The desktop and mobile MP4s under `route-evidence/` are screen recordings of the isolated synthetic guest route at 1280×844 and 390×844. `record-route.cjs` reproduces them after a temporary binding in a disposable checkout of player head `7bb6267c9fb98172679e161aafa208dfc7a276c3`; it does not change the PR's learner binding.

This candidate is not a Human-QA or release approval. The full Phase 3B matrix and captain integration review remain separate gates.
