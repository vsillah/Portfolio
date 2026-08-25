'use client'

import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileText,
  LockKeyhole,
  Mail,
  MessageSquare,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from 'lucide-react'
import type {
  WarmOutreachChannel,
  WarmOutreachContextSummary,
  WarmOutreachReadiness,
  WarmOutreachRelationshipPacket,
} from '@/lib/warm-outreach-relationship-intelligence'

type ChannelCapability = NonNullable<
  WarmOutreachRelationshipPacket['channelCapabilities'][WarmOutreachChannel]
>

export interface RelationshipPacketApiResponse {
  packet: WarmOutreachRelationshipPacket
  readiness: WarmOutreachReadiness
  contextSummary: WarmOutreachContextSummary
  executionBoundary: {
    source: string
    readOnly: boolean
    providerCalls: boolean
    createsDraft: boolean
    externalSend: boolean
    n8nDispatch: boolean
    slackAction: boolean
    responseMonitoring: boolean
  }
}

interface RelationshipPacketPanelProps {
  loading: boolean
  error: string | null
  data: RelationshipPacketApiResponse | null
}

const CHANNEL_LABELS: Record<WarmOutreachChannel, string> = {
  email: 'Email',
  linkedin: 'LinkedIn',
  facebook: 'Facebook / manual',
  phone_contact: 'Phone / manual',
}

const CHANNEL_ICONS: Record<WarmOutreachChannel, typeof Mail> = {
  email: Mail,
  linkedin: MessageSquare,
  facebook: UserRoundCheck,
  phone_contact: Phone,
}

export function relationshipReadinessLabel(status: WarmOutreachReadiness['status']) {
  if (status === 'draft_ready') return 'Ready for draft review'
  if (status === 'needs_review') return 'Needs human review'
  return 'Blocked'
}

export function describeChannelCapability(capability?: ChannelCapability) {
  if (!capability?.available) return 'Not recorded'
  if (capability.manualOnly) return 'Manual review only'
  if (!capability.providerConfigured) return 'Draft context only'
  if (!capability.supportsExternalSend) return 'Draft capable, no send'
  return 'Provider configured'
}

function statusClasses(status: WarmOutreachReadiness['status']) {
  if (status === 'draft_ready') {
    return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
  }
  if (status === 'needs_review') {
    return 'border-amber-500/35 bg-amber-500/10 text-amber-100'
  }
  return 'border-red-500/35 bg-red-500/10 text-red-100'
}

function capabilityClasses(capability?: ChannelCapability) {
  if (!capability?.available) return 'border-silicon-slate bg-silicon-slate/25 text-muted-foreground'
  if (capability.manualOnly) return 'border-sky-500/25 bg-sky-500/10 text-sky-100'
  if (!capability.providerConfigured || !capability.supportsExternalSend) {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
  }
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
}

function sourceLabel(value: string) {
  return value.replace(/_/g, ' ')
}

function BoundaryFlag({
  active,
  label,
}: {
  active: boolean
  label: string
}) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-md border px-2 py-1 text-xs ${
        active
          ? 'border-red-500/30 bg-red-500/10 text-red-100'
          : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
      }`}
    >
      {label}: {active ? 'enabled' : 'off'}
    </span>
  )
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
        {title}
      </p>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={item} className="text-sm leading-5 text-foreground">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function RelationshipPacketPanel({
  loading,
  error,
  data,
}: RelationshipPacketPanelProps) {
  const readiness = data?.readiness
  const packet = data?.packet
  const sourceInventory = packet?.sourceInventory
  const hasInventoryEvidence =
    Boolean(sourceInventory) &&
    ((sourceInventory?.sourceStatus.length ?? 0) > 0 ||
      (sourceInventory?.safeToMention.length ?? 0) > 0 ||
      (sourceInventory?.summarizeOnly.length ?? 0) > 0 ||
      (sourceInventory?.doNotMention.length ?? 0) > 0)

  return (
    <section className="lg:col-span-2 rounded-lg border border-silicon-slate/80 bg-background/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Sparkles size={15} className="text-radiant-gold" aria-hidden />
            Relationship packet
          </p>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
            Read-only Portfolio context for warm outreach review. This is relationship evidence,
            not draft copy or send authority.
          </p>
        </div>
        {readiness && (
          <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(readiness.status)}`}>
            {relationshipReadinessLabel(readiness.status)}
          </span>
        )}
      </div>

      {loading && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-silicon-slate bg-silicon-slate/25 p-3 text-sm text-muted-foreground">
          <Database size={14} className="animate-pulse" aria-hidden />
          Loading relationship packet from local Portfolio rows...
        </div>
      )}

      {!loading && error && (
        <div role="alert" className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {!loading && !error && !data && (
        <div className="mt-4 rounded-md border border-silicon-slate bg-silicon-slate/25 p-3 text-sm text-muted-foreground">
          No relationship packet is available for this lead yet.
        </div>
      )}

      {!loading && !error && data && packet && readiness && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="rounded-md border border-silicon-slate/70 bg-silicon-slate/20 p-3">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                Relationship context
              </p>
              <p className="text-sm leading-5 text-foreground">{packet.relationshipBasis}</p>
              {packet.openingPitchGuidance?.openingAngle && (
                <p className="mt-2 text-sm leading-5 text-muted-foreground">
                  Opening angle: {packet.openingPitchGuidance.openingAngle}
                </p>
              )}
              {packet.suggestedNextStep && (
                <p className="mt-2 text-sm leading-5 text-muted-foreground">
                  Next step: {packet.suggestedNextStep}
                </p>
              )}
            </div>

            <div className="rounded-md border border-silicon-slate/70 bg-silicon-slate/20 p-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                Suppression and readiness
              </p>
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2 text-foreground">
                  {readiness.status === 'blocked' ? (
                    <ShieldAlert size={15} className="text-red-300" aria-hidden />
                  ) : (
                    <ShieldCheck size={15} className="text-emerald-300" aria-hidden />
                  )}
                  {relationshipReadinessLabel(readiness.status)}
                </p>
                {packet.suppression.doNotContact || packet.suppression.unsubscribed || packet.suppression.removedAt ? (
                  <p className="text-red-100">
                    Blocked by suppression state: {packet.suppression.suppressionReason ?? 'review required'}.
                  </p>
                ) : (
                  <p className="text-muted-foreground">No DNC, unsubscribe, or removed-state blocker is recorded.</p>
                )}
                <p className="text-muted-foreground">
                  Template: {readiness.recommendedTemplate.replace(/_/g, ' ')}. Selected channel:{' '}
                  {readiness.selectedChannel ? CHANNEL_LABELS[readiness.selectedChannel] : 'none'}.
                </p>
              </div>
            </div>
          </div>

          {(readiness.blockers.length > 0 || readiness.warnings.length > 0) && (
            <div className="grid gap-3 md:grid-cols-2">
              <ListBlock title="Blockers" items={readiness.blockers} />
              <ListBlock title="Review warnings" items={readiness.warnings} />
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <ListBlock title="Relationship signals" items={packet.relationshipSignals} />
            <ListBlock title="Commonality cues" items={packet.commonalities} />
            <ListBlock title="Safe to mention" items={sourceInventory?.safeToMention ?? []} />
            <ListBlock title="Summarize only" items={sourceInventory?.summarizeOnly ?? []} />
            <ListBlock title="Do not mention" items={sourceInventory?.doNotMention ?? []} />
            <ListBlock title="Avoid in draft context" items={packet.avoidContext} />
          </div>

          {!hasInventoryEvidence && packet.sourceRefs.length === 0 && (
            <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-100">
              No relationship evidence is available yet. Keep this lead in review until Portfolio-local context is added.
            </div>
          )}

          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
              Source and provenance summary
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {packet.sourceRefs.map((source) => (
                <div key={`${source.sourceType}-${source.sourceId ?? source.summary}`} className="rounded-md border border-silicon-slate/70 bg-silicon-slate/20 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-background/70 px-2 py-0.5 text-[11px] capitalize text-foreground">
                      {sourceLabel(source.sourceType)}
                    </span>
                    {source.privateSource && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-100">
                        <LockKeyhole size={11} aria-hidden />
                        private summary
                      </span>
                    )}
                    {source.mentionSafety && (
                      <span className="rounded-full border border-silicon-slate px-2 py-0.5 text-[11px] text-muted-foreground">
                        {source.sourceStatus ?? 'present'} / {source.mentionSafety.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-5 text-muted-foreground">{source.summary}</p>
                </div>
              ))}
            </div>
          </div>

          {sourceInventory?.sourceStatus.length ? (
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                Inventory coverage
              </p>
              <div className="flex flex-wrap gap-2">
                {sourceInventory.sourceStatus.map((source) => (
                  <span key={`${source.sourceType}-${source.status}`} className="inline-flex min-h-7 items-center rounded-md border border-silicon-slate bg-silicon-slate/25 px-2 py-1 text-xs text-muted-foreground">
                    {sourceLabel(source.sourceType)}: {source.status}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
              Channel capability state
            </p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {(['email', 'linkedin', 'facebook', 'phone_contact'] as WarmOutreachChannel[]).map((channel) => {
                const capability = packet.channelCapabilities[channel]
                const Icon = CHANNEL_ICONS[channel]
                return (
                  <div key={channel} className={`rounded-md border p-3 ${capabilityClasses(capability)}`}>
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Icon size={14} aria-hidden />
                      {CHANNEL_LABELS[channel]}
                    </p>
                    <p className="mt-1 text-xs">{describeChannelCapability(capability)}</p>
                    {capability?.reason && (
                      <p className="mt-1 text-xs opacity-85">{capability.reason}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-md border border-silicon-slate/70 bg-silicon-slate/20 p-3">
            <p className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
              <FileText size={13} aria-hidden />
              Execution boundary
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex min-h-7 items-center rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100">
                Read-only local rows
              </span>
              <BoundaryFlag active={data.executionBoundary.providerCalls} label="Provider calls" />
              <BoundaryFlag active={data.executionBoundary.createsDraft} label="Draft creation" />
              <BoundaryFlag active={data.executionBoundary.externalSend} label="External send" />
              <BoundaryFlag active={data.executionBoundary.n8nDispatch} label="n8n dispatch" />
              <BoundaryFlag active={data.executionBoundary.slackAction} label="Slack action" />
              <BoundaryFlag active={data.executionBoundary.responseMonitoring} label="Reply monitoring" />
            </div>
            <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-200" aria-hidden />
              Email and LinkedIn can inform internal drafts only. Facebook and phone remain manual review channels when present.
            </p>
          </div>

          {readiness.status === 'draft_ready' && (
            <p className="flex items-start gap-2 text-xs leading-5 text-emerald-100">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" aria-hidden />
              Ready means the operator has enough local context to review an internal draft. It does not authorize external outreach.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
