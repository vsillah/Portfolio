'use client'

import Link from 'next/link'
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
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
      const [packetResponse, insightResponse] = await Promise.all([
        authedFetch('/api/admin/social-content/intelligence/research-packets?limit=12'),
        authedFetch('/api/admin/agents/work-items?source_type=social_topic_trigger&limit=12'),
      ])
      const packetBody = await packetResponse.json().catch(() => ({}))
      const insightBody = await insightResponse.json().catch(() => ({}))
      if (!packetResponse.ok) throw new Error(packetBody.error || `Research packets HTTP ${packetResponse.status}`)
      if (!insightResponse.ok) throw new Error(insightBody.error || `Insights HTTP ${insightResponse.status}`)
      setPackets(Array.isArray(packetBody.packets) ? packetBody.packets : [])
      setInsights(Array.isArray(insightBody.work_items) ? insightBody.work_items : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Content Intelligence')
      setPackets([])
      setInsights([])
    } finally {
      setLoading(false)
    }
  }, [authedFetch])

  useEffect(() => {
    load()
  }, [load])

  const strongestPacket = useMemo(() => packets[0] ?? null, [packets])

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
