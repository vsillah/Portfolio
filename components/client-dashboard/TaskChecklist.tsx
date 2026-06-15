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
  high: 'bg-bronze/20 text-gold-light border-bronze/50',
  medium: 'bg-radiant-gold/15 text-radiant-gold border-radiant-gold/35',
  low: 'bg-silicon-slate/60 text-platinum-white/55 border-platinum-white/10',
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
    <div className="rounded-lg border border-radiant-gold/15 bg-silicon-slate/35 p-5">
      <h3 className="text-sm font-medium text-radiant-gold uppercase tracking-wider mb-4">
        Task Checklist
      </h3>
      <div className="space-y-6">
        {Object.entries(grouped).map(([category, categoryTasks]) => (
          <div key={category}>
            <h4 className="text-xs font-medium text-platinum-white/50 uppercase tracking-wider mb-3">
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
                        ? 'border-radiant-gold/35 bg-radiant-gold/10'
                        : 'border-radiant-gold/10 bg-imperial-navy/40'
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
                          <CheckCircle2 className="w-5 h-5 text-gold-light" />
                        ) : (
                          <Circle className={`w-5 h-5 ${isUpdating ? 'text-platinum-white/30 animate-pulse' : 'text-platinum-white/35 hover:text-radiant-gold'}`} />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-sm ${
                            isComplete ? 'text-platinum-white/45 line-through' : 'text-platinum-white/85'
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {task.impact_score > 0 && (
                          <span className="text-xs text-radiant-gold font-medium">
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
                            className="text-platinum-white/45 hover:text-radiant-gold"
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
                      <div className="border-t border-radiant-gold/10 p-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* DIY Path */}
                        {task.diy_resources && task.diy_resources.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className="w-3.5 h-3.5 text-radiant-gold/75" />
                              <span className="text-xs font-medium text-platinum-white/55 uppercase">
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
                                    className="flex items-center gap-2 p-2 rounded-lg bg-silicon-slate/50 hover:bg-radiant-gold/10 transition-colors group"
                                  >
                                    <Icon className="w-4 h-4 text-platinum-white/45 group-hover:text-radiant-gold flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs text-platinum-white/75 truncate">
                                        {resource.title}
                                      </p>
                                      {resource.estimated_time && (
                                        <p className="text-[10px] text-platinum-white/40">
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
                              <Zap className="w-3.5 h-3.5 text-radiant-gold" />
                              <span className="text-xs font-medium text-radiant-gold uppercase">
                                Fast Track
                              </span>
                            </div>
                            <div className="p-3 rounded-lg bg-gradient-to-r from-radiant-gold/15 to-bronze/15 border border-radiant-gold/30">
                              <p className="text-sm text-gold-light font-medium mb-1">
                                {task.accelerated_bundle?.name || 'Professional Service'}
                              </p>
                              {task.accelerated_headline && (
                                <p className="text-xs text-platinum-white/65 mb-2">
                                  {task.accelerated_headline}
                                </p>
                              )}
                              {task.accelerated_savings && (
                                <p className="text-[10px] text-platinum-white/45 mb-2">
                                  {task.accelerated_savings}
                                </p>
                              )}
                              <a
                                href={task.accelerated_bundle?.pricing_tier_slug
                                  ? `/pricing`
                                  : `/services`}
                                className="inline-flex items-center gap-1 text-xs text-radiant-gold hover:text-gold-light font-medium"
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
