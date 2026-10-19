import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { endAgentRun, startAgentRun } from '@/lib/agent-run'
import {
  SOCIAL_CAMPAIGN_CANDIDATE_VERSION,
  SOCIAL_CAMPAIGN_EXTERNAL_GATES,
  SOCIAL_CAMPAIGN_MAX_ATTEMPTS,
  SOCIAL_CAMPAIGN_PACKAGE_KIND,
  SOCIAL_CAMPAIGN_RETRY_EXHAUSTED_MESSAGE,
  campaignPreparationAttemptKey,
  evaluateCampaignPreparationCandidate,
  resolveCampaignPreparationAttempt,
  type CampaignPreparationCandidate,
  type CampaignPreparationRunSummary,
} from '@/lib/social-campaign-package-preparation'
import { SOCIAL_CAMPAIGN_PACKAGE_QA_FIXTURE, socialCampaignLongFormBatchQaCandidates, socialCampaignPackageQaCandidates } from '@/lib/social-campaign-package-qa-fixture'
import {
  SOCIAL_CAMPAIGN_LONG_FORM_BATCH_KIND,
  campaignLongFormBatchIdempotencyKey,
  projectCampaignLongFormBatch,
  projectCampaignLongFormDraft,
} from '@/lib/social-campaign-long-form-batch'

export const dynamic = 'force-dynamic'

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function isCandidate(value: unknown): value is CampaignPreparationCandidate {
  const candidate = record(value)
  return candidate.version === SOCIAL_CAMPAIGN_CANDIDATE_VERSION
    && typeof candidate.candidate_id === 'string'
    && typeof candidate.campaign_identity === 'string'
    && typeof candidate.social_content_id === 'string'
    && Array.isArray(candidate.calendar_item_ids)
    && typeof candidate.content_version === 'string'
    && typeof candidate.input_version === 'string'
    && Array.isArray(candidate.source_trace)
    && Array.isArray(candidate.playlist_calibration)
    && Object.keys(record(candidate.receipts)).length === 5
    && Object.keys(record(candidate.thumbnail_checklist)).length > 0
    && Object.keys(record(candidate.deliverables)).length === 2
}

async function loadCandidates() {
  const rows: Array<{ rag_context?: unknown }> = []
  const pageSize = 100
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('social_content_queue')
      .select('id, rag_context, updated_at')
      .not('rag_context->campaign_preparation_candidate', 'is', null)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw new Error('Campaign candidates are unavailable.')
    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows
    .map((row: { rag_context?: unknown }) => record(row.rag_context).campaign_preparation_candidate)
    .filter(isCandidate)
}

async function loadRuns() {
  const { data, error } = await supabaseAdmin
    .from('agent_runs')
    .select('id,status,subject_id,subject_label,current_step,metadata,outcome,error_message,created_at,updated_at,completed_at,idempotency_key')
    .in('kind', [SOCIAL_CAMPAIGN_PACKAGE_KIND, SOCIAL_CAMPAIGN_LONG_FORM_BATCH_KIND])
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error('Campaign preparation history is unavailable.')
  return data ?? []
}

function qaMode(request: NextRequest) {
  return process.env.NODE_ENV !== 'production'
    && request.nextUrl.searchParams.get('qa_fixture') === SOCIAL_CAMPAIGN_PACKAGE_QA_FIXTURE
}

function candidateProjection(candidate: CampaignPreparationCandidate, now: Date) {
  const evaluation = evaluateCampaignPreparationCandidate(candidate, now)
  return {
    candidate: {
      ...candidate,
      deliverables: {
        linkedin: { copy: '', visual_href: '', visual_alt: '' },
        youtube: { title: '', thumbnail_teaser: '', description: '', script: '', storyboard: [], thumbnail_href: '' },
      },
    },
    evaluation: { ...evaluation, package: null },
  }
}

const RUN_RECEIPT_COLUMNS = 'id,status,subject_id,subject_label,current_step,metadata,outcome,error_message,created_at,updated_at,completed_at,idempotency_key'

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const fixtureMode = qaMode(request)
    const candidates: CampaignPreparationCandidate[] = fixtureMode ? socialCampaignPackageQaCandidates() : await loadCandidates()
    const longFormCandidates = fixtureMode ? socialCampaignLongFormBatchQaCandidates() : candidates
    const now = new Date('2026-10-19T12:00:00.000Z')
    const evaluationTime = qaMode(request) ? now : new Date()
    return NextResponse.json({
      candidates: candidates.map((candidate: CampaignPreparationCandidate) => candidateProjection(candidate, evaluationTime)),
      long_form_inventory: longFormCandidates.map((candidate) => {
        const projection = projectCampaignLongFormDraft(candidate, evaluationTime)
        return { ...projection, packet: null }
      }),
      runs: qaMode(request) ? [] : await loadRuns(),
      retry_policy: { maximum_attempts_per_input_version: SOCIAL_CAMPAIGN_MAX_ATTEMPTS, retry_limit: SOCIAL_CAMPAIGN_MAX_ATTEMPTS - 1, duplicate_records_allowed: false, source_change_requires_new_input_version: true },
      external_gates: SOCIAL_CAMPAIGN_EXTERNAL_GATES,
      fixture: qaMode(request),
      integration_note: qaMode(request) ? 'Synthetic development-only operator workflow. No shared record, provider call, paid generation, upload, platform draft, schedule, publication, credential, migration, spend, production release, or external send occurs.' : null,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Campaign preparation is unavailable.' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const body = record(await request.json())
    const action = typeof body.action === 'string' ? body.action : 'prepare_candidate'
    const candidateId = typeof body.candidate_id === 'string' ? body.candidate_id : ''
    const fixtureMode = qaMode(request)
    const candidates: CampaignPreparationCandidate[] = fixtureMode ? socialCampaignPackageQaCandidates() : await loadCandidates()
    if (action === 'prepare_long_form_batch') {
      const batchCandidates = fixtureMode ? socialCampaignLongFormBatchQaCandidates() : candidates
      const batch = projectCampaignLongFormBatch(batchCandidates, fixtureMode ? new Date('2026-10-19T12:00:00.000Z') : new Date())
      const baseKey = campaignLongFormBatchIdempotencyKey(batch)
      if (fixtureMode) return NextResponse.json({
        run: {
          id: `qa-run-${batch.batch_id}`,
          status: 'completed',
          subject_id: batch.batch_id,
          subject_label: 'Current campaign backlog',
          current_step: 'Prepared eligible long-form scripts for human review',
          metadata: { long_form_batch: batch, base_idempotency_key: baseKey, attempt_number: 1, retry_count: 0, retry_limit: 1, maximum_attempts: SOCIAL_CAMPAIGN_MAX_ATTEMPTS },
          outcome: { total: batch.total, scanned: batch.scanned, prepared: batch.prepared_count, blocked: batch.blocked_count, deferred: batch.deferred_count, remaining: batch.remaining, external_gates: SOCIAL_CAMPAIGN_EXTERNAL_GATES },
          idempotency_key: campaignPreparationAttemptKey(baseKey, 1),
          created_at: '2026-10-19T12:00:00.000Z',
          updated_at: '2026-10-19T12:00:00.000Z',
          completed_at: '2026-10-19T12:00:00.000Z',
        },
        duplicate: false,
        fixture: true,
      })

      const attemptKeys = [baseKey, campaignPreparationAttemptKey(baseKey, 1), campaignPreparationAttemptKey(baseKey, 2)]
      const history = await supabaseAdmin.from('agent_runs').select(RUN_RECEIPT_COLUMNS).in('idempotency_key', attemptKeys).order('created_at', { ascending: false })
      if (history.error) throw new Error('Could not verify long-form batch duplicate protection.')
      const decision = resolveCampaignPreparationAttempt(baseKey, (history.data ?? []) as CampaignPreparationRunSummary[])
      if (decision.action === 'replay') return NextResponse.json({ run: decision.run, duplicate: true, fixture: false, retry_count: decision.retry_count, retry_limit: decision.retry_limit })
      if (decision.action === 'blocked') return NextResponse.json({ error: decision.message, code: 'campaign_long_form_batch_retry_exhausted', retry_count: decision.retry_count, retry_limit: decision.retry_limit, recovery_label: 'Refresh source and framework evidence', recovery_href: '/admin/content/video-generation?review=script-intelligence' }, { status: 409 })

      const preparationClaim = crypto.randomUUID()
      const started = await startAgentRun({
        runtime: 'manual',
        kind: SOCIAL_CAMPAIGN_LONG_FORM_BATCH_KIND,
        title: 'Campaign backlog long-form script preparation',
        status: 'running',
        subject: { type: 'social_campaign_long_form_batch', id: batch.batch_id, label: 'Current campaign backlog' },
        triggerSource: 'portfolio_social_content',
        triggeredByUserId: auth.user.id,
        currentStep: 'Validating bounded campaign backlog and long-form framework receipts',
        idempotencyKey: decision.idempotency_key,
        metadata: { long_form_batch: batch, base_idempotency_key: baseKey, attempt_number: decision.attempt_number, retry_count: decision.retry_count, retry_limit: decision.retry_limit, maximum_attempts: SOCIAL_CAMPAIGN_MAX_ATTEMPTS, preparation_claim: preparationClaim, external_gates: SOCIAL_CAMPAIGN_EXTERNAL_GATES },
      })
      const claimed = await supabaseAdmin.from('agent_runs').select(RUN_RECEIPT_COLUMNS).eq('id', started.id).single()
      if (claimed.error || !claimed.data) throw new Error('Long-form batch started but its durable receipt could not be re-read.')
      if (record(claimed.data.metadata).preparation_claim !== preparationClaim) return NextResponse.json({ run: claimed.data, duplicate: true, fixture: false, retry_count: decision.retry_count, retry_limit: decision.retry_limit })
      await endAgentRun({ runId: started.id, status: 'completed', currentStep: 'Prepared eligible long-form scripts for human review', outcome: { total: batch.total, scanned: batch.scanned, prepared: batch.prepared_count, blocked: batch.blocked_count, deferred: batch.deferred_count, remaining: batch.remaining, batch_id: batch.batch_id, external_gates: SOCIAL_CAMPAIGN_EXTERNAL_GATES } })
      const saved = await supabaseAdmin.from('agent_runs').select(RUN_RECEIPT_COLUMNS).eq('id', started.id).single()
      if (saved.error || !saved.data) throw new Error('Long-form batch completed but its durable receipt could not be re-read.')
      return NextResponse.json({ run: saved.data, duplicate: false, fixture: false, retry_count: decision.retry_count, retry_limit: decision.retry_limit })
    }
    const candidate = candidates.find((entry: CampaignPreparationCandidate) => entry.candidate_id === candidateId)
    if (!candidate) return NextResponse.json({ error: 'Candidate unavailable. Refresh the evidence projection.' }, { status: 404 })
    const evaluation = evaluateCampaignPreparationCandidate(candidate, qaMode(request) ? new Date('2026-10-19T12:00:00.000Z') : new Date())
    if (!evaluation.ready || !evaluation.package) return NextResponse.json({ error: 'Candidate remains blocked.', evaluation }, { status: 409 })
    const baseKey = evaluation.package.idempotency_key
    if (qaMode(request)) return NextResponse.json({ run: { id: `qa-run-${evaluation.package.package_id}`, status: 'completed', subject_id: candidate.candidate_id, subject_label: candidate.product_label, current_step: 'Prepared for canonical Decision Queue review', metadata: { package: evaluation.package, base_idempotency_key: baseKey, attempt_number: 1, retry_count: 0, retry_limit: 1, maximum_attempts: SOCIAL_CAMPAIGN_MAX_ATTEMPTS }, outcome: { prepared: true, external_gates: SOCIAL_CAMPAIGN_EXTERNAL_GATES }, idempotency_key: campaignPreparationAttemptKey(baseKey, 1), created_at: evaluation.package.prepared_at, updated_at: evaluation.package.prepared_at, completed_at: evaluation.package.prepared_at }, duplicate: false, fixture: true })

    const attemptKeys = [baseKey, campaignPreparationAttemptKey(baseKey, 1), campaignPreparationAttemptKey(baseKey, 2)]
    const history = await supabaseAdmin.from('agent_runs').select(RUN_RECEIPT_COLUMNS).in('idempotency_key', attemptKeys).order('created_at', { ascending: false })
    if (history.error) throw new Error('Could not verify duplicate protection.')
    const decision = resolveCampaignPreparationAttempt(baseKey, (history.data ?? []) as CampaignPreparationRunSummary[])
    if (decision.action === 'replay') return NextResponse.json({ run: decision.run, duplicate: true, fixture: false, retry_count: decision.retry_count, retry_limit: decision.retry_limit })
    if (decision.action === 'blocked') return NextResponse.json({ error: decision.message, code: 'campaign_preparation_retry_exhausted', retry_count: decision.retry_count, retry_limit: decision.retry_limit, recovery_label: 'Refresh source evidence', recovery_href: '/admin/agents/content-intelligence?section=research' }, { status: 409 })

    const preparationClaim = crypto.randomUUID()
    const started = await startAgentRun({ runtime: 'manual', kind: SOCIAL_CAMPAIGN_PACKAGE_KIND, title: `${candidate.product_label} review package preparation`, status: 'running', subject: { type: 'social_campaign_candidate', id: candidate.candidate_id, label: candidate.product_label }, triggerSource: 'portfolio_social_content', triggeredByUserId: auth.user.id, currentStep: 'Validating evidence and package bindings', idempotencyKey: decision.idempotency_key, metadata: { package: evaluation.package, candidate_snapshot: candidate, base_idempotency_key: baseKey, attempt_number: decision.attempt_number, retry_count: decision.retry_count, retry_limit: decision.retry_limit, maximum_attempts: SOCIAL_CAMPAIGN_MAX_ATTEMPTS, preparation_claim: preparationClaim, external_gates: SOCIAL_CAMPAIGN_EXTERNAL_GATES } })
    const claimed = await supabaseAdmin.from('agent_runs').select(RUN_RECEIPT_COLUMNS).eq('id', started.id).single()
    if (claimed.error || !claimed.data) throw new Error('Preparation started but its durable receipt could not be re-read.')
    if (record(claimed.data.metadata).preparation_claim !== preparationClaim) return NextResponse.json({ run: claimed.data, duplicate: true, fixture: false, retry_count: decision.retry_count, retry_limit: decision.retry_limit })
    await endAgentRun({ runId: started.id, status: 'completed', currentStep: 'Prepared for canonical Decision Queue review', outcome: { prepared: true, package_id: evaluation.package.package_id, decision_queue_href: evaluation.package.decision_queue_href, external_gates: SOCIAL_CAMPAIGN_EXTERNAL_GATES } })
    const saved = await supabaseAdmin.from('agent_runs').select(RUN_RECEIPT_COLUMNS).eq('id', started.id).single()
    if (saved.error || !saved.data) throw new Error('Preparation completed but its durable receipt could not be re-read.')
    return NextResponse.json({ run: saved.data, duplicate: false, fixture: false, retry_count: decision.retry_count, retry_limit: decision.retry_limit })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Campaign review package could not be prepared.'
    return NextResponse.json({ error: message, code: message === SOCIAL_CAMPAIGN_RETRY_EXHAUSTED_MESSAGE ? 'campaign_preparation_retry_exhausted' : 'campaign_preparation_failed' }, { status: 409 })
  }
}

