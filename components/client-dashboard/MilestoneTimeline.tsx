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
    dotClass: 'bg-gold-light border-radiant-gold',
    lineClass: 'bg-gold-light',
    textClass: 'text-gold-light',
    badgeClass: 'bg-radiant-gold/15 text-gold-light border border-radiant-gold/25',
  },
  in_progress: {
    icon: Clock,
    dotClass: 'bg-radiant-gold border-gold-light animate-pulse',
    lineClass: 'bg-radiant-gold',
    textClass: 'text-radiant-gold',
    badgeClass: 'bg-radiant-gold/15 text-radiant-gold border border-radiant-gold/25',
  },
  pending: {
    icon: Circle,
    dotClass: 'bg-silicon-slate border-platinum-white/20',
    lineClass: 'bg-platinum-white/15',
    textClass: 'text-platinum-white/55',
    badgeClass: 'bg-silicon-slate/60 text-platinum-white/50 border border-platinum-white/10',
  },
  skipped: {
    icon: Circle,
    dotClass: 'bg-imperial-navy border-platinum-white/10',
    lineClass: 'bg-platinum-white/10',
    textClass: 'text-platinum-white/35 line-through',
    badgeClass: 'bg-imperial-navy/50 text-platinum-white/35 border border-platinum-white/10',
  },
}

const EVIDENCE_STATUS_STYLES = {
  verified: 'border-radiant-gold/35 bg-radiant-gold/10 text-gold-light',
  pending: 'border-platinum-white/10 bg-silicon-slate/60 text-platinum-white/70',
  access_needed: 'border-bronze/45 bg-bronze/15 text-gold-light',
  manual_review: 'border-radiant-gold/25 bg-silicon-slate/70 text-radiant-gold',
}

const METRIC_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /(\d[\d,]*)\s+all-branch commits/i, label: 'all-branch commits' },
  { pattern: /(\d[\d,]*)\s+tracked code\/doc\/config lines/i, label: 'tracked code/doc/config lines' },
  { pattern: /(\d[\d,]*)\s+passed release gates/i, label: 'passed release gates' },
  { pattern: /(\d[\d,]*)\s+pending store-console gate/i, label: 'pending store-console gate' },
  { pattern: /(\d[\d,]*)[-\s]+tester GO threshold/i, label: 'tester GO threshold' },
]

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

function knownEvidenceMetrics(item: MilestoneEvidence) {
  const text = `${item.source_label} ${item.summary}`
  return METRIC_PATTERNS.flatMap(({ pattern, label }) => {
    const match = text.match(pattern)
    return match?.[1] ? [{ value: match[1], label }] : []
  })
}

function connectionNeededLabel(item: Pick<MilestoneEvidence, 'source_label' | 'summary'>) {
  const text = `${item.source_label} ${item.summary}`.toLowerCase()
  const connections: string[] = []

  if (text.includes('app store') || text.includes('apple')) {
    connections.push('App Store Connect')
  }
  if (text.includes('google play') || text.includes('google')) {
    connections.push('Google Play')
  }
  if (text.includes('stripe')) {
    connections.push('Stripe')
  }
  if (text.includes('website') || text.includes('vanguardenterprises.com')) {
    connections.push('Website')
  }

  if (connections.length > 0) return connections.join(' + ')
  if (text.includes('store') || text.includes('platform')) return 'Store platform access'
  return item.source_label
}

function conciseEvidenceStatement(item: MilestoneEvidence) {
  if (item.status === 'access_needed') {
    return `Connection needed: ${connectionNeededLabel(item)}`
  }
  if (item.status === 'pending') return 'Pending evidence'
  if (item.status === 'manual_review') return 'Manual review needed'
  return null
}

function AutomationHint({
  automation,
  evidence,
}: {
  automation?: MilestoneAutomation
  evidence: MilestoneEvidence[]
}) {
  if (!automation) return null

  const needsAccess = automation.status === 'access_needed'
  const accessTarget = needsAccess
    ? connectionNeededLabel({
        source_label: automation.source,
        summary: automation.summary,
      })
    : null
  const text = accessTarget || automation.next_check || automation.summary
  const duplicateAccess = needsAccess && evidence.some((item) => {
    if (item.status !== 'access_needed') return false
    return connectionNeededLabel(item) === accessTarget
  })

  if (duplicateAccess) return null

  const LabelIcon = needsAccess ? KeyRound : GitBranch
  const label = needsAccess ? 'Connection needed: ' : 'Next check: '

  return (
    <div className="mt-2 flex items-start gap-2 rounded border border-radiant-gold/10 bg-imperial-navy/50 p-2">
      <LabelIcon
        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
          needsAccess ? 'text-gold-light' : 'text-radiant-gold'
        }`}
      />
      <p className="text-[11px] leading-relaxed text-platinum-white/60">
        <span className="font-medium text-platinum-white/80">{label}</span>
        {sanitizeClientText(text)}
      </p>
    </div>
  )
}

export default function MilestoneTimeline({ milestones }: MilestoneTimelineProps) {
  if (!milestones || milestones.length === 0) {
    return (
      <div className="rounded-lg border border-radiant-gold/15 bg-silicon-slate/35 p-5">
        <h3 className="text-sm font-medium text-radiant-gold uppercase tracking-wider mb-4">
          Milestones
        </h3>
        <p className="text-platinum-white/55 text-sm">No milestones set yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-radiant-gold/15 bg-silicon-slate/35 p-5">
      <h3 className="text-sm font-medium text-radiant-gold uppercase tracking-wider mb-4">
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
                  <Icon className="w-4 h-4 text-platinum-white" />
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
                {milestone.target_date && (
                  <p className="text-[10px] text-platinum-white/40 mt-1">
                    Target: {new Date(milestone.target_date).toLocaleDateString()}
                  </p>
                )}
                {evidence.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-radiant-gold/70">
                      <ShieldCheck className="h-3 w-3" />
                      Evidence Trace
                    </div>
                    <div className="space-y-1.5">
                      {evidence.map((item, evidenceIndex) => {
                        const statusClass =
                          EVIDENCE_STATUS_STYLES[item.status] || EVIDENCE_STATUS_STYLES.pending
                        const metrics = knownEvidenceMetrics(item)
                        const statement = conciseEvidenceStatement(item)
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
                            {metrics.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {metrics.map((metric) => (
                                  <span
                                    key={`${item.id || evidenceIndex}-${metric.label}`}
                                    className="rounded border border-radiant-gold/20 bg-imperial-navy/45 px-2 py-1 text-[10px] font-medium text-platinum-white/80"
                                  >
                                    <span className="text-gold-light">{metric.value}</span>{' '}
                                    {metric.label}
                                  </span>
                                ))}
                              </div>
                            )}
                            {statement && (
                              <p className="mt-1 text-[11px] leading-relaxed opacity-85">
                                {statement}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                <AutomationHint automation={milestone.automation} evidence={evidence} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
