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
import type { OpenBrainRelationshipNodeType, OpenBrainSnapshot } from '@/lib/open-brain'

type ViewMode = 'router' | 'sources' | 'proposals' | 'wiki' | 'parity' | 'producers' | 'map'

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
      await authedFetch(`/api/admin/agents/open-brain/proposals/${encodeURIComponent(id)}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ reason: `${action === 'approve' ? 'Approved' : 'Rejected'} from Portfolio Admin.` }),
      })
      setActionMessage(`Proposal ${action === 'approve' ? 'approved' : 'rejected'}.`)
      await fetchSnapshot()
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : `Proposal ${action} failed`)
    } finally {
      setReviewingProposalId(null)
    }
  }

  function handleRelationshipSuggestion(actionLabel: string) {
    setActionMessage(`${actionLabel} is proposal-only in v1. No Open Brain link was changed from this map.`)
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
                reviewingProposalId={reviewingProposalId}
                onReview={reviewProposal}
              />
            ) : null}
            {viewMode === 'wiki' ? <WikiView pages={snapshot.wikiPages} /> : null}
            {viewMode === 'parity' ? <ParityView snapshot={snapshot} /> : null}
            {viewMode === 'producers' ? <ProducerView snapshot={snapshot} /> : null}
            {viewMode === 'map' ? <RelationshipMapView snapshot={snapshot} onSuggestionAction={handleRelationshipSuggestion} /> : null}

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
  onSuggestionAction,
}: {
  snapshot: OpenBrainSnapshot
  onSuggestionAction: (actionLabel: string) => void
}) {
  const [typeFilter, setTypeFilter] = useState<OpenBrainRelationshipNodeType | 'all'>('all')
  const map = snapshot.relationshipMap
  const visibleNodes = typeFilter === 'all' ? map.nodes : map.nodes.filter((node) => node.type === typeFilter)
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id))
  const visibleEdges = map.edges.filter((edge) => visibleNodeIds.has(edge.fromId) && visibleNodeIds.has(edge.toId))
  const nodeById = new Map(visibleNodes.map((node) => [node.id, node]))
  const nodeTypes: Array<OpenBrainRelationshipNodeType | 'all'> = ['all', 'source', 'memory', 'event', 'wiki', 'proposal']
  const selectedPath = visibleEdges.find((edge) => edge.strength === 'strong') || visibleEdges[0]
  const selectedFrom = selectedPath ? nodeById.get(selectedPath.fromId) : null
  const selectedTo = selectedPath ? nodeById.get(selectedPath.toId) : null
  const graphMinHeight = Math.max(620, Math.ceil(visibleNodes.length / 4) * 132)

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
            <span className="text-xs text-muted-foreground">{visibleNodes.length}/{map.nodes.length}</span>
          </div>
          <div className="space-y-2">
            {nodeTypes.map((type) => {
              const count = type === 'all' ? map.nodes.length : map.nodes.filter((node) => node.type === type).length
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(type)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                    typeFilter === type
                      ? 'border-radiant-gold/55 bg-radiant-gold/10 text-radiant-gold'
                      : 'border-silicon-slate/60 bg-background/20 text-muted-foreground hover:border-radiant-gold/35 hover:text-foreground'
                  }`}
                >
                  <span className="capitalize">{type === 'all' ? 'All records' : type}</span>
                  <span className="tabular-nums">{count}</span>
                </button>
              )
            })}
          </div>
          <div className="mt-5 space-y-2 border-t border-silicon-slate/60 pt-4 text-xs text-muted-foreground">
            <RelationshipLegend color="bg-radiant-gold" label="Strong/persisted" />
            <RelationshipLegend color="bg-platinum-white" label="Inferred medium" />
            <RelationshipLegend color="bg-red-300" label="Weak or risky" />
            <RelationshipLegend color="border border-radiant-gold bg-transparent" label="Proposal-only action" />
          </div>
        </aside>

        <div
          className="relative overflow-hidden rounded-lg border border-radiant-gold/20 bg-[radial-gradient(circle_at_50%_45%,rgba(212,175,55,0.08),transparent_34%),linear-gradient(180deg,rgba(12,23,39,0.94),rgba(7,14,25,0.98))] shadow-2xl"
          style={{ minHeight: `${graphMinHeight}px` }}
        >
          <div className="absolute left-5 top-5 z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-radiant-gold">Memory Graph</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedFrom && selectedTo
                ? `Selected path: ${selectedFrom.label} -> ${selectedTo.label}`
                : 'No visible relationship path for this filter.'}
            </p>
          </div>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {visibleEdges.map((edge) => {
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
                  strokeWidth={edge.strength === 'strong' ? 0.6 : edge.strength === 'medium' ? 0.38 : 0.28}
                  strokeDasharray={edge.status === 'inferred' ? '1.4 1.1' : undefined}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
          </svg>
          {visibleNodes.map((node) => (
            <div
              key={node.id}
              className={`absolute z-10 flex max-w-[132px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-lg border px-2.5 py-2 text-center shadow-xl ${relationshipNodeTone(node.type, node.health)}`}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              title={node.summary}
            >
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] opacity-75">{node.type}</span>
              <span className="mt-1 line-clamp-2 text-xs font-semibold leading-4">{node.label}</span>
              <span className="mt-1 text-[10px] opacity-70">{node.kind.replace(/_/g, ' ')}</span>
            </div>
          ))}
          <div className="absolute bottom-5 left-5 z-10 flex flex-wrap gap-3 rounded-lg border border-silicon-slate/60 bg-black/30 p-3 text-xs text-muted-foreground backdrop-blur">
            <RelationshipLegend color="bg-radiant-gold" label="Strong" />
            <RelationshipLegend color="bg-platinum-white" label="Inferred" />
            <RelationshipLegend color="bg-red-300" label="Weak" />
          </div>
        </div>

        <aside className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
          <p className="agent-ops-eyebrow"><Target size={14} /> Relationship insights</p>
          <h2 className="mt-2 text-xl font-semibold">What I will review before action</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            These controls do not mutate Open Brain. They identify relationship changes that should become explicit proposals.
          </p>
          <div className="mt-4 space-y-3">
            {map.insights.length > 0 ? map.insights.map((insight) => (
              <article key={insight.id} className={`rounded-lg border border-l-4 bg-background/20 p-3 ${relationshipInsightTone(insight.severity)}`}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold">{insight.title}</h3>
                  <span className="rounded-full border border-silicon-slate/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {insight.kind.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{insight.detail}</p>
                <p className="mt-2 text-xs leading-relaxed text-foreground/85">{insight.recommendation}</p>
                <button
                  type="button"
                  onClick={() => onSuggestionAction(insight.actionLabel)}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-radiant-gold/40 bg-radiant-gold/10 px-3 py-2 text-xs font-medium text-radiant-gold hover:bg-radiant-gold/15"
                >
                  {insight.actionLabel}
                </button>
              </article>
            )) : (
              <EmptyState message="No relationship issues are visible for the current graph." />
            )}
          </div>
        </aside>
      </div>
    </section>
  )
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

function RelationshipLegend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  )
}

function relationshipEdgeColor(strength: 'strong' | 'medium' | 'weak', status: string) {
  if (strength === 'weak') return 'rgba(252,165,165,0.7)'
  if (status === 'persisted') return 'rgba(212,175,55,0.95)'
  if (strength === 'strong') return 'rgba(245,208,96,0.82)'
  return 'rgba(234,236,238,0.5)'
}

function relationshipNodeTone(type: OpenBrainRelationshipNodeType, health: 'green' | 'yellow' | 'red') {
  if (health === 'red') return 'border-red-300/70 bg-red-950/80 text-red-100'
  if (type === 'source') return 'border-radiant-gold/50 bg-radiant-gold text-imperial-navy'
  if (type === 'memory') return 'border-radiant-gold/45 bg-platinum-white text-imperial-navy'
  if (type === 'wiki') return 'border-radiant-gold/45 bg-bronze text-platinum-white'
  if (type === 'proposal') return 'border-yellow-300/60 bg-imperial-navy text-yellow-100'
  return health === 'yellow'
    ? 'border-yellow-300/55 bg-yellow-500/15 text-yellow-100'
    : 'border-silicon-slate/70 bg-silicon-slate text-platinum-white'
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
              <td className="px-4 py-3">{source.kind}</td>
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

function ProposalsView({
  proposals,
  reviewingProposalId,
  onReview,
}: {
  proposals: OpenBrainSnapshot['proposals']
  reviewingProposalId: string | null
  onReview: (id: string, action: 'approve' | 'reject') => void
}) {
  if (proposals.length === 0) {
    return <EmptyState message="No Open Brain memory proposals are pending or stored locally." />
  }
  return (
    <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {proposals.map((proposal) => (
        <article key={proposal.id} className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{proposal.proposedMemory.title}</h3>
            <StatusBadge value={proposal.status} />
          </div>
          <p className="mb-3 text-sm text-muted-foreground">{proposal.proposedMemory.body}</p>
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
      ))}
    </section>
  )
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

function Detail({ label, value }: { label: string; value: string }) {
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
