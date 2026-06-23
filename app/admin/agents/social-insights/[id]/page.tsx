'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Instagram,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  XCircle,
  Youtube,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import type { AgentWorkItem } from '@/lib/agent-work-items'
import {
  SOCIAL_CONTENT_INTELLIGENCE_CHANNELS,
  type SocialContentIntelligenceChannel,
  type SocialChannelLaneStatus,
} from '@/lib/social-content-intelligence'

type ChannelLane = {
  status: string
  label: string
  decision_note?: string | null
  required_inputs?: string[]
}

const CHANNEL_LABELS: Record<SocialContentIntelligenceChannel, string> = {
  linkedin: 'LinkedIn',
  youtube_shorts: 'YouTube Shorts',
  instagram_reels: 'Instagram Reels',
  thumbnail: 'Thumbnail',
}

const CHANNEL_ICONS: Record<SocialContentIntelligenceChannel, ReactNode> = {
  linkedin: <FileText className="h-4 w-4" />,
  youtube_shorts: <Youtube className="h-4 w-4" />,
  instagram_reels: <Instagram className="h-4 w-4" />,
  thumbnail: <ImageIcon className="h-4 w-4" />,
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ')
}

function decisionLabel(status: SocialChannelLaneStatus) {
  return status === 'blocked' ? 'rejected' : statusLabel(status)
}

function lanesFor(item: AgentWorkItem | null): Record<SocialContentIntelligenceChannel, ChannelLane> {
  const metadata = item?.metadata ?? {}
  const lanes = asRecord(metadata.channel_lanes)
  return SOCIAL_CONTENT_INTELLIGENCE_CHANNELS.reduce((result, channel) => {
    const lane = asRecord(lanes[channel])
    result[channel] = {
      status: asString(lane.status) || 'not_started',
      label: asString(lane.label) || CHANNEL_LABELS[channel],
      decision_note: asString(lane.decision_note) || null,
      required_inputs: asStringArray(lane.required_inputs),
    }
    return result
  }, {} as Record<SocialContentIntelligenceChannel, ChannelLane>)
}

export default function SocialInsightDetailPage() {
  return (
    <ProtectedRoute requireAdmin>
      <SocialInsightDetailContent />
    </ProtectedRoute>
  )
}

function SocialInsightDetailContent() {
  const { id } = useParams<{ id: string }>()
  const [item, setItem] = useState<AgentWorkItem | null>(null)
  const [activeTab, setActiveTab] = useState<SocialContentIntelligenceChannel>('linkedin')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [decisionNote, setDecisionNote] = useState('')
  const [savingLane, setSavingLane] = useState<SocialChannelLaneStatus | null>(null)
  const [laneNotice, setLaneNotice] = useState<string | null>(null)

  const authedFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const session = await getCurrentSession()
    if (!session?.access_token) throw new Error('Missing admin session')
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${session.access_token}`)
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    return fetch(path, {
      ...init,
      headers,
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await authedFetch(`/api/admin/agents/work-items/${id}`)
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setItem(body.work_item ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insight')
      setItem(null)
    } finally {
      setLoading(false)
    }
  }, [authedFetch, id])

  useEffect(() => {
    load()
  }, [load])

  const metadata = item?.metadata ?? {}
  const insight = asRecord(metadata.insight)
  const lanes = useMemo(() => lanesFor(item), [item])
  const activeLane = lanes[activeTab]

  useEffect(() => {
    setDecisionNote(activeLane?.decision_note ?? '')
  }, [activeLane?.decision_note, activeTab])

  useEffect(() => {
    setLaneNotice(null)
  }, [activeTab])

  const updateLane = useCallback(async (status: SocialChannelLaneStatus) => {
    setError(null)
    setLaneNotice(null)

    const note = decisionNote.trim()
    if (status === 'blocked' && !note) {
      setError('Add a decision note before rejecting a channel lane.')
      return
    }

    setSavingLane(status)
    try {
      const response = await authedFetch(`/api/admin/agents/work-items/${id}/social-channels/${activeTab}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          decision_note: note || null,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `Lane update HTTP ${response.status}`)
      setItem(body.work_item ?? null)
      setLaneNotice(`${CHANNEL_LABELS[activeTab]} lane marked ${decisionLabel(status)}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update channel lane')
    } finally {
      setSavingLane(null)
    }
  }, [activeTab, authedFetch, decisionNote, id])

  return (
    <div className="agent-ops-page min-h-screen p-5 text-foreground lg:p-7">
      <div className="mx-auto max-w-7xl">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Agent Operations', href: '/admin/agents' },
          { label: 'Content Intelligence', href: '/admin/agents/content-intelligence' },
          { label: 'Social Insight' },
        ]} />

        <header className="agent-ops-surface-header mb-6 mt-5 rounded-xl border p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="agent-ops-eyebrow mb-2">
                <MessageSquare size={16} />
                Shared insight
              </div>
              <h1 className="text-3xl font-bold">{asString(insight.title) || item?.title || 'Social insight'}</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                One central Shaka backlog item feeds each social channel lane. Drafting, media, uploads, scheduling, and publishing remain separate approval gates.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/agents/coordination" className="agent-ops-button-muted">
                Backlog
              </Link>
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="agent-ops-button-secondary disabled:opacity-60"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mb-6 rounded-lg border border-red-500/35 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading insight...</div>
        ) : item ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.45fr)_minmax(0,1fr)]">
            <section className="agent-ops-card rounded-lg border p-4">
              <h2 className="text-lg font-semibold">Shared evidence</h2>
              <div className="mt-4 space-y-3">
                <InsightField label="Triggering event" value={asString(insight.triggering_event)} />
                <InsightField label="Why Vambah can speak" value={asString(insight.why_vambah_can_speak)} />
                <InsightField label="Evidence summary" value={asString(insight.evidence_summary)} />
                <InsightField label="Brand goal" value={asString(insight.brand_goal)} />
                <InsightField label="Audience" value={asString(insight.audience)} />
              </div>
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-100">
                  <ShieldAlert className="h-4 w-4" />
                  Claim boundaries
                </div>
                {asStringArray(insight.claim_boundaries).length ? (
                  <ul className="space-y-1 text-sm leading-6 text-muted-foreground">
                    {asStringArray(insight.claim_boundaries).map((boundary) => (
                      <li key={boundary}>{boundary}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No claim boundaries recorded yet.</p>
                )}
              </div>
            </section>

            <section className="agent-ops-card rounded-lg border p-4">
              <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Social channel lanes">
                {SOCIAL_CONTENT_INTELLIGENCE_CHANNELS.map((channel) => (
                  <button
                    key={channel}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === channel}
                    onClick={() => setActiveTab(channel)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      activeTab === channel
                        ? 'border-radiant-gold/60 bg-radiant-gold/15 text-radiant-gold'
                        : 'border-silicon-slate/70 bg-silicon-slate/20 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {CHANNEL_ICONS[channel]}
                    {CHANNEL_LABELS[channel]}
                    <span className="rounded-full border border-current/30 px-2 py-0.5 text-[10px]">
                      {statusLabel(lanes[channel].status)}
                    </span>
                  </button>
                ))}
              </div>

              <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
                <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{CHANNEL_LABELS[activeTab]} production inputs</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This lane defines what must be reviewed before production. It does not create drafts, render media, upload, schedule, or publish.
                    </p>
                  </div>
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-100">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {statusLabel(activeLane.status)}
                  </span>
                </div>

                <ChannelInputs channel={activeTab} lane={activeLane} insight={insight} />

                <div className="mt-4 rounded-lg border border-silicon-slate/70 bg-background/45 p-3">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Lane decision</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Updates this channel lane only. No draft, render, upload, schedule, or publish action runs here.
                      </p>
                    </div>
                    {laneNotice ? (
                      <span className="inline-flex w-fit rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                        {laneNotice}
                      </span>
                    ) : null}
                  </div>
                  <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Decision note
                    <textarea
                      value={decisionNote}
                      onChange={(event) => setDecisionNote(event.target.value)}
                      rows={3}
                      placeholder="What should Shaka or the production agent change before this lane moves forward?"
                      className="mt-2 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                    />
                  </label>
                  <div className="mt-3 flex flex-col gap-2 md:flex-row md:justify-end">
                    <button
                      type="button"
                      onClick={() => updateLane('in_review')}
                      disabled={savingLane !== null}
                      className="agent-ops-button-secondary disabled:opacity-60"
                    >
                      <AlertCircle size={16} />
                      {savingLane === 'in_review' ? 'Updating...' : 'Return to Review'}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateLane('blocked')}
                      disabled={savingLane !== null}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/45 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/15 disabled:opacity-60"
                    >
                      <XCircle size={16} />
                      {savingLane === 'blocked' ? 'Rejecting...' : activeLane.status === 'blocked' ? 'Rejected' : 'Reject Lane'}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateLane('approved')}
                      disabled={savingLane !== null}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/45 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/15 disabled:opacity-60"
                    >
                      <CheckCircle2 size={16} />
                      {savingLane === 'approved' ? 'Approving...' : activeLane.status === 'approved' ? 'Approved' : 'Approve Lane'}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 px-4 py-12 text-center text-sm text-muted-foreground">
            Insight not found.
          </div>
        )}
      </div>
    </div>
  )
}

function InsightField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-6">{value || 'Not recorded yet'}</p>
    </div>
  )
}

function ChannelInputs({
  channel,
  lane,
  insight,
}: {
  channel: SocialContentIntelligenceChannel
  lane: ChannelLane
  insight: Record<string, unknown>
}) {
  const requiredInputs = lane.required_inputs?.length ? lane.required_inputs : defaultInputs(channel)
  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2">
        {requiredInputs.map((input) => (
          <div key={input} className="rounded-lg border border-silicon-slate/70 bg-background/40 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{input}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {suggestedValue(input, insight) || 'Pending lane draft'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function defaultInputs(channel: SocialContentIntelligenceChannel) {
  if (channel === 'linkedin') {
    return ['post text', 'CTA', 'CTA URL', 'hashtags', 'carousel or illustration mode', 'screenshot routes', 'references']
  }
  if (channel === 'youtube_shorts') {
    return ['hook', 'first 30 seconds', 'script', 'target duration', 'storyboard scenes', 'b-roll hints/assets', 'on-screen text', 'caption', 'render readiness']
  }
  if (channel === 'instagram_reels') {
    return ['hook', 'script', 'target duration', 'storyboard scenes', 'cover text', 'caption', 'hashtags', 'b-roll assets', 'safe-area notes', 'export readiness']
  }
  return ['source thumbnail reference', 'pattern explanation', 'AmaduTown adaptation direction', 'short thumbnail text', 'face/photo/avatar choice', 'brand colors/style', '2-3 variants', 'approval state']
}

function suggestedValue(input: string, insight: Record<string, unknown>) {
  const lower = input.toLowerCase()
  if (lower.includes('hook')) return asString(insight.suggested_hook)
  if (lower.includes('caption') || lower.includes('post text') || lower.includes('script')) return asString(insight.content_angle)
  if (lower.includes('references')) return asString(insight.evidence_summary)
  if (lower.includes('thumbnail') || lower.includes('pattern')) return 'Use approved public research patterns only; adapt into AmaduTown style.'
  return ''
}
