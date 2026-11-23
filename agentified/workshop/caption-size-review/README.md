# Shared caption size review

Draft PR #1293 on `codex/agentified-caption-safety`, stacked on PR #1292. The local review used this branch's build on port 3121 with `MOCK_N8N=true` and `N8N_DISABLE_OUTBOUND=true`. No customer data or outbound provider action was used.

- Agentified: `/agentified/learningplan?lesson=L07`
- Accelerated: `/accelerated/learningplan`; select L09 from the lesson list for the L09 evidence.
- `receipt.json` records 174 rendered size checks across 58 lesson/viewport pairs: Agentified L01/L05–L16 and Accelerated L01–L16 at 1280×844 and 390×844. Each check seeks an actual cue, selects S/M/L, verifies the 14/18/24 px samples with matching family, weight, style, color, and 24 px line height, equal button geometry, exact accessible names, one selected state, stored preference, track mode, caption band or native cue rule, unchanged video geometry, and no new horizontal overflow. Caption off must remove the entire size group while keeping the saved L preference and video size; caption on must restore the same selected L control and active cue while paused. Enter and Space activation are also checked. Two consecutive fresh-context sweeps passed 174/174.
- The same receipt records 16 theme checks: Light, Dark, and System under both OS schemes, for each course at both widths. These inspect the resolved `html.dark` state, sample color and metrics, selected surface and border, unselected hover, and focus outline. The eight `*-theme.png` captures show Light and Dark controls.
- The receipt also records 48 focused L08 checks across all eight scenes at desktop and mobile S/M/L, plus four adjacent L07/L09 boundary checks. The L08 screenshots and contextual MP4s are in `../l08-caption-clearance-review/`. The L09–L16 scene audit and contextual MP4s are in `../l09-l16-caption-audit/`.
- The 15 lesson PNGs show S/M/L at 390 px for Agentified L07 and Accelerated L01/L09, plus S/M/L at 1280 px for Agentified L07 and Accelerated L09. The three MP4s show the mobile operator path: paused cue, S/M/L, captions off, and captions on. `walkthrough-state.json` records each step. All final MP4s passed FFmpeg decode.
- Agentified L08–L16 use the cue band at every width and size because the native desktop cues covered teaching content. L07 and earlier Agentified lessons retain native WebVTT at desktop Small/Medium; mobile and Large use the band. Accelerated uses the band for every lesson. Browser or OS preferences may further affect native cue rendering.

Validation commands:

```sh
./node_modules/.bin/vitest run components/captions/CaptionSizeControl.test.tsx app/agentified/AgentifiedLessonHero.test.tsx app/agentified/AgentifiedWorkshop.test.tsx app/service-prototypes/'[slug]'/AcceleratedLearningPlan.test.tsx
node scripts/qa/verify-shared-caption-size.mjs
node scripts/qa/verify-shared-caption-size.mjs
node scripts/qa/record-shared-caption-size.mjs
ffmpeg -v error -i <each-final-mp4> -f null -
```

Focused tests passed 76/76 after the L08–L16 clearance change. The repository-wide TypeScript check has existing errors outside the changed caption files; no new caption diagnostics were observed in the prior PR review. See `docs/course-caption-controls.md` for the durable control rule. This lane stops at a draft PR; merge, deployment, and Human QA remain with the Integration Captain.
