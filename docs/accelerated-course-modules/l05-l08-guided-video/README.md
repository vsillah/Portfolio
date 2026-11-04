# Accelerated guided-video Batch 2 · L05–L08

This is an offline, silent storyboard review package. It uses the approved lesson narration verbatim. No presenter likeness, voice, generated media, finished lesson, production unlock, provider execution, upload, publication, or external send is included. L01 and the merged L02–L04 package are untouched.

## Source and timing contract

`build.py` reads the approved L05–L08 scripts, visual-production manifest, storyboard brief, EPUB section bindings, and existing SAM plates. It fails if the script hash, scene narration, source asset, or scene count drifts. Each packet carries the exact source hashes, six scene windows, narration, on-screen copy, visual intent, lineage, accessibility notes, estimated sentence-level captions, exercise, audio ownership, and closed production gate. The `review.html` teaching cards render the visual beats in the approved storyboard order. Source IDs and hypothetical status stay visible where the lesson requires them; no customer record or measured result is implied.

| Lesson | Scenes | Draft caption cues | Reserved presenter seconds | EPUB sections | Learner output |
| --- | ---: | ---: | ---: | --- | --- |
| L05 | 6 | 104 | 81.144 | c010.xhtml | Feedback-to-signal ledger |
| L06 | 6 | 95 | 101.756 | c011.xhtml, c012.xhtml | Roadmap/PRD trace card |
| L07 | 6 | 90 | 87.677 | c013.xhtml, c014.xhtml | Two-checkpoint learning roadmap |
| L08 | 6 | 115 | 112.384 | c015.xhtml, c016.xhtml | Ten-component learning plan and metric definition |

The four presenter windows in each lesson start and stop on complete sentences, with the final window ending before the closing content card. Their durations are **storyboard estimates** based on word-weighted sentence timing. Recorded audio must determine the final edit points. Every `l0x-storyboard.srt` is a draft, not an audio-validated caption file. Final media needs separately checked SRT and VTT, read-along text, and audio description where the spoken line does not convey a visual state.

The local route provides lesson tabs, scene navigation, play/pause, seeking, approved narration, the learner exercise, source/accessibility disclosure, and visible production locks. The SAM Signals and Alignment plates retain their original aspect ratio. Synthetic teaching cards are instructional. The book's Sam case and the membership-service example are not current customer evidence. The tactical course-kit diagrams are not presented as canonical EPUB figures.

## Audio, accessibility, and execution boundaries

`l0x-audio-map.json` assigns one spoken owner at every moment. The review is silent. A later authorized native composite would mute matching narration under each native presenter segment; it must never double the speech. No music, effects, or audio asset has been approved. Captions occupy the bottom 18% band; the 16:9 master keeps 10% edge safety. Portrait cards reflow rather than crop text. Reduced-motion review uses the labeled still state for the same reading hold. Final rendered frames need contrast, mobile legibility, caption, and audio-description QA.

The estimated presenter durations total **382.961 seconds** across the batch, before provider rounding, credits, taxes, or retries. USD cost is unresolved: no binding HeyGen quote or enforceable cap exists. This lane's spend cap is **$0**. Each `l0x-heygen-request.json` is non-executable and leaves provider account, avatar/voice identities and rights, recorded-audio hash, binding quote and cap, privacy receipt, upload, publication, and external-send authority unbound. Stop without retry on source drift, missing rights, unbound audio, quote/cap mismatch, privacy concern, provider error, or unexpected output. Any later provider request requires a separate exact, current authorization for one lesson and one job. Any later production unlock requires a final composite, validated captions, output hashes, privacy/accessibility QA, and per-lesson Human QA.

## Rebuild and review

From this worktree root:

```bash
python3 docs/accelerated-course-modules/l05-l08-guided-video/build.py
python3 -m unittest discover -s docs/accelerated-course-modules/l05-l08-guided-video -p 'test_*.py' -v
python3 -m http.server 8766 --bind 127.0.0.1
```

Open `http://127.0.0.1:8766/docs/accelerated-course-modules/l05-l08-guided-video/review.html?lesson=L05&t=0&rev=<commit>`; select L06, L07, or L08 in the page or change the `lesson` parameter. The route is local review only, outside the production learner player. Desktop frames were captured at 1440×1000 and mobile frames at 390×844 from that route. `render_walkthroughs.sh` compiles those browser frames into privacy-safe, silent H.264 MP4s. Recapture frames after any visual edit before rerendering. `hashes.sha256` covers this package's source and evidence files, excluding itself.

## Human QA approval language for the captain handoff

> I approve Human QA for the **Accelerated L05–L08 guided-video Batch 2 offline storyboard review**, bound to draft PR `[number]`, commit `[exact SHA]`, and the localhost route and desktop/mobile MP4 hashes in the captain packet. I approve the scene order, exact approved narration, sentence-complete reserved presenter windows, visual beats, exercises, source and accessibility treatment, responsive review page, and visible locked states. After the captain records a passing review and verifies the final PR diff, I authorize marking that PR ready and squash-merging **only this review package**, then checking the exact merge deployment in both `Vercel – portfolio` and `Vercel – portfolio-staging`. Stop on a changed source hash, failed validation, visual regression, privacy issue, or deployment mismatch. This approval does not authorize any HeyGen/provider call, voice or avatar generation, spending, upload, publication, distribution, external send, production-data mutation, credential change, or learner-facing lesson unlock.

The bracketed PR number and commit must be replaced with the actual identifiers before presenting this block as an approval gate. This review approval is not provider authorization.
