'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { AgentGovernancePanel, type AgentGovernanceSnapshot } from '@/components/admin/agents/AgentGovernancePanel'
import { getCurrentSession } from '@/lib/auth'

type MissionGovernanceResponse = {
  governance?: AgentGovernanceSnapshot | null
}

export default function AgentGovernancePage() {
  return (
    <ProtectedRoute requireAdmin>
      <AgentGovernanceContent />
    </ProtectedRoute>
  )
}

function AgentGovernanceContent() {
  const [governance, setGovernance] = useState<AgentGovernanceSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadGovernance = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const response = await fetch('/api/admin/agents/mission-control', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await response.json().catch(() => ({})) as MissionGovernanceResponse & { error?: string }
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setGovernance(body.governance ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load governance state')
      setGovernance(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGovernance()
  }, [loadGovernance])

  return (
    <div className="agent-ops-page min-h-screen p-5 text-foreground lg:p-7">
      <div className="mx-auto max-w-7xl">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Agent Operations', href: '/admin/agents' },
          { label: 'Agent Governance' },
        ]} />

        <header className="agent-ops-surface-header mb-6 mt-5 flex flex-col gap-4 rounded-xl border p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="agent-ops-eyebrow"><ShieldCheck size={16} /> Agent Ops</p>
            <h1 className="mt-1 text-3xl font-bold">Agent Governance</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Review scope, delegation, spend authority, and traceable audit exports away from Mission Control so the L1 surface stays focused on swarm coordination.
            </p>
          </div>
          <div className="agent-ops-header-actions">
            <Link href="/admin/agents" className="agent-ops-button-muted">
              <ArrowLeft size={16} />
              Mission Control
            </Link>
            <button
              type="button"
              onClick={loadGovernance}
              disabled={loading}
              className="agent-ops-button-secondary disabled:opacity-60"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </header>

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading governance state...</div>
        ) : error ? (
          <section className="rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-red-100">
            <p className="font-semibold">Governance failed to load</p>
            <p className="mt-2 text-sm">{error}</p>
          </section>
        ) : governance ? (
          <AgentGovernancePanel governance={governance} />
        ) : (
          <section className="rounded-lg border border-silicon-slate/60 bg-background/40 p-4 text-muted-foreground">
            No governance snapshot is available yet.
          </section>
        )}
      </div>
    </div>
  )
}
