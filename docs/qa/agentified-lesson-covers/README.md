# Agentified L01–L16 cover review

Sixteen 1280×720 static covers are bound to the Agentified Learning Plan. The selected cover is visible next to its Operating File page. The page accurately says **Video locked** and renders no video control or media URL. When approved lesson MP4s exist, `AgentifiedLessonHero` can take a source and use the same image as the native poster with the established 340 ms reveal and a reduced-motion cut.

## Source and rights boundary

`source-map.json` binds every cover to the exact approved script hash, storyboard beat, one of the five publication plates approved for that lesson, plate hash and rights status, canonical Agentified JPG hash, first-party Vambah likeness reference hash, new pose cutout hash and prompt/input identity, upscaled shield hash, alt text, output hash, and poster URL. The original Accelerated SAM artwork is excluded. The cutouts are new static image-generation outputs; no HeyGen avatar, voice, narration, video, live product footage, or customer data was used. `build-agentified-covers.py` reproduces the deterministic cover composition from the stored cutouts and approved inputs.

The generated cover uses each registered publication plate intact, at its original aspect ratio. The plate sits within the scene with feathered edges; the title, face, and hand gestures remain in separate read lanes. The canonical JPG supplies the cover texture and dark ink and gold visual language. Its title lettering is not copied as lesson text. The portrait shield keeps its natural aspect ratio.

## Visual inspection

`all-sixteen-montage.jpg` was inspected at 320×180 feed size. `full-size-contact-1.jpg` through `full-size-contact-4.jpg` were inspected at player size. All sixteen have distinct poses and readable teaser text at feed size; the full sheets show consistent facial likeness, intact hands and eyes, contained diagrams, cream on ink contrast, and no teaser over a face or diagram. The plate's small source labels are not intended to be read at feed size; the original full diagram remains available through **Explore lesson diagram** on the page. The lower gold rule was moved below all cover content during review.

The route was exercised with synthetic guest state at 1440×900 desktop, 820×1180 tablet, and 390×844 mobile. Four representative lessons span The Harness (L01), Authority (L06), The Agentified Organization (L11), and Synthesis and capstone (L16). Screenshots for each width and lesson are in this directory. No horizontal overflow, clipped controls, missing cover, empty video player, or Operating File separation was observed. The review uses the actual Agentified act names; Signals, Alignment, and Momentum belong to the Accelerated artwork and are not Agentified navigation groups.

## Review build and recording

- Implementation commit: `dda313eacbd0133e22456716980115fcd09732ce`.
- Exact loaded route: `http://localhost:3117/agentified/learningplan?lesson=L01&revision=dda313eacbd0133e22456716980115fcd09732ce`.
- `agentified-locked-covers-walkthrough.mp4`: desktop and mobile selection of L01, L06, L11, L16, with the static cover, locked media status, and adjacent Operating File visible. H.264, 1280×800, 9.92 seconds.
- `agentified-locked-covers-mobile.mp4`: a separate legible 390×844 mobile walkthrough of the same four lessons. H.264, 6.68 seconds.
- `walkthrough-source.webm` is the source capture for the combined MP4.

## Validation

- `uv run --with pillow python scripts/qa/build-agentified-covers.py` — sixteen covers and contact sheets built.
- `npx vitest run lib/agentified-lesson-posters.test.ts app/agentified/AgentifiedLessonHero.test.tsx app/agentified/AgentifiedWorkshop.test.tsx lib/agentified-workshop.test.ts app/agentified/page.test.tsx` — 8 passed.
- `node agentified/workshop/visual-review/validate.mjs` — 19 approved visual uses pass.
- `node agentified/workshop/scene-production/validate.mjs` — exact scripts, timings, rights, and production gates pass.
- `NODE_OPTIONS=--max-old-space-size=8192 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=local-review-placeholder npm run build` — passes with local placeholder configuration. The default 4 GB Node heap ran out of memory; a build without Supabase placeholders failed at page-data collection because this isolated worktree has no `.env.local`.
- `node scripts/qa/capture-agentified-covers.mjs dda313eacbd0133e22456716980115fcd09732ce` — twelve viewport screenshots and two playable MP4s; the script checks loaded 16:9 covers, no horizontal overflow, no video element, the locked label, and Operating File presence.

No authenticated member flow, live provider media, production database, upload, publication, or customer-data smoke was run. Native playback, pause/resume, and real-media fade remain unverified until approved Agentified MP4s are supplied; the optional video branch has focused component coverage only. This change remains local and in draft PR review until human QA.
