# Accelerated guided-video Batch 1 · L02–L04

This is an offline storyboard review package. It is silent and uses the approved L02–L04 narration as text. It does not contain a generated presenter, voice, finished lesson video, or production unlock. L01 supplied the native-composite and learner-player method; no L01 footage or narration is reused.

## Source and review contract

`build.py` reads the approved scripts, the scene-level visual manifest, the storyboard brief, the EPUB, and the approved Signals plate. It stops if a script hash, scene narration, source asset, or scene count changes. Each `l0x-packet.json` carries the exact script hash, full narration, estimated sentence-level caption cues, scene timing, visual intent, source lineage, accessibility plan, learner exercise, and production lock. Each `l0x-heygen-request.json` contains four exact *storyboard* presenter spans and verbatim sentence-complete text. These are not executable provider requests: their start/end times must be rebound to recorded audio before authorization.

| Lesson | Scenes | Draft captions | Presenter seconds | Book sections | Learner output |
| --- | ---: | ---: | ---: | --- | --- |
| L02 | 7 | 94 | 89.780 | c005.xhtml, c006.xhtml | Priority decision and two alternatives |
| L03 | 6 | 85 | 84.045 | c007.xhtml | Decision question and evidence-gap card |
| L04 | 7 | 94 | 84.643 | c008.xhtml, c009.xhtml | Living persona with source and review date |

The presenter windows stop at complete sentence boundaries. The next frame shows the decision, evidence, or worksheet named in that scene; the final presenter window in each lesson yields to the closing content card. The review uses a solid reserved presenter panel because no likeness is authorized. There is no frozen presenter frame, dotted border, default split-screen source video, or overlay on the worksheet. The synthetic cards remain instructional examples. The book's Sam and Sarah cases are not current customer evidence.

`l0x-storyboard.srt` is an estimated caption draft. It is not timed to audio. The final lesson needs a separately checked SRT and VTT, read-along text, and audio description where narration does not convey the visible state. The review route supports play/pause, seeking, scene navigation, full transcript, reduced-motion preference, and responsive 16:9/portrait layouts. The production app still locks L02–L04.

## Cost and execution boundary

The estimate is **89.780 seconds for L02**, **84.045 for L03**, and **84.643 for L04** of presenter media, before provider rounding, taxes, credits, or retries. The USD estimate is intentionally unresolved: there is no binding HeyGen quote or enforceable rate/cap in this package. Apply the provider's quoted billing units and minimums to these durations, then verify the all-in total and cap. This lane has a $0 spend cap. No provider request, retry, upload, or paid generation is authorized.

Before a first L02 job, bind the exact script hash and recorded audio, approved avatar and voice identities with usage rights, a binding all-in quote, an enforceable cap, a privacy review, and an explicit current authorization. Stop without retry on source drift, missing rights, quote/cap mismatch, privacy concern, provider error, or unexpected output. A successful provider job still requires native-composite validation and separate L02 Human QA before the learner player can unlock.

## Rebuild and review

From the Portfolio worktree root:

```bash
python3 docs/accelerated-course-modules/l02-l04-guided-video/build.py
python3 -m unittest discover -s docs/accelerated-course-modules/l02-l04-guided-video -p 'test_*.py' -v
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `/docs/accelerated-course-modules/l02-l04-guided-video/review.html?lesson=L02&t=120&rev=<commit>` on `127.0.0.1:8765`. Change `lesson` to `L03` or `L04` and `t` to a scene time. Screenshots named `frame-*.png` were captured from that route at 1440×1000 and 390×844. `render_walkthroughs.sh` composites those captured frames into privacy-safe, silent desktop and mobile MP4s. It does not recapture the browser; recapture frames after any visual edit before rendering again. `hashes.sha256` binds the committed source and evidence files.

## First provider authorization template: L02 only

> I authorize one HeyGen preparation job for Accelerated L02 only, using script SHA-256 `73119dd526db5221d0af960feb25be911e31841c5f143d6e1a843076108ec1af` and the exact four sentence-complete spans in `l02-heygen-request.json` **after** they are rebound to the approved recorded audio. Approved avatar identity/rights receipt: `[identity and receipt]`. Approved voice identity/rights receipt: `[identity and receipt]`. Exact recorded audio hash: `[SHA-256]`. Binding provider quote including fees/tax: `[amount/currency]`; enforceable total cap: `[amount/currency]`. Authorized account and job mode: `[account and mode]`. Stop after one job; no automatic retry. Stop on changed source, quote/cap mismatch, missing rights, privacy concern, provider error, or unexpected output. I do not authorize L03/L04 jobs, upload, publication, distribution, production unlock, production-data use, or credential changes. Return the native source file, job receipt, hash, and cost receipt for separate composite review.

The bracketed values are required, not optional defaults. Obtain the price and enforceable cap from the provider account before sending that authorization. This template does not itself authorize execution.
