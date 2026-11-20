# Risk register

| ID | Risk | Evidence | Gate / owner |
| --- | --- | --- | --- |
| R1 | Final illustrated media could be mistaken for fully approved release media | `lib/agentified-illustrated-bindings.json` says `human_qa_pending`; prior presentation audit reports widespread defects | Captain reconciles current fixes and receipts; Vambah reviews contextual lessons at desktop and mobile only after fresh build/video evidence. |
| R2 | L01 completion presentation differs from other lessons | No L01 entry in `lib/agentified-end-screens.ts` | Phase 3 confirms intended end-screen and repairs hash-bound binding if approved. |
| R3 | Browser completion and saved credential eligibility may diverge | Playback end screen is time-based; completion is manual; credential reads completed rows | Phase 4 tests full synthetic learner path, including replay, unmark, claim and verification. |
| R4 | Guest work can be device-bound or stale | Local storage only until explicit claim; validator rejects state older than 90 days | Phase 4 documents recovery/export and tests guest-to-member transition without exposing responses. |
| R5 | Workshop is publicly reachable without a decided offer or entitlement model | Book page links directly to Learning Plan | Phase 5 decides access, book/service relationship and publication language before marketing. |
| R6 | Mobile bandwidth and caption/visual crowding | 226.1 MB bound MP4 total; prior visual audit defects | Phase 3 and 5 measure 390×844 rendering and media loading on realistic network; avoid rebuilding approved sources. |
| R7 | Account assessment and credential data handling may be underexplained | Authenticated member routes, human assessment submission and verification link exist | Phase 4/5 review privacy, retention, support and revocation with synthetic data; no customer-data audit here. |
| R8 | Historic approval receipts may not match current release build | Multiple immutable media variants exist; binding contains exact hashes | Every release packet binds commit, media hash, caption hash, route and QA artifact. |
| R9 | L01's encoded container duration exceeds the bound duration by 0.226 seconds | `ffprobe` values in `manifest.json` | Phase 2 checks final caption and end-screen timing against actual playback; do not infer a content defect from this metadata difference alone. |
