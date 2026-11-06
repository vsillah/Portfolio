# Integrated GLB timeline — Captain review packet

- Draft PR: #1215, branch `codex/trumpet-recruitment-visual-story`.
- Source proof commit: `a7af2bfc0de35bea280cbcefb59b64551bb29fcf`.
- Integrated code and media commit: `6dbb5e18827d893cbebc9bde47354d0b5fc1aa2a`.
- Exact local route: `http://localhost:3018/work/trumpet-trainer/recruitment?revision=6dbb5e18827d893cbebc9bde47354d0b5fc1aa2a#plan`.
- Local server: production build from that commit, `MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run start -- -p 3018`.

## Evidence

- `wide-six-beats-6dbb5e18.mp4`: 8.375-second, 1180×1000, H.264 screen capture of the exact Chrome route, cropped to the plan stage and six cards. The captured DOM progressed from beats 0–6; the MP4 shows the completed six-beat playback. It contains no customer data.
- `phone-360-6dbb5e18.png`: clean rendered 360px plan, with the poster, complete six-step list, and next section. No horizontal overflow.
- `safari-early-6dbb5e18.png` and `safari-later-6dbb5e18.png`: native Safari frames from the exact route at different beats. The transparent WebP paints the actual trumpet rather than a black region.

The Chrome browser viewport recorder returned blank narrow-viewport frames. Its full-page recorder inserted the sticky development header over the instrument during animation. Those captures were excluded; the clean static phone still and direct 360px layout inspection are the mobile evidence. The wide MP4 remains the motion review artifact. The integrated Codex browser was unavailable in this chat; the exact route is loaded in a marked Chrome task tab for Captain review.

## Checks

- `npm test -- --run components/TrumpetRecruitmentTimeline.test.tsx app/work/trumpet-trainer/recruitment/page.test.tsx` — 9 passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with existing warnings outside this change.
- `NODE_OPTIONS=--max-old-space-size=10240 MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run build` — passed from the exact integrated commit.
- `git diff --check` — passed.
- Rendered Chrome widths 360, 768, 1062, and 1279–1280 CSS px — six steps visible, stage contained, no document horizontal overflow. The 360px case had `scrollWidth 350`; 768px had `758`; 1062px had `1052`; 1279px had `1270`.
- Chrome video reached `currentTime 7` and six distinct active-card beats. Native Safari rendered early and later timeline states without a black media rectangle. Component test covers reduced-motion static-poster behavior; live OS reduced-motion emulation was not run.

## Boundaries

The source GLB is unchanged and retains its CC0 provenance record in `../replacement-source-proof/SOURCE.md`. Beat 2 moves the real first-valve branch; beat 3 moves a real button and stem into its casing with body response; beat 4 moves the separate third-valve branch; beat 5 depresses a different real-valve combination. The numbered markers are UI only. The recruitment route remains inactive and noindex; no contact intake, provider action, outreach, release, or production deployment was performed. This packet requests Captain review, not Human QA or merge.
