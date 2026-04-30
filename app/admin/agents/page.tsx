'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Activity, ArrowRight, Bot, CheckCircle2, Clock, DollarSign, RefreshCw, XCircle } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'

export default function AgentOperationsPage() {
  const [hermesLoading, setHermesLoading] = useState(false)
  const [hermesResult, setHermesResult] = useState<{ runId: string; overall: string } | null>(null)
  const [hermesError, setHermesError] = useState<string | null>(null)

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SignalCard icon={<Clock size={18} />} label="Active states" value="Queued, running, approval" />
            <SignalCard icon={<CheckCircle2 size={18} />} label="Completion" value="Completed, cancelled" />
            <SignalCard icon={<XCircle size={18} />} label="Failure modes" value="Failed, stale" />
            <SignalCard icon={<DollarSign size={18} />} label="Cost linkage" value="cost_events.agent_run_id" />
          </div>
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
