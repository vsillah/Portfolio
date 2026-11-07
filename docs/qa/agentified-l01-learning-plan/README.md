# Agentified L01 learner binding QA

These captures use the local production build at `/agentified/learningplan?lesson=L01&revision=local-binding-qa` with an empty guest state. The walkthrough shows the direct L01 player, exact read-along cues, L02 video lock, Operating File return surface, and mobile player and transcript. No learner responses, member identity, or account data were captured.

Viewport widths checked in the rendered browser: 1251, 834, and 390 CSS pixels. The Chrome capture backend returns extra blank canvas; `build-walkthrough.sh` crops that canvas to the rendered page before making the MP4. The video is a sequence of captured UI states, not a recording of the full nine-minute lesson.

Build: `bash docs/qa/agentified-l01-learning-plan/build-walkthrough.sh`

The member review uses the same learner route after sign-in. Account persistence was covered by the existing member flow and focused state tests; no member login, claim, or submission occurred during this QA pass.
