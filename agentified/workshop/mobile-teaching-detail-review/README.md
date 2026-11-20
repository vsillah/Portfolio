# Mobile teaching detail review

This corrective lane is stacked on PR #1291 at `2139a1364`. It replaces the L05-only hero condition with a source-bound scene map. L05–L16 were inspected in lesson order against the approved 128-scene audit. Fifteen scenes use approved publication plates with teaching-critical embedded labels; at 390×844 their native player is 292×164 CSS pixels, so the small text requires a cue-bound reading aid. Those scenes use the existing `/agentified/workshop/` public rasters, exact SHA-256 matches to the approved sources. The redundant five-file public copy was removed. L07-07 adds one text-only gate line during the protected original countdown, 188.515–233.515 seconds, within the audited 160.078–233.648 scene. Its exact wording is bound to the unchanged source renderer and video hashes. No scene outside those windows gains a reading aid.

The mobile panel presents short verbatim labels and supporting lines transcribed from the approved plate, or the exact L07-07 gate sentence. It has no image: the native video remains the only visible teaching illustration. Plate scenes offer `Open full plate`, which pauses playback and opens the complete approved high-resolution raster in a separate tab; the text-only L07-07 scene has no image action. The panel is hidden at desktop width and leaves no permanent caption or reading space outside its cue. The video, audio, VTT, presenter, controls, worksheets, posters, endings, and replay bindings were not edited. No provider was contacted.

`receipt.json` is the immutable browser and source check for code commit `26c3de8c5c679de9c79d87cb1de04aeb3ab2ca85`. `record_mobile_teaching_details.cjs` checks all 16 start, midpoint, and end transitions at 1280×800 and 390×844, desktop hiding, mobile visibility, zero added images, source URLs where applicable, native control clearance, source hashes, and captions on/off for every mobile scene. The L07 sample has no active caption and no full-plate action. The recorder also opens the L06 full-plate link, checks the approved raster dimensions, and confirms playback pauses. The consolidated MP4s scroll through the reading panels; eight scene screenshots and two caption-off screenshots show L06, L07, L10, and L16. External browser requests were blocked during capture. The MP4s decoded without errors.

Validation:

- `vitest run app/agentified/AgentifiedLessonHero.test.tsx app/agentified/AgentifiedWorkshop.test.tsx`: 37/37 passed.
- `tsx scripts/verify-agentified-illustrated-binding.mjs`: 16/16 source, composite, caption, transcript, and duration bindings passed.
- `node agentified/workshop/presentation-illustration-audit/validate.mjs`: 128 audited scenes and 16 exact-duration composites passed.
- `vitest run app/agentified lib/agentified`: 80 passed, 3 existing launch-campaign expectation failures. The same three failures are recorded on the PR #1291 base.
- `tsc --noEmit --pretty false`: failed in unrelated campaign, social, generated-content, and test-dependency files; no errors were reported in the files changed by this lane.

This is a draft PR review packet. It does not claim release or full spoken-course qualification.
