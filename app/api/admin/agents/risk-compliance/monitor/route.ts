import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  assessAiRiskSignals,
  buildAiRiskWorkItemRequests,
  getAiRiskSignalMonitorSummary,
  getAiRiskSourceFeeds,
  AI_RISK_SIGNAL_CATEGORIES,
  AI_RISK_SOURCE_PRIORITIES,
  type AiRiskSignalCategory,
  type AiRiskSourcePriority,
  type AiRiskSignalInput,
} from '@/lib/ai-risk-signal-monitor'
import { createAgentWorkItem } from '@/lib/agent-work-items'
import {
  createMoremiWarningWorkItems,
  getLatestMoremiMonitorReview,
  MOREMI_WARNING_WORK_ITEMS_CONFIRMATION,
} from '@/lib/moremi-monitor-review'

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

function toCreateWorkItemInput(
  request: ReturnType<typeof buildAiRiskWorkItemRequests>[number],
) {
  const { sourceAssessment: _sourceAssessment, ...input } = request
  return input
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const reviewMode = searchParams.get('review') === 'latest' || searchParams.get('mode') === 'latest_review'
  if (reviewMode) {
    return NextResponse.json({
      ok: true,
      review: await getLatestMoremiMonitorReview(),
    })
  }

  const category = searchParams.get('category')
  if (category && !AI_RISK_SIGNAL_CATEGORIES.includes(category as AiRiskSignalCategory)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }
  const priority = searchParams.get('priority')
  if (priority && !AI_RISK_SOURCE_PRIORITIES.includes(priority as AiRiskSourcePriority)) {
    return NextResponse.json({ error: 'Invalid source priority' }, { status: 400 })
  }
  const enabledOnly = searchParams.get('enabled_only') !== 'false'
  const categoryFilter = category ? category as AiRiskSignalCategory : undefined
  const priorityFilter = priority ? priority as AiRiskSourcePriority : undefined

  return NextResponse.json({
    ok: true,
    monitor: getAiRiskSignalMonitorSummary(),
    source_feeds: getAiRiskSourceFeeds({
      enabledOnly,
      category: categoryFilter,
      priority: priorityFilter,
    }),
  })
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  if (body.action === 'create_moremi_warning_work_items') {
    if (body.confirmation !== MOREMI_WARNING_WORK_ITEMS_CONFIRMATION) {
      return NextResponse.json(
        { error: `confirmation must be ${MOREMI_WARNING_WORK_ITEMS_CONFIRMATION} to create Moremi warning work items` },
        { status: 400 },
      )
    }

    const result = await createMoremiWarningWorkItems()
    return NextResponse.json({
      ok: true,
      review: result.review,
      work_items: result.work_items,
      side_effects: {
        work_items_created: result.work_items.length > 0,
        work_item_count: result.work_items.length,
        production_mutation_allowed: false,
        live_external_fetch: false,
        client_data_access: false,
        note: 'Created or reused proposed Agent Ops work items only. Remediation remains approval-gated.',
      },
    })
  }

  const signals = parseSignals(body.signals)
  if (!signals.length) {
    return NextResponse.json({ error: 'signals array with title and summary is required' }, { status: 400 })
  }

  const assessments = assessAiRiskSignals(signals)
  const workItemRequests = buildAiRiskWorkItemRequests(assessments)
  const shouldCreateWorkItems = body.create_work_items === true
  if (shouldCreateWorkItems && body.confirmation !== 'create_ai_risk_work_items') {
    return NextResponse.json(
      { error: 'confirmation must be create_ai_risk_work_items to create work items' },
      { status: 400 },
    )
  }

  const workItems = shouldCreateWorkItems
    ? await Promise.all(workItemRequests.map((request) =>
        createAgentWorkItem(toCreateWorkItemInput(request)),
      ))
    : []

  return NextResponse.json({
    ok: true,
    monitor: getAiRiskSignalMonitorSummary(),
    assessments,
    upgrade_requests: assessments.map((assessment) => assessment.upgradeRequest).filter(Boolean),
    work_item_requests: workItemRequests.map(toCreateWorkItemInput),
    work_items: workItems,
    side_effects: {
      work_items_created: workItems.length > 0,
      work_item_count: workItems.length,
      production_mutation_allowed: false,
      note: shouldCreateWorkItems
        ? 'Created proposed Agent Ops work items only. Production remediation remains approval-gated.'
        : 'This endpoint only classifies supplied signals. Set create_work_items with confirmation to create proposed work items.',
    },
  })
}
