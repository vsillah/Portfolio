# Social avatar plus motion composite

`social_avatar_motion_composite_v1` is the default production stage for eligible YouTube and YouTube Shorts records that combine an approved HeyGen presenter with an approved motion master.

It extends the existing Social Content and video-production contracts. It does not create another publishing workflow.

## Required packet

Every run must bind:

- Social Content ID and approved content version
- exact approved script and script hash
- selected approved avatar identity/group ID, provider look ID, look version, and provider character type
- selected approved voice ID and version
- current consent and rights authorization binding that avatar and voice
- current privacy and source receipts bound to the content version
- approved motion-master path, hash, probe, and aspect ratio
- one-job provider authorization with an expiry, maximum script size, worst-case billing rate, maximum billable duration, and a total cap strictly below US$10

Missing, expired, stale, mismatched, or unavailable inputs fail before generation. The live provider catalog must confirm that the avatar and voice still exist. A provider validation failure blocks that version-fenced attempt and requires a newly selected and approved compatible asset; it never authorizes an automatic retry.

The current Jev recovery state is a Studio-versus-v2-API compatibility mismatch. In authenticated HeyGen Studio, the Red V-Neck avatar is paired with the Mad Hadda voice, the voice is marked as that avatar's default, and its preview plays. That proves Studio playback only. The v2 voice catalog reports an empty `allowed_engines` list for the owned Vambah/Mad Hadda voices, and the one authorized v2 job failed with `VOICE_CONFIG_ERROR`. The generation preflight therefore rejects a selected voice with no allowed v2 engines. Recovery requires positive v2-compatible engine evidence and a new version-bound packet and authorization; the existing failed idempotency key must not be retried.

## Owned-look catalog and rotation

The approved catalog is recorded in `artifacts/human-qa/artifact-video-review-2026-10-14/inputs/vambah-owned-avatar-look-catalog-v1.json`. Stable HeyGen identity/group IDs are stored separately from the look IDs submitted to generation. Digital-twin looks use `avatar`; owned photo looks use `talking_photo`.

For an eligible future video, `social_avatar_look_lru_v1` filters the catalog to looks that are user-owned, explicitly approved, currently available, compatible with the requested target, and bound to both source and consent/rights receipts. Public, third-party, pending, blocked, unavailable, receipt-incomplete, and target-incompatible entries are excluded. If a campaign pins an identity and look, that exact eligible look is used; an invalid pin fails closed rather than silently substituting another look.

Without a pin, selection is deterministic and least-recently-used. The immediately previous completed look is excluded when another eligible look exists. Never-used looks are preferred, older completed usage wins next, and a hash of the stable selection key and look ID breaks ties. Only completed provider jobs enter history: reserved, submitted, and failed attempts do not advance the rotation. Replaying the same version-bound inputs retains the same selection receipt and idempotency binding.

The selection receipt records the selector version, stable selection key, chosen identity and look, provider character type, reason, source and consent/rights receipts, and the completed history considered. The selected identity, look, version, and full selection receipt are material idempotency inputs for new enriched packets. Legacy packets remain byte-for-byte compatible so an existing failed or uncertain attempt cannot acquire a different key.

## Idempotency and failure recovery

The idempotency key binds every material input, including avatar and voice versions, script and motion hashes, content version, aspect ratio, and authorization ID.

The runner writes a local reservation before the provider request. A completed receipt is reusable. `reserved`, `submitted`, or `failed` state requires reconciliation and cannot silently create another job. A repaired avatar, voice, script, or authorization must produce a new packet version and a new idempotency key.

## Native composition

The native HeyGen MP4 remains the presenter visual and audio source of truth. The approved motion master is rendered separately. FFmpeg places the presenter only in bounded hook, explanation, and close windows, while the dashboard remains the primary teaching artifact. Presenter audio is delayed into the same windows and mixed over the otherwise silent motion master.

The manifest records the complete FFmpeg command, source and output hashes, provider job and cost receipt, presenter windows, and all protected execution gates. Final validation requires playable audio, matching duration and dimensions, customer-frame sanitation, and source/final presenter-window comparison.

## Protected gates

Generation and review never authorize YouTube upload, platform-draft creation, scheduling, publishing, external sending, credential changes, or unrelated/shared-row mutation. Those gates remain false in the manifest and protected review route.
