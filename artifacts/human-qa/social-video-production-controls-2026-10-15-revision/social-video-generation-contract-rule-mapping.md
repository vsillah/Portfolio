# Social Video Generation Contract Rule Mapping

The durable contract is `SOCIAL_VIDEO_GENERATION_CONTRACT` in `lib/social-video-production.ts`. This file is evidence mapping for the Jev iteration, not a second contract.

| Learned requirement | Durable rule ID |
|---|---|
| Source research, outlier selection, topic, title, thumbnail, description, and script share evidence | `research.source_outlier_alignment`, `packaging.shared_version_bound_evidence` |
| Run the YouTube template before media; use specific practitioner copy, conclusion, and spoken CTA | `script.youtube_template_first`, `script.practitioner_specific`, `script.complete_conclusion`, `script.semantic_spoken_cta` |
| Keep prompts, code logic, receipts, QA labels, and operator notes out of customer frames | `frames.customer_facing_only` |
| Bind approved avatar, voice, and rights; rotate approved looks | `avatar.approved_identity_voice_rights`, `avatar.rotate_approved_looks` |
| Treat native avatar MP4 as visual truth and use native composite when embedding harms fidelity | `avatar.native_mp4_visual_truth` |
| Presenter-forward bookends; presenter large/left, assets right, smooth transitions | `layout.presenter_forward_bookends`, `layout.presenter_left_assets_right` |
| Preserve approved native motion, source hashes, and reduced-motion fallback | `motion.preserve_native_animation`, `motion.reduced_motion_fallback` |
| Show each cue-bound teaching asset once; no loop/filler; one teaching asset per frame | `assets.once_cue_bound_no_loop`, `assets.max_one_per_frame` |
| Inventory every approved asset and issue explicit omission receipts | `assets.complete_inventory_or_omission` |
| Synchronize assets and enforce padding, safe areas, and collision/clipping checks | `layout.synchronized_safe_uncrowded` |
| Use rights-cleared instrumental music, audible with moderate ducking, no vocals/loop, bounded fades | `music.rights_cleared_instrumental`, `music.audible_moderate_duck_no_loop` |
| Preserve voice timing/lip sync; DSP is EQ/dynamics only and cannot invent prosody or splice words deceptively | `voice.preserve_timing_lip_sync`, `voice.no_deceptive_word_splicing` |
| Keep provenance, rights, privacy, lineage, and field proof reviewable outside customer media | `provenance.reviewable_outside_media` |
| Validate duration, frames, decode, A/V sync, speech, CTA semantics, clipping, green spill, motion, repeats, overlap, and safe areas | `validation.exact_output_and_semantics`, `validation.fail_closed` |
| Keep render, provider, upload, platform draft, schedule, publish, and external send as separate gates | `gates.external_actions_separate` |
| Human QA includes exact in-app route, screenshot, playable MP4, change/value summary, review script, and next authorization | `human_qa.complete_review_packet` |
| Accepted exceptions bind to one artifact and input version and never change future defaults | `exceptions.artifact_only_no_default_drift` |

Jev exception: `social-video-review:jev:20261015:v2` at input `sha256:e6fc9ae4aadd61e3a871e8f7af2dd0a2d424d5c20ae6a8d0eac861b16e796bd5` may retain its visual-only CTA. The prospective default remains `spoken_cta_required: true`.
