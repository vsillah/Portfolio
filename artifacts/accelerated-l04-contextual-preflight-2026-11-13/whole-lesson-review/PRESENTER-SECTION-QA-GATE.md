# L04 presenter-section and caption QA gate

**Status: revised local candidate passed technical and rendered checks; Integration Captain review pending.** The presenter stays in a dedicated native-background section beside the enlarged illustration on desktop and below it on portrait. The source video and illustrations do not overlap. This revision changes the desktop video composition only. The portrait MP4, both optional WebVTT tracks, cue times, and spoken words are unchanged.

The original collision and failed positioning tests remain in [the prior gate](PRESENTER-SECTION-QA-GATE-before-caption-placement.md). The passing [caption receipt](portrait-caption-qa-receipt.json) binds the revised track and browser checks.

- Desktop MP4 SHA-256: `a56cee03509ebb46030a4582a19887875c3568cea94cf8a4141ba47ee91efd86`.
- Portrait MP4 SHA-256: `71fbfdafbcb7c29be9c23de2d5c5f40cc15a7fcbb82adb999ac90653d20635f4`.
- Desktop optional VTT SHA-256: `3773ab5ceec12987ddf3837bc30390613f5b0d18cbf527bcea4a6e3f615e6691`.
- Portrait optional VTT SHA-256: `597f740705c236174463180a57cafb94deb7c784c67f7e7f14f74960719f18a5`.

Both tracks contain 149 nonoverlapping cues and all 1,211 canonical words in identical order at identical times. Only 23 portrait presenter cues have a layout-specific position and optional line break. Their longest two-line cue stays within the native video frame over the lower torso, below the face and above the controls. Cutaway cues retain the earlier qualified placement. Captions off leave the full illustration and presenter layout without a reserved caption band.

The exact [local browser review](http://127.0.0.1:8768/artifacts/accelerated-l04-contextual-preflight-2026-11-13/whole-lesson-review/review.html?rev=a56cee03-71fbfdaf-597f7407) has both encoded MP4s. Use the native captions menu to compare on and off. The local range-capable server must remain running; MP4 and VTT files remain available directly if it stops. The [desktop expansion receipt](desktop-expanded-qa-receipt.json) binds the new composition, audio equivalence, and browser checks.

**Next gate:** Integration Captain first-pass review, then Vambah's full-lesson Human QA with sound. No learner media, commit, push, PR update, deployment, or release occurred.
