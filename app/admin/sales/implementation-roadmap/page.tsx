'use client'

import { useState } from 'react'
import { ClipboardList, Loader2, RefreshCw } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'

type Snapshot = {
  title: string
  phases: Array<{ title: string; objective: string }>
  costSummary: {
    oneTimeClientOwned: number
    monthlyClientOwned: number
    quoteRequiredCount: number
  }
}

export default function ImplementationRoadmapBuilderPage() {
  return (
    <ProtectedRoute requireAdmin>
      <ImplementationRoadmapBuilder />
    </ProtectedRoute>
  )
}

function ImplementationRoadmapBuilder() {
  const [proposalId, setProposalId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)

  async function generateSnapshot() {
    setLoading(true)
    setError(null)
    setSnapshot(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch(`/api/admin/proposals/${proposalId.trim()}/implementation-roadmap`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setSnapshot(body.snapshot)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate roadmap snapshot')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'Sales', href: '/admin/sales' },
            { label: 'Implementation Roadmap' },
          ]}
        />

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="text-emerald-400" />
            <h1 className="text-3xl font-bold">Implementation Roadmap & Startup Costs</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Attach a client-owned AI Ops roadmap snapshot to a proposal before sending it.
          </p>
        </div>

        <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/25 p-5 mb-6">
          <label className="block text-sm font-medium mb-2">Proposal ID</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={proposalId}
              onChange={(e) => setProposalId(e.target.value)}
              placeholder="Paste proposal UUID"
              className="flex-1 rounded-lg border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm"
            />
            <button
              onClick={generateSnapshot}
              disabled={loading || proposalId.trim().length < 8}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Generate Snapshot
            </button>
          </div>
          {error && <p className="text-sm text-red-300 mt-3">{error}</p>}
        </div>

        {snapshot && (
          <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
            <h2 className="text-xl font-semibold mb-4">{snapshot.title}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <Metric label="Startup" value={`$${snapshot.costSummary.oneTimeClientOwned}`} />
              <Metric label="Monthly" value={`$${snapshot.costSummary.monthlyClientOwned}`} />
              <Metric label="Quote required" value={String(snapshot.costSummary.quoteRequiredCount)} />
            </div>
            <div className="space-y-3">
              {snapshot.phases.map((phase, index) => (
                <div key={`${phase.title}-${index}`} className="rounded-lg border border-silicon-slate/60 bg-background/35 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Phase {index + 1}</p>
                  <p className="font-medium">{phase.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{phase.objective}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-silicon-slate/60 bg-background/35 p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </div>
  )
}
