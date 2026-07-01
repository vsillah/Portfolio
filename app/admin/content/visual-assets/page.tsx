'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Check, CheckCheck, ChevronLeft, ChevronRight, ImageIcon, Loader2, RefreshCw, Search, ShieldAlert, ShieldCheck, Sparkles, X } from 'lucide-react'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCurrentSession } from '@/lib/auth'
import type { VisualAssetCandidate, VisualAssetCandidateState, VisualAssetStatus, VisualAssetTheme } from '@/lib/visual-assets'

const STATUSES: Array<VisualAssetStatus | 'all'> = ['all', 'proposed', 'approved', 'rejected', 'applied', 'failed']
const THEMES: Array<VisualAssetTheme | 'all'> = ['all', 'dark', 'light']
const ENTITY_TYPES = ['all', 'product', 'service', 'prototype'] as const
const CANDIDATE_STATES: Array<VisualAssetCandidateState | 'all'> = ['captured', 'needs_capture', 'all']
const PAGE_SIZES = [6, 12, 24, 48] as const
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'title', label: 'Title A-Z' },
  { value: 'score_desc', label: 'Score high-low' },
  { value: 'score_asc', label: 'Score low-high' },
  { value: 'theme', label: 'Theme' },
] as const

type EntityTypeFilter = (typeof ENTITY_TYPES)[number]
type SortKey = (typeof SORT_OPTIONS)[number]['value']

function labelFor(value: string) {
  return value.replace(/_/g, ' ')
}

function pillClass(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
    active
      ? 'border-radiant-gold/50 bg-radiant-gold/15 text-radiant-gold'
      : 'border-radiant-gold/10 text-muted-foreground hover:border-radiant-gold/30 hover:text-foreground'
  }`
}

function ScoreBadge({ score }: { score: number | null }) {
  const tone = score == null ? 'text-muted-foreground border-muted-foreground/20' : score >= 76 ? 'text-emerald-300 border-emerald-400/30' : score >= 50 ? 'text-amber-300 border-amber-400/30' : 'text-rose-300 border-rose-400/30'
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {score == null ? 'No score' : `${score}/100`}
    </span>
  )
}

function CandidateImage({ url, label }: { url: string | null; label: string }) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-lg border border-radiant-gold/10 bg-background/70">
      {url ? (
        <Image src={url} alt={label} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 420px" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <ImageIcon size={36} />
          <span className="text-xs">No image</span>
        </div>
      )}
    </div>
  )
}

function agentReview(candidate: VisualAssetCandidate): { decision?: string; summary?: string } | null {
  const review = candidate.metadata?.agent_review
  if (!review || typeof review !== 'object' || Array.isArray(review)) return null
  const data = review as Record<string, unknown>
  return {
    decision: typeof data.decision === 'string' ? data.decision : undefined,
    summary: typeof data.summary === 'string' ? data.summary : undefined,
  }
}

function AgentReviewBadge({ candidate }: { candidate: VisualAssetCandidate }) {
  const review = agentReview(candidate)
  if (!review?.decision) return null
  const blocked = review.decision === 'blocked'
  const Icon = blocked ? ShieldAlert : ShieldCheck
  return (
    <span
      title={review.summary}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs uppercase ${
        blocked
          ? 'border-rose-400/25 text-rose-200'
          : 'border-emerald-400/25 text-emerald-200'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      Idia {blocked ? 'blocked' : 'passed'}
    </span>
  )
}

function canApprove(candidate: VisualAssetCandidate) {
  return Boolean(candidate.candidate_url) && candidate.status === 'proposed' && agentReview(candidate)?.decision !== 'blocked'
}

export default function VisualAssetsReviewPage() {
  const [candidates, setCandidates] = useState<VisualAssetCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState<VisualAssetStatus | 'all'>('proposed')
  const [theme, setTheme] = useState<VisualAssetTheme | 'all'>('all')
  const [entityType, setEntityType] = useState<EntityTypeFilter>('all')
  const [candidateState, setCandidateState] = useState<VisualAssetCandidateState | 'all'>('captured')
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [pageSize, setPageSize] = useState<number>(12)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const fetchCandidates = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const params = new URLSearchParams()
      if (status !== 'all') params.set('status', status)
      if (theme !== 'all') params.set('theme', theme)
      if (entityType !== 'all') params.set('entity_type', entityType)
      if (candidateState !== 'all') params.set('candidate_state', candidateState)
      params.set('limit', '250')
      const response = await fetch(`/api/admin/visual-assets/candidates?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await response.json()
      setCandidates(Array.isArray(data.candidates) ? data.candidates : [])
    } finally {
      setLoading(false)
    }
  }, [candidateState, entityType, status, theme])

  useEffect(() => {
    fetchCandidates()
  }, [fetchCandidates])

  useEffect(() => {
    setPage(1)
  }, [candidateState, entityType, pageSize, query, sortKey, status, theme])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter((candidate) => (
      candidate.title.toLowerCase().includes(q) ||
      candidate.entity_type.includes(q) ||
      candidate.reason_codes.some((reason) => reason.includes(q))
    ))
  }, [candidates, query])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortKey === 'title') return a.title.localeCompare(b.title) || a.theme.localeCompare(b.theme)
      if (sortKey === 'score_desc') return (b.score ?? -1) - (a.score ?? -1)
      if (sortKey === 'score_asc') return (a.score ?? 101) - (b.score ?? 101)
      if (sortKey === 'theme') return a.theme.localeCompare(b.theme) || a.title.localeCompare(b.title)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [filtered, sortKey])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [currentPage, pageSize, sorted])

  const groupedPageItems = useMemo(() => {
    const groups: Array<{ key: string; title: string; entityType: string; route: string; items: VisualAssetCandidate[] }> = []
    const byKey = new Map<string, (typeof groups)[number]>()
    for (const candidate of pageItems) {
      const key = `${candidate.entity_type}:${candidate.entity_id}`
      const existing = byKey.get(key)
      if (existing) {
        existing.items.push(candidate)
      } else {
        const group = {
          key,
          title: candidate.title,
          entityType: candidate.entity_type,
          route: candidate.capture_route,
          items: [candidate],
        }
        byKey.set(key, group)
        groups.push(group)
      }
    }
    return groups
  }, [pageItems])

  const capturedCount = candidates.filter((candidate) => candidate.candidate_url).length
  const needsCaptureCount = candidates.length - capturedCount
  const visibleApprovalIds = pageItems.filter(canApprove).map((candidate) => candidate.id)

  const postAction = async (path: string, body: Record<string, unknown> = {}) => {
    const session = await getCurrentSession()
    if (!session) return
    setBusy(path)
    setMessage(null)
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Request failed')
      if (data.applied != null) {
        setMessage(`Applied ${data.applied}; failed ${data.failed}.`)
      } else if (data.captured != null) {
        const passed = typeof data.passed === 'number' ? data.passed : data.captured
        const blocked = typeof data.blocked === 'number' ? data.blocked : 0
        setMessage(`Captured ${data.captured}; Idia passed ${passed} and blocked ${blocked}.`)
      } else if (data.candidatesCreated != null) {
        setMessage(`Audit queued ${data.candidatesCreated} candidate${data.candidatesCreated === 1 ? '' : 's'}.`)
      } else {
        setMessage('Updated.')
      }
      await fetchCandidates()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }

  const approveVisibleCandidates = async () => {
    if (visibleApprovalIds.length === 0) return
    const session = await getCurrentSession()
    if (!session) return
    setBusy('approve-visible')
    setMessage(null)
    try {
      const results = await Promise.allSettled(visibleApprovalIds.map(async (id) => {
        const response = await fetch(`/api/admin/visual-assets/${id}/approve`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || `Failed to approve ${id}`)
        return data
      }))
      const approved = results.filter((result) => result.status === 'fulfilled').length
      const failed = results.length - approved
      setMessage(failed > 0 ? `Approved ${approved}; failed ${failed}.` : `Approved ${approved} visible candidate${approved === 1 ? '' : 's'}.`)
      await fetchCandidates()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <ProtectedRoute requireAdmin>
      <main id="admin-main" className="min-h-screen bg-background px-6 py-8 text-foreground">
        <Breadcrumbs items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Content', href: '/admin/content' },
          { label: 'Visual Assets' },
        ]} />

        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-radiant-gold">Idia</p>
            <h1 className="mt-2 text-3xl font-premium text-foreground">Homepage Visual Assets</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Review theme-specific screenshot candidates for homepage products and services before public images change.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="agent-ops-button-secondary"
              disabled={Boolean(busy)}
              onClick={() => postAction('/api/admin/visual-assets/audit', {})}
            >
              {busy?.includes('/audit') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Audit
            </button>
            <button
              className="agent-ops-button-secondary"
              disabled={Boolean(busy)}
              onClick={() => postAction('/api/admin/visual-assets/capture', {})}
            >
              {busy?.includes('/capture') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Capture Missing
            </button>
            <button
              className="agent-ops-button-secondary"
              disabled={Boolean(busy) || visibleApprovalIds.length === 0}
              onClick={approveVisibleCandidates}
            >
              {busy === 'approve-visible' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              Approve Visible
            </button>
            <button
              className="agent-ops-button-primary"
              disabled={Boolean(busy)}
              onClick={() => postAction('/api/admin/visual-assets/apply-approved', {})}
            >
              {busy?.includes('/apply-approved') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Apply Approved
            </button>
          </div>
        </div>

        <section className="mb-6 rounded-xl border border-radiant-gold/10 bg-silicon-slate/25 p-4">
          <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {CANDIDATE_STATES.map((item) => (
                  <button key={item} className={pillClass(candidateState === item)} onClick={() => setCandidateState(item)}>
                    {labelFor(item)}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
              {STATUSES.map((item) => (
                <button key={item} className={pillClass(status === item)} onClick={() => setStatus(item)}>
                  {labelFor(item)}
                </button>
              ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
              {THEMES.map((item) => (
                <button key={item} className={pillClass(theme === item)} onClick={() => setTheme(item)}>
                  {labelFor(item)}
                </button>
              ))}
              </div>
              <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
              {ENTITY_TYPES.map((item) => (
                <button key={item} className={pillClass(entityType === item)} onClick={() => setEntityType(item)}>
                  {labelFor(item)}
                </button>
              ))}
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_140px_auto] lg:items-center">
            <div className="flex items-center gap-3 rounded-lg border border-radiant-gold/10 bg-background/60 px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, type, or reason"
                className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-radiant-gold/10 bg-background/60 px-3 text-xs uppercase tracking-wide text-muted-foreground">
              Sort
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                className="h-10 flex-1 bg-transparent text-sm normal-case text-foreground outline-none"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-radiant-gold/10 bg-background/60 px-3 text-xs uppercase tracking-wide text-muted-foreground">
              Page
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="h-10 flex-1 bg-transparent text-sm normal-case text-foreground outline-none"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
            <button className="flex h-10 items-center justify-center rounded-lg border border-radiant-gold/10 px-3 text-muted-foreground hover:text-foreground" onClick={fetchCandidates} aria-label="Refresh candidates">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>
              Showing {pageItems.length} of {sorted.length} filtered candidates. Loaded {capturedCount} captured and {needsCaptureCount} waiting for capture in this view.
            </p>
            <p>
              {visibleApprovalIds.length} visible captured candidate{visibleApprovalIds.length === 1 ? '' : 's'} can be approved.
            </p>
          </div>
          {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
        </section>

        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading candidates
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-radiant-gold/10 bg-silicon-slate/20 p-10 text-center text-muted-foreground">
            No candidates match the current filters.
          </div>
        ) : (
          <div className="space-y-4">
            <PaginationControls
              currentPage={currentPage}
              pageCount={pageCount}
              onPrevious={() => setPage((value) => Math.max(1, value - 1))}
              onNext={() => setPage((value) => Math.min(pageCount, value + 1))}
            />

            {groupedPageItems.map((group) => (
              <article key={group.key} className="rounded-xl border border-radiant-gold/10 bg-silicon-slate/25 p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className="rounded-full border border-radiant-gold/20 px-2.5 py-1 text-xs uppercase text-radiant-gold">{group.entityType}</span>
                      <span className="rounded-full border border-muted-foreground/20 px-2.5 py-1 text-xs uppercase text-muted-foreground">{group.items.length} variant{group.items.length === 1 ? '' : 's'}</span>
                    </div>
                    <h2 className="text-lg font-semibold text-foreground">{group.title}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{group.route}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((candidate) => (
                      <ScoreBadge key={candidate.id} score={candidate.score} />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                  {group.items.map((candidate) => (
                    <div key={candidate.id} className="rounded-lg border border-radiant-gold/10 bg-background/35 p-3">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-cyan-400/20 px-2.5 py-1 text-xs uppercase text-cyan-200">{candidate.theme}</span>
                          <span className="rounded-full border border-muted-foreground/20 px-2.5 py-1 text-xs uppercase text-muted-foreground">{candidate.status}</span>
                          <AgentReviewBadge candidate={candidate} />
                          {!candidate.candidate_url && (
                            <span className="rounded-full border border-amber-400/20 px-2.5 py-1 text-xs uppercase text-amber-200">needs capture</span>
                          )}
                        </div>
                        <ScoreBadge score={candidate.score} />
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current</p>
                          <CandidateImage url={candidate.current_url} label={`${candidate.title} current`} />
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Candidate</p>
                          <CandidateImage url={candidate.candidate_url} label={`${candidate.title} candidate`} />
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {candidate.reason_codes.map((reason) => (
                          <span key={reason} className="rounded-full bg-background/70 px-2.5 py-1 text-xs text-muted-foreground">
                            {labelFor(reason)}
                          </span>
                        ))}
                      </div>
                      {agentReview(candidate)?.summary && (
                        <p className="mt-3 rounded-lg border border-radiant-gold/10 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                          {agentReview(candidate)?.summary}
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap justify-end gap-2">
                        <button
                          className="agent-ops-button-secondary"
                          disabled={Boolean(busy) || candidate.status === 'rejected'}
                          onClick={() => postAction(`/api/admin/visual-assets/${candidate.id}/reject`)}
                        >
                          <X className="h-4 w-4" />
                          Reject
                        </button>
                        <button
                          className="agent-ops-button-primary"
                          disabled={Boolean(busy) || !canApprove(candidate)}
                          onClick={() => postAction(`/api/admin/visual-assets/${candidate.id}/approve`)}
                        >
                          <Check className="h-4 w-4" />
                          Approve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}

            <PaginationControls
              currentPage={currentPage}
              pageCount={pageCount}
              onPrevious={() => setPage((value) => Math.max(1, value - 1))}
              onNext={() => setPage((value) => Math.min(pageCount, value + 1))}
            />
          </div>
        )}
      </main>
    </ProtectedRoute>
  )
}

function PaginationControls({
  currentPage,
  pageCount,
  onPrevious,
  onNext,
}: {
  currentPage: number
  pageCount: number
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-radiant-gold/10 bg-silicon-slate/20 px-4 py-3">
      <p className="text-sm text-muted-foreground">
        Page {currentPage} of {pageCount}
      </p>
      <div className="flex items-center gap-2">
        <button className="agent-ops-button-secondary" disabled={currentPage <= 1} onClick={onPrevious}>
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
        <button className="agent-ops-button-secondary" disabled={currentPage >= pageCount} onClick={onNext}>
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
