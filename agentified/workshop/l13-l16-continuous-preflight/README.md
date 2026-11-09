# Agentified L13–L16 continuous narration preflight

This internal, provider-free packet is bound to Portfolio source commit `5d61cadff39b46d5d17add8e06370cc25a18de41`. It preserves the exact approved scripts, scene packets, source assets, Operating File sequence, and locked learner video state. The silent review route and MP4s are storyboard evidence. No presenter or voice media exists for this batch.

## Exact source and candidate bindings

| Lesson | Packet SHA-256 | Script SHA-256 | Candidate SHA-256 | Provisional run time | Approved plates | Operating File |
| --- | --- | --- | --- | ---: | ---: | --- |
| L13 | `f7308be394a1d1a85053201e448bd1ed18d03306f20a28fef9890fa88fca8f56` | `75f6c95a9d16af6d18ef13092668d386cdf34c7acc000515076aad79f5cf6b7e` | `ca8117572b7e862a9dcdd15b1b901886cfe1068dbc2be487c6cde6f17cb84876` | 287 s | 1 | v13 `research-proposal` |
| L14 | `4388dbb260c9a9f1a5253777f3b9657c72cebb46f5098d7ad60f41b3c4f552ce` | `2003984f83277f2e810a5145aa967da1b20261f733d6ccdccb45b758f52a271d` | `93414761a5a5a49ebc6068bf72ef5f0055418030f27ec57abe0fafe4f9781e6b` | 284 s | 2 | v14 `three-panel-demo` |
| L15 | `cf4fe7cbafcb46ade700360765d775301a5fd0d14ada1f37fb9f75154680236c` | `b2256c3106e48c0fb664c091c97b8700aca016a2162a5e0e5ec5252fbdf76e47` | `9683b252bff8ec732942905713cc98f06f6d8643814c547d8ad1cc580c8dd224` | 302 s | 1 | v15 `six-beat-rehearsal` |
| L16 | `1002cce78b604a1d118791f07a9c98cd7accd55e532ab1d4a0f5eb2a5fdcf2e1` | `833da08a015fa682c01d3decf8bbf36b439daedc5078b5db23ef96b790a4fe9e` | `2a9fc51f0bdaa64401b57a10d3beac2989d51286187fc5fd11525ed2bb16b314` | 303 s | 2 | v16 `accountability-stack` |

Batch SHA-256: `18b3a6bfa3ee1dc6fadedb2cc969a312e8a9acf935bfb50684ad0d812b0cb194`. Presenter manifest SHA-256: `ebccd6a729944f00cfa0e77e10ce7f771735b0106b95b4348611931003e91dc9`. These are source and candidate identities, not an execution grant. The generator fails on changed packets, scripts, captions, windows, plates, rights, workbook/chapter lineage, or learner lock. The separate validator checks generated request and receipt identities.

The edit plan is cue-derived and provisional. It keeps every approved spoken sentence in order, removes silent ten-minute storyboard padding, and places one visible 45-second guided-work countdown after scene 07. No ordinary pause may exceed 2.5 seconds. L13–L15 close on an approved provider-free card after the last spoken sentence for 8, 11, and 9 seconds. L16 has no silent tail in its approved window, so its approved ending card overlaps the final presenter passage for 11.707 seconds and adds no time. Actual native audio timing, captions, source frame counts, and lip sync require a later audit. There is no music.

The approved plates are shown unmodified in independent contain regions. Their literal text alternatives and separate, readable lesson copy are in each candidate. Dense embedded plate labels are not the sole carrier of meaning on mobile. The source plates and static posters have approval for their bound Agentified lesson uses only. The Gray Sweater presenter look and offscreen voice IDs are historical candidates; L13–L16 purpose-specific rights remain pending. Captions are exact text with provisional cue timing. Final caption sync, native edit, mobile visual inspection, and editorial review remain open.

The audience frame in `review.html` contains approved lesson copy, source captions, approved static visuals, and a visible countdown. Internal hashes and production notes appear only in the reviewer metadata, which the MP4 capture hides. The guided-work screen uses the first two exact narration sentences rather than showing the full worksheet prompt; that prevents internal source qualifications from entering the customer-facing walkthrough. The complete source prompt remains bound in the request candidate. The route is internal review evidence and does not activate learner playback.

## Validation and review

From the repository root:

```bash
node agentified/workshop/l13-l16-continuous-preflight/build.mjs --check
node agentified/workshop/l13-l16-continuous-preflight/check-evidence-table.mjs --self-test
node agentified/workshop/l13-l16-continuous-preflight/validate.mjs
node --test agentified/workshop/l13-l16-continuous-preflight/validate.test.mjs
node agentified/workshop/l13-l16-continuous-preflight/capture.mjs
```

For local review, run `python3 -m http.server 4173 --bind 127.0.0.1` from this worktree and open `/agentified/workshop/l13-l16-continuous-preflight/review.html?lesson=L13&state=opening&revision=<exact-head>`. The capture script starts its own temporary localhost server and records desktop (1280×800) and mobile (390×844) MP4s. It checks every available state, visible countdown movement, plate containment, text overlap, hidden internal metadata, and decoded H.264 output. The capture receipt records final file hashes and dimensions.

## Execution and Human QA gates

Provider calls, new audio/video, uploads, and spend are **zero**. Current execution cap is **$0**. The existing project budget ledger records a $100 aggregate cash ceiling, but current cumulative spend, provider balance, binding quotes, and technical cap enforcement have not been checked for this batch. No provider submission, retry, purchase, production playback binding, publication, or distribution is authorized. Stop on source, rights, identity, timing, cost, privacy, or visual drift.

This PR is an internal preflight package, so it does not request Vambah's Human QA now. A future learner-media Human QA handoff must include the exact native composite commit, playable final MP4, latest localhost route, synchronized captions, responsive proof, and customer-copy audit. After that evidence exists, the captain can use this ready-to-send wording, replacing every bracketed binding:

> I approve Human QA for Agentified L13–L16 learner media at PR `[PR]`, commit `[COMMIT]`, final MP4 hashes `[FOUR_HASHES]`, and localhost review routes `[FOUR_EXACT_URLS]`. I reviewed the exact presenter/narration timing, 45-second guided work, ending cards, captions, mobile layouts, and locked-state transition. This approval covers only those four reviewed lesson videos. Keep provider execution, new spending, unrelated media, manuscript changes, and publication outside this scope. If captain review or either Vercel context fails, stop before merge or deployment.

The later provider execution decision is separate. Before requesting it, attach purpose-specific L13–L16 look and voice rights, current account/balance and per-job quotes, cumulative project spend, enforceable individual and batch caps with auto-reload off, and exact request hashes. Allow at most one presenter source job and one offscreen narration job per lesson, with zero retries; stop on an uncertain outcome rather than resubmitting.
