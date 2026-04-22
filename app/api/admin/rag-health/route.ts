import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { isMockN8nEnabled, isN8nOutboundDisabled } from '@/lib/n8n-runtime-flags'
import { fetchRagContextForEmailQuery } from '@/lib/rag-query'

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
    })
  }

  const { searchParams } = new URL(request.url)
  const customQ = searchParams.get('q')?.trim()
  const query =
    customQ || 'Health check: one short paragraph on AmaduTown services and how you work with clients.'

  const t0 = Date.now()
  const text = await fetchRagContextForEmailQuery(query, { ignoreEmailRagEnabled: true })
  const latencyMs = Date.now() - t0

  if (!text) {
    return NextResponse.json(
      {
        ok: false,
        latencyMs,
        message: 'RAG returned empty (check n8n workflow, Pinecone creds, and N8N_RAG_QUERY_WEBHOOK_URL).',
      },
      { status: 200 }
    )
  }

  return NextResponse.json({
    ok: true,
    latencyMs,
    preview: text.slice(0, 500) + (text.length > 500 ? '…' : ''),
  })
}
