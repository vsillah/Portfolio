import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ALLOWED_ORIGINS = new Set([
  'https://amadutown.com',
  'https://www.amadutown.com',
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
])

export async function middleware(req: NextRequest) {
  // CORS gate for chat API routes (mutating methods only)
  if (req.nextUrl.pathname.startsWith('/api/chat') && req.method !== 'GET') {
    const origin = req.headers.get('origin')
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 },
      )
    }
  }

  // Temporary production cutover bridge. Only the explicitly configured next
  // token is translated for routes that already authorize N8N_INGEST_SECRET.
  // Remove this bridge after every production caller uses the rotated token.
  const current = process.env.N8N_INGEST_SECRET
  const next = process.env.N8N_INGEST_SECRET_NEXT
  if (
    !req.nextUrl.pathname.startsWith('/api/chat') &&
    current && next && current !== next &&
    req.headers.get('authorization') === `Bearer ${next}`
  ) {
    const headers = new Headers(req.headers)
    headers.set('authorization', `Bearer ${current}`)
    return NextResponse.next({ request: { headers } })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/chat/:path*',
    '/api/admin/agents/runs/:runId/events',
    '/api/admin/agents/runs/:runId',
    '/api/admin/cost-events/ingest',
    '/api/admin/outreach/actor-alert',
    '/api/admin/outreach/ingest',
    '/api/admin/outreach/last-run',
    '/api/admin/outreach/run-complete',
    '/api/admin/rag-ingest',
    '/api/admin/read-ai/meetings/:id/follow-up-import',
    '/api/admin/social-content/render-carousel',
    '/api/admin/social-content/workflow-complete',
    '/api/admin/value-evidence/ingest-market',
    '/api/admin/value-evidence/ingest',
    '/api/admin/value-evidence/workflow-complete',
    '/api/admin/value-evidence/workflow-progress',
    '/api/client-email-context',
    '/api/client-update-drafts/:id/delivered',
    '/api/client-update-drafts',
    '/api/cron/agent-ops-morning-review',
    '/api/cron/agent-ops-slack-notifications',
    '/api/cron/client-ai-ops-monitor',
    '/api/cron/drive-sync',
    '/api/cron/gamma-stuck-cleanup',
    '/api/cron/moremi-risk-monitor',
    '/api/cron/social-content-calendar-due-gates',
    '/api/cron/social-content-comment-attention',
    '/api/cron/social-content-human-gate-reminders',
    '/api/cron/social-content-intelligence-digest',
    '/api/cron/social-content-scheduled-publish',
    '/api/cron/social-topic-backlog',
    '/api/meetings/:id/follow-up-context',
    '/api/meetings/:id/promote-tasks',
    '/api/read-ai-meeting-dedupe',
    '/api/slack-meeting-dedupe',
    '/api/video-context',
    '/api/webhooks/n8n/generate-acceleration-recs',
    '/api/webhooks/n8n/generate-dashboard-tasks',
    '/api/webhooks/n8n/milestone-notify',
    '/api/webhooks/n8n/outreach-followup-trigger',
  ],
}
