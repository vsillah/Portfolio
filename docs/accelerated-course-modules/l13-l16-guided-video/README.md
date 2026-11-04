# Accelerated guided-video Batch 4 · L13–L16

This is a local, silent storyboard review package for the final four approved lessons. It binds exact narration to the approved scene manifest without creating voice, presenter, or finished lesson media. The learner player and all provider, spending, upload, publication, distribution, and external-send gates remain closed. L01–L12 are untouched.

## Source and timing contract

`build.py` pins the approved L13–L16 scripts, script manifest, visual manifest, storyboard brief, source notes, canonical EPUB, Momentum plate, full SAM infographic, and public book cover by SHA-256. It fails on missing or changed sources, narration, assets, or scene counts. Each lesson packet contains six timed storyboard windows, exact narration and lineage, draft sentence captions, visual intent, exercise, accessibility plan, audio ownership, and a closed production gate.

| Lesson | Scenes | Draft cues | Reserved presenter seconds | EPUB sections | Learner output |
| --- | ---: | ---: | ---: | --- | --- |
| L13 | 6 | 110 | 112.679 | c024.xhtml, c025.xhtml | Strategic alternatives sheet and concept-test card |
| L14 | 6 | 94 | 108.673 | c026.xhtml | Two-audience pitch card with source annotations |
| L15 | 6 | 127 | 113.618 | c027.xhtml, c028.xhtml | Scale-readiness checklist and decision-memory record |
| L16 | 6 | 89 | 118.975 | c029.xhtml | One-week learning commitment and assembled decision file |

The four reserved presenter windows per lesson start and stop on complete sentences. Their word-weighted durations are storyboard estimates; recorded audio must determine final edit points. The `lxx-storyboard.srt` files are drafts. Final media needs audio-checked SRT/VTT, read-along text, and audio description wherever speech does not convey a meaningful visual state.

The review route has lesson tabs, scene navigation, play/pause, seeking, narration, exercise, source and accessibility notes, and visible production locks. Book cases, fictional rehearsal cards, Simulation, interpretation, and pending observed evidence are visibly distinct. The approved SAM and book art use their natural aspect ratios. No live product, customer, provider, or automation capture is included.

## Audio, access, and execution boundary

`lxx-audio-map.json` assigns one spoken owner at every moment. This review is silent. If a separately authorized native presenter segment is later used, its audio replaces the matching narration span in a composite; speech must never double. No music, sound effects, voice, or presenter source has been approved. The 16:9 master reserves 10% edge safety and an 18% caption band. Portrait cards reflow. Reduced-motion review holds the same labeled still. Final frames require contrast, mobile legibility, caption, and audio-description QA.

Reserved presenter estimates total **453.945 seconds** before provider rounding, credits, taxes, or retries. USD cost remains unresolved because there is no binding quote or enforceable cap. This lane's spend cap is **$0**. Each `lxx-heygen-request.json` is non-executable and leaves provider account, avatar and voice identities and rights, recorded-audio hash, quote, cap, privacy receipt, upload, publication, distribution, and external-send authority unbound. Stop without retry on source drift, missing rights, unbound audio, quote/cap mismatch, privacy concern, provider error, or unexpected output. Any later provider job requires separate exact, current authorization for one lesson and one job. Production unlock requires a final native composite, validated captions, output hashes, privacy/accessibility QA, and per-lesson Human QA.

## Rebuild and review

From this worktree root:

```bash
python3 docs/accelerated-course-modules/l13-l16-guided-video/build.py
python3 -m unittest discover -s docs/accelerated-course-modules/l13-l16-guided-video -p 'test_*.py' -v
python3 -m http.server 8767 --bind 127.0.0.1
```

Open `http://127.0.0.1:8767/docs/accelerated-course-modules/l13-l16-guided-video/review.html?lesson=L13&t=0&rev=<commit>`. This is local review only. Desktop and mobile MP4 walkthroughs show source-labeled scenes, the L16 close, and locked gates. `render_walkthroughs.sh` compiles frames captured from that route into silent H.264 MP4s. After visual edits, recapture the frames, rerender, and update `hashes.sha256`. The hash register covers package source and evidence files, excluding itself.

## Captain handoff

Check every scene at desktop, mid-width, and mobile widths; play/pause and seeking; book-case and Simulation labels; the L16 source-status boundary and closing card; SAM and cover aspect ratios; narration and draft-caption correspondence; locked states; and MP4 playback. Human QA applies to this client-facing storyboard review only. It does not authorize provider calls, generation, spending, upload, publication, distribution, external sends, production-data changes, credentials, or learner-facing unlock.
