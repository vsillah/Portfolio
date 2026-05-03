'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  ArrowRight,
  Bot,
  CalendarCheck,
  CheckCircle2,
  Clock,
  DollarSign,
  ListChecks,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  Workflow,
  XCircle,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import { getAgentOrganizationSummary } from '@/lib/agent-organization'
import { APPROVAL_GATES, RUNTIME_POLICIES } from '@/lib/agent-policy'

const AGENT_ORGANIZATION_SUMMARY = getAgentOrganizationSummary()

export default function AgentOperationsPage() {
  const [hermesLoading, setHermesLoading] = useState(false)
  const [hermesResult, setHermesResult] = useState<{ runId: string; overall: string } | null>(null)
  const [hermesError, setHermesError] = useState<string | null>(null)
  const [drillLoading, setDrillLoading] = useState(false)
  const [drillResult, setDrillResult] = useState<{ runId: string; approvalType: string } | null>(null)
  const [drillError, setDrillError] = useState<string | null>(null)
  const [runtimeLoading, setRuntimeLoading] = useState(false)
  const [runtimeResult, setRuntimeResult] = useState<{ runId: string; available: boolean } | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [morningLoading, setMorningLoading] = useState(false)
  const [morningResult, setMorningResult] = useState<{ runId: string; overall: string; slackNotified: boolean } | null>(null)
  const [morningError, setMorningError] = useState<string | null>(null)
  const [engagingAgentKey, setEngagingAgentKey] = useState<string | null>(null)
  const [engagementResults, setEngagementResults] = useState<Record<string, { runId: string; status: string }>>({})
  const [engagementError, setEngagementError] = useState<string | null>(null)

  async function runHermesHealthSummary() {
    setHermesLoading(true)
    setHermesError(null)
    setHermesResult(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch('/api/admin/agents/hermes/system-health', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setHermesResult({ runId: body.run_id, overall: body.overall })
    } catch (err) {
      setHermesError(err instanceof Error ? err.message : 'Failed to run Hermes health summary')
    } finally {
      setHermesLoading(false)
    }
  }

  async function createApprovalDrill() {
    setDrillLoading(true)
    setDrillError(null)
    setDrillResult(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch('/api/admin/agents/approval-drill', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approval_type: 'production_config_change',
          note: 'Approval drill from Agent Operations.',
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setDrillResult({ runId: body.run_id, approvalType: body.approval_type })
    } catch (err) {
      setDrillError(err instanceof Error ? err.message : 'Failed to create approval drill')
    } finally {
      setDrillLoading(false)
    }
  }

  async function evaluateOpenCodeRuntime() {
    setRuntimeLoading(true)
    setRuntimeError(null)
    setRuntimeResult(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch('/api/admin/agents/runtime-evaluation', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ runtime: 'opencode' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setRuntimeResult({ runId: body.run_id, available: Boolean(body.available) })
    } catch (err) {
      setRuntimeError(err instanceof Error ? err.message : 'Failed to evaluate OpenCode/OpenClaw')
    } finally {
      setRuntimeLoading(false)
    }
  }

  async function runMorningReview() {
    setMorningLoading(true)
    setMorningError(null)
    setMorningResult(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch('/api/admin/agents/morning-review', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setMorningResult({
        runId: body.run_id,
        overall: body.overall,
        slackNotified: Boolean(body.slack_notified),
      })
    } catch (err) {
      setMorningError(err instanceof Error ? err.message : 'Failed to run Agent Ops morning review')
    } finally {
      setMorningLoading(false)
    }
  }

  async function queueAgentEngagement(agentKey: string, agentName: string) {
    setEngagingAgentKey(agentKey)
    setEngagementError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch('/api/admin/agents/engage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_key: agentKey,
          note: `Queued from Agent Operations for ${agentName}.`,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setEngagementResults((current) => ({
        ...current,
        [agentKey]: { runId: body.run_id, status: body.status || 'queued' },
      }))
    } catch (err) {
      setEngagementError(err instanceof Error ? err.message : 'Failed to queue agent engagement')
    } finally {
      setEngagingAgentKey(null)
    }
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-background text-foreground p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          <Breadcrumbs items={[{ label: 'Admin Dashboard', href: '/admin' }, { label: 'Agent Operations' }]} />
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-1">Agent Operations</h1>
            <p className="text-muted-foreground text-sm">
              Shared control plane for Codex, n8n, Hermes, OpenCode, and manual agent work.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
            <Link
              href="/admin/agents/runs"
              className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 p-5 hover:border-radiant-gold/60 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-radiant-gold mb-2">
                    <Activity size={20} />
                    <h2 className="text-lg font-semibold">Run Console</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    View active and recent agent runs, current steps, runtime, costs, errors, and approvals.
                  </p>
                </div>
                <ArrowRight size={20} className="text-muted-foreground shrink-0" />
              </div>
            </Link>

            <Link
              href="/admin/agents/chief-of-staff"
              className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 p-5 hover:border-radiant-gold/60 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-radiant-gold mb-2">
                    <MessageSquare size={20} />
                    <h2 className="text-lg font-semibold">Chief of Staff Chat</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Ask for priorities, blockers, approval risk, and next actions from the agent operating context.
                  </p>
                </div>
                <ArrowRight size={20} className="text-muted-foreground shrink-0" />
              </div>
            </Link>

            <Link
              href="/admin/agents/automations"
              className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 p-5 hover:border-radiant-gold/60 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-cyan-300 mb-2">
                    <ListChecks size={20} />
                    <h2 className="text-lg font-semibold">Automation Context</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Review Codex automation schedules, risk, duplicates, and context readiness for future agents.
                  </p>
                </div>
                <ArrowRight size={20} className="text-muted-foreground shrink-0" />
              </div>
            </Link>

            <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 text-cyan-300 mb-2">
                    <Bot size={20} />
                    <h2 className="text-lg font-semibold">Hermes Health Summary</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Run a read-only secondary-runtime check across agent runs, n8n flags, costs, and workflow status.
                  </p>
                </div>
                <button
                  onClick={runHermesHealthSummary}
                  disabled={hermesLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-background/60 px-3 py-2 text-sm hover:border-radiant-gold/60 disabled:opacity-60"
                >
                  <RefreshCw size={16} className={hermesLoading ? 'animate-spin' : ''} />
                  Run
                </button>
              </div>
              {hermesResult ? (
                <Link href={`/admin/agents/runs/${hermesResult.runId}`} className="text-sm text-radiant-gold hover:underline">
                  Open {hermesResult.overall} health run
                </Link>
              ) : null}
              {hermesError ? <p className="text-sm text-red-300">{hermesError}</p> : null}
            </div>

            <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 text-yellow-300 mb-2">
                    <CheckCircle2 size={20} />
                    <h2 className="text-lg font-semibold">Approval Drill</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Create a disposable approval checkpoint to verify approve and reject behavior.
                  </p>
                </div>
                <button
                  onClick={createApprovalDrill}
                  disabled={drillLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-background/60 px-3 py-2 text-sm hover:border-radiant-gold/60 disabled:opacity-60"
                >
                  <RefreshCw size={16} className={drillLoading ? 'animate-spin' : ''} />
                  Create
                </button>
              </div>
              {drillResult ? (
                <Link href={`/admin/agents/runs/${drillResult.runId}`} className="text-sm text-radiant-gold hover:underline">
                  Open {drillResult.approvalType} drill
                </Link>
              ) : null}
              {drillError ? <p className="text-sm text-red-300">{drillError}</p> : null}
            </div>

            <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 text-orange-300 mb-2">
                    <ShieldAlert size={20} />
                    <h2 className="text-lg font-semibold">Runtime Evaluation</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Probe OpenCode/OpenClaw availability without running worker tasks or mutating production data.
                  </p>
                </div>
                <button
                  onClick={evaluateOpenCodeRuntime}
                  disabled={runtimeLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-background/60 px-3 py-2 text-sm hover:border-radiant-gold/60 disabled:opacity-60"
                >
                  <RefreshCw size={16} className={runtimeLoading ? 'animate-spin' : ''} />
                  Probe
                </button>
              </div>
              {runtimeResult ? (
                <Link href={`/admin/agents/runs/${runtimeResult.runId}`} className="text-sm text-radiant-gold hover:underline">
                  Open {runtimeResult.available ? 'available' : 'unavailable'} runtime run
                </Link>
              ) : null}
              {runtimeError ? <p className="text-sm text-red-300">{runtimeError}</p> : null}
            </div>
          </div>

          <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-radiant-gold mb-2">
                  <CalendarCheck size={20} />
                  <h2 className="text-lg font-semibold">Agent Engagement</h2>
                </div>
                <p className="text-sm text-muted-foreground max-w-3xl">
                  Operational roster for the agents that are ready to run, where to engage them, and what approval gates apply.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={runMorningReview}
                  disabled={morningLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-60"
                >
                  <RefreshCw size={16} className={morningLoading ? 'animate-spin' : ''} />
                  Run morning review
                </button>
                <Link
                  href="/admin/agents/runs"
                  className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-background/60 px-3 py-2 text-sm hover:border-radiant-gold/60"
                >
                  <Activity size={16} />
                  View runs
                </Link>
              </div>
            </div>
            {morningResult ? (
              <div className="mt-4 rounded-lg border border-green-400/30 bg-green-500/10 px-4 py-3 text-sm">
                <Link href={`/admin/agents/runs/${morningResult.runId}`} className="text-green-200 hover:underline">
                  Open {morningResult.overall} morning review run
                </Link>
                <span className="text-muted-foreground">
                  {' '}
                  · Slack {morningResult.slackNotified ? 'notified' : 'not configured or skipped'}
                </span>
              </div>
            ) : null}
            {morningError ? <p className="mt-3 text-sm text-red-300">{morningError}</p> : null}

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {AGENT_ENGAGEMENTS.map((agent) => (
                <div key={agent.key} className="rounded-lg border border-silicon-slate/60 bg-background/35 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{agent.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{agent.purpose}</p>
                    </div>
                    <span className="rounded-full border border-silicon-slate/60 bg-black/20 px-2 py-1 text-xs">
                      {agent.runtime}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Engage</p>
                      <p className="mt-1">{agent.engage}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gate</p>
                      <p className="mt-1">{agent.gate}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {agent.links.map((link) => (
                      <Link
                        key={`${agent.key}-${link.href}`}
                        href={link.href}
                        className="inline-flex items-center gap-1 rounded-md border border-silicon-slate/60 bg-black/10 px-2 py-1 text-xs hover:border-radiant-gold/60"
                      >
                        {link.label}
                        <ArrowRight size={12} />
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SignalCard icon={<Clock size={18} />} label="Active states" value="Queued, running, approval" />
            <SignalCard icon={<CheckCircle2 size={18} />} label="Completion" value="Completed, cancelled" />
            <SignalCard icon={<XCircle size={18} />} label="Failure modes" value="Failed, stale" />
            <SignalCard icon={<DollarSign size={18} />} label="Cost linkage" value="cost_events.agent_run_id" />
          </div>

          <section className="mt-8 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
            <div className="flex items-center gap-2 text-radiant-gold mb-2">
              <Workflow size={20} />
              <h2 className="text-lg font-semibold">Agent Organization Map</h2>
            </div>
            <p className="text-sm text-muted-foreground max-w-3xl">
              Maps the target agent organization to the n8n workflow families currently wired into the operating system.
            </p>
            {engagementError ? <p className="mt-3 text-sm text-red-300">{engagementError}</p> : null}

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {AGENT_ORGANIZATION_SUMMARY.map((pod) => (
                <div key={pod.key} className="rounded-lg border border-silicon-slate/60 bg-background/35 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">{pod.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{pod.purpose}</p>
                    </div>
                    <span className="w-fit rounded-full border border-silicon-slate/60 bg-black/20 px-2 py-1 text-xs">
                      {pod.activeWorkflowCount} active workflows
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <OrgCount label="Active" value={pod.activeAgentCount} tone="green" />
                    <OrgCount label="Partial" value={pod.partialAgentCount} tone="yellow" />
                    <OrgCount label="Planned" value={pod.plannedAgentCount} tone="slate" />
                  </div>
                  <div className="mt-4 space-y-3">
                    {pod.agents.map((agent) => (
                      <div key={agent.key} className="rounded-md border border-silicon-slate/50 bg-black/10 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{agent.name}</p>
                          <StatusPill status={agent.status} />
                          <span className="rounded-full border border-silicon-slate/50 px-2 py-0.5 text-xs text-muted-foreground">
                            {agent.primaryRuntime}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{agent.responsibility}</p>
                        {agent.n8nWorkflows.length > 0 ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            n8n: {agent.n8nWorkflows.slice(0, 3).map((workflow) => workflow.name).join(', ')}
                            {agent.n8nWorkflows.length > 3 ? ` +${agent.n8nWorkflows.length - 3} more` : ''}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">n8n: not primary runtime yet</p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {engagementResults[agent.key] ? (
                            <Link
                              href={`/admin/agents/runs/${engagementResults[agent.key].runId}`}
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200 hover:underline"
                            >
                              {engagementResults[agent.key].status === 'completed'
                                ? 'Read-only run ready'
                                : 'Engagement queued'}
                              <ArrowRight size={12} />
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => queueAgentEngagement(agent.key, agent.name)}
                              disabled={engagingAgentKey === agent.key}
                              className="inline-flex items-center gap-1 rounded-md border border-radiant-gold/50 bg-radiant-gold/10 px-2 py-1 text-xs text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-60"
                            >
                              <Send size={12} />
                              Run read-only
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
            <h2 className="text-lg font-semibold mb-4">Runtime Policies</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {RUNTIME_POLICIES.map((policy) => (
                <div key={policy.runtime} className="rounded-lg border border-silicon-slate/60 bg-background/35 p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="font-semibold">{policy.label}</p>
                    <span className="rounded-full border border-silicon-slate/60 bg-black/20 px-2 py-1 text-xs">
                      {policy.runtime}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <PolicyFlag label="Read files" value={policy.canReadFiles} />
                    <PolicyFlag label="Write files" value={policy.canWriteFiles} />
                    <PolicyFlag label="External APIs" value={policy.canCallExternalApis} />
                    <PolicyFlag label="Client data" value={policy.canTouchClientData} />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Production writes: {policy.canWriteProductionData}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{policy.notes}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
            <h2 className="text-lg font-semibold mb-4">Approval Gates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {APPROVAL_GATES.map((gate) => (
                <div key={gate.action} className="rounded-lg border border-silicon-slate/60 bg-background/35 p-4">
                  <p className="font-medium">{gate.label}</p>
                  <p className="text-sm text-muted-foreground mt-1">{gate.description}</p>
                  <p className="text-xs text-muted-foreground mt-2">Type: {gate.approvalType}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </ProtectedRoute>
  )
}

function SignalCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-silicon-slate/60 bg-black/10 p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

function OrgCount({ label, value, tone }: { label: string; value: number; tone: 'green' | 'yellow' | 'slate' }) {
  const toneClass =
    tone === 'green' ? 'text-green-300' : tone === 'yellow' ? 'text-yellow-300' : 'text-muted-foreground'

  return (
    <div className="rounded-md border border-silicon-slate/50 bg-black/10 p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  )
}

function StatusPill({ status }: { status: 'active' | 'partial' | 'planned' }) {
  const className =
    status === 'active'
      ? 'border-green-400/40 bg-green-500/10 text-green-200'
      : status === 'partial'
        ? 'border-yellow-400/40 bg-yellow-500/10 text-yellow-200'
        : 'border-silicon-slate/60 bg-black/20 text-muted-foreground'

  return <span className={`rounded-full border px-2 py-0.5 text-xs ${className}`}>{status}</span>
}

const AGENT_ENGAGEMENTS = [
  {
    key: 'portfolio-operations-manager',
    name: 'Portfolio Operations Manager',
    runtime: 'n8n + codex',
    purpose: 'Daily agent health, stale-run cleanup, Slack summary, and admin review trace.',
    engage: 'Automatic morning review or the Run morning review button.',
    gate: 'Notification-only; production config changes still require approval.',
    links: [
      { label: 'Runs', href: '/admin/agents/runs' },
      { label: 'Runbook', href: '/admin/agents' },
    ],
  },
  {
    key: 'hermes-health-analyst',
    name: 'Hermes Health Analyst',
    runtime: 'hermes',
    purpose: 'Read-only secondary-runtime summary across agent runs, costs, n8n flags, and workflow status.',
    engage: 'Use Hermes Health Summary from this page.',
    gate: 'No production writes in v1.',
    links: [{ label: 'Runs', href: '/admin/agents/runs' }],
  },
  {
    key: 'outreach-generation',
    name: 'Outreach Generation Agent',
    runtime: 'codex + n8n',
    purpose: 'Creates observable outreach draft traces with prompt assembly, LLM dispatch, cost linkage, and artifact references.',
    engage: 'Use existing outreach and lead-pipeline admin workflows.',
    gate: 'Human review before sending email.',
    links: [
      { label: 'Lead Pipeline', href: '/admin/outreach' },
      { label: 'Runs', href: '/admin/agents/runs' },
    ],
  },
  {
    key: 'evidence-listening',
    name: 'Value Evidence Agent',
    runtime: 'n8n',
    purpose: 'Collects and routes value evidence, social-listening findings, and workflow traces for review.',
    engage: 'Use Value Evidence and workflow-specific admin surfaces.',
    gate: 'Public content and client-facing summaries require approval.',
    links: [
      { label: 'Value Evidence', href: '/admin/value-evidence' },
      { label: 'Runs', href: '/admin/agents/runs' },
    ],
  },
  {
    key: 'approval-steward',
    name: 'Approval Steward',
    runtime: 'manual',
    purpose: 'Keeps publishing, email, production config, and sensitive-data gates represented in agent_approvals.',
    engage: 'Use Approval Drill and run-detail approval controls.',
    gate: 'Approval state is the system of record.',
    links: [{ label: 'Runs', href: '/admin/agents/runs' }],
  },
  {
    key: 'slack-command-path',
    name: 'Slack Command Path',
    runtime: 'slack + n8n',
    purpose: 'Mobile-friendly command surface for checking status without adding Telegram or another channel.',
    engage: 'Use /agent status, /agent failed, /agent approvals, or /agent morning-review in Slack.',
    gate: 'Status, failed, and approvals are read-only; morning-review writes only the approved Agent Ops trace.',
    links: [{ label: 'Runbook', href: '/admin/agents' }],
  },
] satisfies Array<{
  key: string
  name: string
  runtime: string
  purpose: string
  engage: string
  gate: string
  links: Array<{ label: string; href: string }>
}>

function PolicyFlag({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-black/10 px-2 py-1">
      <span>{label}</span>
      <span className={value ? 'text-green-300' : 'text-red-300'}>{value ? 'yes' : 'no'}</span>
    </div>
  )
}
