# Shared caption size review

Code commit: `6cb52368e` on draft PR #1293. The local review used the exact branch build on port 3121 with `MOCK_N8N=true` and `N8N_DISABLE_OUTBOUND=true`; no customer data or outbound provider action was used.

- Agentified review route: `/agentified/learningplan?lesson=L07&rev=6cb52368e`
- Accelerated review route: `/accelerated/learningplan?rev=6cb52368e`. The L09 example is selected from the lesson list in the walkthrough.
- `receipt.json` records 174 rendered size checks across 58 lesson/viewport pairs: Agentified L01/L05–L16 and Accelerated L01–L16 at 1280 px and 390 px. Each check seeks the longest loaded cue, applies S/M/L, verifies unchanged video dimensions and no new page overflow, and checks caption off/on plus immediate active-cue restoration while paused.
- The 15 PNGs show S/M/L at 390 px for Agentified L07 and Accelerated L01/L09, plus S/M/L desktop states for Agentified L07 and Accelerated L09. Each capture waits for the selected control, `data-caption-size`, stored preference, track mode, computed band font (or the native `::cue` CSS rule), decoded source frame, neutral pointer, and a rendered paint. The three MP4s show the exact operator path: paused cue, S/M/L changes, captions off, captions on. `walkthrough-state.json` records each step. FFmpeg decoded all final MP4s without errors.
- Agentified retains native WebVTT at desktop Small/Medium and uses its cue band at mobile widths and desktop Large. Accelerated uses the cue band for every lesson. These placements keep the video frame and teaching artwork unobscured at Large. Browser and OS caption preferences may further affect native rendering.

Commands run:

```sh
./node_modules/.bin/vitest run components/captions/CaptionSizeControl.test.tsx app/agentified/AgentifiedLessonHero.test.tsx app/agentified/AgentifiedWorkshop.test.tsx app/service-prototypes/'[slug]'/AcceleratedLearningPlan.test.tsx
node scripts/qa/verify-shared-caption-size.mjs
node scripts/qa/record-shared-caption-size.mjs
ffmpeg -v error -i <each-final-mp4> -f null -
```

The prior PNGs were rejected because capture occurred before the painted control caught up, and a hovered previous button could look selected. The replacement evidence waits for paint and moves the pointer clear. Live product state was correct; no product code changed in this correction.

The verifier now uses an instant, bounded scroll before mobile cropping and waits for the target position. This fixes an intermittent `480–861` crop on Accelerated L01 caused by the page's smooth-scroll behavior; the viewport bounds check remains strict. Two consecutive fresh-context verifier runs passed 174/174 checks, including Accelerated L01 at 390×844. The media files were retained because product geometry did not change.

Focused tests passed: 67/67. The repository-wide TypeScript check still reports existing errors outside the changed implementation files; no new diagnostics were observed in the caption implementation.
