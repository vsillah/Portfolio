# Accelerated L09-L16 contextual review

This package records the reproducible local source and Human-QA receipts for the approved Accelerated L09-L16 contextual walkthroughs.

## Approved artifact binding

- Draft PR: `#1270`
- Source commit: `ee9c32231a880788c4537b7b531ead72184215d6`
- Narration pack SHA-256: `a0952c90bdea643245e69ef64cee022dc6b670a129c455bec4e57c394de2c245`
- Desktop walkthrough SHA-256: `e3d56170ac6e5ba2d9968c139de17dbd9848ac4b15da7bfa96c9b70a4eea03d3`
- Portrait walkthrough SHA-256: `77670556bc97a1bc729bc09c94c315b09d8a38e84bf928739edf5fe11c4540f8`
- Consolidated receipt SHA-256: `7327975f1cc5922da3bd004f7b1af9b797f57005b6a220e4167da0f51aa97fdf`

The portrait presenter section is `(18, 526, 354, 200)`. It is inset to the same 18-pixel content lane as the presentation, retains the native source aspect ratio, and no longer reads wider than the teaching composition.

## Reproduction

The walkthroughs require the locally preserved, already-qualified narration files and provider timestamp responses. They are intentionally not copied into Git. Place those files in a local directory and set `ACCELERATED_NARRATION_ROOT` to that directory. The builders default outputs to `.local/accelerated-l09-l16-contextual-review`; override this with `ACCELERATED_REVIEW_OUTPUT` when needed.

```bash
ACCELERATED_NARRATION_ROOT=/absolute/path/to/qualified-narration \
  python3 scripts/qa/build-accelerated-l09-l16-contextual-reviews.py

ACCELERATED_REVIEW_OUTPUT=.local/accelerated-l09-l16-contextual-review \
  python3 scripts/qa/build-accelerated-l09-l16-consolidated-human-qa.py
```

Expected narration filenames follow `L09-J01-original.wav`, `L09-J02-replacement-original.wav`, and `L10-J01-original.wav` through `L16-J02-original.wav`, with matching `*-provider-response.json` files where the timing builder requires provider-returned timestamps. The batch receipt binds every local input and output to its SHA-256 digest.

## Validation represented by the receipts

- All eight desktop and portrait contextual masters decoded completely.
- The consolidated desktop and portrait walkthroughs decoded completely.
- Audio identities, cue boundaries, optional captions, controls, presenter handoffs, and responsive compositions were checked.
- All eight portrait presenter states were visually inspected after the width correction.
- Human QA approved the aligned presenter lane, contextual narration, illustrations, compact text, optional captions, controls, and responsive layouts.

## Exclusions

This package changes no learner-media binding. It authorizes no provider contact, spending, merge, deployment, publication, or release.
