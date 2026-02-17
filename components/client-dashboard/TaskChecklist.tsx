'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  Play,
  Download,
  BookOpen,
  FileText,
  ExternalLink,
  Zap,
  Clock,
  ArrowRight,
} from 'lucide-react'
import type { DashboardTask, DiyResource } from '@/lib/client-dashboard'

interface TaskChecklistProps {
  tasks: DashboardTask[]
  token: string
  onTaskUpdate: (taskId: string, newStatus: string) => void
}

const PRIORITY_STYLES = {
  high: 'bg-red-900/40 text-red-300 border-red-700/50',
  medium: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50',
  low: 'bg-gray-800 text-gray-400 border-gray-700',
}

const RESOURCE_ICONS: Record<DiyResource['type'], typeof Play> = {
  video: Play,
  article: BookOpen,
  n8n_workflow: Download,
  lead_magnet: FileText,
  product: FileText,
  external_link: ExternalLink,
}

export default function TaskChecklist({ tasks, token, onTaskUpdate }: TaskChecklistProps) {
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [updatingTask, setUpdatingTask] = useState<string | null>(null)

  // Group tasks by category
  const grouped = tasks.reduce<Record<string, DashboardTask[]>>((acc, task) => {
    if (!acc[task.category]) acc[task.category] = []
    acc[task.category].push(task)
    return acc
  }, {})

  const handleToggle = async (task: DashboardTask) => {
    const newStatus = task.status === 'complete' ? 'pending' : 'complete'
    setUpdatingTask(task.id)

    try {
      const res = await fetch(`/api/client/dashboard/${token}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        onTaskUpdate(task.id, newStatus)
      }
    } catch {
      // Revert on error handled by parent
    } finally {
      setUpdatingTask(null)
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
        Task Checklist
      </h3>
      <div className="space-y-6">
        {Object.entries(grouped).map(([category, categoryTasks]) => (
          <div key={category}>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              {category.replace(/_/g, ' ')}
            </h4>
            <div className="space-y-2">
              {categoryTasks.map((task) => {
                const isExpanded = expandedTask === task.id
                const isComplete = task.status === 'complete'
                const isUpdating = updatingTask === task.id
                const hasPaths = (task.diy_resources?.length > 0) || task.accelerated_bundle_id

                return (
                  <div
                    key={task.id}
                    className={`border rounded-lg overflow-hidden transition-colors ${
                      isComplete
                        ? 'border-green-800/50 bg-green-900/10'
                        : 'border-gray-800 bg-gray-800/30'
                    }`}
                  >
                    {/* Task Header */}
                    <div className="flex items-center gap-3 p-3">
                      <button
                        onClick={() => handleToggle(task)}
                        disabled={isUpdating}
                        className="flex-shrink-0 transition-colors"
                      >
                        {isComplete ? (
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        ) : (
                          <Circle className={`w-5 h-5 ${isUpdating ? 'text-gray-600 animate-pulse' : 'text-gray-600 hover:text-blue-400'}`} />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-sm ${
                            isComplete ? 'text-gray-500 line-through' : 'text-gray-200'
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {task.impact_score > 0 && (
                          <span className="text-xs text-blue-400 font-medium">
                            +{task.impact_score} pts
                          </span>
                        )}
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_STYLES[task.priority]}`}
                        >
                          {task.priority}
                        </span>
                        {hasPaths && (
                          <button
                            onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                            className="text-gray-500 hover:text-gray-300"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded: DIY + Fast Track Paths */}
                    {isExpanded && hasPaths && (
                      <div className="border-t border-gray-800 p-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* DIY Path */}
                        {task.diy_resources && task.diy_resources.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-xs font-medium text-gray-400 uppercase">
                                Do It Yourself
                              </span>
                            </div>
                            <div className="space-y-2">
                              {task.diy_resources.map((resource, i) => {
                                const Icon = RESOURCE_ICONS[resource.type] || ExternalLink
                                const href = resource.signed_url || resource.url || '#'
                                return (
                                  <a
                                    key={i}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors group"
                                  >
                                    <Icon className="w-4 h-4 text-gray-500 group-hover:text-blue-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs text-gray-300 truncate">
                                        {resource.title}
                                      </p>
                                      {resource.estimated_time && (
                                        <p className="text-[10px] text-gray-600">
                                          {resource.estimated_time}
                                        </p>
                                      )}
                                    </div>
                                  </a>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Fast Track Path */}
                        {task.accelerated_bundle_id && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Zap className="w-3.5 h-3.5 text-yellow-400" />
                              <span className="text-xs font-medium text-yellow-400 uppercase">
                                Fast Track
                              </span>
                            </div>
                            <div className="p-3 rounded-lg bg-gradient-to-r from-yellow-900/20 to-amber-900/20 border border-yellow-800/50">
                              <p className="text-sm text-yellow-200 font-medium mb-1">
                                {task.accelerated_bundle?.name || 'Professional Service'}
                              </p>
                              {task.accelerated_headline && (
                                <p className="text-xs text-yellow-300/70 mb-2">
                                  {task.accelerated_headline}
                                </p>
                              )}
                              {task.accelerated_savings && (
                                <p className="text-[10px] text-gray-500 mb-2">
                                  {task.accelerated_savings}
                                </p>
                              )}
                              <a
                                href={task.accelerated_bundle?.pricing_tier_slug
                                  ? `/pricing`
                                  : `/services`}
                                className="inline-flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 font-medium"
                              >
                                Learn More <ArrowRight className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
