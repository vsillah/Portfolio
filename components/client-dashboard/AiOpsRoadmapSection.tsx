'use client'

import { ClipboardList, DollarSign, ShieldCheck } from 'lucide-react'
import type { RoadmapClientView } from '@/lib/client-ai-ops-roadmap'

interface Props {
  roadmap: RoadmapClientView
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function AiOpsRoadmapSection({ roadmap }: Props) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-medium text-gray-200 uppercase tracking-wider">
              Implementation Roadmap
            </h3>
          </div>
          {roadmap.clientSummary && (
            <p className="text-sm text-gray-400 max-w-3xl">{roadmap.clientSummary}</p>
          )}
        </div>
        <span className="text-xs px-2 py-1 rounded border border-gray-700 bg-gray-800 text-gray-300 capitalize">
          {roadmap.status}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-3">
          <DollarSign className="w-4 h-4 text-emerald-300 mb-2" />
          <p className="text-xs text-gray-500 uppercase tracking-wide">Startup costs</p>
          <p className="text-lg font-semibold text-gray-100">
            {formatCurrency(roadmap.costSummary.oneTimeClientOwned)}
          </p>
        </div>
        <div className="rounded-lg border border-blue-900/60 bg-blue-950/20 p-3">
          <DollarSign className="w-4 h-4 text-blue-300 mb-2" />
          <p className="text-xs text-gray-500 uppercase tracking-wide">Monthly operating</p>
          <p className="text-lg font-semibold text-gray-100">
            {formatCurrency(roadmap.costSummary.monthlyClientOwned)}
          </p>
        </div>
        <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3">
          <ShieldCheck className="w-4 h-4 text-amber-300 mb-2" />
          <p className="text-xs text-gray-500 uppercase tracking-wide">Quote-required</p>
          <p className="text-lg font-semibold text-gray-100">
            {roadmap.costSummary.quoteRequiredCount}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {roadmap.phases.map((phase) => {
          const pct = phase.tasksTotal > 0 ? Math.round((phase.tasksComplete / phase.tasksTotal) * 100) : 0
          return (
            <div key={phase.id || phase.title} className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Phase {phase.phaseOrder}</p>
                  <h4 className="font-medium text-gray-100">{phase.title}</h4>
                  <p className="text-sm text-gray-500 mt-1">{phase.objective}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded border border-gray-700 bg-gray-800 text-gray-300 capitalize">
                  {phase.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-gray-800 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {phase.tasksComplete}/{phase.tasksTotal} visible tasks complete
              </p>
            </div>
          )
        })}
      </div>

      {roadmap.nextActions.length > 0 && (
        <div className="mt-5 rounded-lg border border-gray-800 bg-gray-950/40 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Next actions</p>
          <ul className="space-y-2">
            {roadmap.nextActions.map((action, index) => (
              <li key={`${action.title}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-300">{action.title}</span>
                <span className="text-gray-500 capitalize">{action.ownerType}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
