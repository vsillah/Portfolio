# L06-01 measured-padding stop

Status: **STOP / review-only / unbound**. The padding lane began at draft PR #1290 `fab07bad364f2e658e3f384cd7eb754eec989f95`, with the exact caption dependency draft PR #1293 `46b2c166ec012a06b8e0a458d6c189c5911f4a03`. Neither branch was restacked or merged.

The L06-01 candidate fits “A role needs a permission slip.” in a measured lower-left panel. Its source illustration, gate, lock, slip, and surrounding art remain intact. The mapped source MP4 and VTT match their recorded hashes. Desktop and 390×844 review-only clips decode; the sampler placed both at 17.1395–25.1395 seconds, after the 0–13.64 second protected native presenter window. These clips retain the source audio and caption words, but the candidate frame is **not** bound to the learner route.

The first blocking state is the **desktop learner route with medium captions on**, paused at 20.7168 seconds. In Chrome at `http://127.0.0.1:3137/agentified/learningplan?lesson=L06`, the three-line cue beginning “If the agent quietly treats that as permission” crosses the source video’s lower-left headline “A role needs a permission slip.” The browser screenshot was observed in the task’s computer-use trace. The new candidate keeps that headline in the same lower-left caption band, so it cannot be cleared as a content-aware padding change. This is a source-route caption/art collision; it is not evidence of candidate-in-learner playback.

Stop before L06-02. The L06-01 mobile candidate clip was generated and decoded, but the mobile caption matrix, S/L caption sizes, off/restoration, theme, adjacent boundaries, and controls were not attempted after the first desktop failure. The exact L06 caption branch needs a separate caption-placement or scene-layout clearance, followed by reinspection of L06-01 on the revised exact head before the padding sweep resumes.

No caption wording/timing, audio, approved illustration, native presenter, controls, lesson completion, Aa behavior, theme, media binding, deployment, or release artifact changed. The two pre-existing untracked L10 WAVs were untouched.

Evidence: `l06-01-stop-receipt.json`, `candidate-receipt-L06-01.json`, `frames/illustrated/L06-01.png`, and the two `checks/lesson-order/L06-01-*.mp4` clips with companion VTTs. The clips are source-bound review simulations, not learner-route qualification.
