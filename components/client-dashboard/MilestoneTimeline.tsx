'use client'

import {
  Check,
  Clock,
  Circle,
  ExternalLink,
  GitBranch,
  KeyRound,
  ShieldCheck,
} from 'lucide-react'
import type {
  Milestone,
  MilestoneAutomation,
  MilestoneEvidence,
} from '@/lib/onboarding-templates'

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

const EVIDENCE_STATUS_STYLES = {
  verified: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  pending: 'border-gray-700 bg-gray-800/70 text-gray-300',
  access_needed: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  manual_review: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
}

const CONFIDENCE_LABELS = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
}

function clientVisibleEvidence(milestone: Milestone): MilestoneEvidence[] {
  return (milestone.evidence || []).filter((item) => item.is_client_visible !== false)
}

function evidenceStatusLabel(status: MilestoneEvidence['status']) {
  return status
    .split('_')
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ')
}

function sanitizeClientText(value: string) {
  return value.replace(/\/Users\/[^\s)]+/g, '[private path]')
}

function AutomationHint({ automation }: { automation?: MilestoneAutomation }) {
  if (!automation) return null

  const needsAccess = automation.status === 'access_needed'

  return (
    <div className="mt-2 flex items-start gap-2 rounded border border-gray-800 bg-gray-950/60 p-2">
      {needsAccess ? (
        <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
      ) : (
        <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-300" />
      )}
      <p className="text-[11px] leading-relaxed text-gray-400">
        <span className="font-medium text-gray-300">Automation: </span>
        {sanitizeClientText(automation.summary)}
      </p>
    </div>
  )
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
          const evidence = clientVisibleEvidence(milestone)

          return (
            <div key={milestone.id || index} className="flex gap-4 pb-6 last:pb-0">
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
                {evidence.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                      <ShieldCheck className="h-3 w-3" />
                      Evidence Trace
                    </div>
                    <div className="space-y-1.5">
                      {evidence.map((item, evidenceIndex) => {
                        const statusClass =
                          EVIDENCE_STATUS_STYLES[item.status] || EVIDENCE_STATUS_STYLES.pending
                        return (
                          <div
                            key={item.id || evidenceIndex}
                            className={`rounded border px-2 py-1.5 ${statusClass}`}
                          >
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-[11px] font-medium">
                                {item.source_label}
                              </span>
                              <span className="text-[10px] opacity-80">
                                {evidenceStatusLabel(item.status)}
                              </span>
                              <span className="text-[10px] opacity-70">
                                {CONFIDENCE_LABELS[item.confidence]}
                              </span>
                              {item.source_url && (
                                <a
                                  href={item.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] underline-offset-2 hover:underline"
                                >
                                  Source
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                            </div>
                            <p className="mt-1 text-[11px] leading-relaxed opacity-85">
                              {sanitizeClientText(item.summary)}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                <AutomationHint automation={milestone.automation} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
