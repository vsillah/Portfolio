#!/usr/bin/env tsx

import { supabaseAdmin } from '@/lib/supabase'
import { buildMarkReversrEvidenceSnapshot } from '@/lib/reversr-build-evidence-extractor'

const args = new Set(process.argv.slice(2))

const AGREED_MARK_TOKEN_SNAPSHOT = {
  sessionCount: 5,
  totalTokens: 283717602,
  inputTokens: 283030750,
  cachedInputTokens: 270859776,
  outputTokens: 686852,
  reasoningTokens: 177176,
  shareOfComparisonWindowPct: 17.38,
}

function getArgValue(name: string): string | null {
  const prefix = `${name}=`
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix))
  return found ? found.slice(prefix.length) : null
}

function numberArg(name: string): number | null {
  const raw = getArgValue(name)
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

async function findOrCreateProject(apply: boolean) {
  const clientEmail = process.env.MARK_MEADOWS_EMAIL || 'mark.meadows@offline.local'

  const { data: existing, error: readError } = await supabaseAdmin
    .from('client_projects')
    .select('id, client_email')
    .or('project_name.ilike.%ReversR Rebuild%,client_name.ilike.%Mark Meadows%,client_company.ilike.%Vanguard%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (readError) throw new Error(`Failed to read client project: ${readError.message}`)
  if (existing?.id) return existing as { id: string; client_email: string }
  if (!apply) return { id: 'dry-run-client-project-id', client_email: clientEmail }

  const { data, error } = await supabaseAdmin
    .from('client_projects')
    .insert({
      project_name: 'ReversR Rebuild Product Asset',
      description: 'Client-safe dashboard record for ReversR Rebuild build evidence, token attribution, and investment translation.',
      client_name: 'Mark Meadows',
      client_email: clientEmail,
      client_company: 'Vanguard Enterprises',
      project_start_date: '2026-04-24',
      estimated_end_date: '2026-06-30',
      project_status: 'active',
      current_phase: 1,
      project_value: 30000,
      currency: 'USD',
      notes: 'Offline/security-conscious client. Keep private strategy materials out of public/client-facing surfaces.',
    })
    .select('id, client_email')
    .single()

  if (error || !data?.id) {
    throw new Error(`Failed to create client project: ${error?.message ?? 'missing id'}`)
  }
  return data as { id: string; client_email: string }
}

async function assertEvidenceTableReady() {
  const { error } = await supabaseAdmin
    .from('client_project_build_evidence')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(
      `client_project_build_evidence is not ready in the active Supabase project: ${error.message}`
    )
  }
}

async function ensureDashboardAccess(clientProjectId: string, clientEmail: string, apply: boolean) {
  if (!apply && clientProjectId === 'dry-run-client-project-id') {
    return 'dry-run-dashboard-token'
  }

  const { data: existing, error: readError } = await supabaseAdmin
    .from('client_dashboard_access')
    .select('access_token')
    .eq('client_project_id', clientProjectId)
    .eq('is_active', true)
    .maybeSingle()

  if (readError) throw new Error(`Failed to read dashboard access: ${readError.message}`)
  if (existing?.access_token) return existing.access_token as string
  if (!apply) return 'dry-run-dashboard-token'

  const { data, error } = await supabaseAdmin
    .from('client_dashboard_access')
    .insert({
      client_project_id: clientProjectId,
      client_email: clientEmail,
    })
    .select('access_token')
    .single()

  if (error || !data?.access_token) {
    throw new Error(`Failed to create dashboard access: ${error?.message ?? 'missing token'}`)
  }
  return data.access_token as string
}

async function upsertEvidence(clientProjectId: string, snapshot: Awaited<ReturnType<typeof buildMarkReversrEvidenceSnapshot>>, apply: boolean) {
  const payload = {
    client_project_id: clientProjectId,
    evidence_key: 'reversr-build-evidence',
    project_label: snapshot.projectLabel,
    repo_metrics: snapshot.repoMetrics,
    token_usage: snapshot.tokenUsage,
    cost_summary: snapshot.costSummary,
    hourly_translation: snapshot.hourlyTranslation,
    source_confidence: snapshot.sourceConfidence,
    client_safe_notes: snapshot.clientSafeNotes,
    private_source_refs: snapshot.privateSourceRefs,
    is_client_visible: true,
    captured_at: new Date().toISOString(),
  }

  if (!apply) return payload

  const { error } = await supabaseAdmin
    .from('client_project_build_evidence')
    .upsert(payload, { onConflict: 'client_project_id,evidence_key' })

  if (error) throw new Error(`Failed to upsert build evidence: ${error.message}`)
  return payload
}

async function main() {
  const apply = args.has('--apply')
  const repoEvidencePath =
    getArgValue('--repo-evidence-path') ||
    '/Users/vambahsillah/Projects/Portfolio/local-private/client-proposals/reversr-rebuild-offline-client/repo-evidence-snapshot.json'
  const sessionsRoot = getArgValue('--sessions-root') || '/Users/vambahsillah/.codex/sessions/2026/06'

  const snapshot = await buildMarkReversrEvidenceSnapshot({
    repoEvidencePath,
    sessionsRoot,
    subscriptionMonthlyCostUsd: numberArg('--subscription-monthly-usd'),
    apiEquivalentCostUsd: numberArg('--api-equivalent-cost-usd'),
  })

  if (!args.has('--live-token-scan')) {
    snapshot.tokenUsage = {
      ...snapshot.tokenUsage,
      ...AGREED_MARK_TOKEN_SNAPSHOT,
    }
    snapshot.costSummary = {
      ...snapshot.costSummary,
      subscriptionSharePct: AGREED_MARK_TOKEN_SNAPSHOT.shareOfComparisonWindowPct,
      subscriptionAllocatedCostUsd:
        snapshot.costSummary.subscriptionMonthlyCostUsd == null
          ? null
          : Math.round(
              snapshot.costSummary.subscriptionMonthlyCostUsd *
                (AGREED_MARK_TOKEN_SNAPSHOT.shareOfComparisonWindowPct / 100) *
                100
            ) / 100,
    }
    snapshot.sourceConfidence = {
      ...snapshot.sourceConfidence,
      excludedSources: [
        'Broader sessions that mention ReversR or Mark are excluded from client-facing token totals.',
        'Raw prompts, private strategy notes, local paths, and full session logs stay admin-only.',
      ],
    }
  }

  if (apply) {
    await assertEvidenceTableReady()
  }

  const project = await findOrCreateProject(apply)
  const dashboardToken = await ensureDashboardAccess(project.id, project.client_email, apply)
  const evidencePayload = await upsertEvidence(project.id, snapshot, apply)

  console.log(JSON.stringify({
    applied: apply,
    clientProjectId: project.id,
    dashboardUrl: `/client/dashboard/${dashboardToken}`,
    clientEmail: project.client_email,
    evidence: {
      project_label: evidencePayload.project_label,
      repo_metrics: evidencePayload.repo_metrics,
      token_usage: evidencePayload.token_usage,
      cost_summary: evidencePayload.cost_summary,
      hourly_translation: evidencePayload.hourly_translation,
      source_confidence: evidencePayload.source_confidence,
      client_safe_notes: evidencePayload.client_safe_notes,
    },
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
