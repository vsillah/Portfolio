'use client'

import { Clock, TrendingUp } from 'lucide-react'
import type { TimeTrackingData } from '@/lib/client-dashboard'

interface TimeTrackingSectionProps {
  timeTracking: TimeTrackingData
  milestones: Array<{ title?: string }>
}

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  if (m > 0) return `${m}m`
  return '<1m'
}

export default function TimeTrackingSection({
  timeTracking,
  milestones,
}: TimeTrackingSectionProps) {
  if (!timeTracking || timeTracking.total_seconds === 0) return null

  const milestoneEntries = timeTracking.by_target
    .filter((t) => t.target_type === 'milestone')
    .sort((a, b) => Number(a.target_id) - Number(b.target_id))

  const taskEntries = timeTracking.by_target.filter(
    (t) => t.target_type === 'task'
  )

  const totalTaskTime = taskEntries.reduce((s, t) => s + t.total_seconds, 0)

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Time Investment
        </h3>
        <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
          <Clock className="w-4 h-4 text-blue-400" />
          {formatHours(timeTracking.total_seconds)} total
        </div>
      </div>

      {milestoneEntries.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs text-gray-500 font-medium uppercase">By Milestone</p>
          {milestoneEntries.map((entry) => {
            const idx = Number(entry.target_id)
            const title = milestones[idx]?.title || `Milestone ${idx + 1}`
            const pct = Math.round(
              (entry.total_seconds / timeTracking.total_seconds) * 100
            )
            return (
              <div key={entry.target_id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-300 truncate">
                      {title}
                    </span>
                    <span className="text-xs text-gray-500 shrink-0 ml-2">
                      {formatHours(entry.total_seconds)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500/60 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalTaskTime > 0 && (
        <div className="pt-3 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Task work ({taskEntries.length} task{taskEntries.length !== 1 ? 's' : ''})
            </span>
            <span className="text-xs text-gray-400">
              {formatHours(totalTaskTime)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
