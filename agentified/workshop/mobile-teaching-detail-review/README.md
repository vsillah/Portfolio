# Mobile teaching detail review

This corrective lane is stacked on PR #1291 at `2139a1364`. It replaces the L05-only hero condition with a source-bound scene map. L05–L16 were inspected in lesson order against the approved 128-scene audit. Fifteen scenes use approved publication plates with teaching-critical embedded labels; at 390×844 their native player is 292×164 CSS pixels, so the small text requires a separate reading view. Every mapped scene has one approved raster, an exact SHA-256 match to the staged public copy, and the audited half-open cue window. No scene outside those windows gains a reading view.

The mobile panel presents the complete raster beneath the native player, followed by short verbatim labels and supporting lines transcribed from that exact plate. It is hidden at desktop width. The video, audio, VTT, presenter, controls, worksheets, posters, endings, and replay bindings were not edited. No provider was contacted.

`receipt.json` is the immutable browser and source check for code commit `0846a639ac69b9a11eda200ef14d7c16b695a359`. `record_mobile_teaching_details.cjs` checks all 15 start, midpoint, and end transitions at 1280×800 and 390×844, desktop hiding, mobile visibility, source URLs, native controls, source hashes, and caption on/off behavior at L06. The consolidated MP4s scroll through the reading panels; the six scene screenshots and one caption-off screenshot show L06, L10, and L16. External browser requests were blocked during capture. The MP4s decoded without errors.

Validation:

- `vitest run app/agentified/AgentifiedLessonHero.test.tsx app/agentified/AgentifiedWorkshop.test.tsx`: 36/36 passed.
- `tsx scripts/verify-agentified-illustrated-binding.mjs`: 16/16 source, composite, caption, transcript, and duration bindings passed.
- `node agentified/workshop/presentation-illustration-audit/validate.mjs`: 128 audited scenes and 16 exact-duration composites passed.
- `vitest run app/agentified lib/agentified`: 80 passed, 3 existing launch-campaign expectation failures. The same three failures are recorded on the PR #1291 base.
- `tsc --noEmit --pretty false`: failed in unrelated campaign, social, generated-content, and test-dependency files; no errors were reported in the files changed by this lane.

This is a draft PR review packet. It does not claim release or full spoken-course qualification.
