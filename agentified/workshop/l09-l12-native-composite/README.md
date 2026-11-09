# Agentified L09-L12 native composites

Provider-free review package built from the four approved HeyGen native sources.

- The native source audio remains continuous and unchanged.
- Presenter video appears only for the approved opening and closing passages.
- Teaching plates replace presenter footage through the instructional sections.
- A synchronized 45-second countdown separates the guided exercise from the closing section.
- Each output ends with its approved provider-free closing card.
- The immutable execution authorization binds the exact source, batch, requests, look, voice, scope, and zero-retry limits.
- Batch and lesson receipts fail closed when that authorization is absent, altered, stale, or mismatched.
- Learner-facing playback remains unchanged pending Human QA and integration approval.

Run:

```bash
node agentified/workshop/l09-l12-native-composite/render.mjs
node agentified/workshop/l09-l12-native-composite/build-walkthrough.mjs
node agentified/workshop/l09-l12-native-composite/validate.mjs
node --test agentified/workshop/l09-l12-native-composite/execution-authorization.test.mjs
```
