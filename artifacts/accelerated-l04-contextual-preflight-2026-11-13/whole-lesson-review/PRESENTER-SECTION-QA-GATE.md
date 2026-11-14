# L04 presenter-section and caption QA gate

**Status: portrait single-image correction passed local technical and rendered checks; Integration Captain review pending.** The presenter stays in a dedicated native-background section beside the enlarged illustration on desktop and below one focused image on portrait. The source video and illustrations do not overlap. This correction changes only portrait presenter-on picture frames. Desktop MP4, portrait presenter-free scenes, audio, both optional WebVTT tracks, cue times, and spoken words are unchanged.

The original collision and failed positioning tests remain in [the prior gate](PRESENTER-SECTION-QA-GATE-before-caption-placement.md). The passing [caption receipt](portrait-caption-qa-receipt.json) binds the revised track and browser checks.

- Desktop MP4 SHA-256: `a56cee03509ebb46030a4582a19887875c3568cea94cf8a4141ba47ee91efd86`.
- Portrait MP4 SHA-256: `85c0a94bebfa0934da942070a812685be7397077607edf634409b6cd3472d1a8`.
- Desktop optional VTT SHA-256: `3773ab5ceec12987ddf3837bc30390613f5b0d18cbf527bcea4a6e3f615e6691`.
- Portrait optional VTT SHA-256: `597f740705c236174463180a57cafb94deb7c784c67f7e7f14f74960719f18a5`.

Both tracks contain 149 nonoverlapping cues and all 1,211 canonical words in identical order at identical times. Only 23 portrait presenter cues have a layout-specific position and optional line break. Their longest two-line cue stays within the native video frame over the lower torso, below the face and above the controls. Cutaway cues retain the earlier qualified placement. Captions off leave the full illustration and presenter layout without a reserved caption band.

The exact [local browser review](http://127.0.0.1:8768/artifacts/accelerated-l04-contextual-preflight-2026-11-13/whole-lesson-review/review.html?rev=a56cee03-85c0a94b-597f7407) has both encoded MP4s. Use the native captions menu to compare on and off. The local range-capable server must remain running; MP4 and VTT files remain available directly if it stops. The [single-image receipt](portrait-single-image-qa-receipt.json) binds the corrected portrait composition, audio equivalence, and browser checks; its preflight gate records one active teaching image layer for each presenter passage.

**Next gate:** Integration Captain first-pass review, then Vambah's renewed full-lesson Human QA with sound. The previous portrait approval does not cover this corrected MP4. No learner media, commit, push, PR update, deployment, or release occurred for this correction.
