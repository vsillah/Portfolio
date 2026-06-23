'use client'

import Link from 'next/link'
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Database,
  ExternalLink,
  FileSearch,
  Film,
  Instagram,
  RefreshCw,
  ShieldCheck,
  Youtube,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import type { AgentWorkItem } from '@/lib/agent-work-items'

type ResearchPacket = {
  id: string
  source_url: string
  platform: string
  creator_name: string | null
  creator_handle: string | null
  title: string | null
  caption: string | null
  thumbnail_url: string | null
  hook_transcript: string | null
  outlier_score: number
  pattern_status: string
  retrieved_at: string
  actor_metadata: Record<string, unknown>
  metrics: Record<string, unknown>
}

type EvidenceForm = {
  source_url: string
  platform: string
  title: string
  creator_name: string
  creator_handle: string
  thumbnail_url: string
  hook_transcript: string
  views: string
  likes: string
  comments: string
  follower_count: string
  retrieval_notes: string
}

type DailyDigest = {
  generated_at: string
  lookback_days: number
  summary: {
    new_research_packets: number
    usable_patterns: number
    shaka_insights: number
    blocked_or_sensitive_items: number
  }
  strongest_patterns: Array<{
    packet_id: string
    title: string
    source_url: string
    platform: string
    creator: string | null
    outlier_score: number
    pattern_status: string
    hook_structure: string | null
    promise_value: string | null
    thumbnail_pattern: string | null
  }>
  recommended_insights: Array<{
    work_item_id: string
    title: string
    status: string
    priority: string
    triggering_event: string | null
    why_vambah_can_speak: string | null
    sensitivity: string
  }>
  suggested_channel_lanes: Array<{
    work_item_id: string
    insight_title: string
    channel: string
    label: string
    status: string
    required_inputs: string[]
  }>
  thumbnail_opportunities: Array<{
    packet_id: string
    title: string
    thumbnail_pattern: string | null
  }>
  blocked_or_sensitive_items: Array<{
    type: string
    id: string
    title: string
    reason: string
  }>
  governance: Record<string, string>
  side_effects: Record<string, boolean>
}

const EMPTY_EVIDENCE_FORM: EvidenceForm = {
  source_url: '',
  platform: 'youtube',
  title: '',
  creator_name: '',
  creator_handle: '',
  thumbnail_url: '',
  hook_transcript: '',
  views: '',
  likes: '',
  comments: '',
  follower_count: '',
  retrieval_notes: '',
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function optionalNumber(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function insightFor(item: AgentWorkItem) {
  const metadata = item.metadata ?? {}
  const insight = metadata.insight && typeof metadata.insight === 'object' && !Array.isArray(metadata.insight)
    ? metadata.insight as Record<string, unknown>
    : {}
  return {
    title: stringValue(insight.title) ?? item.title,
    triggeringEvent: stringValue(insight.triggering_event),
    whyVambahCanSpeak: stringValue(insight.why_vambah_can_speak),
    sensitivity: stringValue(insight.sensitivity) ?? 'needs_review',
  }
}

function platformIcon(platform: string) {
  if (platform.includes('youtube')) return <Youtube className="h-4 w-4 text-red-200" />
  if (platform.includes('instagram')) return <Instagram className="h-4 w-4 text-pink-200" />
  return <Film className="h-4 w-4 text-blue-200" />
}

export default function ContentIntelligencePage() {
  return (
    <ProtectedRoute requireAdmin>
      <ContentIntelligenceContent />
    </ProtectedRoute>
  )
}

function ContentIntelligenceContent() {
  const [packets, setPackets] = useState<ResearchPacket[]>([])
  const [insights, setInsights] = useState<AgentWorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [evidenceForm, setEvidenceForm] = useState<EvidenceForm>(EMPTY_EVIDENCE_FORM)
  const [submittingEvidence, setSubmittingEvidence] = useState(false)
  const [evidenceNotice, setEvidenceNotice] = useState<string | null>(null)
  const [selectedPacketId, setSelectedPacketId] = useState('')
  const [selectedInsightId, setSelectedInsightId] = useState('')
  const [linkDecisionNote, setLinkDecisionNote] = useState('')
  const [linkingPattern, setLinkingPattern] = useState(false)
  const [linkNotice, setLinkNotice] = useState<string | null>(null)
  const [digest, setDigest] = useState<DailyDigest | null>(null)

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
      const [packetResponse, insightResponse, digestResponse] = await Promise.all([
        authedFetch('/api/admin/social-content/intelligence/research-packets?limit=12'),
        authedFetch('/api/admin/agents/work-items?source_type=social_topic_trigger&limit=12'),
        authedFetch('/api/admin/social-content/intelligence/daily-digest?lookback_days=5&limit=12'),
      ])
      const packetBody = await packetResponse.json().catch(() => ({}))
      const insightBody = await insightResponse.json().catch(() => ({}))
      const digestBody = await digestResponse.json().catch(() => ({}))
      if (!packetResponse.ok) throw new Error(packetBody.error || `Research packets HTTP ${packetResponse.status}`)
      if (!insightResponse.ok) throw new Error(insightBody.error || `Insights HTTP ${insightResponse.status}`)
      if (!digestResponse.ok) throw new Error(digestBody.error || `Digest HTTP ${digestResponse.status}`)
      setPackets(Array.isArray(packetBody.packets) ? packetBody.packets : [])
      setInsights(Array.isArray(insightBody.work_items) ? insightBody.work_items : [])
      setDigest(digestBody.digest ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Content Intelligence')
      setPackets([])
      setInsights([])
      setDigest(null)
    } finally {
      setLoading(false)
    }
  }, [authedFetch])

  useEffect(() => {
    load()
  }, [load])

  const strongestPacket = useMemo(() => packets[0] ?? null, [packets])

  useEffect(() => {
    setSelectedPacketId((current) => current || packets[0]?.id || '')
  }, [packets])

  useEffect(() => {
    setSelectedInsightId((current) => current || insights[0]?.id || '')
  }, [insights])

  const submitRecordedEvidence = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setEvidenceNotice(null)

    const sourceUrl = evidenceForm.source_url.trim()
    if (!sourceUrl) {
      setError('Source URL is required to store recorded evidence.')
      return
    }

    const metrics = {
      views: optionalNumber(evidenceForm.views),
      likes: optionalNumber(evidenceForm.likes),
      comments: optionalNumber(evidenceForm.comments),
      follower_count: optionalNumber(evidenceForm.follower_count),
    }

    setSubmittingEvidence(true)
    try {
      const response = await authedFetch('/api/admin/social-content/intelligence/research-runs', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'recorded_evidence',
          evidence_items: [
            {
              source_url: sourceUrl,
              platform: evidenceForm.platform,
              creator_name: evidenceForm.creator_name.trim() || null,
              creator_handle: evidenceForm.creator_handle.trim() || null,
              title: evidenceForm.title.trim() || null,
              thumbnail_url: evidenceForm.thumbnail_url.trim() || null,
              hook_transcript: evidenceForm.hook_transcript.trim() || null,
              metrics,
              retrieval_method: 'codex_browser',
              retrieval_notes: evidenceForm.retrieval_notes.trim() || null,
            },
          ],
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `Evidence store HTTP ${response.status}`)
      setEvidenceForm(EMPTY_EVIDENCE_FORM)
      setEvidenceNotice('Recorded public evidence stored.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to store recorded evidence')
    } finally {
      setSubmittingEvidence(false)
    }
  }, [authedFetch, evidenceForm, load])

  const linkResearchPattern = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setLinkNotice(null)

    if (!selectedPacketId || !selectedInsightId) {
      setError('Choose a research packet and Shaka insight before linking a pattern.')
      return
    }

    setLinkingPattern(true)
    try {
      const response = await authedFetch(`/api/admin/agents/work-items/${selectedInsightId}/research-packets`, {
        method: 'POST',
        body: JSON.stringify({
          packet_ids: [selectedPacketId],
          decision_note: linkDecisionNote.trim() || null,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `Pattern link HTTP ${response.status}`)
      setLinkDecisionNote('')
      setLinkNotice('Research pattern linked to Shaka insight.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link research pattern')
    } finally {
      setLinkingPattern(false)
    }
  }, [authedFetch, linkDecisionNote, load, selectedInsightId, selectedPacketId])

  return (
    <div className="agent-ops-page min-h-screen p-5 text-foreground lg:p-7">
      <div className="mx-auto max-w-7xl">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Agent Operations', href: '/admin/agents' },
          { label: 'Content Intelligence' },
        ]} />

        <header className="agent-ops-surface-header mb-6 mt-5 flex flex-col gap-4 rounded-xl border p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="agent-ops-eyebrow mb-2">
              <FileSearch size={16} />
              Content Intelligence
            </div>
            <h1 className="text-3xl font-bold">Research and Shaka insight queue</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Public creator research stays read-only. Shaka insights stay centralized in the Agentic Dashboard backlog, then feed LinkedIn, YouTube Shorts, Instagram Reels, and thumbnail lanes.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="agent-ops-button-secondary disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </header>

        {error ? (
          <div className="mb-6 rounded-lg border border-red-500/35 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <div className="mb-6 grid gap-3 md:grid-cols-4">
          <MetricCard label="Research packets" value={packets.length} />
          <MetricCard label="Shaka insights" value={insights.length} />
          <MetricCard label="Top outlier score" value={strongestPacket ? Math.round(Number(strongestPacket.outlier_score)) : 0} />
          <MetricCard label="Paid scraper runs" value={0} tone="amber" />
        </div>

        <section className="agent-ops-card mb-6 rounded-lg border p-4">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="agent-ops-eyebrow mb-2">
                <CalendarDays size={16} />
                Daily review digest
              </div>
              <h2 className="text-lg font-semibold">What Shaka should review next</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Read-only digest from public research and central backlog items. Activation, drafting, media generation, upload, schedule, and publish gates stay locked.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              <ShieldCheck className="h-3.5 w-3.5" />
              No side effects
            </span>
          </div>
          {digest ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.45fr)]">
              <div className="grid gap-3 md:grid-cols-4">
                <DigestMetric label="New research" value={digest.summary.new_research_packets} />
                <DigestMetric label="Usable patterns" value={digest.summary.usable_patterns} />
                <DigestMetric label="Insights" value={digest.summary.shaka_insights} />
                <DigestMetric label="Blocked/privacy" value={digest.summary.blocked_or_sensitive_items} tone="amber" />
              </div>
              <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Governance</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <DigestPill label="Schedule" value={digest.governance.schedule_activation} />
                  <DigestPill label="Apify" value={digest.governance.apify_collection} />
                  <DigestPill label="Publish" value={digest.governance.publishing} />
                </div>
              </div>
              <DigestList
                title="Strongest patterns"
                empty="No usable patterns in the current lookback."
                items={digest.strongest_patterns.map((pattern) => ({
                  id: pattern.packet_id,
                  title: pattern.title,
                  detail: pattern.hook_structure ?? pattern.promise_value ?? pattern.pattern_status,
                  href: pattern.source_url,
                  meta: `Outlier ${Math.round(Number(pattern.outlier_score))}`,
                }))}
              />
              <DigestList
                title="Recommended insights"
                empty="No Shaka insight backlog items found."
                items={digest.recommended_insights.map((insight) => ({
                  id: insight.work_item_id,
                  title: insight.title,
                  detail: insight.why_vambah_can_speak ?? insight.triggering_event ?? insight.sensitivity,
                  href: `/admin/agents/social-insights/${insight.work_item_id}`,
                  meta: insight.status.replace(/_/g, ' '),
                }))}
              />
              <DigestList
                title="Channel lanes"
                empty="No channel lane suggestions yet."
                items={digest.suggested_channel_lanes.slice(0, 4).map((lane) => ({
                  id: `${lane.work_item_id}-${lane.channel}`,
                  title: `${lane.label}: ${lane.insight_title}`,
                  detail: lane.required_inputs.join(', '),
                  href: `/admin/agents/social-insights/${lane.work_item_id}`,
                  meta: lane.status.replace(/_/g, ' '),
                }))}
              />
              <DigestList
                title="Thumbnail opportunities"
                empty="No thumbnail opportunities in the current lookback."
                items={digest.thumbnail_opportunities.map((item) => ({
                  id: item.packet_id,
                  title: item.title,
                  detail: item.thumbnail_pattern ?? 'Review source thumbnail pattern.',
                  meta: 'thumbnail',
                }))}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 px-4 py-8 text-center text-sm text-muted-foreground">
              {loading ? 'Loading daily digest...' : 'Daily digest is not available yet.'}
            </div>
          )}
        </section>

        <section className="agent-ops-card mb-6 rounded-lg border p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Free-first evidence layer</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Codex/browser review and public manual evidence are the default research path. Paid scrapers are fallback tools only when a scoped source cannot be captured cheaply.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
              <ShieldCheck className="h-3.5 w-3.5" />
              Paid scraper approval required
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ActorCard title="Default" actor="Recorded public evidence from Codex/browser review. Cost: $0." />
            <ActorCard title="YouTube fallback" actor="pintostudio/youtube-transcript-scraper only after cost approval" />
            <ActorCard title="YouTube data fallback" actor="streamers/youtube-scraper only after cost approval" />
            <ActorCard title="Instagram/TikTok fallback" actor="apify/instagram-scraper or clockworks/tiktok-scraper only after cost approval" />
          </div>
          <form onSubmit={submitRecordedEvidence} className="mt-4 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
            <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-sm font-semibold">Add recorded public evidence</h3>
                <p className="mt-1 text-xs text-muted-foreground">Free review packet. No scraper, generation, upload, schedule, or publish action.</p>
              </div>
              {evidenceNotice ? (
                <span className="inline-flex w-fit rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                  {evidenceNotice}
                </span>
              ) : null}
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_12rem]">
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Source URL
                <input
                  required
                  type="url"
                  value={evidenceForm.source_url}
                  onChange={(event) => setEvidenceForm((current) => ({ ...current, source_url: event.target.value }))}
                  placeholder="https://youtube.com/watch?v=..."
                  className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Platform
                <select
                  value={evidenceForm.platform}
                  onChange={(event) => setEvidenceForm((current) => ({ ...current, platform: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                >
                  <option value="youtube">YouTube</option>
                  <option value="youtube_shorts">YouTube Shorts</option>
                  <option value="instagram">Instagram</option>
                  <option value="instagram_reels">Instagram Reels</option>
                  <option value="tiktok">TikTok</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <EvidenceInput label="Title" value={evidenceForm.title} onChange={(value) => setEvidenceForm((current) => ({ ...current, title: value }))} />
              <EvidenceInput label="Creator" value={evidenceForm.creator_name} onChange={(value) => setEvidenceForm((current) => ({ ...current, creator_name: value }))} />
              <EvidenceInput label="Handle" value={evidenceForm.creator_handle} onChange={(value) => setEvidenceForm((current) => ({ ...current, creator_handle: value }))} />
              <EvidenceInput label="Thumbnail URL" value={evidenceForm.thumbnail_url} onChange={(value) => setEvidenceForm((current) => ({ ...current, thumbnail_url: value }))} />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <EvidenceInput label="Views" type="number" value={evidenceForm.views} onChange={(value) => setEvidenceForm((current) => ({ ...current, views: value }))} />
              <EvidenceInput label="Likes" type="number" value={evidenceForm.likes} onChange={(value) => setEvidenceForm((current) => ({ ...current, likes: value }))} />
              <EvidenceInput label="Comments" type="number" value={evidenceForm.comments} onChange={(value) => setEvidenceForm((current) => ({ ...current, comments: value }))} />
              <EvidenceInput label="Followers" type="number" value={evidenceForm.follower_count} onChange={(value) => setEvidenceForm((current) => ({ ...current, follower_count: value }))} />
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <EvidenceTextarea label="Hook or first 30 seconds" value={evidenceForm.hook_transcript} onChange={(value) => setEvidenceForm((current) => ({ ...current, hook_transcript: value }))} />
              <EvidenceTextarea label="Notes" value={evidenceForm.retrieval_notes} onChange={(value) => setEvidenceForm((current) => ({ ...current, retrieval_notes: value }))} />
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={submittingEvidence}
                className="agent-ops-button-primary disabled:opacity-60"
              >
                <FileSearch size={16} />
                {submittingEvidence ? 'Storing...' : 'Store Evidence Packet'}
              </button>
            </div>
          </form>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.45fr)]">
          <section className="agent-ops-card rounded-lg border p-4">
            <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Public creator research</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Evidence packets preserve source transparency and reusable patterns without copying creator scripts, titles, thumbnails, or visual identity.
                </p>
              </div>
            </div>
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading research packets...</div>
            ) : packets.length ? (
              <div className="space-y-3">
                {insights.length ? (
                  <form onSubmit={linkResearchPattern} className="rounded-lg border border-radiant-gold/35 bg-radiant-gold/10 p-3">
                    <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-radiant-gold">Link pattern to Shaka insight</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Adds the reusable pattern to the central backlog item. No draft, media, upload, schedule, or publish action runs.
                        </p>
                      </div>
                      {linkNotice ? (
                        <span className="inline-flex w-fit rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                          {linkNotice}
                        </span>
                      ) : null}
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Research packet
                        <select
                          value={selectedPacketId}
                          onChange={(event) => setSelectedPacketId(event.target.value)}
                          className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                        >
                          {packets.map((packet) => (
                            <option key={packet.id} value={packet.id}>
                              {(packet.title ?? packet.creator_name ?? packet.source_url).slice(0, 90)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Shaka insight
                        <select
                          value={selectedInsightId}
                          onChange={(event) => setSelectedInsightId(event.target.value)}
                          className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                        >
                          {insights.map((item) => (
                            <option key={item.id} value={item.id}>
                              {insightFor(item).title.slice(0, 90)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Decision note
                      <textarea
                        value={linkDecisionNote}
                        onChange={(event) => setLinkDecisionNote(event.target.value)}
                        rows={2}
                        placeholder="Why this source pattern is safe and useful for this insight."
                        className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                      />
                    </label>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="submit"
                        disabled={linkingPattern}
                        className="agent-ops-button-primary disabled:opacity-60"
                      >
                        <CheckCircle2 size={16} />
                        {linkingPattern ? 'Linking...' : 'Link Pattern'}
                      </button>
                    </div>
                  </form>
                ) : null}
                {packets.map((packet) => (
                  <article key={packet.id} className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-blue-100">
                            {platformIcon(packet.platform)}
                            {packet.platform.replace(/_/g, ' ')}
                          </span>
                          <span>{packet.creator_name ?? packet.creator_handle ?? 'Creator unknown'}</span>
                          <span>{new Date(packet.retrieved_at).toLocaleString()}</span>
                        </div>
                        <h3 className="font-semibold">{packet.title ?? packet.caption ?? packet.source_url}</h3>
                        {packet.hook_transcript ? (
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            Hook: {packet.hook_transcript}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <SourceMetric label="views" value={numberValue(packet.metrics.views)} />
                          <SourceMetric label="likes" value={numberValue(packet.metrics.likes)} />
                          <SourceMetric label="comments" value={numberValue(packet.metrics.comments)} />
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2 text-right">
                        <span className="inline-flex justify-center rounded-full border border-radiant-gold/40 bg-radiant-gold/10 px-3 py-1 text-xs font-semibold text-radiant-gold">
                          Outlier {Math.round(Number(packet.outlier_score))}
                        </span>
                        <span className="rounded-full border border-silicon-slate/70 px-3 py-1 text-xs text-muted-foreground">
                          {packet.pattern_status.replace(/_/g, ' ')}
                        </span>
                        <a
                          href={packet.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-1 text-xs text-blue-200 hover:text-blue-100"
                        >
                          Source <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 px-4 py-12 text-center text-sm text-muted-foreground">
                No research packets have been stored yet. Store free recorded public evidence first; use paid scrapers only after explicit approval.
              </div>
            )}
          </section>

          <section className="agent-ops-card rounded-lg border p-4">
            <h2 className="text-lg font-semibold">Shaka insight backlog</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              These are central Agentic Dashboard work items. Social Content pages filter this same backlog.
            </p>
            <div className="mt-4 space-y-3">
              {insights.length ? insights.map((item) => {
                const insight = insightFor(item)
                return (
                  <Link
                    key={item.id}
                    href={`/admin/agents/social-insights/${item.id}`}
                    className="block rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-3 transition hover:border-radiant-gold/45"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{insight.title}</p>
                        {insight.triggeringEvent ? (
                          <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{insight.triggeringEvent}</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-100">
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {insight.whyVambahCanSpeak ? (
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Why now: {insight.whyVambahCanSpeak}
                      </p>
                    ) : null}
                  </Link>
                )
              }) : (
                <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 px-4 py-10 text-center text-sm text-muted-foreground">
                  No Shaka insight work items found.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'amber' }) {
  return (
    <div className={`rounded-lg border p-4 ${tone === 'amber' ? 'border-amber-500/30 bg-amber-500/10' : 'border-silicon-slate/70 bg-silicon-slate/20'}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function DigestMetric({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'amber' }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === 'amber' ? 'border-amber-500/30 bg-amber-500/10' : 'border-silicon-slate/70 bg-background/40'}`}>
      <p className="text-[0.68rem] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}

function DigestPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-100">
      {label}: {value.replace(/_/g, ' ')}
    </span>
  )
}

function DigestList({
  title,
  empty,
  items,
}: {
  title: string
  empty: string
  items: Array<{ id: string; title: string; detail: string | null; meta?: string; href?: string }>
}) {
  return (
    <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item) => {
          const body = (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{item.title}</p>
                {item.meta ? (
                  <span className="shrink-0 rounded-full border border-silicon-slate/70 px-2 py-0.5 text-[0.68rem] text-muted-foreground">
                    {item.meta}
                  </span>
                ) : null}
              </div>
              {item.detail ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.detail}</p> : null}
            </>
          )
          return item.href ? (
            <Link key={item.id} href={item.href} className="block rounded-md border border-silicon-slate/60 bg-background/35 p-2 transition hover:border-radiant-gold/45">
              {body}
            </Link>
          ) : (
            <div key={item.id} className="rounded-md border border-silicon-slate/60 bg-background/35 p-2">
              {body}
            </div>
          )
        }) : (
          <p className="rounded-md border border-silicon-slate/60 bg-background/35 p-3 text-xs text-muted-foreground">{empty}</p>
        )}
      </div>
    </div>
  )
}

function ActorCard({ title, actor }: { title: string; actor: string }) {
  return (
    <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Database className="h-4 w-4 text-radiant-gold" />
        {title}
      </div>
      <p className="break-words text-xs leading-5 text-muted-foreground">{actor}</p>
    </div>
  )
}

function EvidenceInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number'
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
      <input
        type={type}
        min={type === 'number' ? 0 : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
      />
    </label>
  )
}

function EvidenceTextarea({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="mt-1 w-full rounded-md border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm normal-case tracking-normal text-foreground"
      />
    </label>
  )
}

function SourceMetric({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-silicon-slate/70 px-2 py-0.5">
      <BarChart3 className="h-3 w-3" />
      {label}: {value.toLocaleString()}
    </span>
  )
}
