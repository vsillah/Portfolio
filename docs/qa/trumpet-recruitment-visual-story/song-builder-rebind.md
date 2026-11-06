# Song Builder slide 7 source rebind

This record is for the inactive Portfolio recruitment review in draft PR #1215. It replaces only the affected Song Builder social slide. The old slide remains at `public/showcases/trumpet-trainer/c19989a3/social/slide-07.png` and in the historical `docs/qa/trumpet-trainer-gameplay/social/` packet. Slides 1–6, the gameplay video, and their source claims remain tied to Trumpet Trainer `c19989a3b156ce97326e35b335e169014ca076f3`; they were not recaptured.

## Exact source

- Trumpet Trainer merge commit: `a558583a7b4a16919a9dae0a82718ff7ec4c4891`, merged source PR #15. Verified locally as an ancestor of Trumpet Trainer `origin/main`; it contains `app/src/builder.ts`, `tests/builder-notation.test.ts`, and `e2e/notation-clearance.cjs` changes.
- Production deployment receipt supplied by the Integration Captain: `dpl_D6wKQ2sMh8tpTZM91UXECrWs4eXU`.
- Approved synthetic two-note production screenshot: `source/after-1062.png`, 1062 × 1070, SHA-256 `4613e9d8f4785d4e922a2fe120435ae2cc131f2476cf180eb6df24741b965b5f`.
- Playable production walkthrough: `source/notation-walkthrough.mp4`, 1062 × 900, 25 fps, 6 seconds, SHA-256 `45ebbda1961027f966c9ce2d119c77504ff7d921782ea8def2cba7876ffb1eff`. Full FFmpeg decode passed.
- Both source files are byte-identical copies of the two supplied `/tmp/trumpet-production-notation-a558583a/` artifacts. No other capture is used for the new slide.

The screenshot and walkthrough visibly show Whole and Half duration glyphs contained within their buttons and the treble clef aligned against the five staff lines. This is a visual provenance statement for the corrected source state. It is not a claim that unchanged gameplay or slides 1–6 were retested on the new source commit.

## Derived asset

- `public/showcases/trumpet-trainer/a558583a/social/slide-07.png`, 1080 × 1350, SHA-256 `678bde6e836b3ebeda6c9356f00a4f9c879b9d4139002d5183eecba26f535a0e`.
- `build-song-builder-slide.sh` reproduces the composition with FFmpeg. It keeps the approved navy left copy and gold right frame from the historical slide. It clears only the old screenshot inside the frame, crops the corrected source at x=180..881 across all 1070 rows, scales it proportionally to 590 × 900, and centers it at x=456, y=210 on a purple matte. The crop includes all corrected notation, duration buttons, and controls. No glyph or clef is redrawn.
- The historical public slide 7 remains SHA-256 `b9f30d645f598b7f712ece1676b69f52f5bca531f5fac15ea21f0dc05c83ea72` and is not selected by this recruitment route.

The updated carousel component selects the derived asset only for slide 7. The route's provenance disclosures distinguish that source from the older gameplay and six unchanged slides. This asset remains review-only; no social publication or outreach is authorized.
