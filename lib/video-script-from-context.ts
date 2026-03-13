/**
 * Video script from context — produces a short (60–90s) pitch script from the same
 * context used for Gamma reports. Used by companion video and report+video flows.
 */

import {
  fetchVideoScriptContext,
  type GammaReportParams,
  type VideoScriptContext,
} from '@/lib/gamma-report-builder'

/**
 * Build a 60–90 second spoken script for HeyGen avatar from report context.
 * Uses a simple template; same context as Gamma so script and report stay in sync.
 */
export async function buildVideoScriptFromContext(
  params: GammaReportParams
): Promise<string> {
  const ctx = await fetchVideoScriptContext(params)
  return renderVideoScript(ctx)
}

function renderVideoScript(ctx: VideoScriptContext): string {
  const parts: string[] = []

  if (ctx.contactName) {
    parts.push(`Hi ${ctx.contactName},`)
  }
  if (ctx.company) {
    parts.push(
      ctx.contactName
        ? `I put together a short overview for ${ctx.company}.`
        : `This is a quick overview for ${ctx.company}.`
    )
  }

  if (ctx.diagnosticSummary) {
    const summary =
      ctx.diagnosticSummary.length > 280
        ? ctx.diagnosticSummary.slice(0, 277) + '...'
        : ctx.diagnosticSummary
    parts.push(`Based on our conversation: ${summary}`)
  }

  if (ctx.valueStatementsSummary) {
    parts.push(ctx.valueStatementsSummary)
  }
  if (ctx.topPainPoints.length > 0) {
    parts.push(
      `Key areas we looked at: ${ctx.topPainPoints.slice(0, 2).join(', ')}.`
    )
  }

  if (parts.length === 0) {
    parts.push(
      "Thanks for your interest. I've prepared a report for you — check the link for the full picture. Let's get it."
    )
  } else {
    parts.push("Check the full report for the details. Let's get it.")
  }

  return parts.join(' ')
}

/**
 * Build script string from an already-fetched VideoScriptContext (no extra fetch).
 * Use when you have context from fetchReportAndVideoContext (report+video one-click).
 */
export function buildVideoScriptFromVideoContext(ctx: VideoScriptContext): string {
  return renderVideoScript(ctx)
}
