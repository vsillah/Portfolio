'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowRight, ClipboardList, ShieldCheck } from 'lucide-react'

export type AgentGovernanceSnapshot = {
  generated_at: string
  summary: {
    total_agents: number
    reviewed_agents: number
    planned_agents: number
    least_privilege_attention: number
    pending_authority_approvals: number
    payment_authority_actions: number
  }
  capability_profiles: Array<{
    agent_key: string
    display_name: string
    pod: string
    status: 'active' | 'partial' | 'planned'
    primary_runtime: string
    allowed_tools: string[]
    allowed_data_classes: string[]
    allowed_write_classes: string[]
    outbound_authority: 'none' | 'draft_only' | 'known_workflow' | 'approval_required'
    spend_authority: 'none' | 'approval_required'
    approval_required_for: string[]
    sensitive_boundaries: string[]
    last_reviewed_at: string
    review_status: 'reviewed' | 'planned'
    governance_status: 'green' | 'yellow' | 'red'
  }>
  payment_authority_actions: Array<{
    action: string
    approval_type: string
    label: string
    description: string
  }>
  pending_authority_approvals: Array<{
    id?: string
    run_id: string
    approval_type: string
    status: string
    requested_at: string
    requested_by_agent_key?: string | null
    metadata?: Record<string, unknown> | null
  }>
  recent_delegation_decisions: Array<{
    run_id: string
    selected_agent_key: string
    selected_agent_name: string
    task_type: string
    risk_class: string
    confidence: number
    occurred_at: string
    reason: string
    required_evidence: string[]
    approval_gate: string | null
    fallback_agent_key: string | null
    alternatives_considered: string[]
    decision_trust_enforcement: DecisionTrustEnforcementSummary | null
  }>
  recent_decision_trust_frames: Array<{
    run_id: string
    decision_id: string
    agent_key: string
    decision_type: 'information' | 'tool' | 'vendor' | 'spend' | 'data' | 'action' | 'oauth' | 'app_install'
    objective: string
    selected_candidate: string
    candidates_considered: string[]
    trust_signals: string[]
    risk_signals: string[]
    missing_evidence: string[]
    scores: {
      relationshipTrust: number
      decisionRisk: number
      evidenceCompleteness: number
    }
    recommended_gate: 'allow' | 'sandbox' | 'human_review' | 'block'
    approval_type: string | null
    reversibility: string
    occurred_at: string
    decision_trust_enforcement: DecisionTrustEnforcementSummary | null
  }>
  recent_governance_exports: Array<{
    id: string
    export_type: string
    format: 'json' | 'markdown'
    classification: string
    run_id: string | null
    client_project_id: string | null
    from_at: string | null
    to_at: string | null
    matching_run_count: number | null
    requested_by_user_id: string | null
    generated_at: string
    created_at: string
  }>
}

type DecisionTrustEnforcementSummary = {
  mode: 'shadow' | 'advisory' | 'soft_gate' | 'hard_block'
  gate: 'allow' | 'sandbox' | 'human_review' | 'block'
  may_proceed: boolean
  requires_approval: boolean
  should_block: boolean
  approval_type: string | null
  reason: string
  evidence: {
    decision_id: string | null
    linked_run_id: string | null
    selected_candidate: string | null
    missing_evidence: string[]
  }
}

export function AgentGovernancePanel({ governance }: { governance: AgentGovernanceSnapshot | null }) {
  if (!governance) return null

  const profiles = governance.capability_profiles.slice(0, 4)
  const latestDelegation = governance.recent_delegation_decisions[0]
  const latestPaymentAction = governance.payment_authority_actions[0]
  const pendingAuthority = governance.pending_authority_approvals[0]
  const pendingAuthorityPacket = authorityPacket(pendingAuthority?.metadata)
  const pendingAuthorityEnforcement = decisionTrustEnforcement(pendingAuthority?.metadata)
  const statusTone = governance.summary.pending_authority_approvals > 0
    ? 'yellow'
    : governance.summary.least_privilege_attention > 0
      ? 'blue'
      : 'green'

  return (
    <section className="agent-ops-card rounded-lg border p-4" aria-label="Agent Governance">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-radiant-gold">
            <ShieldCheck size={18} />
            <h2 className="font-semibold">Agent Governance</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Scope, delegation, spend authority, and audit state for the agentic operating system.
          </p>
        </div>
        <StatusOnlyPill tone={statusTone}>
          {governance.summary.pending_authority_approvals
            ? `${governance.summary.pending_authority_approvals} authority approval(s)`
            : `${governance.summary.reviewed_agents} reviewed`}
        </StatusOnlyPill>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/api/admin/agents/governance/export?format=markdown"
          className="inline-flex items-center gap-2 rounded-md border border-radiant-gold/45 bg-radiant-gold/10 px-3 py-2 text-sm font-medium text-radiant-gold hover:border-radiant-gold/70"
        >
          <ClipboardList size={15} />
          Export client audit
        </Link>
        <Link
          href="/api/admin/agents/governance/export?format=json"
          className="inline-flex items-center gap-2 rounded-md border border-silicon-slate/60 bg-background/40 px-3 py-2 text-sm font-medium text-foreground hover:border-radiant-gold/50"
        >
          <ShieldCheck size={15} />
          Export audit JSON
        </Link>
        {latestDelegation ? (
          <Link
            href={governanceExportHref('markdown', { runId: latestDelegation.run_id })}
            className="inline-flex items-center gap-2 rounded-md border border-sky-400/40 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-100 hover:border-sky-300/70"
          >
            <ClipboardList size={15} />
            Export latest trace
          </Link>
        ) : null}
        {pendingAuthority ? (
          <Link
            href={governanceExportHref('markdown', { runId: pendingAuthority.run_id })}
            className="inline-flex items-center gap-2 rounded-md border border-yellow-400/40 bg-yellow-500/10 px-3 py-2 text-sm font-medium text-yellow-100 hover:border-yellow-300/70"
          >
            <ShieldCheck size={15} />
            Export authority trace
          </Link>
        ) : null}
      </div>

      <GovernanceExportBuilder />
      <GovernanceExportLedger exports={governance.recent_governance_exports ?? []} />
      <DecisionTrustPanel frames={governance.recent_decision_trust_frames ?? []} />

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MiniMetric label="Profiles" value={`${governance.summary.reviewed_agents}/${governance.summary.total_agents}`} tone="green" />
        <MiniMetric label="Needs review" value={governance.summary.least_privilege_attention} tone={governance.summary.least_privilege_attention ? 'yellow' : 'green'} />
        <MiniMetric label="Payment gates" value={governance.summary.payment_authority_actions} />
        <MiniMetric label="Planned agents" value={governance.summary.planned_agents} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
        <div className="rounded-lg border border-silicon-slate/55 bg-black/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Capability inventory</p>
          <div className="mt-3 space-y-2">
            {profiles.map((profile) => (
              <div key={profile.agent_key} className="rounded-md border border-silicon-slate/45 bg-background/35 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{profile.display_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{profile.primary_runtime} · {profile.pod}</p>
                  </div>
                  <StatusOnlyPill tone={profile.governance_status}>
                    {profile.spend_authority === 'approval_required' ? 'Spend gated' : profile.review_status}
                  </StatusOnlyPill>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Tools: {profile.allowed_tools.slice(0, 3).join(', ')}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Link
            href={latestDelegation ? `/admin/agents/runs/${latestDelegation.run_id}` : '/admin/agents/runs'}
            className="block rounded-lg border border-radiant-gold/35 bg-radiant-gold/10 p-3 hover:border-radiant-gold/60"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-radiant-gold">Delegation trace</p>
            <p className="mt-2 text-sm font-semibold">
              {latestDelegation ? latestDelegation.selected_agent_name : 'No recent delegation decisions'}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {latestDelegation
                ? `${latestDelegation.task_type.replace(/_/g, ' ')} · ${Math.round(latestDelegation.confidence * 100)}% confidence`
                : 'Shaka will record deterministic delegation events when routed engagements are proposed.'}
            </p>
            {latestDelegation?.required_evidence.length ? (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Evidence: {latestDelegation.required_evidence.slice(0, 3).join(', ')}
              </p>
            ) : null}
            {latestDelegation?.approval_gate || latestDelegation?.fallback_agent_key ? (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {latestDelegation.approval_gate ? `Approval: ${latestDelegation.approval_gate}` : 'Approval: none'}
                {' · '}
                {latestDelegation.fallback_agent_key ? `Fallback: ${latestDelegation.fallback_agent_key}` : 'Fallback: none'}
              </p>
            ) : null}
            {latestDelegation?.decision_trust_enforcement ? (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Enforcement: {formatEnforcementPosture(latestDelegation.decision_trust_enforcement)}
              </p>
            ) : null}
          </Link>

          <Link
            href={pendingAuthority?.run_id ? `/admin/agents/runs/${pendingAuthority.run_id}` : '/admin/agents/coordination'}
            className="block rounded-lg border border-silicon-slate/60 bg-background/40 p-3 hover:border-radiant-gold/50"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment authority</p>
            <p className="mt-2 text-sm font-semibold">
              {governance.pending_authority_approvals.length
                ? pendingAuthorityPacket?.label ?? `${governance.pending_authority_approvals.length} pending authority checkpoint(s)`
                : latestPaymentAction?.label ?? 'Payment gates ready'}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {pendingAuthorityPacket?.side_effect_boundary ??
                'Payment, refund, subscription, vendor spend, paid API, and paid external job actions require trace-linked approval.'}
            </p>
            {pendingAuthority ? (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {pendingAuthorityPacket?.risk_level ? `Risk: ${pendingAuthorityPacket.risk_level}` : `Approval: ${pendingAuthority.approval_type}`}
                {' · '}
                {pendingAuthorityPacket?.executes_action ? 'Executes now: yes' : 'Executes now: no'}
              </p>
            ) : null}
            {pendingAuthorityEnforcement ? (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Enforcement: {formatEnforcementPosture(pendingAuthorityEnforcement)}
              </p>
            ) : null}
          </Link>
        </div>
      </div>
    </section>
  )
}

function DecisionTrustPanel({ frames }: { frames: AgentGovernanceSnapshot['recent_decision_trust_frames'] }) {
  const latest = frames[0]

  return (
    <div className="mt-4 border-t border-silicon-slate/55 pt-4" aria-label="Decision Trust">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Decision Trust</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Shadow-mode frames explain why an agent trusted a source, tool, vendor, app, or spend path before action.
          </p>
        </div>
        <StatusOnlyPill tone={latest ? gateTone(latest.recommended_gate) : 'neutral'}>
          {latest ? latest.recommended_gate.replace(/_/g, ' ') : 'shadow mode'}
        </StatusOnlyPill>
      </div>
      {latest ? (
        <Link
          href="/admin/agents/open-brain"
          className="mt-3 inline-flex items-center gap-2 rounded-md border border-radiant-gold/35 bg-radiant-gold/10 px-3 py-2 text-xs font-medium text-radiant-gold hover:border-radiant-gold/60"
        >
          <ArrowRight size={14} />
          Inspect in Open Brain
        </Link>
      ) : null}

      {latest ? (
        <Link
          href={`/admin/agents/runs/${latest.run_id}`}
          className="mt-3 block rounded-lg border border-silicon-slate/55 bg-background/35 p-3 hover:border-radiant-gold/50"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{latest.selected_candidate}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {latest.decision_type.replace(/_/g, ' ')} · {latest.objective}
              </p>
            </div>
            <StatusOnlyPill tone={gateTone(latest.recommended_gate)}>
              {latest.recommended_gate.replace(/_/g, ' ')}
            </StatusOnlyPill>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <MiniMetric label="Trust" value={formatTrustScore(latest.scores.relationshipTrust)} tone={latest.scores.relationshipTrust >= 0.65 ? 'green' : 'yellow'} />
            <MiniMetric label="Risk" value={formatTrustScore(latest.scores.decisionRisk)} tone={latest.scores.decisionRisk >= 0.55 ? 'yellow' : 'green'} />
            <MiniMetric label="Evidence" value={formatTrustScore(latest.scores.evidenceCompleteness)} tone={latest.scores.evidenceCompleteness >= 0.65 ? 'green' : 'yellow'} />
          </div>

          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Trust: {latest.trust_signals.slice(0, 2).join(', ') || 'No trust signals recorded.'}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Risk: {latest.risk_signals.slice(0, 2).join(', ') || 'No risk signals recorded.'}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Missing evidence: {latest.missing_evidence.slice(0, 3).join(', ') || 'No missing evidence recorded.'}
          </p>
          {latest.approval_type ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Approval: {latest.approval_type} · Reversibility: {latest.reversibility}
            </p>
          ) : null}
          {latest.decision_trust_enforcement ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Enforcement: {formatEnforcementPosture(latest.decision_trust_enforcement)}
            </p>
          ) : null}
        </Link>
      ) : (
        <div className="mt-3 rounded-lg border border-silicon-slate/55 bg-background/35 p-3 text-sm text-muted-foreground">
          No decision trust frames recorded yet. V1 will log frames as Agent Ops events before any enforcement is added.
        </div>
      )}
    </div>
  )
}

function authorityPacket(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.authority_packet
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  return {
    label: typeof record.label === 'string' ? record.label : null,
    risk_level: typeof record.risk_level === 'string' ? record.risk_level : null,
    side_effect_boundary: typeof record.side_effect_boundary === 'string' ? record.side_effect_boundary : null,
    executes_action: record.executes_action === true,
  }
}

function decisionTrustEnforcement(metadata: Record<string, unknown> | null | undefined): DecisionTrustEnforcementSummary | null {
  const value = metadata?.decision_trust_enforcement
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Partial<DecisionTrustEnforcementSummary>
  if (!record.mode || !record.gate || typeof record.reason !== 'string') return null
  return {
    mode: record.mode,
    gate: record.gate,
    may_proceed: record.may_proceed === true,
    requires_approval: record.requires_approval === true,
    should_block: record.should_block === true,
    approval_type: typeof record.approval_type === 'string' ? record.approval_type : null,
    reason: record.reason,
    evidence: {
      decision_id: record.evidence?.decision_id ?? null,
      linked_run_id: record.evidence?.linked_run_id ?? null,
      selected_candidate: record.evidence?.selected_candidate ?? null,
      missing_evidence: Array.isArray(record.evidence?.missing_evidence) ? record.evidence.missing_evidence : [],
    },
  }
}

function formatEnforcementPosture(enforcement: DecisionTrustEnforcementSummary) {
  const decision = enforcement.should_block
    ? 'blocks'
    : enforcement.requires_approval
      ? 'requires review'
      : enforcement.may_proceed
        ? 'may proceed'
        : 'holds'
  return `${enforcement.mode.replace(/_/g, ' ')} · ${enforcement.gate.replace(/_/g, ' ')} · ${decision}`
}

function GovernanceExportLedger({ exports }: { exports: AgentGovernanceSnapshot['recent_governance_exports'] }) {
  if (!exports.length) return null

  return (
    <div className="mt-4 border-t border-silicon-slate/55 pt-4" aria-label="Recent governance exports">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent governance exports</p>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {exports.slice(0, 4).map((item) => (
          <div key={item.id} className="rounded-md border border-silicon-slate/50 bg-background/35 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{item.format === 'markdown' ? 'Client audit' : 'Audit JSON'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatTime(item.created_at)} · {item.classification}</p>
              </div>
              <StatusOnlyPill tone={item.matching_run_count ? 'green' : 'blue'}>
                {typeof item.matching_run_count === 'number' ? `${item.matching_run_count} run(s)` : 'snapshot'}
              </StatusOnlyPill>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {governanceExportScopeLabel(item)}
            </p>
            {item.run_id ? (
              <Link href={`/admin/agents/runs/${item.run_id}`} className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-radiant-gold hover:underline">
                Open trace
                <ArrowRight size={12} />
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function governanceExportScopeLabel(item: AgentGovernanceSnapshot['recent_governance_exports'][number]) {
  const parts = [
    item.run_id ? `Run ${shortId(item.run_id)}` : null,
    item.client_project_id ? `Client ${item.client_project_id}` : null,
    item.from_at ? `From ${item.from_at.slice(0, 10)}` : null,
    item.to_at ? `To ${item.to_at.slice(0, 10)}` : null,
  ].filter(Boolean)

  return parts.length ? parts.join(' · ') : 'Current governance snapshot'
}

function shortId(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value
}

function gateTone(gate: AgentGovernanceSnapshot['recent_decision_trust_frames'][number]['recommended_gate']): 'green' | 'yellow' | 'red' | 'blue' {
  if (gate === 'allow') return 'green'
  if (gate === 'block') return 'red'
  if (gate === 'human_review') return 'yellow'
  return 'blue'
}

function formatTrustScore(value: number) {
  return `${Math.round(value * 100)}%`
}

function GovernanceExportBuilder() {
  const [runId, setRunId] = useState('')
  const [clientProjectId, setClientProjectId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const invalidDateWindow = Boolean(from && to && from > to)
  const scopedAuditHref = governanceExportHref('markdown', {
    runId,
    clientProjectId,
    from,
    to,
  })
  const scopedJsonHref = governanceExportHref('json', {
    runId,
    clientProjectId,
    from,
    to,
  })

  function resetScope() {
    setRunId('')
    setClientProjectId('')
    setFrom('')
    setTo('')
  }

  return (
    <div className="mt-4 border-t border-silicon-slate/55 pt-4" aria-label="Scoped governance export builder">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px_160px]">
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Run ID
          <input
            value={runId}
            onChange={(event) => setRunId(event.target.value)}
            placeholder="Run UUID"
            className="mt-2 h-10 w-full rounded-md border border-silicon-slate/65 bg-background/55 px-3 text-sm font-normal normal-case text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-radiant-gold/60"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Client project ID
          <input
            value={clientProjectId}
            onChange={(event) => setClientProjectId(event.target.value)}
            placeholder="Client/project key"
            className="mt-2 h-10 w-full rounded-md border border-silicon-slate/65 bg-background/55 px-3 text-sm font-normal normal-case text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-radiant-gold/60"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          From
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-2 h-10 w-full rounded-md border border-silicon-slate/65 bg-background/55 px-3 text-sm font-normal normal-case text-foreground outline-none focus:border-radiant-gold/60"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          To
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="mt-2 h-10 w-full rounded-md border border-silicon-slate/65 bg-background/55 px-3 text-sm font-normal normal-case text-foreground outline-none focus:border-radiant-gold/60"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {invalidDateWindow ? (
          <span className="text-sm text-red-300">Date range is inverted.</span>
        ) : (
          <>
            <Link
              href={scopedAuditHref}
              className="inline-flex items-center gap-2 rounded-md border border-radiant-gold/45 bg-radiant-gold/10 px-3 py-2 text-sm font-medium text-radiant-gold hover:border-radiant-gold/70"
            >
              <ClipboardList size={15} />
              Export scoped audit
            </Link>
            <Link
              href={scopedJsonHref}
              className="inline-flex items-center gap-2 rounded-md border border-silicon-slate/60 bg-background/40 px-3 py-2 text-sm font-medium text-foreground hover:border-radiant-gold/50"
            >
              <ShieldCheck size={15} />
              Export scoped JSON
            </Link>
          </>
        )}
        <button
          type="button"
          onClick={resetScope}
          className="inline-flex items-center gap-2 rounded-md border border-silicon-slate/60 bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:border-radiant-gold/50 hover:text-foreground"
        >
          Reset
        </button>
      </div>
    </div>
  )
}

function governanceExportHref(
  format: 'json' | 'markdown',
  scope: { runId?: string; clientProjectId?: string; from?: string; to?: string } = {},
) {
  const params = new URLSearchParams({ format })
  const runId = scope.runId?.trim()
  const clientProjectId = scope.clientProjectId?.trim()
  const from = scope.from?.trim()
  const to = scope.to?.trim()
  if (runId) params.set('runId', runId)
  if (clientProjectId) params.set('clientProjectId', clientProjectId)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  return `/api/admin/agents/governance/export?${params.toString()}`
}

function StatusOnlyPill({ children, tone }: { children: ReactNode; tone: 'green' | 'yellow' | 'red' | 'blue' | 'neutral' }) {
  const toneClass = {
    green: 'border-emerald-400/45 bg-emerald-500/10 text-emerald-200',
    yellow: 'border-yellow-400/45 bg-yellow-500/10 text-yellow-100',
    red: 'border-red-400/45 bg-red-500/10 text-red-100',
    blue: 'border-sky-400/45 bg-sky-500/10 text-sky-100',
    neutral: 'border-silicon-slate/60 bg-background/40 text-muted-foreground',
  }[tone]
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${toneClass}`}>{children}</span>
}

function MiniMetric({ label, value, tone = 'default' }: { label: string; value: string | number; tone?: 'default' | 'yellow' | 'green' }) {
  const toneClass = tone === 'yellow' ? 'text-yellow-100' : tone === 'green' ? 'text-emerald-200' : 'text-foreground'
  return (
    <div className="rounded-md border border-silicon-slate/55 bg-background/35 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  )
}

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}
