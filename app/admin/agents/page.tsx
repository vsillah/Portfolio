'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Activity, ArrowRight, Bot, CheckCircle2, Clock, DollarSign, XCircle } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'

export default function AgentOperationsPage() {
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
              <div className="flex items-center gap-2 text-cyan-300 mb-2">
                <Bot size={20} />
                <h2 className="text-lg font-semibold">Runtime Strategy</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Codex and n8n are the primary backbone. Hermes is supported as a secondary runtime. OpenCode stays
                deferred until traces prove safe.
              </p>
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
