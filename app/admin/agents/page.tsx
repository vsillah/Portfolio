'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Activity, ArrowRight, Bot, CheckCircle2, Clock, DollarSign, RefreshCw, XCircle } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import { APPROVAL_GATES, RUNTIME_POLICIES } from '@/lib/agent-policy'

export default function AgentOperationsPage() {
  const [hermesLoading, setHermesLoading] = useState(false)
  const [hermesResult, setHermesResult] = useState<{ runId: string; overall: string } | null>(null)
  const [hermesError, setHermesError] = useState<string | null>(null)
  const [drillLoading, setDrillLoading] = useState(false)
  const [drillResult, setDrillResult] = useState<{ runId: string; approvalType: string } | null>(null)
  const [drillError, setDrillError] = useState<string | null>(null)

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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SignalCard icon={<Clock size={18} />} label="Active states" value="Queued, running, approval" />
            <SignalCard icon={<CheckCircle2 size={18} />} label="Completion" value="Completed, cancelled" />
            <SignalCard icon={<XCircle size={18} />} label="Failure modes" value="Failed, stale" />
            <SignalCard icon={<DollarSign size={18} />} label="Cost linkage" value="cost_events.agent_run_id" />
          </div>

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

function PolicyFlag({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-black/10 px-2 py-1">
      <span>{label}</span>
      <span className={value ? 'text-green-300' : 'text-red-300'}>{value ? 'yes' : 'no'}</span>
    </div>
  )
}
