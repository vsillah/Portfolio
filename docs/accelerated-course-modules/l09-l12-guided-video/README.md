# Accelerated guided-video Batch 3 · L09–L12

This is a local, silent storyboard review package. It binds the approved narration and visual-production scenes without creating voice, presenter, or finished lesson media. The production and learner-player gates remain closed. L01–L08 are untouched.

## Source and timing contract

`build.py` pins the approved L09–L12 scripts, visual manifest, storyboard brief, source notes, canonical EPUB, and Alignment/Momentum SAM plates by SHA-256. It fails on a missing or changed source, mismatched scene narration, asset, or scene count. Each packet contains six storyboard windows, exact narration, lineage, draft sentence captions, visual intent, exercise, accessibility plan, audio ownership, and a closed production gate.

| Lesson | Scenes | Draft cues | Reserved presenter seconds | EPUB sections | Learner output |
| --- | ---: | ---: | ---: | --- | --- |
| L09 | 6 | 118 | 96.762 | c017.xhtml, c018.xhtml | Decision theater map and pre-meeting sequence |
| L10 | 6 | 94 | 101.918 | c019.xhtml | Stakeholder-specific decision brief |
| L11 | 6 | 95 | 109.198 | c020.xhtml, c021.xhtml | Signal-to-decision loop with review gate |
| L12 | 6 | 95 | 118.065 | c022.xhtml, c023.xhtml | Jobs and simulation-validation cards |

The four reserved presenter windows per lesson start and stop on complete sentences. Their durations are word-weighted storyboard estimates. Recorded audio must determine final edit points. Each `lxx-storyboard.srt` is a draft; final media requires audio-checked SRT/VTT, read-along text, and audio description where speech does not convey a visual state.

The local review route offers lesson tabs, scene navigation, play/pause, seeking, narration, exercise, source/accessibility notes, and visible production locks. L09 typesets the book's power-interest axes and four exact quadrants; L12 visibly labels both hypothetical reactions as Simulation. The SAM plates keep their original aspect ratio. Fictional exercise cards, attributed book cases, and future observed evidence remain separate. No live product, customer, provider, or automation capture is in this package.

## Audio, access, and execution boundary

`lxx-audio-map.json` assigns one spoken owner at every moment. The review has no audio. If a separately authorized native presenter segment is later used, its audio replaces the same narration span in a composite; speech must never double. No music, sound effects, voice, or presenter source has been approved. The 16:9 master reserves 10% edge safety and an 18% caption band. Portrait cards reflow. Reduced-motion review holds the same labeled still. Final frames require contrast, mobile legibility, caption, and audio-description QA.

Reserved presenter estimates total **425.943 seconds** before provider rounding, credits, taxes, or retries. USD cost remains unresolved because there is no binding quote or enforceable cap. This lane's spend cap is **$0**. Each `lxx-heygen-request.json` is non-executable and leaves provider account, avatar and voice identities and rights, recorded-audio hash, quote, cap, privacy receipt, upload, publication, distribution, and external-send authority unbound. Stop without retry on source drift, missing rights, unbound audio, quote/cap mismatch, privacy concern, provider error, or unexpected output. Any later provider job requires separate exact, current authorization for one lesson and one job. Production unlock requires a final native composite, validated captions, output hashes, privacy/accessibility QA, and per-lesson Human QA.

## Rebuild and review

From this worktree root:

```bash
python3 docs/accelerated-course-modules/l09-l12-guided-video/build.py
python3 -m unittest discover -s docs/accelerated-course-modules/l09-l12-guided-video -p 'test_*.py' -v
python3 -m http.server 8767 --bind 127.0.0.1
```

Open `http://127.0.0.1:8767/docs/accelerated-course-modules/l09-l12-guided-video/review.html?lesson=L09&t=0&rev=<commit>`. The route is local review only. Desktop and mobile MP4 walkthroughs show the exact review states and locked gate. `render_walkthroughs.sh` compiles frames captured from that route into silent H.264 MP4s. Recapture frames after a visual edit, rerender, and update `hashes.sha256`. The hash register covers the package's source and evidence files, excluding itself.

## Captain handoff

Captain review should verify every lesson and scene at desktop, mid-width, and mobile widths; play/pause and seeking; power-interest grid axes and quadrants; persistent Simulation labels; SAM aspect ratios; narration and draft-caption correspondence; visible locked states; and MP4 playback. Human QA applies to this client-facing storyboard review only. It does not authorize provider calls, generation, spending, upload, publication, distribution, external sends, production-data changes, credentials, or learner-facing unlock.
