# L05-02–08 measured-padding checkpoint

Status: **PASS for review-only L05-02–08 candidates; unbound**. Padding base is draft PR #1290 `d047960edcf58bc2c75b3a944fe22a5d8ad25bb4`. Caption dependency is separate draft PR #1293 at `46b2c166ec012a06b8e0a458d6c189c5911f4a03`, whose consolidated L05 clearance receipt and README cover the exact L05 source MP4/VTT and L05-01 candidate bytes. No branches were restacked or merged.

Seven L05-02–08 frames were rendered in lesson order into `frames/illustrated/`. Sixteen measured teaching panels fit their glyphs with 28 px padding. Every candidate preserves source pixels outside the old/new panel unions. L05-07's protected worksheet frame is byte-identical to its original. Desktop stills and 390×844 review clip frames show the teaching labels inside their panels with no new clipping or collision. The L05-04 approved diagram, L05-07 writing area, and L05-08 file page remain complete.

Desktop and mobile context clips for all seven scenes decode and retain the exact mapped L05 source MP4 and VTT. The scene sampler now uses a clip shorter than eight seconds when the scene itself is shorter; L05-06 is 7.748 seconds long and is sampled for 7.648 seconds. L05-07 is sampled before the protected countdown, and L05-08 before the protected presenter ending. No source timing, audio, caption words, presenter frames, or protected content changed.

`verify-l05-resume-checkpoint.py` binds the seven frame receipts and fourteen clips to the source map and exact caption-branch receipt. It checked 168 L05-02–08 learner-route caption states across 1280 and 390 widths, including S/M/L, cue bands below the video, controls, scene edges, and on/off/restoration records. The caption branch's full exact-commit packet reports 242 learner states, six L05-01 candidate states, 86 focused tests, four decoded walkthroughs, and the 16-lesson media-binding verifier; its own README records theme, paused restoration, and protected ending coverage. These are **source-route** checks. The new L05-02–08 padding frames are review-only and are not bound to the learner route; no claim of candidate-in-learner playback is made.

Next lesson-order scene: L06-01. The consolidated before/after MP4, candidate binding, Human QA, merge, deployment, publication, and release remain pending. The two pre-existing untracked L10 WAVs were untouched.

Reproduce:

```bash
python3 agentified/workshop/phase-3b-review/text-panel-padding/verify-l05-resume-checkpoint.py
```
