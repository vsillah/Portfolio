# Agentified L09–L12 continuous narration preflight

This is an internal, provider-free production packet bound to Portfolio source commit `cb44c2389b4281aac7dae33d835363ae35c42ea2`. The four approved lesson scripts and eight-scene production packets are the source of truth. The lesson player remains video locked. No HeyGen contact, avatar/voice generation, upload, purchase, production binding, or learner release occurred.

Run `node agentified/workshop/l09-l12-continuous-preflight/build.mjs --check` to verify exact generated candidates against the source hashes. Run `node agentified/workshop/l09-l12-continuous-preflight/capture.mjs` to capture the silent internal review at desktop and mobile widths; it verifies all 16 lesson/state combinations at each width, plate containment, countdown movement, and decoded MP4 output.

## Source and timing bindings

| Lesson | Packet SHA-256 | Script SHA-256 | Candidate SHA-256 | Provisional run time | Approved plates | Operating File |
| --- | --- | --- | --- | ---: | ---: | --- |
| L09 | `5bbe9c3259a039e1b008fe10d59c2c067aca21f8858f750d6fb1231dcf800f80` | `fc1388fa740bf355a821a7e37ce065a49ed0ed95af25b5e62a29a2aeb093dc79` | `cb89bf17ea0df2de96018439b3b54ce13aa5b4fbe017724b7c9ab5047c556fcd` | 314 s | 2 | v9 `metrics-and-review` |
| L10 | `265b07c07604510aee75e39fd0ef658e05cba86f8db01e1b2fd3c41d85f38459` | `689d6c0b2fe4c93a08fcc8043e33ccf30c33b9c4eeec43c5ab2f1db69a` | `19a70e94acb9c75e633535211ce54af1b4e1075f2ec5da7d40048c90593694a8` | 307 s | 1 | v10 `spend-and-decision-brief` |
| L11 | `1302b2a29c6b0bcec3d1d049bc7b53de25ab9a8d72c3dfa65dc7af368297fde1` | `adafcfec9e4a83cc5e279c73e2b6e5f1f1df25237f00b30b76ed930e8bdb599d` | `7a139886e0f6b35daf35bab1b44ab4eb582127cd4aadedbcf59f810011cc74b8` | 307 s | 1 | v11 `cockpit-and-unblock` |
| L12 | `8ec927a1785e5cc9aa1f910d2c998d704334ba0587d0d803d0cff60d1d9bf84b` | `5201a7b99266d2a7f227679e3b7719ae42d6322ac6f6ce053b780b6c4d1dc4e4` | `56498ca2f4748dc058a63ca80efe27e340d3474d0025c4f335e93e1e9d8a15b7` | 306 s | 1 | v12 `proof-and-foundry` |

Batch SHA-256: `c339600cab53a406b01ae80399354bf718e94a36863322f934d795c424aa6ed5`. Every source path and hash is in the lesson candidate. The L09 poster selects one of its two approved plates; both remain bound for the lesson. The local poster and plates have their existing lesson-specific approval. Static poster rights do not confer talking-avatar or voice rights.

The provisional timing removes silent ten-minute storyboard padding. It concatenates each exact approved caption span in order, gives the scene 07 exercise one visible 45-second countdown, and holds approved closing copy for 9/8/4/3 seconds. There is no music. The cue-derived run times are **not** final audio or caption sync. Native presenter and narration sources must set the final clock. Ordinary pauses must stay at or below 2.5 seconds; visual topic changes must follow sentence-complete spoken handoffs. Native presenter audio owns its two passages; offscreen narration must never overlap it. Preserve native frame rate, frame count, duration, and lip sync when compositing.

The review MP4s and screenshots contain synthetic Harbor Learning Circle material and approved local plates. They are silent storyboard evidence. They are not learner-facing lesson videos or substitutes for native audio QA. Portrait plates fit the mobile review frame, but their embedded labels are too small for learner playback at phone width. The native edit must use a legible approved crop or full-size treatment with matching text equivalent; the final mobile render must be inspected before Human QA.

## Execution gate

Current execution cap is **$0** and provider calls are **0**. The existing project ledger states a $100 aggregate cash ceiling, but it does not supply current cumulative spend, balance, live quotes, or technical cap enforcement for this batch. Prior Gray Sweater look `7275ba9035f94b31ad589dda6532d002`, avatar group `5796a337512c43bbbdaa77c1cefc295f`, and offscreen voice `4f53988b1c314610b514db98432fd0ef` are precedent candidates only. L09–L12 purpose-specific rights remain pending.

Before any provider execution, obtain and record: (1) explicit L09–L12 look and voice use receipt naming this purpose; (2) current provider account and balance, credit and cash quote for each job, and cumulative project spend; (3) enforceable per-job and batch maximums with auto-reload/overage off; (4) one exact authorization tied to the source commit, batch SHA, four candidate SHAs, identity, voice, account, cap and no-retry rule. If any binding, rights, quote, timing source, or control is uncertain, stop without submitting. A provider error or uncertain result is a stop, not a retry signal.

### Ready-to-send future authorization template

This is a template for a later, separately reviewed decision; filling it is not part of this preflight.

> Authorize **only** Agentified L09–L12 review-only native presenter passages and continuous offscreen narration from Portfolio source commit `cb44c2389b4281aac7dae33d835363ae35c42ea2`, batch `c339600cab53a406b01ae80399354bf718e94a36863322f934d795c424aa6ed5`, candidates L09 `cb89bf17ea0df2de96018439b3b54ce13aa5b4fbe017724b7c9ab5047c556fcd`, L10 `19a70e94acb9c75e633535211ce54af1b4e1075f2ec5da7d40048c90593694a8`, L11 `7a139886e0f6b35daf35bab1b44ab4eb582127cd4aadedbcf59f810011cc74b8`, L12 `56498ca2f4748dc058a63ca80efe27e340d3474d0025c4f335e93e1e9d8a15b7`. Use HeyGen account `[HEYGEN_ACCOUNT_ID]`, approved Gray Sweater look `[LOOK_NAME_AND_ID]`, avatar group `[AVATAR_GROUP_ID]`, offscreen voice `[VOICE_ID]`, purpose-specific rights receipt `[RIGHTS_RECEIPT_ID]`. Maximum one presenter job and one narration job per lesson, zero retries, individual all-in cash caps L09 `[L09_MAX_USD]`, L10 `[L10_MAX_USD]`, L11 `[L11_MAX_USD]`, L12 `[L12_MAX_USD]`, total all-in batch cash cap `[BATCH_MAX_USD]`, subject to the existing $100 aggregate project ceiling and verified cap enforcement. Stop on drift, uncertain provider outcome, unexpected debit, missing rights or quote, or cap breach. No purchase, auto-reload, customer binding, publication, distribution, or additional lesson media is authorized.

The reviewer must replace every bracketed value with a verified current value and attach the rights, quote/balance and cap-control evidence before sending. The two jobs per lesson are proposed bounds, not an instruction to submit them together; each native result requires a source and timing audit before local compositing.
