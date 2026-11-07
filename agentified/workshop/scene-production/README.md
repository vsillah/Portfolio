# Agentified scene packets and silent animatics

This package turns the approved L01–L16 scripts into 128 scene records in four batches: L01–L04, L05–L08, L09–L12, and L13–L16. Each packet stores the exact narration and on-screen source cell, timing, sentence captions, shot treatment, approved plate use, reserved presenter windows, B-roll limit, audio ownership, transition, accessibility plan, chapter/workbook lineage, Operating File update, Harbor continuity, and prepare-only boundary. The canonical source files and approved visual register are unchanged.

Run the review route from the repository root:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/agentified/workshop/scene-production/review.html?lesson=L01&rev=<commit>` and choose any lesson. The route is a silent, provider-free animatic: seek or play at 1×, 8×, or 16×. It displays only quoted on-screen script copy. The exercise row's exact production instruction stays in the packet and appears as a quiet timer in the animatic. Approved plates are preloaded, held in a contain region, and never cropped or covered by captions. On narrow screens the art and teaching copy stack vertically.

The caption cue text reconstructs every scene's exact narration. Its timing is provisional because no voice track exists. Presenter windows are reservations only. Audio is silent. Final spoken pacing, caption sync, scene-specific plate alternatives, contrast at delivery resolution, and customer-facing copy review remain production gates. No avatar, voice, B-roll, live application footage, or external action is represented as complete.

The five approved publication plates may appear only in the lessons listed in `agentified/workshop/visual-review/packets.json`. The canonical JPG cover is approved as a cover but is absent from these scene uses. The inherited Accelerated SAM image remains lineage-only and is excluded from media. No new illustration is generated.

Rebuild each bounded batch with `node agentified/workshop/scene-production/build.mjs L01-L04` (or the other three batch labels). Run `node agentified/workshop/scene-production/validate.mjs`, `node --test agentified/workshop/scene-production/validate.test.mjs`, and `NODE_PATH=<Playwright module directory> node agentified/workshop/scene-production/qa-review.mjs <localhost-route> <commit>`. The last command checks seven beats per lesson at desktop, tablet, and mobile widths, including image load, containment, and overflow. `record-walkthrough.mjs <commit>` creates a silent H.264 MP4 and verifies duration, codec, and size. Playwright can also resolve from project `node_modules` after dependencies are installed.

This is an internal production review package. It does not authorize provider rendering, publication, uploads, member access, or a live course route. The next gate is captain review of the packets and responsive animatics, followed by editorial resolution of any customer-facing script language and approval of final audio, captions, and scene-specific accessibility treatment. Human QA applies when a later client-facing course experience is ready.
