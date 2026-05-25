'use client'

import { Activity, AlertTriangle, CheckCircle2, ClipboardList, DollarSign, ShieldCheck } from 'lucide-react'
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

function formatDate(value: string | null): string {
  if (!value) return 'Not generated yet'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export default function AiOpsRoadmapSection({ roadmap }: Props) {
  const projection = roadmap.projectionStatus
  const connectors = roadmap.connectorReadiness
  const monitoringFlags = projection.overdueTasks + projection.staleCostItems + (projection.reportMissing ? 1 : 0)
  const openActions = projection.clientActionCount + projection.amadutownActionCount + projection.sharedActionCount
  const projectionTone = projection.blockedTasks > 0 || monitoringFlags > 0 || projection.approvalNeededCount > 0
    ? 'border-radiant-gold/45 bg-radiant-gold/10 text-radiant-gold shadow-[0_0_28px_rgba(212,175,55,0.10)]'
    : 'border-radiant-gold/30 bg-background/45 text-radiant-gold'
  const metricCardClass = 'rounded-lg border border-silicon-slate/60 bg-background/45 p-3'
  const eyebrowClass = 'text-xs font-semibold uppercase tracking-[0.14em] text-radiant-gold/85'

  return (
    <div className="rounded-lg border border-silicon-slate/70 bg-imperial-navy/85 p-5 shadow-[0_0_32px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="w-5 h-5 text-radiant-gold" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-[0.16em]">
              Implementation Roadmap
            </h3>
          </div>
          {roadmap.clientSummary && (
            <p className="text-sm text-muted-foreground max-w-3xl">{roadmap.clientSummary}</p>
          )}
        </div>
        <span className="rounded-full border border-radiant-gold/35 bg-radiant-gold/10 px-2.5 py-1 text-xs font-medium text-radiant-gold capitalize">
          {roadmap.status}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className={metricCardClass}>
          <DollarSign className="w-4 h-4 text-radiant-gold mb-2" />
          <p className={eyebrowClass}>Startup costs</p>
          <p className="text-lg font-semibold text-foreground">
            {formatCurrency(roadmap.costSummary.oneTimeClientOwned)}
          </p>
        </div>
        <div className={metricCardClass}>
          <DollarSign className="w-4 h-4 text-radiant-gold mb-2" />
          <p className={eyebrowClass}>Monthly operating</p>
          <p className="text-lg font-semibold text-foreground">
            {formatCurrency(roadmap.costSummary.monthlyClientOwned)}
          </p>
        </div>
        <div className={metricCardClass}>
          <ShieldCheck className="w-4 h-4 text-radiant-gold mb-2" />
          <p className={eyebrowClass}>Quote-required</p>
          <p className="text-lg font-semibold text-foreground">
            {roadmap.costSummary.quoteRequiredCount}
          </p>
        </div>
      </div>

      <div className={`rounded-lg border p-4 mb-5 ${projectionTone}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              {projection.blockedTasks > 0 || monitoringFlags > 0 || projection.approvalNeededCount > 0 ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <p className={eyebrowClass}>Roadmap projection</p>
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">{projection.nextReportingAction}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Open actions</p>
              <p className="font-semibold text-foreground">{openActions}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Approvals</p>
              <p className="font-semibold text-foreground">{projection.approvalNeededCount}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Isolation checks</p>
              <p className="font-semibold text-foreground">{projection.isolationRequiredCount}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Monitor flags</p>
              <p className="font-semibold text-foreground">{monitoringFlags}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-silicon-slate/60 bg-background/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className={eyebrowClass}>Connector readiness</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{connectors.connectorNextAction}</p>
            <p className="mt-1 text-xs text-muted-foreground">{connectors.summary}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Required</p>
              <p className="font-semibold text-foreground">{connectors.requiredConnectorCount}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Ready</p>
              <p className="font-semibold text-foreground">{connectors.readyConnectorCount}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Approval blocked</p>
              <p className="font-semibold text-foreground">{connectors.approvalBlockedConnectorCount}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Critical missing</p>
              <p className="font-semibold text-foreground">{connectors.missingCriticalConnectorCount}</p>
            </div>
          </div>
        </div>
        {connectors.items.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {connectors.items.slice(0, 6).map((connector) => (
              <span
                key={connector.key}
                className="rounded-full border border-radiant-gold/30 bg-radiant-gold/10 px-2.5 py-1 text-xs text-radiant-gold"
              >
                {connector.label} · {connector.status.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {roadmap.phases.map((phase) => {
          const pct = phase.tasksTotal > 0 ? Math.round((phase.tasksComplete / phase.tasksTotal) * 100) : 0
          return (
            <div key={phase.id || phase.title} className="rounded-lg border border-silicon-slate/60 bg-background/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={eyebrowClass}>Phase {phase.phaseOrder}</p>
                  <h4 className="font-medium text-foreground">{phase.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{phase.objective}</p>
                </div>
                <span className="rounded-full border border-silicon-slate/60 bg-background/60 px-2.5 py-1 text-xs text-muted-foreground capitalize">
                  {phase.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-silicon-slate/45 overflow-hidden">
                <div className="h-full bg-radiant-gold" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {phase.tasksComplete}/{phase.tasksTotal} visible tasks complete
              </p>
            </div>
          )
        })}
      </div>

      {roadmap.nextActions.length > 0 && (
        <div className="mt-5 rounded-lg border border-silicon-slate/60 bg-background/40 p-4">
          <p className={`${eyebrowClass} mb-2`}>Next actions</p>
          <ul className="space-y-2">
            {roadmap.nextActions.map((action, index) => (
              <li key={`${action.title}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">{action.title}</span>
                <span className="text-muted-foreground capitalize">{action.ownerType}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {roadmap.latestReport && (
        <div className="mt-5 rounded-lg border border-silicon-slate/60 bg-background/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-radiant-gold" />
                <p className={eyebrowClass}>Latest report</p>
              </div>
              <h4 className="font-medium text-foreground">{roadmap.latestReport.title}</h4>
              {roadmap.latestReport.summary && (
                <p className="text-sm text-muted-foreground mt-1">{roadmap.latestReport.summary}</p>
              )}
            </div>
            <span className="rounded-full border border-silicon-slate/60 bg-background/60 px-2.5 py-1 text-xs text-muted-foreground capitalize">
              {roadmap.latestReport.status.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Generated</p>
              <p className="text-foreground">{formatDate(roadmap.latestReport.generatedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Client actions</p>
              <p className="text-foreground">{roadmap.latestReport.clientActions.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Approvals</p>
              <p className="text-foreground">{roadmap.latestReport.approvalNeededCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Monitoring flags</p>
              <p className="text-foreground">
                {(roadmap.latestReport.monitoringSummary?.overdueTasks ?? 0) +
                  (roadmap.latestReport.monitoringSummary?.staleCostItems ?? 0) +
                  (roadmap.latestReport.monitoringSummary?.reportMissing ? 1 : 0)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
