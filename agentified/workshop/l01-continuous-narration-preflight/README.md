# Agentified L01 continuous narration preflight

This packet corrects the review finding that the presenter may leave the frame while the approved narration must continue under instructional slides.

It prepares one HeyGen `create_speech` request using the already approved L01 script and Vambah avatar-native voice. It excludes the two accepted presenter passages, preserves their native audio, and keeps the intentional guided-work pause.

The packet does not authorize or perform provider execution, spending, retries, learner binding, publication, or distribution.

Run `node agentified/workshop/l01-continuous-narration-preflight/build.mjs` to regenerate the candidate, or add `--check` to verify it without changes.
