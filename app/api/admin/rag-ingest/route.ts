import { NextRequest, NextResponse } from 'next/server'
import { isAuthError, verifyAdmin } from '@/lib/auth-server'
import { endAgentRun, recordAgentEvent, startAgentRun } from '@/lib/agent-run'
import { buildKnowledgeIngestionPlan } from '@/lib/knowledge-ingestion'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/rag-ingest
 *
 * Builds a governed shadow ingestion plan from the repo-owned knowledge manifest.
 * n8n may trigger this endpoint, but Portfolio owns source validation,
 * extraction, chunking, dedup, privacy checks, and Agent Ops trace recording.
 *
 * This endpoint does not mutate Pinecone yet. Production cutover and writes to
 * `amadutown-knowledge-v1` remain approval-gated.
 */
export async function POST(request: NextRequest) {
  const bearerToken = request.headers.get('authorization')?.replace('Bearer ', '')
  const isN8nAuth = Boolean(process.env.N8N_INGEST_SECRET && bearerToken === process.env.N8N_INGEST_SECRET)

  if (!isN8nAuth) {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
  }

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const requestedWrite = body.write === true || body.dry_run === false
  const sourceIds = Array.isArray(body.source_ids)
    ? body.source_ids.filter((sourceId): sourceId is string => typeof sourceId === 'string')
    : undefined

  const plan = await buildKnowledgeIngestionPlan({
    sourceIds,
    includeUnapproved: body.include_unapproved === true,
    ingestRunId: typeof body.ingest_run_id === 'string' ? body.ingest_run_id : undefined,
  })

  await recordKnowledgeIngestRun(plan, {
    triggerSource: isN8nAuth ? 'n8n' : 'admin',
    requestedWrite,
  })

  return NextResponse.json(
    {
      ...summarizePlan(plan),
      write_status: requestedWrite
        ? 'blocked_pending_pinecone_cutover_approval'
        : 'shadow_plan_only',
      approval_required: requestedWrite,
    },
    { status: plan.ok ? 200 : 422 },
  )
}

function summarizePlan(plan: Awaited<ReturnType<typeof buildKnowledgeIngestionPlan>>) {
  return {
    ok: plan.ok,
    mode: plan.mode,
    ingest_run_id: plan.ingestRunId,
    target_index: plan.targetIndex,
    legacy_index: plan.legacyIndex,
    source_count: plan.sourceCount,
    approved_source_count: plan.approvedSourceCount,
    chunk_count: plan.chunkCount,
    skipped_sources: plan.skippedSources,
    errors: plan.errors,
    privacy_violations: plan.privacyViolations,
    duplicate_chunk_count: plan.duplicateChunkCount,
    namespace_counts: plan.namespaceCounts,
    metadata_completeness: plan.metadataCompleteness,
    sample_chunks: plan.chunks.slice(0, 5).map((chunk) => ({
      id: chunk.id,
      title: chunk.metadata.title,
      source_id: chunk.metadata.sourceId,
      namespace: chunk.metadata.namespace,
      privacy_tier: chunk.metadata.privacyTier,
      content_fingerprint: chunk.metadata.contentFingerprint,
      text_preview: chunk.text.slice(0, 180),
    })),
  }
}

async function recordKnowledgeIngestRun(
  plan: Awaited<ReturnType<typeof buildKnowledgeIngestionPlan>>,
  context: { triggerSource: string; requestedWrite: boolean },
) {
  try {
    const run = await startAgentRun({
      agentKey: 'private-knowledge-librarian',
      runtime: 'codex',
      kind: 'rag_ingest_shadow_plan',
      title: 'Governed RAG ingestion shadow plan',
      status: plan.ok ? 'completed' : 'failed',
      triggerSource: context.triggerSource,
      metadata: {
        target_index: plan.targetIndex,
        legacy_index: plan.legacyIndex,
        requested_write: context.requestedWrite,
        source_count: plan.sourceCount,
        chunk_count: plan.chunkCount,
        skipped_source_count: plan.skippedSources.length,
        privacy_violation_count: plan.privacyViolations.length,
        duplicate_chunk_count: plan.duplicateChunkCount,
      },
      idempotencyKey: `rag-ingest-shadow:${plan.ingestRunId}`,
    })

    await recordAgentEvent({
      runId: run.id,
      eventType: plan.ok ? 'rag_ingest_shadow_ready' : 'rag_ingest_shadow_failed',
      severity: plan.ok ? 'info' : 'error',
      message: plan.ok
        ? `Prepared ${plan.chunkCount} governed RAG chunks.`
        : `Governed RAG ingestion blocked with ${plan.errors.length} errors.`,
      metadata: summarizePlan(plan),
      idempotencyKey: `rag-ingest-shadow:${plan.ingestRunId}:summary`,
    })

    await endAgentRun({
      runId: run.id,
      status: plan.ok ? 'completed' : 'failed',
      outcome: summarizePlan(plan),
      errorMessage: plan.ok ? null : plan.errors.join('; '),
      currentStep: 'shadow plan complete',
    })
  } catch (error) {
    console.warn('[rag-ingest] Agent Ops run recording skipped:', error instanceof Error ? error.message : error)
  }
}
