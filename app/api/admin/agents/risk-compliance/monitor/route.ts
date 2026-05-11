import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  assessAiRiskSignals,
  getAiRiskSignalMonitorSummary,
  type AiRiskSignalInput,
} from '@/lib/ai-risk-signal-monitor'

export const dynamic = 'force-dynamic'

function parseSignals(value: unknown): AiRiskSignalInput[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : undefined,
      title: typeof item.title === 'string' ? item.title.trim() : '',
      summary: typeof item.summary === 'string' ? item.summary.trim() : '',
      sourceUrl: typeof item.sourceUrl === 'string' ? item.sourceUrl : null,
      sourceName: typeof item.sourceName === 'string' ? item.sourceName : null,
      category: typeof item.category === 'string' ? item.category : null,
      severity: typeof item.severity === 'string' ? item.severity : null,
      publishedAt: typeof item.publishedAt === 'string' ? item.publishedAt : null,
      tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    }))
    .filter((item) => item.title && item.summary)
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  return NextResponse.json({
    ok: true,
    monitor: getAiRiskSignalMonitorSummary(),
  })
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const signals = parseSignals(body.signals)
  if (!signals.length) {
    return NextResponse.json({ error: 'signals array with title and summary is required' }, { status: 400 })
  }

  const assessments = assessAiRiskSignals(signals)
  return NextResponse.json({
    ok: true,
    monitor: getAiRiskSignalMonitorSummary(),
    assessments,
    upgrade_requests: assessments.map((assessment) => assessment.upgradeRequest).filter(Boolean),
    side_effects: {
      work_items_created: false,
      production_mutation_allowed: false,
      note: 'This endpoint only classifies supplied signals. Creating work items remains approval-gated.',
    },
  })
}
