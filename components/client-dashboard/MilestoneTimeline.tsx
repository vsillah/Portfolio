'use client'

import { Check, Clock, Circle } from 'lucide-react'

interface Milestone {
  week: number | string
  title: string
  description: string
  deliverables: string[]
  phase: number
  target_date?: string
  status: 'pending' | 'in_progress' | 'complete' | 'skipped'
}

interface MilestoneTimelineProps {
  milestones: Milestone[]
}

const STATUS_STYLES = {
  complete: {
    icon: Check,
    dotClass: 'bg-green-500 border-green-400',
    lineClass: 'bg-green-500',
    textClass: 'text-green-300',
    badgeClass: 'bg-green-900/50 text-green-300',
  },
  in_progress: {
    icon: Clock,
    dotClass: 'bg-blue-500 border-blue-400 animate-pulse',
    lineClass: 'bg-blue-500',
    textClass: 'text-blue-300',
    badgeClass: 'bg-blue-900/50 text-blue-300',
  },
  pending: {
    icon: Circle,
    dotClass: 'bg-gray-700 border-gray-600',
    lineClass: 'bg-gray-700',
    textClass: 'text-gray-500',
    badgeClass: 'bg-gray-800 text-gray-500',
  },
  skipped: {
    icon: Circle,
    dotClass: 'bg-gray-800 border-gray-700',
    lineClass: 'bg-gray-800',
    textClass: 'text-gray-600 line-through',
    badgeClass: 'bg-gray-800/50 text-gray-600',
  },
}

export default function MilestoneTimeline({ milestones }: MilestoneTimelineProps) {
  if (!milestones || milestones.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
          Milestones
        </h3>
        <p className="text-gray-500 text-sm">No milestones set yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
        Milestones
      </h3>
      <div className="relative">
        {milestones.map((milestone, index) => {
          const styles = STATUS_STYLES[milestone.status] || STATUS_STYLES.pending
          const Icon = styles.icon
          const isLast = index === milestones.length - 1

          return (
            <div key={index} className="flex gap-4 pb-6 last:pb-0">
              {/* Timeline dot + line */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${styles.dotClass}`}
                >
                  <Icon className="w-4 h-4 text-white" />
                </div>
                {!isLast && (
                  <div className={`w-0.5 flex-1 mt-1 ${styles.lineClass}`} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-medium ${styles.textClass}`}>
                    {milestone.title}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${styles.badgeClass}`}>
                    Week {milestone.week}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-1">{milestone.description}</p>
                {milestone.deliverables && milestone.deliverables.length > 0 && (
                  <ul className="text-xs text-gray-600 space-y-0.5">
                    {milestone.deliverables.map((d, di) => (
                      <li key={di} className="flex items-center gap-1">
                        <span className="text-gray-700">•</span> {d}
                      </li>
                    ))}
                  </ul>
                )}
                {milestone.target_date && (
                  <p className="text-[10px] text-gray-600 mt-1">
                    Target: {new Date(milestone.target_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
