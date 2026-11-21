# L16 mobile overflow correction receipt

Review only. Base: `ca5be3720c0fc596a2cfd6bc7796283709fc3b54`; branch: `codex/agentified-l16-mobile-overflow`; worktree: `/Users/vambahsillah/.codex/worktrees/69b9/Portfolio`. No learner media was rebound.

## Cause and correction

At `/agentified/learningplan?lesson=L16`, Chromium at 390×844 reproduced a 404px document width. The L16 footer has only the completion button, placed at the right edge. Its centered, absolutely positioned tooltip extends 14px past the viewport even while transparent. The lesson article, footer, and layout therefore reported internal scroll widths of 389px, 372px, and 390px against their narrower boxes. The caption band remained inside the 292px video lane.

The mobile CSS now anchors lesson footer tooltips to the button's right edge. The tooltip remains visible on focus and hover. No lesson, media, player, caption, or footer button dimensions changed. The desktop tooltip rule is unchanged.

## Rendered checks

Local route: `http://127.0.0.1:3107/agentified/learningplan?lesson=L16`. Local review used placeholder Supabase environment values and disabled outbound n8n calls. Captures show synthetic guest state.

| Width | L16 document/body | Video | Footer | States checked |
| --- | --- | --- | --- | --- |
| 390×844 | 390/390px | 292×164.25px | 326px | opening, teaching at 1:35, captions off/on, S/M/L, paused restoration, sound control, 4:27 ending, completion, replay, focused footer tooltip |
| 1280×844 | 1280/1280px | 621×349.3125px | 1064px layout box | opening, teaching, captions off/on, S/M/L, paused restoration, ending, completion, replay |

L01, L06, and L10 also had zero document/body overflow at 390×844 and 1280×844; video sizes matched L16 at each width. Active L16 cue text stayed “The preparation role may draft a Session Option Brief.” at S/M/L, with rendered 14/18/24px sizes. Off removed the cue; on restored the same cue while paused. Completion appeared at the existing end boundary and cleared after seeking back to zero. The mobile sound control muted and accepted the Low volume key action.

Focused validation: `npx vitest run app/agentified/AgentifiedWorkshop.test.tsx app/agentified/AgentifiedLessonHero.test.tsx lib/agentified-l13-l16-media.test.ts lib/agentified-end-screens.test.ts` — 4 files, 65 tests passed. `git diff --check` passed. No full application build or authenticated live workflow was run.

L16 source hashes remain `e890f6a940ea6fcb1861bc79f1bffafec7306637f14b4bee1753527572e7138a` (MP4) and `18dd5bebac74af34048e62b8f6171daefea89ddfc86618a82cc2b74472936060` (VTT). Registered duration remains 267.309s; the CSS edit cannot alter media timing. Screenshots here show the exact teaching, completion, and focused footer states at the listed route. They were opened and visually inspected after capture.

## Existing follow-up defect

The desktop completion capture shows the existing L16 end-screen overlay obscuring part of the native presenter's image. Captain review confirmed this predates the correction and is outside this mobile-only tooltip scope. The screenshot is `L16-1280-completion.png`. This lane did not alter the presenter, completion overlay, media, or desktop ending.

PR #1290 and PR #1293 remain draft and unchanged. No push, new PR, merge, or deployment occurred.
