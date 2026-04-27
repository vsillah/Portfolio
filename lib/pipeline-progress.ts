/**
 * Shared helper for rendering stage-aware progress bars against pipelines
 * whose true progress we cannot observe directly (n8n webhooks, in-app AI
 * classify calls, etc).
 *
 * Mental model: we define a list of named stages with a "starts at" elapsed
 * time in seconds, plus a typical-completion duration. As wall-clock elapses
 * since the operation was kicked off, we pick the highest stage whose
 * `startsAt` we have crossed, then ease a sub-progress value inside that
 * stage towards the next stage's `startsAt`. The whole bar caps at 94% so
 * it never reads 100% until the caller actually flips state to complete.
 *
 * Originally lived inline in `components/admin/OutreachEmailGenerateRow.tsx`
 * and was duplicated in `ReviewEnrichModal.tsx` for the value-evidence push
 * and classify phases. Centralized here so new pipelines can reuse the same
 * tuned easing without drifting UX between rows and modals.
 */

export type PipelineStage = { label: string; startsAt: number }

export function estimateMilestoneProgress(
  stages: PipelineStage[],
  typicalS: number,
  elapsedMs: number,
): { currentStageLabel: string; progressPct: number; stepIndex: number; stepTotal: number } {
  const elapsedS = elapsedMs / 1000
  let currentLabel = stages[0].label
  let stageIdx = 0
  for (let i = stages.length - 1; i >= 0; i--) {
    if (elapsedS >= stages[i].startsAt) {
      currentLabel = stages[i].label
      stageIdx = i
      break
    }
  }
  const nextStart = stageIdx + 1 < stages.length ? stages[stageIdx + 1].startsAt : typicalS
  const segStart = stages[stageIdx].startsAt
  const segLen = Math.max(5, nextStart - segStart)
  const t = Math.min(1, Math.max(0, (elapsedS - segStart) / segLen))
  const eased = 1 - Math.exp(-2.8 * t)
  const base = (stageIdx / stages.length) * 88
  const span = (1 / stages.length) * 88
  const progressPct = Math.round(Math.min(94, Math.max(3, base + eased * span * 0.92)))
  return {
    currentStageLabel: currentLabel,
    progressPct,
    stepIndex: stageIdx + 1,
    stepTotal: stages.length,
  }
}
