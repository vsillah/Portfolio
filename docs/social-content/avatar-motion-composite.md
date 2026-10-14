# Social avatar plus motion composite

`social_avatar_motion_composite_v1` is the default production stage for eligible YouTube and YouTube Shorts records that combine an approved HeyGen presenter with an approved motion master.

It extends the existing Social Content and video-production contracts. It does not create another publishing workflow.

## Required packet

Every run must bind:

- Social Content ID and approved content version
- exact approved script and script hash
- selected approved avatar ID and version
- selected approved voice ID and version
- current consent and rights authorization binding that avatar and voice
- current privacy and source receipts bound to the content version
- approved motion-master path, hash, probe, and aspect ratio
- one-job provider authorization with an expiry, maximum script size, worst-case billing rate, maximum billable duration, and a total cap strictly below US$10

Missing, expired, stale, mismatched, or unavailable inputs fail before generation. The live provider catalog must confirm that the avatar exists and that the voice has a currently allowed generation engine.

## Idempotency and failure recovery

The idempotency key binds every material input, including avatar and voice versions, script and motion hashes, content version, aspect ratio, and authorization ID.

The runner writes a local reservation before the provider request. A completed receipt is reusable. `reserved`, `submitted`, or `failed` state requires reconciliation and cannot silently create another job. A repaired avatar, voice, script, or authorization must produce a new packet version and a new idempotency key.

## Native composition

The native HeyGen MP4 remains the presenter visual and audio source of truth. The approved motion master is rendered separately. FFmpeg places the presenter only in bounded hook, explanation, and close windows, while the dashboard remains the primary teaching artifact. Presenter audio is delayed into the same windows and mixed over the otherwise silent motion master.

The manifest records the complete FFmpeg command, source and output hashes, provider job and cost receipt, presenter windows, and all protected execution gates. Final validation requires playable audio, matching duration and dimensions, customer-frame sanitation, and source/final presenter-window comparison.

## Protected gates

Generation and review never authorize YouTube upload, platform-draft creation, scheduling, publishing, external sending, credential changes, or unrelated/shared-row mutation. Those gates remain false in the manifest and protected review route.
