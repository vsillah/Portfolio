'use client'

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Hash,
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
  draft_packet?: Record<string, unknown> | null
  review_requested_at?: string | null
  required_inputs?: string[]
}

const CHANNEL_LABELS: Record<SocialContentIntelligenceChannel, string> = {
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  youtube_shorts: 'YouTube Shorts',
  instagram_reels: 'Instagram Reels',
  tiktok: 'TikTok',
  x: 'X',
  thumbnail: 'Thumbnail',
}

const CHANNEL_ICONS: Record<SocialContentIntelligenceChannel, ReactNode> = {
  linkedin: <FileText className="h-4 w-4" />,
  youtube: <Youtube className="h-4 w-4" />,
  youtube_shorts: <Youtube className="h-4 w-4" />,
  instagram_reels: <Instagram className="h-4 w-4" />,
  tiktok: <Hash className="h-4 w-4" />,
  x: <MessageSquare className="h-4 w-4" />,
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

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map((item) => asRecord(item)).filter((item) => Object.keys(item).length > 0) : []
}

function hasReviewDraft(lane: ChannelLane) {
  const draftPacket = asRecord(lane.draft_packet)
  const fields = asRecord(draftPacket.fields)
  return Object.keys(fields).length > 0
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
      draft_packet: asRecord(lane.draft_packet),
      review_requested_at: asString(lane.review_requested_at) || null,
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
  const searchParams = useSearchParams()
  const requestedChannel = searchParams.get('channel')
  const [activeTab, setActiveTab] = useState<SocialContentIntelligenceChannel>(
    SOCIAL_CONTENT_INTELLIGENCE_CHANNELS.find(channel => channel === requestedChannel) ?? 'linkedin',
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [decisionNote, setDecisionNote] = useState('')
  const [savingLane, setSavingLane] = useState<SocialChannelLaneStatus | null>(null)
  const [preparingReviewDrafts, setPreparingReviewDrafts] = useState(false)
  const [researchPackets, setResearchPackets] = useState<Record<string, unknown>[] | null>(null)
  const [selectedPacket, setSelectedPacket] = useState('')
  const [researchBusy, setResearchBusy] = useState(false)
  const [researchError, setResearchError] = useState<string | null>(null)
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
  const approvedResearchPatterns = asRecordArray(insight.approved_research_patterns)
  const lanes = useMemo(() => lanesFor(item), [item])
  const activeLane = lanes[activeTab]
  const activeLaneHasReviewDraft = hasReviewDraft(activeLane)
  const activeLaneNeedsReviewDraft = activeTab !== 'thumbnail' && !activeLaneHasReviewDraft
  const canPrepareReviewDrafts = approvedResearchPatterns.length > 0

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

  const loadResearchPatterns = async () => {
    setResearchBusy(true)
    setResearchError(null)
    setSelectedPacket('')
    try {
      const response = await authedFetch('/api/admin/social-content/intelligence/research-packets?status=approved&limit=50')
      const body = await response.json()
      if (!response.ok || body.unavailable) throw new Error(body.error || 'Could not load approved evidence.')
      setResearchPackets(asRecordArray(body.packets).filter((packet) =>
        packet.status === 'approved' && packet.pattern_status === 'usable_framework'
        && asString(packet.source_url) && Object.keys(asRecord(packet.pattern_packet)).length > 0
      ))
    } catch (err) {
      setResearchError(err instanceof Error ? err.message : 'Could not load approved evidence.')
    } finally {
      setResearchBusy(false)
    }
  }

  const linkResearchPattern = async () => {
    setResearchBusy(true)
    setResearchError(null)
    try {
      const response = await authedFetch(`/api/admin/agents/work-items/${id}/research-packets`, {
        method: 'POST',
        body: JSON.stringify({ packet_ids: [selectedPacket], mode: 'link_approved' }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not link approved evidence.')
      setItem(body.work_item)
      setSelectedPacket('')
      setLaneNotice('Approved evidence linked. Prepare channel review drafts next.')
    } catch (err) {
      setResearchError(err instanceof Error ? err.message : 'Could not link approved evidence.')
    } finally {
      setResearchBusy(false)
    }
  }

  const prepareReviewDrafts = useCallback(async () => {
    setError(null)
    setLaneNotice(null)
    setPreparingReviewDrafts(true)
    try {
      const response = await authedFetch(`/api/admin/agents/work-items/${id}/social-channels/prepare-review-drafts`, {
        method: 'POST',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `Review draft HTTP ${response.status}`)
      setItem(body.work_item ?? null)
      setActiveTab('linkedin')
      setLaneNotice('Channel drafts are ready for human review.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prepare channel review drafts')
    } finally {
      setPreparingReviewDrafts(false)
    }
  }, [authedFetch, id])

  return (
    <div className="agent-ops-page min-h-screen min-w-0 break-words p-3 sm:p-5 text-foreground lg:p-7">
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
                disabled={loading || researchBusy || preparingReviewDrafts}
                className="agent-ops-button-secondary disabled:opacity-60"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button
                type="button"
                onClick={prepareReviewDrafts}
                disabled={loading || researchBusy || preparingReviewDrafts || !canPrepareReviewDrafts}
                title={canPrepareReviewDrafts ? undefined : 'Link approved research patterns before preparing channel review drafts.'}
                className="agent-ops-button-primary max-w-full whitespace-normal disabled:opacity-60"
              >
                <FileText size={16} />
                {preparingReviewDrafts ? 'Preparing...' : 'Prepare Channel Review Drafts'}
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
            <section className="agent-ops-card min-w-0 rounded-lg border p-4">
              <h2 className="text-lg font-semibold">Shared evidence</h2>
              {!canPrepareReviewDrafts ? (
                <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                  Link at least one approved research pattern before preparing channel review drafts.
                </div>
              ) : null}
              <div className="mt-4 space-y-3 rounded-lg border border-silicon-slate/70 p-3">
                <h3 className="font-semibold">Link approved evidence</h3>
                <p className="text-sm text-muted-foreground">Choose a reusable framework already approved in Content Intelligence. Linking keeps its source and approval unchanged. Copy remains subject to review.</p>
                <button type="button" onClick={loadResearchPatterns} disabled={researchBusy || preparingReviewDrafts}
                  className="agent-ops-button-secondary max-w-full whitespace-normal disabled:opacity-60">
                  {researchBusy ? 'Working...' : researchPackets === null ? 'Find approved patterns' : 'Refresh approved patterns'}
                </button>
                {researchError ? <p role="alert" className="text-sm text-red-300">{researchError}</p> : null}
                {researchPackets !== null ? researchPackets.length ? (
                  <>
                    <label className="block text-sm">Approved framework
                      <select aria-label="Approved framework" value={selectedPacket} onChange={(event) => setSelectedPacket(event.target.value)} disabled={researchBusy || preparingReviewDrafts}
                        className="mt-2 block w-full min-w-0 rounded border border-silicon-slate bg-background p-2 text-sm">
                        <option value="">Select a pattern</option>
                        {researchPackets.map((packet) => <option key={asString(packet.id)} value={asString(packet.id)}>{asString(packet.title) || asString(packet.source_url)}</option>)}
                      </select>
                    </label>
                    {selectedPacket ? <ResearchPatternCard pattern={researchPackets.find((packet) => packet.id === selectedPacket) ?? {}} /> : null}
                    <button type="button" onClick={linkResearchPattern} disabled={!selectedPacket || researchBusy || preparingReviewDrafts}
                      className="agent-ops-button-secondary max-w-full whitespace-normal disabled:opacity-60">Link selected pattern</button>
                  </>
                ) : <p className="text-sm text-muted-foreground">No eligible approved frameworks found. Review research evidence in Content Intelligence, then return here and refresh.</p> : null}
                <Link href="/admin/agents/content-intelligence?section=research" className="block text-sm text-blue-200 underline">Review evidence in Content Intelligence</Link>
              </div>
              {asString(metadata.calendar_item_id) ? (
                <div className="mt-4 space-y-2 text-sm">
                  <p>Campaign: {asString(metadata.campaign_name) || asString(metadata.campaign_id)}</p>
                  <Link className="block text-blue-200 underline" href={`/admin/agents/content-intelligence?section=calendar&calendar_item=${encodeURIComponent(asString(metadata.calendar_item_id))}`}>Open source calendar item</Link>
                  {asString(metadata.social_content_id) ? <Link className="block text-blue-200 underline" href={`/admin/social-content/${encodeURIComponent(asString(metadata.social_content_id))}`}>Open Social Content draft</Link> : null}
                </div>
              ) : null}
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
              <div className="mt-4 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Approved research patterns</p>
                {approvedResearchPatterns.length ? (
                  <div className="mt-3 space-y-3">
                    {approvedResearchPatterns.map((pattern) => (
                      <ResearchPatternCard key={asString(pattern.packet_id) || asString(pattern.source_url)} pattern={pattern} />
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">No public research patterns linked yet.</p>
                )}
              </div>
            </section>

            <section className="agent-ops-card min-w-0 rounded-lg border p-4">
              <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Social channel lanes">
                {SOCIAL_CONTENT_INTELLIGENCE_CHANNELS.map((channel) => (
                  <button
                    key={channel}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === channel}
                    onClick={() => setActiveTab(channel)}
                    className={`inline-flex max-w-full flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
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
                      Review the channel adaptation before approval. This step does not render media, upload, schedule, or publish.
                    </p>
                  </div>
                  <span className="inline-flex w-fit shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-100">
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
                      {activeLaneNeedsReviewDraft ? (
                        <p className="mt-1 text-sm text-amber-100">
                          Prepare channel review drafts before approving this lane.
                        </p>
                      ) : null}
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
                      className="mt-2 w-full rounded-md border border-silicon-slate/70 bg-gray-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 [color-scheme:dark] placeholder:text-slate-500 focus:border-radiant-gold/60 focus:outline-none focus:ring-2 focus:ring-radiant-gold/25"
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
                      disabled={savingLane !== null || activeLaneNeedsReviewDraft}
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

function ResearchPatternCard({ pattern }: { pattern: Record<string, unknown> }) {
  const patternPacket = asRecord(pattern.pattern_packet)
  const title = asString(pattern.title) || asString(pattern.source_url) || 'Research pattern'
  const hook = asString(patternPacket.hook_structure)
  const promise = asString(patternPacket.promise_value)
  const thumbnail = asString(patternPacket.thumbnail_pattern)
  return (
    <article className="min-w-0 break-words rounded-lg border border-silicon-slate/70 bg-background/45 p-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {asString(pattern.platform).replace(/_/g, ' ')} · {asString(pattern.creator_name) || asString(pattern.creator_handle) || 'Creator unknown'}
          </p>
        </div>
        <span className="inline-flex w-fit shrink-0 whitespace-nowrap rounded-full border border-radiant-gold/35 bg-radiant-gold/10 px-2 py-0.5 text-xs text-radiant-gold">
          Outlier {Math.round(Number(pattern.outlier_score ?? 0))}
        </span>
      </div>
      <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
        {hook ? <p>Hook: {hook}</p> : null}
        {promise ? <p>Promise: {promise}</p> : null}
        {thumbnail ? <p>Thumbnail: {thumbnail}</p> : null}
      </div>
      {asString(pattern.source_url) ? (
        <a
          href={asString(pattern.source_url)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-xs text-blue-200 hover:text-blue-100"
        >
          Open source
        </a>
      ) : null}
    </article>
  )
}

function StrategyEvidencePanel({ evidence }: { evidence: Record<string, unknown> }) {
  if (!Object.keys(evidence).length) return null

  const agents = asRecordArray(evidence.agents)
  const surfaces = asRecordArray(evidence.portfolio_surfaces)
  const channelStructure = asRecord(evidence.channel_structure)
  const voiceTranslation = asRecord(evidence.voice_translation)
  const visualReinforcement = asRecord(evidence.visual_reinforcement)

  return (
    <details className="mb-4 rounded-lg border border-radiant-gold/35 bg-radiant-gold/10 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-radiant-gold">
        Agent + Portfolio strategy
      </summary>
      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <div className="rounded-md border border-radiant-gold/20 bg-background/35 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Agents called</p>
          <ul className="mt-2 space-y-2 text-xs leading-5 text-muted-foreground">
            {agents.map((agent) => (
              <li key={`${asString(agent.name)}-${asString(agent.role)}`}>
                <span className="font-semibold text-foreground">{asString(agent.name)}</span>
                {asString(agent.role) ? <span> · {asString(agent.role)}</span> : null}
                {asString(agent.responsibility) ? <span className="block">{asString(agent.responsibility)}</span> : null}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border border-radiant-gold/20 bg-background/35 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Portfolio surfaces</p>
          <ul className="mt-2 space-y-2 text-xs leading-5 text-muted-foreground">
            {surfaces.map((surface) => (
              <li key={`${asString(surface.label)}-${asString(surface.route)}`}>
                <span className="font-semibold text-foreground">{asString(surface.label)}</span>
                {asString(surface.route) ? <span> · {asString(surface.route)}</span> : null}
                {asString(surface.purpose) ? <span className="block">{asString(surface.purpose)}</span> : null}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border border-radiant-gold/20 bg-background/35 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Channel structure</p>
          <p className="mt-2 text-sm font-semibold">{asString(channelStructure.format) || 'Channel-specific structure pending.'}</p>
          <CompactList values={asStringArray(channelStructure.structure)} />
          <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">Success checks</p>
          <CompactList values={asStringArray(channelStructure.success_criteria)} />
        </div>
        <div className="rounded-md border border-radiant-gold/20 bg-background/35 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Vambah voice + visuals</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Source: {asString(voiceTranslation.source) || 'Voice source pending.'}
          </p>
          <CompactList values={asStringArray(voiceTranslation.principles)} />
          <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">Visual reinforcement</p>
          <CompactList values={asStringArray(visualReinforcement.recommended_assets)} />
          {asString(visualReinforcement.illustration_direction) ? (
            <p className="mt-2 rounded border border-radiant-gold/20 bg-background/35 px-2 py-1 text-xs leading-5 text-muted-foreground">
              {asString(visualReinforcement.illustration_direction)}
            </p>
          ) : null}
        </div>
      </div>
    </details>
  )
}

function CompactList({ values }: { values: string[] }) {
  if (!values.length) return null
  return (
    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-muted-foreground">
      {values.map((value) => (
        <li key={value}>{value}</li>
      ))}
    </ul>
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
  const draftPacket = asRecord(lane.draft_packet)
  const fields = asRecord(draftPacket.fields)
  const hasDraftFields = Object.keys(fields).length > 0
  const draftApprovalStatus = asString(draftPacket.approval_status)
  const sharedSource = asRecord(draftPacket.shared_source)
  const sharedSourceTitle = asString(sharedSource.insight_title)
  const orchestrationEvidence = asRecord(draftPacket.orchestration_evidence)
  const sideEffects = asRecord(draftPacket.side_effects)
  const disabledSideEffects = [
    ['provider_generation', 'provider generation'],
    ['upload', 'upload'],
    ['publish', 'publish'],
    ['schedule', 'schedule'],
    ['external_post', 'external post'],
  ]
    .filter(([key]) => sideEffects[key] === false)
    .map(([, label]) => label)
  return (
    <div>
      {hasDraftFields ? (
        <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-blue-100">Review draft packet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Generated from the shared insight and approved research patterns for human approval.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {draftApprovalStatus ? (
                <span className="inline-flex w-fit rounded-full border border-blue-400/35 px-2 py-0.5 text-xs text-blue-100">
                  Packet: {statusLabel(draftApprovalStatus)}
                </span>
              ) : null}
              {asString(draftPacket.generated_at) ? (
                <span className="inline-flex w-fit rounded-full border border-blue-400/35 px-2 py-0.5 text-xs text-blue-100">
                  {new Date(asString(draftPacket.generated_at)).toLocaleString()}
                </span>
              ) : null}
            </div>
          </div>
          {asString(draftPacket.source_use_boundary) ? (
            <p className="mt-3 rounded-md border border-blue-400/20 bg-background/35 px-3 py-2 text-xs leading-5 text-blue-100">
              {asString(draftPacket.source_use_boundary)}
            </p>
          ) : null}
          {sharedSourceTitle ? (
            <p className="mt-2 rounded-md border border-blue-400/20 bg-background/35 px-3 py-2 text-xs leading-5 text-blue-100">
              Shared source: {sharedSourceTitle}
            </p>
          ) : null}
          {disabledSideEffects.length ? (
            <p className="mt-2 rounded-md border border-emerald-400/20 bg-background/35 px-3 py-2 text-xs leading-5 text-emerald-100">
              No side effects authorized: {disabledSideEffects.join(', ')}.
            </p>
          ) : null}
        </div>
      ) : null}

      <StrategyEvidencePanel evidence={orchestrationEvidence} />

      <div className="grid gap-3 md:grid-cols-2">
        {(hasDraftFields ? Object.entries(fields) : requiredInputs.map((input) => [input, suggestedValue(input, insight)] as const))
          .map(([input, value]) => (
            <div key={input} className="rounded-lg border border-silicon-slate/70 bg-background/40 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{formatInputLabel(input)}</p>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">
                <FormattedValue value={hasDraftFields ? value : value || 'Pending lane draft'} />
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

function formatInputLabel(input: string) {
  return input.replace(/_/g, ' ')
}

function FormattedValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    if (!value.length) return <span>Pending</span>
    return (
      <ul className="space-y-1">
        {value.map((item, index) => (
          <li key={`${String(item)}-${index}`}>{String(item)}</li>
        ))}
      </ul>
    )
  }
  if (value && typeof value === 'object') {
    return <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(value, null, 2)}</pre>
  }
  return <span className="whitespace-pre-line">{String(value ?? 'Pending')}</span>
}

function defaultInputs(channel: SocialContentIntelligenceChannel) {
  if (channel === 'linkedin') {
    return ['post text', 'CTA', 'CTA URL', 'hashtags', 'carousel or illustration mode', 'screenshot routes', 'references']
  }
  if (channel === 'youtube') {
    return ['title', 'description', 'opening hook', 'full-video script', 'storyboard beats', 'b-roll plan', 'thumbnail readiness', 'final video URL', 'visibility setting', 'upload readiness']
  }
  if (channel === 'youtube_shorts') {
    return ['hook', 'first 30 seconds', 'script', 'target duration', 'storyboard scenes', 'b-roll hints/assets', 'on-screen text', 'caption', 'render readiness']
  }
  if (channel === 'instagram_reels') {
    return ['hook', 'script', 'target duration', 'storyboard scenes', 'cover text', 'caption', 'hashtags', 'b-roll assets', 'safe-area notes', 'export readiness']
  }
  if (channel === 'tiktok') {
    return ['hook', 'script', 'target duration', 'storyboard scenes', 'cover frame', 'caption', 'hashtags', 'b-roll assets', 'audio rights', 'safe-area notes', 'export readiness']
  }
  if (channel === 'x') {
    return ['post text', 'thread option', 'CTA', 'CTA URL', 'hashtags', 'manual handoff gate', 'references']
  }
  return ['source thumbnail reference', 'pattern explanation', 'AmaduTown, LLC adaptation direction', 'short thumbnail text', 'face/photo/avatar choice', 'brand colors/style', '2-3 variants', 'approval state']
}

function suggestedValue(input: string, insight: Record<string, unknown>) {
  const lower = input.toLowerCase()
  if (lower.includes('hook')) return asString(insight.suggested_hook)
  if (lower.includes('caption') || lower.includes('post text') || lower.includes('script')) return asString(insight.content_angle)
  if (lower.includes('references')) return asString(insight.evidence_summary)
  if (lower.includes('thumbnail') || lower.includes('pattern')) return 'Use approved public research patterns only; adapt into AmaduTown, LLC style.'
  return ''
}
