'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Database,
  FileText,
  GitBranch,
  Network,
  RefreshCw,
  Route,
  ShieldCheck,
  Target,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import type {
  OpenBrainPrivacyTier,
  OpenBrainRelationshipAuditRecord,
  OpenBrainRelationshipInsight,
  OpenBrainRelationshipNodeType,
  OpenBrainSnapshot,
} from '@/lib/open-brain'

type ViewMode = 'router' | 'sources' | 'proposals' | 'wiki' | 'parity' | 'producers' | 'map'
type RelationshipFilterValue = 'all'
type RelationshipHealthFilter = RelationshipFilterValue | 'green' | 'yellow' | 'red'
type RelationshipStrengthFilter = RelationshipFilterValue | 'strong' | 'medium' | 'weak'
type RelationshipStatusFilter = RelationshipFilterValue | 'persisted' | 'inferred' | 'recommended'
type DecisionTrustFilter = RelationshipFilterValue | 'decision_trust' | 'high_risk_gate'
type RelationshipLens = 'all' | 'edges' | 'routes'
type RelationshipGraphNode = OpenBrainSnapshot['relationshipMap']['nodes'][number]
type DisplayRelationshipGraphNode = RelationshipGraphNode & { x: number; y: number }

export default function OpenBrainPage() {
  return (
    <ProtectedRoute requireAdmin>
      <OpenBrainContent />
    </ProtectedRoute>
  )
}

function OpenBrainContent() {
  const [snapshot, setSnapshot] = useState<OpenBrainSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('router')
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [reviewingProposalId, setReviewingProposalId] = useState<string | null>(null)
  const [proposingInsightId, setProposingInsightId] = useState<string | null>(null)

  const authedFetch = useCallback(async (url: string, init: RequestInit = {}) => {
    const session = await getCurrentSession()
    if (!session?.access_token) throw new Error('Missing admin session')
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...(init.headers || {}),
      },
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
    return body
  }, [])

  const fetchSnapshot = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSnapshot(await authedFetch('/api/admin/agents/open-brain'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Open Brain status')
      setSnapshot(null)
    } finally {
      setLoading(false)
    }
  }, [authedFetch])

  useEffect(() => {
    fetchSnapshot()
  }, [fetchSnapshot])

  const pendingProposals = useMemo(
    () => snapshot?.proposals.filter((proposal) => proposal.status === 'pending') || [],
    [snapshot?.proposals],
  )

  async function compileWiki() {
    setActionMessage(null)
    try {
      const body = await authedFetch('/api/admin/agents/open-brain/wiki/compile', { method: 'POST', body: '{}' })
      setActionMessage(`${body.pages?.length || 0} wiki page preview(s) compiled. Approval is required before repo writes.`)
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Wiki compile failed')
    }
  }

  async function reviewProposal(id: string, action: 'approve' | 'reject') {
    setActionMessage(null)
    setReviewingProposalId(id)
    try {
      const body = await authedFetch(`/api/admin/agents/open-brain/proposals/${encodeURIComponent(id)}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ reason: `${action === 'approve' ? 'Approved' : 'Rejected'} from Portfolio Admin.` }),
      })
      const createdRelationshipLink = action === 'approve' && Boolean(body.proposal?.metadata?.relationship)
      setActionMessage(createdRelationshipLink
        ? 'Relationship proposal approved. A durable Open Brain link record was created.'
        : `Proposal ${action === 'approve' ? 'approved' : 'rejected'}.`)
      await fetchSnapshot()
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : `Proposal ${action} failed`)
    } finally {
      setReviewingProposalId(null)
    }
  }

  async function handleRelationshipSuggestion(insight: OpenBrainRelationshipInsight) {
    if (!snapshot) return
    setActionMessage(null)
    setProposingInsightId(insight.id)
    try {
      const payload = buildRelationshipProposalPayload(snapshot, insight)
      const body = await authedFetch('/api/admin/agents/open-brain/proposals', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setActionMessage(`Relationship proposal created for review: ${body.proposal?.proposedMemory?.title || insight.title}. No Open Brain link was changed.`)
      setViewMode('proposals')
      await fetchSnapshot()
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Relationship proposal creation failed')
    } finally {
      setProposingInsightId(null)
    }
  }

  return (
    <div className="agent-ops-page min-h-screen p-5 text-foreground lg:p-7">
      <div className="mx-auto max-w-7xl">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Agent Operations', href: '/admin/agents' },
          { label: 'Open Brain' },
        ]} />

        <header className="agent-ops-surface-header mb-6 mt-5 flex flex-col gap-4 rounded-xl border p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="agent-ops-eyebrow"><Brain size={16} /> Agent Ops Memory</p>
            <h1 className="mt-1 text-3xl font-bold">Open Brain</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Local-first memory projection for Portfolio Agent Ops. The local Open Brain remains the source of truth; Portfolio shows health, proposals, source freshness, producer gates, and generated wiki previews.
            </p>
          </div>
          <div className="agent-ops-header-actions">
            <Link
              href="/admin/agents/automations"
              className="agent-ops-button-muted"
            >
              <GitBranch size={16} />
              Automation Context
            </Link>
            <button
              onClick={fetchSnapshot}
              disabled={loading}
              className="agent-ops-button-secondary disabled:opacity-60"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </header>

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading Open Brain status...</div>
        ) : error ? (
          <FailureState title="Failed to load Open Brain" message={error} />
        ) : snapshot ? (
          <>
            {!snapshot.service.available ? (
              <section className="mb-6 rounded-lg border border-yellow-400/40 bg-yellow-500/10 p-4 text-yellow-100">
                <div className="mb-2 flex items-center gap-2 font-medium">
                  <AlertTriangle size={18} />
                  Local Open Brain service not initialized
                </div>
                <p className="text-sm">{snapshot.service.reason}</p>
                <p className="mt-2 text-xs text-yellow-100/80">Home: {snapshot.service.home}</p>
              </section>
            ) : null}

            <OpenBrainActionMetrics
              snapshot={snapshot}
              pendingProposals={pendingProposals.length}
              onViewModeChange={setViewMode}
            />

            <OpenBrainControlPanel
              snapshot={snapshot}
              pendingProposals={pendingProposals.length}
              onViewModeChange={setViewMode}
              onCompileWiki={compileWiki}
            />

            <section className="mb-6 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-radiant-gold">
                    <Brain size={18} />
                    <h2 className="font-semibold">Context Packet</h2>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{snapshot.contextPacket.purpose}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <HealthPill label="Sources" value={snapshot.health.sourceFreshness} />
                  <HealthPill label="Memory" value={snapshot.health.memoryHealth} />
                  <HealthPill label="Proposals" value={snapshot.health.proposalHealth} />
                  <HealthPill label="Wiki" value={snapshot.health.wikiOverlay} />
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
                <ListBlock label="Boundaries" values={snapshot.contextPacket.boundaries} />
                <ListBlock label="Current risks" values={snapshot.contextPacket.currentRisks} empty="No immediate risks in the projection." />
                <ListBlock label="Expected outputs" values={snapshot.contextPacket.expectedOutputs} />
              </div>
            </section>

            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="max-w-full overflow-x-auto rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-1">
                <div className="inline-flex min-w-max">
                <ModeButton icon={<Route size={16} />} active={viewMode === 'router'} onClick={() => setViewMode('router')}>Router</ModeButton>
                <ModeButton icon={<Database size={16} />} active={viewMode === 'sources'} onClick={() => setViewMode('sources')}>Sources</ModeButton>
                <ModeButton icon={<ShieldCheck size={16} />} active={viewMode === 'proposals'} onClick={() => setViewMode('proposals')}>Proposals</ModeButton>
                <ModeButton icon={<FileText size={16} />} active={viewMode === 'wiki'} onClick={() => setViewMode('wiki')}>Wiki Overlay</ModeButton>
                <ModeButton icon={<Network size={16} />} active={viewMode === 'parity'} onClick={() => setViewMode('parity')}>Runtime Parity</ModeButton>
                <ModeButton icon={<GitBranch size={16} />} active={viewMode === 'producers'} onClick={() => setViewMode('producers')}>Producers</ModeButton>
                <ModeButton icon={<Network size={16} />} active={viewMode === 'map'} onClick={() => setViewMode('map')}>Map</ModeButton>
                </div>
              </div>
              <button
                onClick={compileWiki}
                className="agent-ops-button-secondary"
              >
                <FileText size={16} />
                Compile wiki preview
              </button>
            </div>

            {actionMessage ? (
              <div className="mb-6 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-3 text-sm text-muted-foreground">
                {actionMessage}
              </div>
            ) : null}

            {viewMode === 'router' ? <RouterView snapshot={snapshot} /> : null}
            {viewMode === 'sources' ? <SourcesView snapshot={snapshot} /> : null}
            {viewMode === 'proposals' ? (
              <ProposalsView
                proposals={pendingProposals.length ? pendingProposals : snapshot.proposals}
                relationshipAudit={snapshot.relationshipMap.audit}
                reviewingProposalId={reviewingProposalId}
                onReview={reviewProposal}
              />
            ) : null}
            {viewMode === 'wiki' ? <WikiView pages={snapshot.wikiPages} /> : null}
            {viewMode === 'parity' ? <ParityView snapshot={snapshot} /> : null}
            {viewMode === 'producers' ? <ProducerView snapshot={snapshot} /> : null}
            {viewMode === 'map' ? (
              <RelationshipMapView
                snapshot={snapshot}
                proposingInsightId={proposingInsightId}
                onSuggestionAction={handleRelationshipSuggestion}
              />
            ) : null}

            <p className="mt-5 text-xs text-muted-foreground">
              Generated {formatDateTime(snapshot.generatedAt)}. {snapshot.service.operationalBoundary}
            </p>
          </>
        ) : null}
      </div>
    </div>
  )
}

function OpenBrainControlPanel({
  snapshot,
  pendingProposals,
  onViewModeChange,
  onCompileWiki,
}: {
  snapshot: OpenBrainSnapshot
  pendingProposals: number
  onViewModeChange: (mode: ViewMode) => void
  onCompileWiki: () => void
}) {
  const blockedProducerGates = snapshot.producerGates.filter((gate) => gate.status === 'blocked').length
  const parityIssues = snapshot.runtimeParity.filter((runtime) => runtime.status !== 'connected').length
  const primary = pendingProposals
    ? {
        label: 'Memory proposals need review',
        detail: `${pendingProposals} proposal(s) are waiting for approve or reject before becoming durable Open Brain memory.`,
        reason: 'Unreviewed proposals are not durable memory yet. They should stay out of compiled wiki and RAG projections until a human approves or rejects them.',
        recommendation: 'Review the pending proposal queue first, then approve only the memories that are sourced, non-private, and operationally useful.',
        safety: 'Approve/reject records a review decision. It does not publish private raw exports or write generated wiki pages to the repo.',
        proof: 'Proposal review history and status live in the Proposals view.',
        action: 'Review proposals',
        mode: 'proposals' as ViewMode,
        tone: 'border-radiant-gold/45',
      }
    : snapshot.overview.staleSources
      ? {
          label: 'Source freshness needs review',
          detail: `${snapshot.overview.staleSources} source(s) are stale and should be inspected before RAG or wiki promotion.`,
          reason: 'Stale source records can make memory, wiki, and RAG projections look more current than they are.',
          recommendation: 'Inspect source freshness before compiling wiki previews or promoting knowledge into retrieval.',
          safety: 'Inspection is read-only. Refreshing or replacing a source remains outside this page unless a producer writes a new approved record.',
          proof: 'Source timestamps and privacy tiers live in the Sources view.',
          action: 'Inspect sources',
          mode: 'sources' as ViewMode,
          tone: 'border-yellow-400/45',
        }
      : blockedProducerGates
        ? {
            label: 'Producer gates are blocked',
            detail: `${blockedProducerGates} producer gate(s) need context or configuration before emitting records.`,
            reason: 'Blocked producers cannot safely emit memory records, so downstream dashboards may miss current context.',
            recommendation: 'Review the producer gate notes and unblock only the producers with clear approval and privacy boundaries.',
            safety: 'Opening producer gates here is informational; configuration changes still happen through their runtime-specific approval paths.',
            proof: 'Producer status and required environment handles live in the Producers view.',
            action: 'Review producers',
            mode: 'producers' as ViewMode,
            tone: 'border-yellow-400/45',
          }
        : {
            label: 'Open Brain projection is ready',
            detail: 'No pending proposal is waiting. Router, source, parity, and producer views remain available for audit.',
            reason: 'The projection has no immediate memory-review blocker, so the next useful action is an audit rather than a mutation.',
            recommendation: 'Inspect router policy or runtime parity when you need to confirm how memory-aware work will execute.',
            safety: 'Audit actions are read-only. Wiki compilation still creates a preview and requires approval before repo writes.',
            proof: 'Router decisions, parity status, and generated timestamps live in their drilldown views.',
            action: 'Inspect router',
            mode: 'router' as ViewMode,
            tone: 'border-green-400/45',
          }

  return (
    <section className={`mb-6 rounded-lg border bg-background/20 p-5 ${primary.tone}`} aria-label="Open Brain next actions">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-radiant-gold">
            <Target size={14} />
            Open Brain operator packet
          </p>
          <h2 className="mt-2 text-xl font-semibold">{primary.label}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{primary.detail}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onViewModeChange(primary.mode)}
              className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15"
            >
              {primary.action}
            </button>
            <button
              type="button"
              onClick={onCompileWiki}
              className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-background/55 px-3 py-2 text-sm hover:border-radiant-gold/45"
            >
              <FileText size={15} />
              Compile wiki preview
            </button>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <OperatorPacketBlock title="Why this matters" value={primary.reason} />
          <OperatorPacketBlock title="Recommended action" value={primary.recommendation} />
          <OperatorPacketBlock title="Safety boundary" value={primary.safety} />
          <OperatorPacketBlock title="Evidence home" value={primary.proof} />
        </div>
      </div>
    </section>
  )
}

function OpenBrainActionMetrics({
  snapshot,
  pendingProposals,
  onViewModeChange,
}: {
  snapshot: OpenBrainSnapshot
  pendingProposals: number
  onViewModeChange: (mode: ViewMode) => void
}) {
  const enabledProducerGates = snapshot.producerGates.filter((gate) => gate.status === 'enabled').length
  const parityIssues = snapshot.runtimeParity.filter((runtime) => runtime.status !== 'connected').length
  const metricCards = [
    {
      label: 'Pending proposals',
      value: String(pendingProposals),
      detail: 'Approve or reject memory before it becomes durable.',
      action: 'Review queue',
      mode: 'proposals' as ViewMode,
      icon: <ShieldCheck size={17} />,
      tone: pendingProposals ? 'border-radiant-gold/55 bg-radiant-gold/10' : 'border-green-400/35 bg-green-500/10',
      ariaLabel: 'Open pending memory proposals',
    },
    {
      label: 'Stale sources',
      value: String(snapshot.overview.staleSources),
      detail: 'Check source freshness before wiki or RAG use.',
      action: 'Inspect sources',
      mode: 'sources' as ViewMode,
      icon: <Database size={17} />,
      tone: snapshot.overview.staleSources ? 'border-yellow-400/45 bg-yellow-500/10' : 'border-silicon-slate/70 bg-silicon-slate/20',
      ariaLabel: 'Open stale source records',
    },
    {
      label: 'Producer gates',
      value: `${enabledProducerGates}/${snapshot.producerGates.length}`,
      detail: 'See which producers can safely emit records.',
      action: 'Review gates',
      mode: 'producers' as ViewMode,
      icon: <GitBranch size={17} />,
      tone: enabledProducerGates === snapshot.producerGates.length ? 'border-green-400/35 bg-green-500/10' : 'border-yellow-400/45 bg-yellow-500/10',
      ariaLabel: 'Open producer gate status',
    },
    {
      label: 'Runtime parity',
      value: `${parityIssues}/${snapshot.runtimeParity.length}`,
      detail: 'Verify Codex, Hermes, and bridge registration.',
      action: 'Check runtimes',
      mode: 'parity' as ViewMode,
      icon: <Network size={17} />,
      tone: parityIssues ? 'border-yellow-400/45 bg-yellow-500/10' : 'border-green-400/35 bg-green-500/10',
      ariaLabel: 'Open runtime parity checks',
    },
  ]

  return (
    <section className="mb-6 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4" aria-label="Open Brain actionable metrics">
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="agent-ops-eyebrow"><Target size={14} /> Actionable signals</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Four entry points for work that may need an operator. Broader counts stay inside their drilldown views.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {snapshot.overview.sources} sources · {snapshot.overview.events} events · {snapshot.overview.wikiPages} wiki page(s)
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <button
            key={card.label}
            type="button"
            aria-label={card.ariaLabel}
            onClick={() => onViewModeChange(card.mode)}
            className={`group rounded-lg border p-4 text-left transition hover:border-radiant-gold/70 hover:bg-radiant-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-radiant-gold/60 ${card.tone}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-radiant-gold">
                {card.icon}
                <p className="text-xs font-semibold uppercase tracking-[0.14em]">{card.label}</p>
              </div>
              <ArrowRight size={16} className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-radiant-gold" />
            </div>
            <p className="mt-4 text-3xl font-bold tabular-nums text-foreground">{card.value}</p>
            <p className="mt-1 min-h-[40px] text-sm text-muted-foreground">{card.detail}</p>
            <span className="mt-3 inline-flex text-sm font-medium text-radiant-gold">{card.action}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function OperatorPacketBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-silicon-slate/55 bg-background/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-foreground/90">{value}</p>
    </div>
  )
}

function RouterView({ snapshot }: { snapshot: OpenBrainSnapshot }) {
  const modelOps = snapshot.modelOps
  if (!modelOps.available) {
    return <EmptyState message={modelOps.reason || 'Model Ops reports are not available to the Open Brain projection.'} />
  }

  const localEligible = modelOps.routerDecisions.filter((decision) => decision.executionLane === 'local')
  const frontierHeld = modelOps.routerDecisions.filter((decision) => decision.executionLane === 'frontier')
  const approvalRequired = modelOps.routerDecisions.filter((decision) => decision.approvalState === 'approval_required')

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <Detail label="Local default" value={modelOps.currentLocalDefault} />
        <Detail label="Frontier fallback" value={modelOps.currentFrontierFallback} />
        <Detail label="Embedding model" value={modelOps.currentEmbeddingModel} />
        <Detail label="Monitor cadence" value={modelOps.monitor.cadence} />
      </div>

      <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-radiant-gold">
              <Route size={18} />
              <h2 className="font-semibold">Unified Router Status</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              One governance-aware router decides between local, frontier, hybrid, tool, and approval-gated execution.
            </p>
          </div>
          <StatusBadge value={approvalRequired.length ? 'approval_required' : 'approved_policy'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
          <ListBlock label="Local eligible" values={localEligible.map((decision) => decision.taskClass)} empty="No task classes are local-only yet." />
          <ListBlock label="Held on frontier" values={frontierHeld.map((decision) => decision.taskClass)} empty="No task classes are frontier-only." />
          <ListBlock label="Approval gated" values={approvalRequired.map((decision) => decision.taskClass)} empty="No approval-gated router decisions." />
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {modelOps.routerDecisions.map((decision) => (
          <article key={decision.id} className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{decision.taskClass.replace(/_/g, ' ')}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{decision.id}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <LaneBadge lane={decision.executionLane} />
                <StatusBadge value={decision.approvalState} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <Detail label="Selected runtime" value={decision.selectedRuntime} />
              <Detail label="Fallback runtime" value={decision.fallbackRuntime || 'none'} />
              <Detail label="Confidence" value={`${Math.round(decision.confidence * 100)}%`} />
              <Detail label="Evidence" value={decision.evidenceSource} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{decision.reason}</p>
            {decision.linkedRecordIds.length > 0 ? (
              <p className="mt-3 break-all text-xs text-muted-foreground">
                Linked evidence: {decision.linkedRecordIds.join(', ')}
              </p>
            ) : null}
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
        <h2 className="mb-3 font-semibold">Latest Benchmark Evidence</h2>
        <div className="overflow-x-auto rounded-lg border border-silicon-slate/70">
          <table className="min-w-[720px] w-full text-sm">
            <thead className="bg-silicon-slate/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Task</th>
                <th className="px-4 py-3 text-left font-medium">Model</th>
                <th className="px-4 py-3 text-left font-medium">Score</th>
                <th className="px-4 py-3 text-left font-medium">Latency</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-silicon-slate/60">
              {modelOps.benchmarkResults.map((result) => (
                <tr key={result.id}>
                  <td className="px-4 py-3">{result.task}</td>
                  <td className="px-4 py-3">{result.model}</td>
                  <td className="px-4 py-3">{result.score === null ? 'n/a' : `${Math.round(result.score * 1000) / 10}%`}</td>
                  <td className="px-4 py-3">{result.latencyMs === null ? 'n/a' : `${Math.round(result.latencyMs)}ms`}</td>
                  <td className="px-4 py-3 text-muted-foreground">{result.confidenceStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
        <h2 className="mb-3 font-semibold">RAG Quality Progress</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {modelOps.ragQualityRuns.map((run) => (
            <article key={run.id} className="rounded-lg border border-silicon-slate/60 bg-black/10 p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <h3 className="font-medium">{run.name}</h3>
                <span className="text-xs text-muted-foreground">{run.totalQueries}/200</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Local sufficient {run.localSufficient}, partial {run.localPartial}, weak {run.localWeak}. Better/same/worse: {run.localBetter}/{run.localSame}/{run.localWorse}.
              </p>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}

function RelationshipMapView({
  snapshot,
  proposingInsightId,
  onSuggestionAction,
}: {
  snapshot: OpenBrainSnapshot
  proposingInsightId: string | null
  onSuggestionAction: (insight: OpenBrainRelationshipInsight) => void
}) {
  const [typeFilter, setTypeFilter] = useState<OpenBrainRelationshipNodeType | 'all'>('all')
  const [privacyFilter, setPrivacyFilter] = useState<OpenBrainPrivacyTier | 'all'>('all')
  const [healthFilter, setHealthFilter] = useState<RelationshipHealthFilter>('all')
  const [strengthFilter, setStrengthFilter] = useState<RelationshipStrengthFilter>('all')
  const [statusFilter, setStatusFilter] = useState<RelationshipStatusFilter>('all')
  const [decisionTrustFilter, setDecisionTrustFilter] = useState<DecisionTrustFilter>('all')
  const [relationshipLens, setRelationshipLens] = useState<RelationshipLens>('all')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null)
  const map = snapshot.relationshipMap
  const visibleNodes = map.nodes.filter((node) => (
    (typeFilter === 'all' || node.type === typeFilter) &&
    (privacyFilter === 'all' || node.privacyTier === privacyFilter) &&
    (healthFilter === 'all' || node.health === healthFilter) &&
    (decisionTrustFilter === 'all' ||
      (decisionTrustFilter === 'decision_trust' && node.kind === 'agent_decision_trust_observed') ||
      (decisionTrustFilter === 'high_risk_gate' && (node.decisionTrustGate === 'human_review' || node.decisionTrustGate === 'block')))
  ))
  const displayNodes = visibleNodes.map((node, index) => ({
    ...node,
    ...relationshipNodePosition(index, visibleNodes.length),
  }))
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id))
  const visibleEdges = map.edges.filter((edge) => (
    visibleNodeIds.has(edge.fromId) &&
    visibleNodeIds.has(edge.toId) &&
    (strengthFilter === 'all' || edge.strength === strengthFilter) &&
    (statusFilter === 'all' || edge.status === statusFilter)
  ))
  const nodeById = new Map(displayNodes.map((node) => [node.id, node]))
  const allNodeById = new Map(map.nodes.map((node) => [node.id, node]))
  const nodeTypes: Array<OpenBrainRelationshipNodeType | 'all'> = ['all', 'source', 'memory', 'event', 'wiki', 'proposal']
  const privacyTiers: Array<OpenBrainPrivacyTier | 'all'> = ['all', 'public_safe', 'client_safe', 'internal_ops', 'private']
  const healthValues: RelationshipHealthFilter[] = ['all', 'green', 'yellow', 'red']
  const strengthValues: RelationshipStrengthFilter[] = ['all', 'strong', 'medium', 'weak']
  const statusValues: RelationshipStatusFilter[] = ['all', 'persisted', 'inferred', 'recommended']
  const decisionTrustValues: DecisionTrustFilter[] = ['all', 'decision_trust', 'high_risk_gate']
  const selectedNode = (selectedNodeId ? nodeById.get(selectedNodeId) : null) || visibleNodes[0] || null
  const selectedNodeEdges = selectedNode
    ? visibleEdges.filter((edge) => edge.fromId === selectedNode.id || edge.toId === selectedNode.id)
    : []
  const selectedPath = selectedNodeEdges.find((edge) => edge.strength === 'strong') || selectedNodeEdges[0] || visibleEdges.find((edge) => edge.strength === 'strong') || visibleEdges[0]
  const selectedFrom = selectedPath ? nodeById.get(selectedPath.fromId) : null
  const selectedTo = selectedPath ? nodeById.get(selectedPath.toId) : null
  const selectedInsight = (selectedInsightId ? map.insights.find((insight) => insight.id === selectedInsightId) : null) || map.insights[0] || null
  const selectedInsightSource = selectedInsight?.sourceNodeId ? allNodeById.get(selectedInsight.sourceNodeId) || null : null
  const selectedInsightTarget = selectedInsight?.targetNodeId ? allNodeById.get(selectedInsight.targetNodeId) || null : null
  const visibleInsightSource = selectedInsight?.sourceNodeId ? nodeById.get(selectedInsight.sourceNodeId) || null : null
  const visibleInsightTarget = selectedInsight?.targetNodeId ? nodeById.get(selectedInsight.targetNodeId) || null : null
  const visibleProposalRoutes = map.insights
    .map((insight) => ({
      insight,
      source: insight.sourceNodeId ? nodeById.get(insight.sourceNodeId) || null : null,
      target: insight.targetNodeId ? nodeById.get(insight.targetNodeId) || null : null,
    }))
    .filter((route): route is { insight: OpenBrainRelationshipInsight; source: DisplayRelationshipGraphNode; target: DisplayRelationshipGraphNode } => Boolean(route.source && route.target))
  const renderedEdges = relationshipLens === 'routes' ? [] : visibleEdges
  const renderedProposalRoutes = relationshipLens === 'edges' ? [] : visibleProposalRoutes
  const renderedRelationshipNodeIds = new Set<string>()
  for (const edge of renderedEdges) {
    renderedRelationshipNodeIds.add(edge.fromId)
    renderedRelationshipNodeIds.add(edge.toId)
  }
  for (const route of renderedProposalRoutes) {
    renderedRelationshipNodeIds.add(route.source.id)
    renderedRelationshipNodeIds.add(route.target.id)
  }
  const renderedOrphanedNodes = visibleNodes.filter((node) => !renderedRelationshipNodeIds.has(node.id)).length
  const graphMinHeight = Math.max(680, Math.ceil(visibleNodes.length / 3) * 150 + 210)
  const activeFilterCount = [typeFilter, privacyFilter, healthFilter, strengthFilter, statusFilter, decisionTrustFilter, relationshipLens].filter((value) => value !== 'all').length
  const selectedRouteLabel = visibleInsightSource && visibleInsightTarget
    ? relationshipRouteLabel(visibleInsightSource, visibleInsightTarget)
    : selectedFrom && selectedTo
      ? `Selected path: ${formatRouteNodeLabel(selectedFrom)} -> ${formatRouteNodeLabel(selectedTo)}`
      : 'No visible relationship path for this filter.'

  function resetFilters() {
    setTypeFilter('all')
    setPrivacyFilter('all')
    setHealthFilter('all')
    setStrengthFilter('all')
    setStatusFilter('all')
    setDecisionTrustFilter('all')
    setRelationshipLens('all')
  }

  return (
    <section className="space-y-5" aria-label="Open Brain relationship map">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <RelationshipMetric label="Relationships" value={map.overview.relationships} detail={`${map.overview.strongRelationships} strong`} />
        <RelationshipMetric label="Weak links" value={map.overview.weakRelationships} detail="Need more evidence" tone="yellow" />
        <RelationshipMetric label="Orphaned records" value={map.overview.orphanedRecords} detail="No visible edge" tone="red" />
        <RelationshipMetric label="Stale sources" value={map.overview.staleSources} detail="Refresh before promotion" tone="yellow" />
        <RelationshipMetric label="Suggestions" value={map.overview.proposalSuggestions} detail="Proposal-only actions" />
      </div>

      <div className="grid gap-4 2xl:grid-cols-[250px_minmax(0,1fr)_340px]">
        <aside className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="agent-ops-eyebrow"><Network size={14} /> Filters</p>
            <span className="text-xs text-muted-foreground">{visibleNodes.length}/{map.nodes.length} nodes · {visibleEdges.length}/{map.edges.length} edges · {visibleProposalRoutes.length} routes</span>
          </div>
          <div className="space-y-5">
            <RelationshipFilterGroup label="Record type">
            {nodeTypes.map((type) => {
              const count = type === 'all' ? map.nodes.length : map.nodes.filter((node) => node.type === type).length
              return (
                <RelationshipFilterButton
                  key={type}
                  active={typeFilter === type}
                  count={count}
                  onClick={() => setTypeFilter(type)}
                  label={type === 'all' ? 'All records' : type}
                />
              )
            })}
            </RelationshipFilterGroup>

            <RelationshipFilterGroup label="Privacy tier">
            {privacyTiers.map((tier) => (
              <RelationshipFilterButton
                key={tier}
                active={privacyFilter === tier}
                count={tier === 'all' ? map.nodes.length : map.nodes.filter((node) => node.privacyTier === tier).length}
                onClick={() => setPrivacyFilter(tier)}
                label={tier === 'all' ? 'All tiers' : tier.replace(/_/g, ' ')}
              />
            ))}
            </RelationshipFilterGroup>

            <RelationshipFilterGroup label="Context health">
            {healthValues.map((health) => (
              <RelationshipFilterButton
                key={health}
                active={healthFilter === health}
                count={health === 'all' ? map.nodes.length : map.nodes.filter((node) => node.health === health).length}
                onClick={() => setHealthFilter(health)}
                label={health === 'all' ? 'All health' : health}
              />
            ))}
            </RelationshipFilterGroup>

            <RelationshipFilterGroup label="Relationship strength">
            {strengthValues.map((strength) => (
              <RelationshipFilterButton
                key={strength}
                active={strengthFilter === strength}
                count={strength === 'all' ? map.edges.length : map.edges.filter((edge) => edge.strength === strength).length}
                onClick={() => setStrengthFilter(strength)}
                label={strength === 'all' ? 'All strengths' : strength}
              />
            ))}
            </RelationshipFilterGroup>

            <RelationshipFilterGroup label="Edge status">
            {statusValues.map((status) => (
              <RelationshipFilterButton
                key={status}
                active={statusFilter === status}
                count={status === 'all' ? map.edges.length : map.edges.filter((edge) => edge.status === status).length}
                onClick={() => setStatusFilter(status)}
                label={status === 'all' ? 'All statuses' : status}
              />
            ))}
            </RelationshipFilterGroup>

            <RelationshipFilterGroup label="Decision Trust">
            {decisionTrustValues.map((value) => (
              <RelationshipFilterButton
                key={value}
                active={decisionTrustFilter === value}
                count={decisionTrustCount(map.nodes, value)}
                onClick={() => setDecisionTrustFilter(value)}
                label={decisionTrustLabel(value)}
              />
            ))}
            </RelationshipFilterGroup>
          </div>
          <div className="mt-5 rounded-lg border border-silicon-slate/60 bg-background/20 p-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-3">
              <span>{activeFilterCount} active filter(s)</span>
              <button
                type="button"
                onClick={resetFilters}
                disabled={activeFilterCount === 0}
                className="rounded-md border border-silicon-slate/60 px-2 py-1 text-foreground hover:border-radiant-gold/45 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset filters
              </button>
            </div>
            <p className="mt-2">Showing {visibleNodes.length} node(s) and {visibleEdges.length} relationship(s).</p>
          </div>
          <div className="mt-5 space-y-2 border-t border-silicon-slate/60 pt-4 text-xs text-muted-foreground">
            <RelationshipLegend color="bg-radiant-gold" label="Strong/persisted" />
            <RelationshipLegend color="bg-platinum-white" label="Inferred medium" />
            <RelationshipLegend color="bg-red-300" label="Weak or risky" />
            <RelationshipLegend color="border border-radiant-gold bg-transparent" label="Proposal-only action" />
          </div>
          <RelationshipMapDiagnostics
            renderedEdges={renderedEdges.length}
            renderedProposalRoutes={renderedProposalRoutes.length}
            visibleEdges={visibleEdges.length}
            visibleProposalRoutes={visibleProposalRoutes.length}
            renderedOrphanedNodes={renderedOrphanedNodes}
            relationshipLens={relationshipLens}
          />
          <RelationshipNodeColorLegend nodes={visibleNodes} />
        </aside>

        <div
          className="relative overflow-hidden rounded-lg border border-radiant-gold/20 bg-[radial-gradient(circle_at_50%_45%,rgba(212,175,55,0.08),transparent_34%),linear-gradient(180deg,rgba(12,23,39,0.94),rgba(7,14,25,0.98))] shadow-2xl"
          style={{ minHeight: `${graphMinHeight}px` }}
        >
          <div className="absolute left-5 top-5 z-10 max-w-[calc(100%-2.5rem)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-radiant-gold">Memory Graph</p>
            <p className="mt-1 text-sm text-muted-foreground">{selectedRouteLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Filtered view: {visibleNodes.length} node(s), {renderedEdges.length} rendered edge(s), {renderedProposalRoutes.length} rendered proposal route(s)
            </p>
            <div className="mt-3 flex flex-wrap gap-2 rounded-lg border border-silicon-slate/60 bg-black/25 p-2 backdrop-blur">
              <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Relationship lens</span>
              <button
                type="button"
                onClick={() => setRelationshipLens('all')}
                className={relationshipLensButtonClass(relationshipLens === 'all')}
              >
                All relationships
              </button>
              <button
                type="button"
                onClick={() => setRelationshipLens('edges')}
                className={relationshipLensButtonClass(relationshipLens === 'edges')}
              >
                Persisted edges
              </button>
              <button
                type="button"
                onClick={() => setRelationshipLens('routes')}
                className={relationshipLensButtonClass(relationshipLens === 'routes')}
              >
                Proposal routes
              </button>
            </div>
          </div>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <marker id="relationship-arrow" markerHeight="4" markerWidth="5" orient="auto" refX="4.5" refY="2">
                <path d="M0,0 L5,2 L0,4 Z" fill="rgba(245,208,96,0.88)" />
              </marker>
              <marker id="relationship-muted-arrow" markerHeight="4" markerWidth="5" orient="auto" refX="4.5" refY="2">
                <path d="M0,0 L5,2 L0,4 Z" fill="rgba(234,236,238,0.62)" />
              </marker>
            </defs>
            {renderedEdges.map((edge) => {
              const from = nodeById.get(edge.fromId)
              const to = nodeById.get(edge.toId)
              if (!from || !to) return null
              return (
                <line
                  key={edge.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={relationshipEdgeColor(edge.strength, edge.status)}
                  strokeWidth={edge.strength === 'strong' ? 1.2 : edge.strength === 'medium' ? 0.9 : 0.7}
                  strokeDasharray={edge.status === 'inferred' ? '1.4 1.1' : undefined}
                  strokeLinecap="round"
                  markerEnd={edge.strength === 'weak' ? 'url(#relationship-muted-arrow)' : 'url(#relationship-arrow)'}
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
            {renderedProposalRoutes.map(({ insight, source, target }, index) => {
              const isSelectedRoute = selectedInsight?.id === insight.id
              return (
                <path
                  key={`route:${insight.id}`}
                  d={relationshipRoutePath(source, target, index)}
                  fill="none"
                  stroke={isSelectedRoute ? 'rgba(245,208,96,0.98)' : 'rgba(125,211,252,0.64)'}
                  strokeWidth={isSelectedRoute ? 1.8 : 1}
                  strokeDasharray={isSelectedRoute ? '2.4 1.2' : '1.2 1.4'}
                  strokeLinecap="round"
                  markerEnd={isSelectedRoute ? 'url(#relationship-arrow)' : 'url(#relationship-muted-arrow)'}
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
          </svg>
          {displayNodes.map((node) => (
            <button
              type="button"
              key={node.id}
              onClick={() => setSelectedNodeId(node.id)}
              aria-label={`Select ${node.label}`}
              className={`absolute z-10 flex max-w-[132px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-lg border px-2.5 py-2 text-center shadow-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-radiant-gold/70 ${
                selectedNode?.id === node.id ? 'ring-2 ring-radiant-gold/80' : ''
              } ${relationshipNodeTone(node.type, node.health, node.kind)}`}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              title={node.summary}
            >
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] opacity-75">{node.type}</span>
              <span className="mt-1 line-clamp-2 text-xs font-semibold leading-4">{node.label}</span>
              <span className="mt-1 text-[10px] opacity-70">{node.kind.replace(/_/g, ' ')}</span>
              {node.decisionTrustGate ? (
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] opacity-80">
                  {node.decisionTrustGate.replace(/_/g, ' ')}
                </span>
              ) : null}
            </button>
          ))}
          <div className="absolute bottom-5 left-5 z-10 flex flex-wrap gap-3 rounded-lg border border-silicon-slate/60 bg-black/30 p-3 text-xs text-muted-foreground backdrop-blur">
            <RelationshipLegend color="bg-radiant-gold" label="Strong" />
            <RelationshipLegend color="bg-platinum-white" label="Inferred" />
            <RelationshipLegend color="bg-red-300" label="Weak" />
            <RelationshipLegend color="bg-sky-300" label="Proposed route" />
          </div>
        </div>

        <aside className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
          <SelectedRelationshipRecordPanel
            node={selectedNode}
            nodes={nodeById}
            edges={selectedNodeEdges}
            insights={map.insights}
            audit={map.audit}
          />
          <div className="my-5 border-t border-silicon-slate/60" />
          <RelationshipInsightRoutePreview
            insight={selectedInsight}
            sourceNode={selectedInsightSource}
            targetNode={selectedInsightTarget}
            proposingInsightId={proposingInsightId}
            onSuggestionAction={onSuggestionAction}
          />
          <div className="my-5 border-t border-silicon-slate/60" />
          <p className="agent-ops-eyebrow"><Target size={14} /> Relationship insights</p>
          <h2 className="mt-2 text-xl font-semibold">What I will review before action</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            These controls do not mutate Open Brain. They identify relationship changes that should become explicit proposals.
          </p>
          <div className="mt-4 space-y-3">
            {map.insights.length > 0 ? map.insights.map((insight) => {
              const isSelectedInsight = selectedInsight?.id === insight.id
              return (
              <article key={insight.id} className={`rounded-lg border border-l-4 bg-background/20 p-3 ${relationshipInsightTone(insight.severity)} ${isSelectedInsight ? 'ring-1 ring-radiant-gold/70' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold">{insight.title}</h3>
                  <span className="rounded-full border border-silicon-slate/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {insight.kind.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{insight.detail}</p>
                <p className="mt-2 text-xs leading-relaxed text-foreground/85">{insight.recommendation}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedInsightId(insight.id)
                      if (insight.sourceNodeId && visibleNodeIds.has(insight.sourceNodeId)) {
                        setSelectedNodeId(insight.sourceNodeId)
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/60 px-3 py-2 text-xs font-medium text-foreground hover:border-radiant-gold/45"
                  >
                    Preview route
                  </button>
                  <button
                    type="button"
                    onClick={() => onSuggestionAction(insight)}
                    disabled={proposingInsightId === insight.id}
                    className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/40 bg-radiant-gold/10 px-3 py-2 text-xs font-medium text-radiant-gold hover:bg-radiant-gold/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {proposingInsightId === insight.id ? 'Creating proposal...' : insight.actionLabel}
                  </button>
                </div>
              </article>
              )
            }) : (
              <EmptyState message="No relationship issues are visible for the current graph." />
            )}
          </div>
          <div className="mt-5 border-t border-silicon-slate/60 pt-4">
            <p className="agent-ops-eyebrow"><ShieldCheck size={14} /> Persisted link audit</p>
            <div className="mt-3 space-y-3">
              {map.audit.length > 0 ? map.audit.slice(0, 4).map((record) => (
                <RelationshipAuditCard key={record.linkId} record={record} compact />
              )) : (
                <p className="rounded-lg border border-silicon-slate/60 bg-background/20 p-3 text-xs text-muted-foreground">
                  No approved relationship links are persisted yet.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

function buildRelationshipProposalPayload(snapshot: OpenBrainSnapshot, insight: OpenBrainRelationshipInsight) {
  const nodes = snapshot.relationshipMap.nodes
  const sourceNode = insight.sourceNodeId ? nodes.find((node) => node.id === insight.sourceNodeId) : null
  const targetNode = insight.targetNodeId ? nodes.find((node) => node.id === insight.targetNodeId) : null
  const sourceIds = [sourceNode, targetNode]
    .filter((node): node is NonNullable<typeof node> => Boolean(node && node.type === 'source'))
    .map((node) => node.id)
  const relationshipLabel = sourceNode && targetNode
    ? `${sourceNode.label} -> ${targetNode.label}`
    : sourceNode
      ? sourceNode.label
      : targetNode
        ? targetNode.label
        : 'Unscoped relationship insight'
  const title = `Relationship proposal: ${insight.title}`
  const body = [
    `Relationship insight: ${insight.detail}`,
    `Recommended change: ${insight.recommendation}`,
    `Relationship path: ${relationshipLabel}`,
    `Insight kind: ${insight.kind.replace(/_/g, ' ')}`,
    sourceNode && targetNode
      ? 'Authority boundary: approval creates one durable Open Brain link record for the relationship path shown here.'
      : 'Authority boundary: this proposal records the recommended relationship context for review; no link record is created unless a target relationship is explicit.',
  ].join('\n')

  const metadata = {
    ...(sourceNode && targetNode ? {
      relationship: {
        fromId: sourceNode.id,
        toId: targetNode.id,
        relationship: relationshipNameForInsight(insight),
        insightId: insight.id,
        insightKind: insight.kind,
        sourceLabel: sourceNode.label,
        targetLabel: targetNode.label,
      },
    } : {}),
    ...(insight.decisionTrust ? { decisionTrust: insight.decisionTrust } : {}),
  }

  return {
    kind: 'workflow',
    title,
    body,
    privacyTier: insight.decisionTrust ? 'internal_ops' : strongestPrivacyTier([sourceNode?.privacyTier, targetNode?.privacyTier]),
    confidence: insight.severity === 'high' ? 0.84 : insight.severity === 'medium' ? 0.78 : 0.72,
    sourceIds,
    reason: `Created from Open Brain relationship map insight ${insight.id}. Review before durable memory or link changes.`,
    metadata: Object.keys(metadata).length ? metadata : undefined,
  }
}

function SelectedRelationshipRecordPanel({
  node,
  nodes,
  edges,
  insights,
  audit,
}: {
  node: OpenBrainSnapshot['relationshipMap']['nodes'][number] | null
  nodes: Map<string, OpenBrainSnapshot['relationshipMap']['nodes'][number]>
  edges: OpenBrainSnapshot['relationshipMap']['edges']
  insights: OpenBrainSnapshot['relationshipMap']['insights']
  audit: OpenBrainRelationshipAuditRecord[]
}) {
  if (!node) {
    return (
      <div>
        <p className="agent-ops-eyebrow"><Network size={14} /> Selected record</p>
        <p className="mt-3 rounded-lg border border-silicon-slate/60 bg-background/20 p-3 text-sm text-muted-foreground">
          No record is visible for the current filters.
        </p>
      </div>
    )
  }

  const relatedInsights = insights.filter((insight) => insight.sourceNodeId === node.id || insight.targetNodeId === node.id)
  const relatedAudit = audit.filter((record) => record.fromId === node.id || record.toId === node.id)

  return (
    <div>
      <p className="agent-ops-eyebrow"><Network size={14} /> Selected record</p>
      <h2 className="mt-2 text-xl font-semibold">{node.label}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{node.summary}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Detail label="Type" value={node.type} />
        <Detail label="Kind" value={node.kind.replace(/_/g, ' ')} />
        <Detail label="Privacy" value={node.privacyTier} />
        <Detail label="Health" value={node.health} />
      </div>
      {node.path ? (
        <p className="mt-3 break-all rounded-lg border border-silicon-slate/60 bg-background/20 p-3 text-xs text-muted-foreground">
          Source path: {node.path}
        </p>
      ) : null}
      {node.decisionTrustGate ? (
        <p className="mt-3 rounded-lg border border-yellow-400/30 bg-yellow-500/10 p-3 text-xs text-yellow-100">
          Decision trust gate: {node.decisionTrustGate.replace(/_/g, ' ')}
        </p>
      ) : null}

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Connected relationships</p>
        <div className="mt-2 space-y-2">
          {edges.length > 0 ? edges.map((edge) => {
            const otherId = edge.fromId === node.id ? edge.toId : edge.fromId
            const otherNode = nodes.get(otherId)
            const direction = edge.fromId === node.id ? 'outbound' : 'inbound'
            return (
              <div key={edge.id} className="rounded-lg border border-silicon-slate/60 bg-background/20 p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{formatRelationshipLabel(edge.relationship)} · {direction}</p>
                  <span className="rounded-full border border-silicon-slate/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {edge.strength} / {edge.status}
                  </span>
                </div>
                <p className="mt-2 text-muted-foreground">{otherNode?.label || otherId}</p>
                <p className="mt-1 text-muted-foreground">{edge.evidence}</p>
              </div>
            )
          }) : (
            <p className="rounded-lg border border-silicon-slate/60 bg-background/20 p-3 text-xs text-muted-foreground">
              No visible relationships match the current filters.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Recommendation context</p>
        <div className="mt-2 space-y-2">
          {relatedInsights.length > 0 ? relatedInsights.map((insight) => (
            <p key={insight.id} className="rounded-lg border border-radiant-gold/25 bg-radiant-gold/10 p-3 text-xs text-muted-foreground">
              <span className="font-semibold text-radiant-gold">{insight.kind.replace(/_/g, ' ')}:</span> {insight.title}
            </p>
          )) : (
            <p className="rounded-lg border border-silicon-slate/60 bg-background/20 p-3 text-xs text-muted-foreground">
              No relationship recommendation currently targets this record.
            </p>
          )}
        </div>
      </div>

      {relatedAudit.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Approval provenance</p>
          <div className="mt-2 space-y-2">
            {relatedAudit.map((record) => (
              <p key={record.linkId} className="rounded-lg border border-green-400/25 bg-green-500/10 p-3 text-xs text-muted-foreground">
                {record.linkId} · {record.reviewedBy || 'unknown reviewer'} · {record.evidence}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function RelationshipInsightRoutePreview({
  insight,
  sourceNode,
  targetNode,
  proposingInsightId,
  onSuggestionAction,
}: {
  insight: OpenBrainRelationshipInsight | null
  sourceNode: OpenBrainSnapshot['relationshipMap']['nodes'][number] | null
  targetNode: OpenBrainSnapshot['relationshipMap']['nodes'][number] | null
  proposingInsightId: string | null
  onSuggestionAction: (insight: OpenBrainRelationshipInsight) => void
}) {
  if (!insight) {
    return (
      <div>
        <p className="agent-ops-eyebrow"><Route size={14} /> Proposed route</p>
        <p className="mt-3 rounded-lg border border-silicon-slate/60 bg-background/20 p-3 text-sm text-muted-foreground">
          No relationship insight is available for this map.
        </p>
      </div>
    )
  }

  const relationshipName = relationshipNameForInsight(insight)
  const sourceLabel = sourceNode?.label || insight.sourceNodeId || 'Unscoped source'
  const targetLabel = targetNode?.label || insight.targetNodeId || 'Review target not yet explicit'
  const createsDurableLink = Boolean(sourceNode && targetNode)

  return (
    <div>
      <p className="agent-ops-eyebrow"><Route size={14} /> Proposed route</p>
      <h2 className="mt-2 text-xl font-semibold">{insight.title}</h2>
      <div className="mt-4 rounded-lg border border-radiant-gold/25 bg-radiant-gold/10 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-radiant-gold">Route preview</p>
        <div className="mt-3 grid gap-2 text-xs">
          <Detail label="From" value={sourceLabel} />
          <Detail label="To" value={targetLabel} />
          <Detail label="Relationship" value={formatRelationshipLabel(relationshipName)} />
          <Detail label="Severity" value={insight.severity} />
        </div>
      </div>
      <p className="mt-3 rounded-lg border border-silicon-slate/60 bg-background/20 p-3 text-xs leading-relaxed text-muted-foreground">
        Next step I will create an approval-gated relationship proposal when this action is selected. Approval is required before Open Brain creates or changes a durable link.
      </p>
      <p className={`mt-3 rounded-lg border p-3 text-xs leading-relaxed ${
        createsDurableLink
          ? 'border-green-400/25 bg-green-500/10 text-green-100'
          : 'border-yellow-400/30 bg-yellow-500/10 text-yellow-100'
      }`}>
        {createsDurableLink
          ? 'Approval impact: this proposal can become one durable Open Brain link record for the route shown above.'
          : 'Approval impact: this proposal records review context only until both sides of the route are explicit.'}
      </p>
      <button
        type="button"
        onClick={() => onSuggestionAction(insight)}
        disabled={proposingInsightId === insight.id}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-radiant-gold/40 bg-radiant-gold/10 px-3 py-2 text-xs font-medium text-radiant-gold hover:bg-radiant-gold/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {proposingInsightId === insight.id ? 'Creating proposal...' : insight.actionLabel}
      </button>
    </div>
  )
}

function formatRelationshipLabel(value: string) {
  return value.replace(/_/g, ' ')
}

function relationshipNameForInsight(insight: OpenBrainRelationshipInsight) {
  if (insight.kind === 'strengthen') return 'governed_by'
  if (insight.kind === 'missing_governance') return 'needs_governing_context'
  if (insight.kind === 'merge_duplicate') return 'possible_duplicate'
  if (insight.kind === 'decision_trust_review') return 'requires_trust_review'
  return 'needs_review'
}

function decisionTrustLabel(value: DecisionTrustFilter) {
  if (value === 'decision_trust') return 'Decision Trust'
  if (value === 'high_risk_gate') return 'Human/block gate'
  return 'All decisions'
}

function decisionTrustCount(nodes: OpenBrainSnapshot['relationshipMap']['nodes'], value: DecisionTrustFilter) {
  if (value === 'decision_trust') return nodes.filter((node) => node.kind === 'agent_decision_trust_observed').length
  if (value === 'high_risk_gate') return nodes.filter((node) => node.decisionTrustGate === 'human_review' || node.decisionTrustGate === 'block').length
  return nodes.length
}

function strongestPrivacyTier(tiers: Array<OpenBrainPrivacyTier | undefined>): OpenBrainPrivacyTier {
  if (tiers.includes('private')) return 'private'
  if (tiers.includes('internal_ops')) return 'internal_ops'
  if (tiers.includes('client_safe')) return 'client_safe'
  return 'public_safe'
}

function RelationshipMetric({
  label,
  value,
  detail,
  tone = 'gold',
}: {
  label: string
  value: number
  detail: string
  tone?: 'gold' | 'yellow' | 'red'
}) {
  const valueTone = tone === 'red' ? 'text-red-200' : tone === 'yellow' ? 'text-yellow-100' : 'text-foreground'
  const borderTone = tone === 'red' ? 'border-red-400/35' : tone === 'yellow' ? 'border-yellow-400/40' : 'border-radiant-gold/20'
  return (
    <div className={`rounded-lg border bg-silicon-slate/20 p-4 ${borderTone}`}>
      <p className={`text-3xl font-bold tabular-nums ${valueTone}`}>{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-radiant-gold">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function RelationshipFilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function RelationshipFilterButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean
  count: number
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={`${label} ${count}`}
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm capitalize transition ${
        active
          ? 'border-radiant-gold/55 bg-radiant-gold/10 text-radiant-gold'
          : 'border-silicon-slate/60 bg-background/20 text-muted-foreground hover:border-radiant-gold/35 hover:text-foreground'
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{count}</span>
    </button>
  )
}

function RelationshipLegend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  )
}

function RelationshipMapDiagnostics({
  renderedEdges,
  renderedProposalRoutes,
  visibleEdges,
  visibleProposalRoutes,
  renderedOrphanedNodes,
  relationshipLens,
}: {
  renderedEdges: number
  renderedProposalRoutes: number
  visibleEdges: number
  visibleProposalRoutes: number
  renderedOrphanedNodes: number
  relationshipLens: RelationshipLens
}) {
  const hiddenEdges = Math.max(0, visibleEdges - renderedEdges)
  const hiddenRoutes = Math.max(0, visibleProposalRoutes - renderedProposalRoutes)
  const diagnostic = renderedEdges === 0 && renderedProposalRoutes > 0
    ? 'Only proposal routes are visible in this lens. No durable edge is being shown.'
    : renderedEdges === 0 && renderedProposalRoutes === 0
      ? 'No relationship is visible under the current filters and lens.'
      : 'The graph is drawing relationship evidence for the current lens.'

  return (
    <div className="mt-5 rounded-lg border border-silicon-slate/60 bg-background/20 p-3 text-xs text-muted-foreground">
      <p className="font-semibold uppercase tracking-[0.14em] text-radiant-gold">Map diagnostics</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Detail label="Lens" value={relationshipLens} />
        <Detail label="Rendered edges" value={renderedEdges} />
        <Detail label="Proposal routes" value={renderedProposalRoutes} />
        <Detail label="Unconnected nodes" value={renderedOrphanedNodes} />
      </div>
      <p className="mt-3 leading-relaxed">{diagnostic}</p>
      {(hiddenEdges > 0 || hiddenRoutes > 0) ? (
        <p className="mt-2 leading-relaxed">
          Hidden by lens: {hiddenEdges} edge(s), {hiddenRoutes} proposal route(s).
        </p>
      ) : null}
    </div>
  )
}

function RelationshipNodeColorLegend({ nodes }: { nodes: RelationshipGraphNode[] }) {
  const counts = new Map<string, { count: number; node: RelationshipGraphNode }>()
  for (const node of nodes) {
    const key = node.type === 'source' ? node.kind : node.type
    const current = counts.get(key)
    counts.set(key, { count: (current?.count || 0) + 1, node: current?.node || node })
  }
  const entries = [...counts.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))

  return (
    <div className="mt-5 rounded-lg border border-silicon-slate/60 bg-background/20 p-3 text-xs text-muted-foreground">
      <p className="font-semibold uppercase tracking-[0.14em] text-radiant-gold">Node colors</p>
      <div className="mt-3 space-y-2">
        {entries.length > 0 ? entries.map(([key, entry]) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <span className="inline-flex min-w-0 items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${relationshipNodeLegendColor(entry.node.type, entry.node.health, entry.node.kind)}`} />
              <span className="truncate">{key.replace(/_/g, ' ')}</span>
            </span>
            <span className="tabular-nums">{entry.count}</span>
          </div>
        )) : (
          <p>No visible node colors for the current filters.</p>
        )}
      </div>
    </div>
  )
}

function relationshipLensButtonClass(active: boolean) {
  return `rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
    active
      ? 'border-radiant-gold/60 bg-radiant-gold/15 text-radiant-gold'
      : 'border-silicon-slate/60 text-muted-foreground hover:border-radiant-gold/40 hover:text-foreground'
  }`
}

function relationshipEdgeColor(strength: 'strong' | 'medium' | 'weak', status: string) {
  if (strength === 'weak') return 'rgba(252,165,165,0.7)'
  if (status === 'persisted') return 'rgba(212,175,55,0.95)'
  if (strength === 'strong') return 'rgba(245,208,96,0.82)'
  return 'rgba(234,236,238,0.5)'
}

function relationshipNodeTone(type: OpenBrainRelationshipNodeType, health: 'green' | 'yellow' | 'red', kind: string) {
  if (type === 'source') {
    if (kind === 'creative_manuscript') return 'border-fuchsia-300/70 bg-fuchsia-500/20 text-fuchsia-50'
    if (kind === 'creative_project') return 'border-amber-300/70 bg-amber-500/20 text-amber-50'
    if (health === 'red') return 'border-red-300/70 bg-red-950/80 text-red-100'
    if (kind === 'workspace_root_report') return 'border-sky-300/70 bg-sky-500/25 text-sky-50'
    if (kind === 'codex_automation') return 'border-radiant-gold/70 bg-radiant-gold text-imperial-navy'
    if (kind === 'runbook') return 'border-emerald-300/70 bg-emerald-500/25 text-emerald-50'
    if (kind.includes('credential')) return 'border-red-300/70 bg-red-500/20 text-red-50'
    if (kind.includes('model')) return 'border-violet-300/70 bg-violet-500/25 text-violet-50'
    if (kind.includes('content') || kind.includes('voice')) return 'border-pink-300/70 bg-pink-500/20 text-pink-50'
    return 'border-cyan-300/70 bg-cyan-500/20 text-cyan-50'
  }
  if (type === 'memory') return 'border-radiant-gold/45 bg-platinum-white text-imperial-navy'
  if (type === 'wiki') return 'border-radiant-gold/45 bg-bronze text-platinum-white'
  if (type === 'proposal') return 'border-yellow-300/60 bg-imperial-navy text-yellow-100'
  return health === 'yellow'
    ? 'border-yellow-300/55 bg-yellow-500/15 text-yellow-100'
    : 'border-silicon-slate/70 bg-silicon-slate text-platinum-white'
}

function relationshipNodeLegendColor(type: OpenBrainRelationshipNodeType, health: 'green' | 'yellow' | 'red', kind: string) {
  if (type === 'source') {
    if (kind === 'creative_manuscript') return 'bg-fuchsia-300'
    if (kind === 'creative_project') return 'bg-amber-300'
    if (health === 'red') return 'bg-red-300'
    if (kind === 'workspace_root_report') return 'bg-sky-300'
    if (kind === 'codex_automation') return 'bg-radiant-gold'
    if (kind === 'runbook') return 'bg-emerald-300'
    if (kind.includes('credential')) return 'bg-red-300'
    if (kind.includes('model')) return 'bg-violet-300'
    if (kind.includes('content') || kind.includes('voice')) return 'bg-pink-300'
    return 'bg-cyan-300'
  }
  if (type === 'memory') return 'bg-platinum-white'
  if (type === 'wiki') return 'bg-bronze'
  if (type === 'proposal') return 'bg-yellow-300'
  return health === 'yellow' ? 'bg-yellow-300' : 'bg-silicon-slate'
}

function relationshipNodePosition(index: number, total: number) {
  if (total <= 1) return { x: 50, y: 52 }

  const columns = total <= 4 ? 2 : total <= 9 ? 3 : 4
  const rows = Math.ceil(total / columns)
  const row = Math.floor(index / columns)
  const col = index % columns
  const itemsInRow = Math.min(columns, total - row * columns)
  const rowColumns = Math.max(1, itemsInRow)
  const xSpacing = rowColumns === 1 ? 0 : 62 / (rowColumns - 1)
  const xOffset = rowColumns === 1 ? 0 : (columns - rowColumns) * (62 / Math.max(1, columns - 1)) / 2
  const ySpacing = rows === 1 ? 0 : 56 / (rows - 1)

  return {
    x: 19 + xOffset + col * xSpacing,
    y: 31 + row * ySpacing,
  }
}

function relationshipRoutePath(source: DisplayRelationshipGraphNode, target: DisplayRelationshipGraphNode, index: number) {
  if (source.id === target.id) {
    const loopWidth = 8 + (index % 3) * 2
    const loopHeight = 10 + (index % 3) * 2
    return `M ${source.x} ${source.y - 4} C ${source.x + loopWidth} ${source.y - loopHeight}, ${source.x + loopWidth} ${source.y + loopHeight}, ${source.x + 1.5} ${source.y + 4}`
  }

  const dx = target.x - source.x
  const dy = target.y - source.y
  const distance = Math.max(1, Math.hypot(dx, dy))
  const curve = index % 2 === 0 ? 7 : -7
  const controlX = (source.x + target.x) / 2 - (dy / distance) * curve
  const controlY = (source.y + target.y) / 2 + (dx / distance) * curve
  return `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`
}

function relationshipRouteLabel(source: RelationshipGraphNode, target: RelationshipGraphNode) {
  if (source.id === target.id) return `Selected review target: ${formatRouteNodeLabel(source)}`
  return `Selected proposed route: ${formatRouteNodeLabel(source)} -> ${formatRouteNodeLabel(target)}`
}

function formatRouteNodeLabel(node: RelationshipGraphNode) {
  return `${node.label} (${node.kind.replace(/_/g, ' ')})`
}

function relationshipInsightTone(severity: 'low' | 'medium' | 'high') {
  if (severity === 'high') return 'border-l-red-300'
  if (severity === 'medium') return 'border-l-radiant-gold'
  return 'border-l-platinum-white'
}

function SourcesView({ snapshot }: { snapshot: OpenBrainSnapshot }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-silicon-slate/70">
      <table className="min-w-[760px] w-full text-sm">
        <thead className="bg-silicon-slate/40 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Source</th>
            <th className="px-4 py-3 text-left font-medium">Kind</th>
            <th className="px-4 py-3 text-left font-medium">Privacy</th>
            <th className="px-4 py-3 text-left font-medium">Confidence</th>
            <th className="px-4 py-3 text-left font-medium">Last observed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-silicon-slate/60">
          {snapshot.sources.map((source) => (
            <tr key={source.id}>
              <td className="px-4 py-3">
                <p className="font-medium">{source.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{source.summary}</p>
                <p className="mt-1 break-all text-xs text-muted-foreground">{source.path || source.id}</p>
              </td>
              <td className="px-4 py-3"><SourceKindBadge kind={source.kind} /></td>
              <td className="px-4 py-3"><PrivacyBadge tier={source.privacyTier} /></td>
              <td className="px-4 py-3">{Math.round(source.confidence * 100)}%</td>
              <td className="px-4 py-3 text-muted-foreground">{formatDateTime(source.lastObservedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SourceKindBadge({ kind }: { kind: string }) {
  const tone = kind === 'creative_manuscript'
    ? 'border-fuchsia-300/40 bg-fuchsia-500/10 text-fuchsia-100'
    : kind === 'creative_project'
      ? 'border-amber-300/40 bg-amber-500/10 text-amber-100'
      : kind.includes('creative')
        ? 'border-fuchsia-300/30 bg-fuchsia-500/10 text-fuchsia-100'
        : 'border-silicon-slate/70 bg-silicon-slate/30 text-muted-foreground'
  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${tone}`}>
      {formatSourceKind(kind)}
    </span>
  )
}

function formatSourceKind(kind: string) {
  return kind.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function ProposalsView({
  proposals,
  relationshipAudit,
  reviewingProposalId,
  onReview,
}: {
  proposals: OpenBrainSnapshot['proposals']
  relationshipAudit: OpenBrainRelationshipAuditRecord[]
  reviewingProposalId: string | null
  onReview: (id: string, action: 'approve' | 'reject') => void
}) {
  if (proposals.length === 0 && relationshipAudit.length === 0) {
    return <EmptyState message="No Open Brain memory proposals are pending or stored locally." />
  }
  return (
    <section className="space-y-5">
      {relationshipAudit.length > 0 ? (
        <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="agent-ops-eyebrow"><ShieldCheck size={14} /> Persisted relationship audit</p>
              <h2 className="mt-2 text-xl font-semibold">Approved links now in Open Brain</h2>
            </div>
            <span className="rounded-full border border-radiant-gold/35 bg-radiant-gold/10 px-2 py-1 text-xs text-radiant-gold">
              {relationshipAudit.length} durable link(s)
            </span>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {relationshipAudit.slice(0, 4).map((record) => (
              <RelationshipAuditCard key={record.linkId} record={record} />
            ))}
          </div>
        </div>
      ) : null}

      {proposals.length === 0 ? (
        <EmptyState message="No Open Brain memory proposals are pending or stored locally." />
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {proposals.map((proposal) => {
        const relationship = proposal.metadata?.relationship
        const auditRecord = relationship ? findRelationshipAuditForProposal(relationshipAudit, proposal) : null
        return (
          <article key={proposal.id} className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{proposal.proposedMemory.title}</h3>
              <div className="flex flex-wrap gap-2">
                {auditRecord ? (
                  <span className="rounded-full border border-green-400/35 bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-green-200">
                    Durable link recorded
                  </span>
                ) : relationship ? (
                  <span className="rounded-full border border-radiant-gold/45 bg-radiant-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-radiant-gold">
                    Link on approval
                  </span>
                ) : null}
                <StatusBadge value={proposal.status} />
              </div>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">{proposal.proposedMemory.body}</p>
            {relationship ? (
              <div className="mb-3 rounded-lg border border-radiant-gold/25 bg-radiant-gold/10 p-3 text-xs">
                <p className="font-semibold uppercase tracking-[0.12em] text-radiant-gold">Relationship link approval</p>
                <p className="mt-2 text-muted-foreground">
                  Approving this proposal creates a durable link: {relationship.sourceLabel} {'->'} {relationship.targetLabel}
                </p>
                <p className="mt-1 text-muted-foreground">Relationship: {relationship.relationship}</p>
                {auditRecord ? (
                  <p className="mt-1 text-green-200">
                    Durable link recorded as {auditRecord.linkId} from {auditRecord.eventId || 'local link store'}.
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Detail label="Kind" value={proposal.proposedMemory.kind} />
              <Detail label="Privacy" value={proposal.proposedMemory.privacyTier} />
              <Detail label="Confidence" value={`${Math.round(proposal.proposedMemory.confidence * 100)}%`} />
              <Detail label="Created" value={formatDateTime(proposal.createdAt)} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{proposal.reason}</p>
            {proposal.status === 'pending' ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => onReview(proposal.id, 'approve')}
                  disabled={reviewingProposalId === proposal.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-green-400/40 bg-green-500/10 px-3 py-2 text-sm text-green-200 hover:bg-green-500/15 disabled:opacity-60"
                >
                  <CheckCircle2 size={16} />
                  Approve
                </button>
                <button
                  onClick={() => onReview(proposal.id, 'reject')}
                  disabled={reviewingProposalId === proposal.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-background px-3 py-2 text-sm text-muted-foreground hover:border-radiant-gold/60 disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            ) : null}
          </article>
        )
        })}
      </div>
    </section>
  )
}

function RelationshipAuditCard({
  record,
  compact = false,
}: {
  record: OpenBrainRelationshipAuditRecord
  compact?: boolean
}) {
  return (
    <article className="rounded-lg border border-green-400/25 bg-green-500/10 p-3 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-semibold text-green-100">{record.sourceLabel} {'->'} {record.targetLabel}</p>
        <span className="rounded-full border border-green-400/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-green-200">
          {record.relationship}
        </span>
      </div>
      <p className="mt-2 break-all text-muted-foreground">{record.linkId}</p>
      {!compact ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Detail label="Approved by" value={record.reviewedBy || 'unknown'} />
          <Detail label="Approved" value={record.reviewedAt ? formatDateTime(record.reviewedAt) : 'unknown'} />
          <Detail label="Proposal" value={record.sourceProposalId || 'not linked'} />
          <Detail label="Event" value={record.eventId || 'not linked'} />
        </div>
      ) : (
        <p className="mt-2 text-muted-foreground">
          {record.reviewedAt ? formatDateTime(record.reviewedAt) : 'Approval time unknown'} · {record.sourceProposalId || 'proposal not linked'}
        </p>
      )}
      <p className="mt-2 text-muted-foreground">{record.evidence}</p>
    </article>
  )
}

function findRelationshipAuditForProposal(
  relationshipAudit: OpenBrainRelationshipAuditRecord[],
  proposal: OpenBrainSnapshot['proposals'][number],
) {
  const relationship = proposal.metadata?.relationship
  if (!relationship) return null
  return relationshipAudit.find((record) =>
    (proposal.status === 'approved' && record.sourceProposalId === proposal.id) ||
    (
      proposal.status === 'approved' &&
      record.fromId === relationship.fromId &&
      record.toId === relationship.toId &&
      record.relationship === relationship.relationship
    )
  ) || null
}

function WikiView({ pages }: { pages: OpenBrainSnapshot['wikiPages'] }) {
  if (pages.length === 0) {
    return <EmptyState message="No generated wiki overlays yet. Approve memory proposals before compiling repo-owned docs." />
  }
  return (
    <section className="space-y-4">
      {pages.map((page) => (
        <article key={page.slug} className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="font-semibold">{page.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{page.path}</p>
            </div>
            <PrivacyBadge tier={page.privacyTier} />
          </div>
          <div className="mb-3 grid grid-cols-1 gap-2 text-xs md:grid-cols-3">
            <Detail label="Approval" value={page.approvalState} />
            <Detail label="Sources" value={page.sourceIds.length ? page.sourceIds.join(', ') : 'none'} />
            <Detail label="Events" value={page.sourceEventIds.length ? page.sourceEventIds.join(', ') : 'none'} />
          </div>
          <pre className="max-h-72 overflow-auto rounded-lg border border-silicon-slate/60 bg-black/20 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
            {page.markdown}
          </pre>
        </article>
      ))}
    </section>
  )
}

function ParityView({ snapshot }: { snapshot: OpenBrainSnapshot }) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <article className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
        <div className="mb-4 flex items-center gap-2 text-radiant-gold">
          <Database size={18} />
          <h2 className="font-semibold">Local Service</h2>
        </div>
        <div className="grid grid-cols-1 gap-2 text-sm">
          <Detail label="Storage" value={snapshot.service.storage} />
          <Detail label="Home" value={snapshot.service.home} />
          <Detail label="Database configured" value={snapshot.service.databaseConfigured ? 'yes' : 'no'} />
          <Detail label="MCP configured" value={snapshot.service.mcpConfigured ? 'yes' : 'no'} />
          <Detail label="MCP URL" value={snapshot.service.mcpUrl || 'not configured'} />
        </div>
      </article>

      <div className="space-y-3">
        {snapshot.runtimeParity.map((runtime) => (
          <article key={runtime.runtime} className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="font-semibold">{runtime.runtime}</h3>
              <StatusBadge value={runtime.status} />
            </div>
            <p className="break-all text-xs text-muted-foreground">{runtime.configPath}</p>
            <p className="mt-2 text-sm text-muted-foreground">{runtime.note}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function ProducerView({ snapshot }: { snapshot: OpenBrainSnapshot }) {
  return (
    <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {snapshot.producerGates.map((gate) => (
        <article key={gate.id} className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold">{gate.label}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{gate.id}</p>
            </div>
            <StatusBadge value={gate.status} />
          </div>
          <p className="mb-4 text-sm text-muted-foreground">{gate.note}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <Detail label="Source kind" value={gate.sourceKind} />
            <Detail label="Event kind" value={gate.eventKind || 'none'} />
            <Detail label="Privacy" value={gate.privacyTier} />
            <Detail label="Config" value={gate.envVar ? `${gate.envVar}=${gate.configuredValue || 'unset'}` : 'always evaluated'} />
          </div>
        </article>
      ))}
    </section>
  )
}

function ModeButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${active ? 'bg-radiant-gold/15 text-radiant-gold' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {icon}
      {children}
    </button>
  )
}

function ListBlock({ label, values, empty = 'None.' }: { label: string; values: string[]; empty?: string }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</h3>
      {values.length > 0 ? (
        <ul className="space-y-2">
          {values.map((value) => <li key={value} className="rounded-lg border border-silicon-slate/60 bg-black/10 p-3">{value}</li>)}
        </ul>
      ) : (
        <p className="rounded-lg border border-silicon-slate/60 bg-black/10 p-3 text-muted-foreground">{empty}</p>
      )}
    </div>
  )
}

function HealthPill({ label, value }: { label: string; value: 'green' | 'yellow' | 'red' }) {
  return (
    <div className="rounded-lg border border-silicon-slate/60 bg-black/10 p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className={value === 'green' ? 'text-green-300' : value === 'yellow' ? 'text-yellow-200' : 'text-red-300'}>{value}</p>
    </div>
  )
}

function LaneBadge({ lane }: { lane: string }) {
  const tone = lane === 'local'
    ? 'border-green-400/30 bg-green-500/10 text-green-200'
    : lane === 'frontier'
      ? 'border-blue-400/30 bg-blue-500/10 text-blue-100'
      : lane === 'hybrid'
        ? 'border-radiant-gold/40 bg-radiant-gold/10 text-radiant-gold'
        : lane === 'approval_required'
          ? 'border-yellow-400/30 bg-yellow-500/10 text-yellow-100'
          : 'border-silicon-slate/70 bg-silicon-slate/30 text-muted-foreground'
  return <span className={`rounded-full border px-2 py-1 text-xs ${tone}`}>{lane}</span>
}

function StatusBadge({ value }: { value: string }) {
  const tone = value === 'approved' || value === 'connected' || value === 'enabled'
    ? 'border-green-400/30 bg-green-500/10 text-green-200'
    : value === 'approved_policy'
      ? 'border-green-400/30 bg-green-500/10 text-green-200'
      : value === 'pending' || value === 'blocked' || value === 'approval_required' || value === 'shadow_only' || value === 'approval_gated'
      ? 'border-yellow-400/30 bg-yellow-500/10 text-yellow-100'
      : 'border-silicon-slate/70 bg-silicon-slate/30 text-muted-foreground'
  return <span className={`rounded-full border px-2 py-1 text-xs ${tone}`}>{value}</span>
}

function PrivacyBadge({ tier }: { tier: string }) {
  const tone = tier === 'private' ? 'border-red-400/30 bg-red-500/10 text-red-200' : 'border-silicon-slate/70 bg-silicon-slate/30 text-muted-foreground'
  return <span className={`rounded-full border px-2 py-1 text-xs ${tone}`}>{tier}</span>
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-silicon-slate/60 bg-black/10 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-all">{value}</p>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-8 text-center text-muted-foreground">
      {message}
    </div>
  )
}

function FailureState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-6 text-red-100">
      <div className="mb-2 flex items-center gap-2 font-medium">
        <AlertTriangle size={18} />
        {title}
      </div>
      <p className="text-sm">{message}</p>
    </div>
  )
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
