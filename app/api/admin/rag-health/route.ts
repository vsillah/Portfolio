import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { isMockN8nEnabled, isN8nOutboundDisabled } from '@/lib/n8n-runtime-flags'
import { fetchRagContextForEmailQueryWithDiagnostics } from '@/lib/rag-query'
import { routePolicyFor, type RagRoute } from '@/lib/knowledge-governance'
import { KNOWLEDGE_GOVERNANCE_STATUS } from '@/lib/knowledge-source-manifest'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/rag-health
 *
 * Verifies the n8n RAG query webhook (Pinecone) is reachable from the app
 * and returns a short text preview. Use for ops; does not replace n8n UI checks.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (isN8nOutboundDisabled() || isMockN8nEnabled()) {
    return NextResponse.json({
      ok: false,
      skipped: true,
      reason: isMockN8nEnabled() ? 'MOCK_N8N' : 'N8N_DISABLE_OUTBOUND',
      governance: KNOWLEDGE_GOVERNANCE_STATUS,
    })
  }

  const { searchParams } = new URL(request.url)
  const customQ = searchParams.get('q')?.trim()
  const requestedRoute = searchParams.get('route')?.trim() as RagRoute | null
  const route: RagRoute = requestedRoute && isSupportedRagRoute(requestedRoute)
    ? requestedRoute
    : 'public_chatbot_voice'
  const policy = routePolicyFor(route)
  const query =
    customQ || 'Health check: one short paragraph on AmaduTown services and how you work with clients.'

  const t0 = Date.now()
  const { block: text, diagnostics } = await fetchRagContextForEmailQueryWithDiagnostics(query, {
    ignoreEmailRagEnabled: true,
    route,
  })
  const latencyMs = Date.now() - t0

  if (!text) {
    return NextResponse.json(
      {
        ok: false,
        latencyMs,
        route,
        policy,
        diagnostics,
        governance: KNOWLEDGE_GOVERNANCE_STATUS,
        message: 'RAG returned empty (check n8n workflow, Pinecone creds, and N8N_RAG_QUERY_WEBHOOK_URL).',
      },
      { status: 200 }
    )
  }

  return NextResponse.json({
    ok: true,
    latencyMs,
    route,
    policy,
    diagnostics,
    governance: KNOWLEDGE_GOVERNANCE_STATUS,
    preview: text.slice(0, 500) + (text.length > 500 ? '…' : ''),
  })
}

function isSupportedRagRoute(route: string): route is RagRoute {
  return ['public_chatbot', 'public_chatbot_voice', 'outreach_email', 'admin_internal', 'legacy_health'].includes(route)
}
